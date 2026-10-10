#version 330 core
// =============================================================================
// 镜面 IBL 第一部分：预滤波环境贴图（Split-Sum 的 "光照积分" 项）
// 对每个方向 N、每个粗糙度（对应一个 mip 级别），用 GGX 重要性采样
// 对环境贴图做卷积，得到"该粗糙度下沿 R 方向看到的模糊反射"。
// 采用准蒙特卡洛：Hammersley 低差异序列 + GGX 重要性采样。
// =============================================================================
out vec4 FragColor;
in vec3 WorldPos;   // 立方体局部坐标，归一化后作为 N

uniform samplerCube environmentMap;   // 源环境贴图（512x512，已生成 mipmap）
uniform float roughness;              // 当前 mip 对应的粗糙度 = mip / (maxMipLevels - 1)

const float PI = 3.14159265359;
// ----------------------------------------------------------------------------
// D：GGX 法线分布函数（用于计算采样 pdf）
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
// Van der Corpus 序列：把 32 位整数按位反转后除以 2^32，得到 [0,1) 的低差异数
// 参考 http://holger.dammertz.org/stuff/notes_HammersleyOnHemisphere.html
float RadicalInverse_VdC(uint bits) 
{
     // 分治法反转 32 位：先交换高低 16 位，再依次交换 8/4/2/1 位分组
     bits = (bits << 16u) | (bits >> 16u);
     bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
     bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
     bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
     bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
     return float(bits) * 2.3283064365386963e-10; // 即 / 0x100000000
}
// ----------------------------------------------------------------------------
// Hammersley 点集：第 i 个（共 N 个）二维低差异采样点 (i/N, VdC(i))
vec2 Hammersley(uint i, uint N)
{
	return vec2(float(i)/float(N), RadicalInverse_VdC(i));
}
// ----------------------------------------------------------------------------
// GGX 重要性采样：把均匀随机数 Xi 映射为按 GGX 分布的半程向量 H（世界空间）
// 采样会集中在 N 附近的"镜面瓣"内，粗糙度越大分布越散
vec3 ImportanceSampleGGX(vec2 Xi, vec3 N, float roughness)
{
	float a = roughness*roughness;
	
	// GGX 分布的逆 CDF：Xi.x -> 方位角 φ，Xi.y -> 天顶角 θ
	// 按 pdf(H) = D(H) * cosθ 采样：φ 均匀分布；对 θ 的边缘 CDF 求逆得
	//   cos²θ = (1 - ξ) / (1 + (α² - 1) * ξ)，α 越小 θ 越集中在 0 附近（高光越锐利）
	float phi = 2.0 * PI * Xi.x;
	float cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a*a - 1.0) * Xi.y));
	float sinTheta = sqrt(1.0 - cosTheta*cosTheta);
	
	// 球坐标 -> 切线空间笛卡尔坐标（半程向量）
	vec3 H;
	H.x = cos(phi) * sinTheta;
	H.y = sin(phi) * sinTheta;
	H.z = cosTheta;
	
	// 以 N 为 z 轴构建 TBN，把 H 转到世界空间（N 接近 z 轴时换参考向量避免叉乘退化）
	vec3 up          = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
	vec3 tangent   = normalize(cross(up, N));
	vec3 bitangent = cross(N, tangent);
	
	vec3 sampleVec = tangent * H.x + bitangent * H.y + N * H.z;
	return normalize(sampleVec);
}
// ----------------------------------------------------------------------------
void main()
{		
    vec3 N = normalize(WorldPos);
    
    // Split-Sum 的简化假设：视线方向 V = 反射方向 R = 法线 N
    // （代价是掠射角下丢失拉长的反射形状）
    vec3 R = N;
    vec3 V = R;

    const uint SAMPLE_COUNT = 1024u;
    vec3 prefilteredColor = vec3(0.0);
    float totalWeight = 0.0;
    
    for(uint i = 0u; i < SAMPLE_COUNT; ++i)
    {
        // 生成按 GGX 分布的 H，再把 V 关于 H 反射得到入射光方向 L
        vec2 Xi = Hammersley(i, SAMPLE_COUNT);
        vec3 H = ImportanceSampleGGX(Xi, N, roughness);
        vec3 L  = normalize(2.0 * dot(V, H) * H - V);

        float NdotL = max(dot(N, L), 0.0);
        if(NdotL > 0.0)
        {
            // 根据 pdf 选择源贴图的 mip 级别，抑制高亮区域的"亮点"噪声：
            //   pdf(L)   = D * NdotH / (4 * HdotV)
            //   saTexel  = mip0 上单个纹素对应的立体角
            //   saSample = 单个采样代表的立体角 = 1 / (N * pdf)
            //   mip      = 0.5 * log2(saSample / saTexel)（每升一级 mip，纹素立体角 ×4）
            float D   = DistributionGGX(N, H, roughness);
            float NdotH = max(dot(N, H), 0.0);
            float HdotV = max(dot(H, V), 0.0);
            float pdf = D * NdotH / (4.0 * HdotV) + 0.0001; 

            float resolution = 512.0; // 源立方体贴图单面分辨率，需与 envCubemap 一致
            float saTexel  = 4.0 * PI / (6.0 * resolution * resolution);
            float saSample = 1.0 / (float(SAMPLE_COUNT) * pdf + 0.0001);

            float mipLevel = roughness == 0.0 ? 0.0 : 0.5 * log2(saSample / saTexel); 
            
            // 按 NdotL 加权累加（Epic 的经验做法，比均匀权重效果更好）
            prefilteredColor += textureLod(environmentMap, L, mipLevel).rgb * NdotL;
            totalWeight      += NdotL;
        }
    }

    prefilteredColor = prefilteredColor / totalWeight;

    FragColor = vec4(prefilteredColor, 1.0);
}
