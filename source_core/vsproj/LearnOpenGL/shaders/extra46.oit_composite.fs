#version 460 core
// WBOIT 合成 pass：全屏三角形，把透明层结果按「普通 alpha 混合」叠到不透明场景上
out vec4 FragColor;

layout (binding = 0) uniform sampler2D accumTex;
layout (binding = 1) uniform sampler2D revealTex;

void main()
{
    // 两张纹理与屏幕同尺寸，按像素整数坐标直接取，不需要 UV
    ivec2 coords = ivec2(gl_FragCoord.xy);
    float revealage = texelFetch(revealTex, coords, 0).r;
    // reveal 仍是清屏值 1：该像素没有任何透明物体，保留不透明场景
    if (revealage >= 0.9999)
        discard;

    vec4 accumulation = texelFetch(accumTex, coords, 0);
    // 权重叠加过多时 16 位浮点可能溢出为 inf，退化成用 alpha 和代替
    if (isinf(max(max(abs(accumulation.r), abs(accumulation.g)), abs(accumulation.b))))
        accumulation.rgb = vec3(accumulation.a);

    // 加权平均色；accum.a 是加权 alpha 和，作分母做归一化
    vec3 averageColor = accumulation.rgb / max(accumulation.a, 1e-5);
    // 配合混合 SRC_ALPHA, ONE_MINUS_SRC_ALPHA：结果 = 平均色 * 总不透明度 + 背景 * 总透过率
    FragColor = vec4(averageColor, 1.0 - revealage);
}
