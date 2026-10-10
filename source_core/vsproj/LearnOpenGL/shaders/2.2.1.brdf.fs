#version 330 core
// =============================================================================
// 镜面 IBL 第二部分：BRDF 积分查找表（Split-Sum 的 "BRDF 积分" 项）
// 与环境无关，只依赖 (NdotV, roughness)，输出到 512x512 的 RG16F 纹理：
//   ∫ BRDF * cosθ dω = F0 * A + B
//   R 通道 = A（F0 的缩放），G 通道 = B（偏移）
// 绘制全屏四边形：TexCoords.x 作为 NdotV，TexCoords.y 作为 roughness。
// =============================================================================
out vec2 FragColor;
in vec2 TexCoords;

const float PI = 3.14159265359;
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
// GGX 重要性采样：把均匀随机数 Xi 映射为按 GGX 分布的半程向量 H
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
// G1：Schlick-GGX；注意 IBL 使用 k = roughness² / 2（直接光照是 (r+1)² / 8）
float GeometrySchlickGGX(float NdotV, float roughness)
{
    float a = roughness;
    float k = (a * a) / 2.0;

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
// 蒙特卡洛积分镜面 BRDF，返回 (A, B)
// 令 Fc = (1 - VdotH)^5，把 Schlick 菲涅尔 F = F0 + (1 - F0) * Fc 改写为
// F = F0 * (1 - Fc) + Fc，于是 F0 可提到积分外：∫ = F0 * A + B
vec2 IntegrateBRDF(float NdotV, float roughness)
{
    // BRDF 各向同性，只需 N·V；固定 N = +Z，把 V 放在 xz 平面
    vec3 V;
    V.x = sqrt(1.0 - NdotV*NdotV);   // sinθ
    V.y = 0.0;
    V.z = NdotV;                     // cosθ

    float A = 0.0;
    float B = 0.0; 

    vec3 N = vec3(0.0, 0.0, 1.0);
    
    const uint SAMPLE_COUNT = 1024u;
    for(uint i = 0u; i < SAMPLE_COUNT; ++i)
    {
        // GGX 重要性采样得到 H，反射 V 得到 L
        vec2 Xi = Hammersley(i, SAMPLE_COUNT);
        vec3 H = ImportanceSampleGGX(Xi, N, roughness);
        vec3 L = normalize(2.0 * dot(V, H) * H - V);

        // N = +Z，点积直接取 z 分量
        float NdotL = max(L.z, 0.0);
        float NdotH = max(H.z, 0.0);
        float VdotH = max(dot(V, H), 0.0);

        if(NdotL > 0.0)
        {
            // 估计量 = BRDF * NdotL / pdf，其中 pdf = D * NdotH / (4 * VdotH)
            // D 被约掉，化简为 G * VdotH / (NdotH * NdotV)（不含 F）
            float G = GeometrySmith(N, V, L, roughness);
            float G_Vis = (G * VdotH) / (NdotH * NdotV);
            float Fc = pow(1.0 - VdotH, 5.0);

            A += (1.0 - Fc) * G_Vis;   // 乘 F0 的部分
            B += Fc * G_Vis;           // 常数偏移部分
        }
    }
    A /= float(SAMPLE_COUNT);
    B /= float(SAMPLE_COUNT);
    return vec2(A, B);
}
// ----------------------------------------------------------------------------
void main() 
{
    // x 轴 = NdotV，y 轴 = roughness
    vec2 integratedBRDF = IntegrateBRDF(TexCoords.x, TexCoords.y);
    FragColor = integratedBRDF;
}
