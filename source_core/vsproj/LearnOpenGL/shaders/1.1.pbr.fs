#version 330 core
// =============================================================================
// PBR 直接光照（无 IBL）：Cook-Torrance BRDF + 4 个点光源
// 材质参数由 uniform 统一给出，用于 pbr/lighting.cpp
//
// 反射方程（对每个光源求和）：
//   Lo = Σ ( kD * albedo / π  +  D * G * F / (4 * NdotV * NdotL) ) * Li * NdotL
//          \___ 漫反射 ___/     \__________ 镜面反射 __________/
// =============================================================================
out vec4 FragColor;
in vec2 TexCoords;
in vec3 WorldPos;   // 世界空间片元位置
in vec3 Normal;     // 世界空间法线（已乘 normalMatrix）

// 材质参数
uniform vec3 albedo;      // 基础色（线性空间）
uniform float metallic;   // 金属度 [0,1]
uniform float roughness;  // 粗糙度 [0,1]
uniform float ao;         // 环境光遮蔽

// 点光源
uniform vec3 lightPositions[4];
uniform vec3 lightColors[4];   // HDR 强度（如 300），会被平方反比衰减

uniform vec3 camPos;

const float PI = 3.14159265359;
// ----------------------------------------------------------------------------
// D：GGX (Trowbridge-Reitz) 法线分布函数
// 微表面法线与半程向量 H 对齐的比例；越粗糙，高光越宽越暗
//   D = α² / (π * ((N·H)² * (α² - 1) + 1)²)，α = roughness²（Disney/UE 的重映射）
float DistributionGGX(vec3 N, vec3 H, float roughness)
{
    float a = roughness*roughness;
    float a2 = a*a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH*NdotH;

    float nom   = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;

    return nom / denom;
}
// ----------------------------------------------------------------------------
// G1：Schlick-GGX 单方向几何遮蔽
//   G1 = NdotX / (NdotX * (1 - k) + k)
// 直接光照使用 k = (roughness + 1)² / 8（IBL 中则用 k = roughness² / 2）
float GeometrySchlickGGX(float NdotV, float roughness)
{
    float r = (roughness + 1.0);
    float k = (r*r) / 8.0;

    float nom   = NdotV;
    float denom = NdotV * (1.0 - k) + k;

    return nom / denom;
}
// ----------------------------------------------------------------------------
// G：Smith 法，G = G1(视线方向, 遮挡 masking) * G1(光线方向, 阴影 shadowing)
float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness)
{
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx2 = GeometrySchlickGGX(NdotV, roughness);
    float ggx1 = GeometrySchlickGGX(NdotL, roughness);

    return ggx1 * ggx2;
}
// ----------------------------------------------------------------------------
// F：Fresnel-Schlick 近似，F = F0 + (1 - F0) * (1 - cosθ)^5
// cosθ 取 H·V；越接近掠射角，反射率越趋近 1
vec3 fresnelSchlick(float cosTheta, vec3 F0)
{
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}
// ----------------------------------------------------------------------------
void main()
{		
    vec3 N = normalize(Normal);
    vec3 V = normalize(camPos - WorldPos);   // 片元 -> 相机

    // 垂直入射时的基础反射率 F0（金属度工作流）：
    // 非金属统一近似为 0.04，金属则直接使用 albedo 作为 F0（有色反射）
    vec3 F0 = vec3(0.04); 
    F0 = mix(F0, albedo, metallic);

    // 反射方程：累加每个光源的出射辐射率
    vec3 Lo = vec3(0.0);
    for(int i = 0; i < 4; ++i) 
    {
        // 单个光源的入射辐射率 Li（平方反比衰减）
        vec3 L = normalize(lightPositions[i] - WorldPos);
        vec3 H = normalize(V + L);                         // 半程向量
        float distance = length(lightPositions[i] - WorldPos);
        float attenuation = 1.0 / (distance * distance);
        vec3 radiance = lightColors[i] * attenuation;

        // Cook-Torrance 镜面 BRDF = D * G * F / (4 * NdotV * NdotL)
        // 分母是把微表面（以 H 度量）换算到宏观表面（以 L、V 度量）的校正：
        // 4 来自 H 与 L 的立体角雅可比 dω_h = dω_l / (4 * VdotH)，NdotV/NdotL 来自投影面积
        float NDF = DistributionGGX(N, H, roughness);   
        float G   = GeometrySmith(N, V, L, roughness);      
        vec3 F    = fresnelSchlick(clamp(dot(H, V), 0.0, 1.0), F0);
           
        vec3 numerator    = NDF * G * F; 
        float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001; // +0.0001 防止除零
        vec3 specular = numerator / denominator;
        
        // 能量守恒：镜面反射比例 kS 即 F，漫反射比例 kD = 1 - kS
        vec3 kS = F;
        vec3 kD = vec3(1.0) - kS;
        // 金属没有漫反射（折射光全部被吸收），按 (1 - metallic) 线性削弱
        kD *= 1.0 - metallic;	  

        float NdotL = max(dot(N, L), 0.0);        

        // 漫反射用 Lambert（albedo / π）；specular 中已含 F(=kS)，因此不再乘 kS
        Lo += (kD * albedo / PI + specular) * radiance * NdotL;
    }   
    
    // 常量环境光占位（后续 IBL 章节会替换成环境光照）
    vec3 ambient = vec3(0.03) * albedo * ao;

    vec3 color = ambient + Lo;

    // Reinhard 色调映射：HDR -> [0,1]
    color = color / (color + vec3(1.0));
    // Gamma 校正（线性 -> sRGB）
    color = pow(color, vec3(1.0/2.2)); 

    FragColor = vec4(color, 1.0);
}
