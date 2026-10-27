#version 460 core
// 须与 extra46.light_culling.comp 一致
#define TILE_SIZE 16
#define MAX_LIGHTS_PER_TILE 256

in vec3 FragPos;
in vec3 Normal;
out vec4 FragColor;

struct PointLight
{
    vec4 posRadius;
    vec4 color;
};
layout (std430, binding = 0) readonly buffer LightBuffer { PointLight lights[]; };
layout (std430, binding = 1) readonly buffer TileLightIndexBuffer { uint tileLightIndices[]; };
layout (std430, binding = 2) readonly buffer TileLightCountBuffer { uint tileLightCounts[]; };

uniform vec3 viewPos;
uniform vec3 albedo;
uniform uint numTilesX;
uniform uint lightCount;
// 0 分块（Forward+）/ 1 遍历全部光源（传统 forward）/ 2 分块 + 热力图
uniform int mode;

vec3 shadePointLight(PointLight light, vec3 N, vec3 V)
{
    vec3 L = light.posRadius.xyz - FragPos;
    float dist = length(L);
    float radius = light.posRadius.w;
    if (dist >= radius)
        return vec3(0.0);
    L /= dist;

    // 窗函数衰减：在 radius 处平滑降到 0。
    // 剔除的前提是「半径外贡献为 0」，若用教程的 1/(c+l*d+q*d^2) 衰减，半径外仍有微弱光，剔除会产生可见边界
    float falloff = clamp(1.0 - (dist * dist) / (radius * radius), 0.0, 1.0);
    falloff *= falloff;

    float diff = max(dot(N, L), 0.0);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 32.0) * 0.3;
    return light.color.rgb * (diff * albedo + spec) * falloff;
}

void main()
{
    vec3 N = normalize(Normal);
    vec3 V = normalize(viewPos - FragPos);
    vec3 color = 0.02 * albedo;

    // 当前像素所在 tile；gl_FragCoord 原点在左下，与 compute 端 tile 编号方式一致
    uvec2 tile = uvec2(gl_FragCoord.xy) / TILE_SIZE;
    uint tileIndex = tile.y * numTilesX + tile.x;
    uint count = tileLightCounts[tileIndex];

    if (mode == 1)
    {
        for (uint i = 0; i < lightCount; ++i)
            color += shadePointLight(lights[i], N, V);
    }
    else
    {
        for (uint i = 0; i < count; ++i)
            color += shadePointLight(lights[tileLightIndices[tileIndex * MAX_LIGHTS_PER_TILE + i]], N, V);
    }

    // 上千盏灯叠加远超 1.0：Reinhard 色调映射 + gamma
    color = color / (color + 1.0);
    color = pow(color, vec3(1.0 / 2.2));

    // 热力图：蓝 = 灯少，红 = 灯多（>= 64）。物体边缘、远处大片地面的 tile 通常更红：
    // tile 内深度跨度越大，视锥越长，包含的灯越多（所谓深度不连续问题，Clustered 在深度方向再切分来缓解）
    if (mode == 2)
    {
        vec3 heat = count == 0u ? vec3(0.0) : mix(vec3(0.0, 0.2, 1.0), vec3(1.0, 0.0, 0.0), clamp(float(count) / 64.0, 0.0, 1.0));
        color = mix(color, heat, 0.6);
    }

    FragColor = vec4(color, 1.0);
}
