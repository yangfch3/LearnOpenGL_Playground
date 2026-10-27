#version 460 core
// Weighted Blended OIT（McGuire & Bavoil 2013）透明 pass。
// 普通 alpha 混合 C = a*Cs + (1-a)*Cd 不满足交换律，必须从后往前画；
// WBOIT 改用两个满足交换律的量，任意顺序叠加结果都相同：
//   accum  = Σ (premultiplied 颜色, alpha) * w   —— 加法，靠混合 ONE, ONE
//   reveal = Π (1 - alpha)                       —— 乘法，靠混合 ZERO, ONE_MINUS_SRC_COLOR
// 合成时 平均颜色 = accum.rgb / accum.a，总不透明度 = 1 - reveal
in vec3 Normal;

// MRT：location 0 -> GL_COLOR_ATTACHMENT0 (RGBA16F)，location 1 -> GL_COLOR_ATTACHMENT1 (R8)
layout (location = 0) out vec4 accum;
layout (location = 1) out float reveal;

uniform vec4 color;

void main()
{
    float diff = abs(dot(normalize(Normal), normalize(vec3(0.4, 1.0, 0.3))));
    vec3 rgb = color.rgb * (0.35 + 0.65 * diff);
    float a = color.a;

    // 深度权重：离相机越近 (gl_FragCoord.z 越小) 权重越大，让前面的层在平均色里占比更高，
    // 这是对「真实遮挡关系」的近似，也是 WBOIT 「近似」二字的来源。
    // 系数来自原论文的经验公式；clamp 防止 RGBA16F 溢出或下溢
    float w = clamp(pow(min(1.0, a * 10.0) + 0.01, 3.0) * 1e8 * pow(1.0 - gl_FragCoord.z * 0.9, 3.0), 1e-2, 3e3);

    accum = vec4(rgb * a, a) * w;
    // 混合因子 ONE_MINUS_SRC_COLOR 取的是这里输出的 a：dst = dst * (1 - a)
    reveal = a;
}
