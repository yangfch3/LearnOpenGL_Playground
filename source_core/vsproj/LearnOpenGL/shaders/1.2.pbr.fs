#version 330 core
// =============================================================================
// PBR 直接光照（贴图版）：材质参数全部从贴图采样，用于 pbr/lighting_textured.cpp
// 与 1.1.pbr.fs 的区别：
//   1. albedo / metallic / roughness / ao 来自纹理
//   2. 法线来自法线贴图，用屏幕空间导数现场构建 TBN（无需顶点切线）
// =============================================================================
out vec4 FragColor;
in vec2 TexCoords;
in vec3 WorldPos;   // 世界空间片元位置
in vec3 Normal;     // 世界空间几何法线

// 材质贴图
uniform sampler2D albedoMap;     // sRGB 存储，使用前需转换到线性空间
uniform sampler2D normalMap;     // 切线空间法线
uniform sampler2D metallicMap;   // 取 r 通道
uniform sampler2D roughnessMap;  // 取 r 通道
uniform sampler2D aoMap;         // 取 r 通道

// 点光源
uniform vec3 lightPositions[4];
uniform vec3 lightColors[4];

uniform vec3 camPos;

const float PI = 3.14159265359;
// ----------------------------------------------------------------------------
// 把法线贴图中的切线空间法线变换到世界空间。
// 利用 dFdx/dFdy 求出相邻像素间 WorldPos 与 UV 的变化量，
// 由 "ΔPos = T * Δu + B * Δv" 反解出切线 T，再与 N 叉乘得到 B。
// 写法简洁但有额外开销，正式项目一般用顶点属性传入切线。
vec3 getNormalFromMap()
{
    vec3 tangentNormal = texture(normalMap, TexCoords).xyz * 2.0 - 1.0;  // [0,1] -> [-1,1]

    vec3 Q1  = dFdx(WorldPos);    // 屏幕 x 方向的位置变化
    vec3 Q2  = dFdy(WorldPos);    // 屏幕 y 方向的位置变化
    vec2 st1 = dFdx(TexCoords);   // 屏幕 x 方向的 UV 变化
    vec2 st2 = dFdy(TexCoords);   // 屏幕 y 方向的 UV 变化

    vec3 N   = normalize(Normal);
    vec3 T  = normalize(Q1*st2.t - Q2*st1.t);   // 沿 u 增大的方向
    vec3 B  = -normalize(cross(N, T));
    mat3 TBN = mat3(T, B, N);

    return normalize(TBN * tangentNormal);
}
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
    // 从贴图读取材质；albedo 由 sRGB 转回线性空间（pow 2.2）
    vec3 albedo     = pow(texture(albedoMap, TexCoords).rgb, vec3(2.2));
    float metallic  = texture(metallicMap, TexCoords).r;
    float roughness = texture(roughnessMap, TexCoords).r;
    float ao        = texture(aoMap, TexCoords).r;

    vec3 N = getNormalFromMap();
    vec3 V = normalize(camPos - WorldPos);

    // F0：非金属 0.04，金属用 albedo（金属度工作流）
    vec3 F0 = vec3(0.04); 
    F0 = mix(F0, albedo, metallic);

    // 反射方程：累加每个光源的出射辐射率
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
    
    // 常量环境光占位（IBL 章节会替换）
    vec3 ambient = vec3(0.03) * albedo * ao;
    
    vec3 color = ambient + Lo;

    // Reinhard 色调映射 + Gamma 校正
    color = color / (color + vec3(1.0));
    color = pow(color, vec3(1.0/2.2)); 

    FragColor = vec4(color, 1.0);
}
