#version 330 core
// =============================================================================
// PBR 直接光照 + 完整 IBL（漫反射 + 镜面反射），用于 pbr/ibl_specular.cpp
//
// 环境光 = 漫反射 IBL + 镜面 IBL
//   漫反射：irradianceMap(N) * albedo
//   镜面  ：分裂求和近似（Split-Sum, Epic UE4）
//           ∫ Li * BRDF * cosθ dω ≈ prefilterMap(R, roughness) * (F * A + B)
//           （标准公式里是 F0，这里沿用教程写法，用带粗糙度的 F 代替）
//           第一项：预滤波环境贴图，不同 mip 对应不同粗糙度
//           第二项：BRDF 积分查找表 brdfLUT(NdotV, roughness) -> (A, B)
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

// IBL 预计算结果
uniform samplerCube irradianceMap;  // 漫反射辐照度（32x32）
uniform samplerCube prefilterMap;   // 预滤波环境贴图（128x128，5 级 mip：roughness 0 -> 1）
uniform sampler2D brdfLUT;          // BRDF 积分 LUT（RG = 菲涅尔的缩放 A 与偏移 B）

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
// 带粗糙度的 Fresnel-Schlick（用于环境光）：
// 粗糙表面的掠射角反射不应趋近 1，因此把上限从 1 降为 max(1 - roughness, F0)
vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness)
{
    return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}   
// ----------------------------------------------------------------------------
void main()
{		
    vec3 N = Normal;
    vec3 V = normalize(camPos - WorldPos);
    vec3 R = reflect(-V, N);   // 反射向量，用于采样预滤波贴图

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
    
    // ---------------- 环境光：IBL ----------------
    // 用 N·V 和粗糙度估计环境光的菲涅尔
    vec3 F = fresnelSchlickRoughness(max(dot(N, V), 0.0), F0, roughness);
    
    vec3 kS = F;
    vec3 kD = 1.0 - kS;
    kD *= 1.0 - metallic;	  
    
    // 漫反射 IBL：辐照度贴图已折算 Lambert 的 1/π
    vec3 irradiance = texture(irradianceMap, N).rgb;
    vec3 diffuse      = irradiance * albedo;
    
    // 镜面 IBL（分裂求和）：
    //   1) 按粗糙度选择预滤波贴图的 mip 级别（0..4，共 5 级）
    //   2) 用 (NdotV, roughness) 查 BRDF LUT 得到 (A, B)
    //   3) specular = 预滤波颜色 * (F * A + B)
    const float MAX_REFLECTION_LOD = 4.0;   // = prefilterMap 的 mip 数 - 1
    vec3 prefilteredColor = textureLod(prefilterMap, R,  roughness * MAX_REFLECTION_LOD).rgb;    
    vec2 brdf  = texture(brdfLUT, vec2(max(dot(N, V), 0.0), roughness)).rg;
    vec3 specular = prefilteredColor * (F * brdf.x + brdf.y);

    // 镜面项已含 F，不再乘 kS；ao 只作用于环境光
    vec3 ambient = (kD * diffuse + specular) * ao;
    
    vec3 color = ambient + Lo;

    // Reinhard 色调映射 + Gamma 校正
    color = color / (color + vec3(1.0));
    color = pow(color, vec3(1.0/2.2)); 

    FragColor = vec4(color , 1.0);
}
