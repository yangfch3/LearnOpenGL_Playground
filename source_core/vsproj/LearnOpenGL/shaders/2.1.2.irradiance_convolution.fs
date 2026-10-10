#version 330 core
// =============================================================================
// 漫反射辐照度卷积：生成 irradianceMap
// 对每个输出方向 N，在以 N 为中心的半球上对环境光做余弦加权积分：
//   E(N) = ∫∫ L(ω) * cosθ * sinθ dθ dφ        （θ∈[0, π/2]，φ∈[0, 2π]）
// 结果存储为 E / π（预先乘上 Lambert BRDF 的 1/π），PBR shader 中直接乘 albedo 即可。
// =============================================================================
out vec4 FragColor;
in vec3 WorldPos;   // 立方体局部坐标，归一化后作为法线 N

uniform samplerCube environmentMap;   // 由 HDR 转换得到的环境立方体贴图

const float PI = 3.14159265359;

void main()
{		
    // WorldPos 方向即"以原点为中心、朝向该方向的表面"的法线 N；
    // 计算出的值就是 PBR shader 中用 N 采样 irradianceMap 时得到的辐照度
    vec3 N = normalize(WorldPos);

    vec3 irradiance = vec3(0.0);   
    
    // 以 N 为 z 轴构建切线空间基 (right, up, N)
    vec3 up    = vec3(0.0, 1.0, 0.0);
    vec3 right = normalize(cross(up, N));
    up         = normalize(cross(N, right));
       
    // 以固定步长对半球做黎曼和（离散积分）
    float sampleDelta = 0.025;
    float nrSamples = 0.0;
    for(float phi = 0.0; phi < 2.0 * PI; phi += sampleDelta)
    {
        for(float theta = 0.0; theta < 0.5 * PI; theta += sampleDelta)
        {
            // 球坐标 -> 切线空间笛卡尔坐标
            vec3 tangentSample = vec3(sin(theta) * cos(phi),  sin(theta) * sin(phi), cos(theta));
            // 切线空间 -> 世界空间
            vec3 sampleVec = tangentSample.x * right + tangentSample.y * up + tangentSample.z * N; 

            // cosθ：Lambert 余弦项；sinθ：立体角微元 dω = sinθ dθ dφ 的雅可比
            irradiance += texture(environmentMap, sampleVec).rgb * cos(theta) * sin(theta);
            nrSamples++;
        }
    }
    // 黎曼和 ≈ (2π * π/2) / nrSamples * Σ = π² / nrSamples * Σ，再乘 1/π 得 π / nrSamples * Σ
    irradiance = PI * irradiance * (1.0 / float(nrSamples));
    
    FragColor = vec4(irradiance, 1.0);
}
