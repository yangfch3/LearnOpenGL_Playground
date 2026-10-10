#version 330 core
// 输出颜色
out vec4 FragColor;

// 从顶点着色器传来的纹理坐标
in vec2 TexCoords;

// 场景颜色纹理
uniform sampler2D scene;
// 模糊后的亮部纹理
uniform sampler2D bloomBlur;
// 是否启用泛光
uniform bool bloom;
// 曝光值
uniform float exposure;

void main()
{             
    // 伽马值
    const float gamma = 2.2;
    // 从场景纹理采样 HDR 颜色
    vec3 hdrColor = texture(scene, TexCoords).rgb;      
    // 从模糊纹理采样泛光颜色
    vec3 bloomColor = texture(bloomBlur, TexCoords).rgb;
    // 如果启用泛光
    if(bloom)
        // 把泛光颜色叠加到场景颜色上
        hdrColor += bloomColor; // additive blending
    // tone mapping
    // 用曝光做色调映射，把 HDR 颜色压缩到 [0,1]
    vec3 result = vec3(1.0) - exp(-hdrColor * exposure);
    // also gamma correct while we're at it       
    // 再做伽马校正
    result = pow(result, vec3(1.0 / gamma));
    // 输出最终颜色
    FragColor = vec4(result, 1.0);
}