#version 330 core
// =============================================================================
// PBR 直接光照 + 漫反射 IBL，用于 pbr/ibl_irradiance.cpp
// 环境光不再是常量，而是从预卷积的辐照度贴图 irradianceMap 中按法线 N 采样。
// 镜面反射 IBL 在 2.2.x 中才加入。
// =============================================================================
out vec4 FragColor;
in vec2 TexCoords;
in vec3 WorldPos;
in vec3 Normal;

// 材质参数
uniform vec3 albedo;
uniform float metallic;
uniform float roughness;
uniform float ao;

// IBL：辐照度立方体贴图（按法线方向存储半球入射光的余弦加权积分，已除以 π）
uniform samplerCube irradianceMap;

// 点光源
uniform vec3 lightPositions[4];
uniform vec3 lightColors[4];

uniform vec3 camPos;

const float PI = 3.14159265359;
// ----------------------------------------------------------------------------
// D：GGX 法线分布函数，D = α² / (π * ((N·H)² * (α² - 1) + 1)²)，α = roughness²
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
// G1：Schlick-GGX，直接光照 k = (roughness + 1)² / 8
float GeometrySchlickGGX(float NdotV, float roughness)
{
    float r = (roughness + 1.0);
    float k = (r*r) / 8.0;

    float nom   = NdotV;
    float denom = NdotV * (1.0 - k) + k;

    return nom / denom;
}
// ----------------------------------------------------------------------------
// G：Smith 法，视线遮挡 * 光线阴影
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
vec3 fresnelSchlick(float cosTheta, vec3 F0)
{
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}
// ----------------------------------------------------------------------------
void main()
{		
    vec3 N = Normal;
    vec3 V = normalize(camPos - WorldPos);
    vec3 R = reflect(-V, N);   // 反射向量（本 shader 未使用）

    // F0：非金属 0.04，金属用 albedo（金属度工作流）
    vec3 F0 = vec3(0.04); 
    F0 = mix(F0, albedo, metallic);

    // ---------------- 直接光照：与 1.1.pbr.fs 相同 ----------------
    vec3 Lo = vec3(0.0);
    for(int i = 0; i < 4; ++i) 
    {
        // 单个光源的入射辐射率（平方反比衰减）
        vec3 L = normalize(lightPositions[i] - WorldPos);
        vec3 H = normalize(V + L);
        float distance = length(lightPositions[i] - WorldPos);
        float attenuation = 1.0 / (distance * distance);
        vec3 radiance = lightColors[i] * attenuation;

        // Cook-Torrance 镜面 BRDF = D * G * F / (4 * NdotV * NdotL)
        // 分母是把微表面（以 H 度量）换算到宏观表面（以 L、V 度量）的校正：
        // 4 来自 H 与 L 的立体角雅可比 dω_h = dω_l / (4 * VdotH)，NdotV/NdotL 来自投影面积
        float NDF = DistributionGGX(N, H, roughness);   
        float G   = GeometrySmith(N, V, L, roughness);    
        vec3 F    = fresnelSchlick(max(dot(H, V), 0.0), F0);        
        
        vec3 numerator    = NDF * G * F;
        float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001; // +0.0001 防止除零
        vec3 specular = numerator / denominator;
        
        // 能量守恒：kS = F，kD = 1 - kS；金属无漫反射
        vec3 kS = F;
        vec3 kD = vec3(1.0) - kS;
        kD *= 1.0 - metallic;	                
            
        float NdotL = max(dot(N, L), 0.0);        

        // specular 中已含 F(=kS)，因此不再乘 kS
        Lo += (kD * albedo / PI + specular) * radiance * NdotL;
    }   
    
    // ---------------- 环境光：漫反射 IBL ----------------
    // 环境光来自整个半球，没有单一的 H，因此用 N·V 计算菲涅尔来估计 kS
    vec3 kS = fresnelSchlick(max(dot(N, V), 0.0), F0);
    vec3 kD = 1.0 - kS;
    kD *= 1.0 - metallic;	  
    // 辐照度贴图在预计算时已把 Lambert 的 1/π 折算进去（见 irradiance_convolution.fs），
    // 所以这里直接 irradiance * albedo，无需再除以 π
    vec3 irradiance = texture(irradianceMap, N).rgb;
    vec3 diffuse      = irradiance * albedo;
    vec3 ambient = (kD * diffuse) * ao;
    // vec3 ambient = vec3(0.002);
    
    vec3 color = ambient + Lo;

    // Reinhard 色调映射 + Gamma 校正
    color = color / (color + vec3(1.0));
    color = pow(color, vec3(1.0/2.2)); 

    FragColor = vec4(color , 1.0);
}
