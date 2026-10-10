#version 330 core
// =============================================================================
// 等距柱状投影（equirectangular）HDR 贴图 -> 立方体贴图的某一个面
// 配合 cubemap.vs 渲染单位立方体：每个片元的 WorldPos 就是从原点出发的方向向量，
// 把该方向换算成经纬度 UV，再去 2D HDR 贴图里采样。
// =============================================================================
out vec4 FragColor;
in vec3 WorldPos;   // 立方体局部坐标，归一化后即采样方向

uniform sampler2D equirectangularMap;

// (1/2π, 1/π)：把经度 [-π, π]、纬度 [-π/2, π/2] 缩放到 [-0.5, 0.5]
const vec2 invAtan = vec2(0.1591, 0.3183);
// 方向向量 -> 球面 UV
vec2 SampleSphericalMap(vec3 v)
{
    vec2 uv = vec2(atan(v.z, v.x), asin(v.y));  // (经度 φ, 纬度 θ)
    uv *= invAtan;
    uv += 0.5;                                  // 平移到 [0, 1]
    return uv;
}

void main()
{		
    vec2 uv = SampleSphericalMap(normalize(WorldPos));
    vec3 color = texture(equirectangularMap, uv).rgb;
    
    FragColor = vec4(color, 1.0);   // 保持 HDR 原值，不做色调映射
}
