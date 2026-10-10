#version 330 core
// 输出颜色
out vec4 FragColor;

// 从顶点着色器传来的纹理坐标
in vec2 TexCoords;

// HDR 浮点颜色缓冲
uniform sampler2D hdrBuffer;
// 是否启用 HDR 色调映射
uniform bool hdr;
// 曝光值
uniform float exposure;

void main()
{             
    // 伽马值
    const float gamma = 2.2;
    // 从 HDR 缓冲采样颜色，可能是大于 1.0 的亮度值
    vec3 hdrColor = texture(hdrBuffer, TexCoords).rgb;
    // 如果启用 HDR
    if(hdr)
    {
        // reinhard
        // vec3 result = hdrColor / (hdrColor + vec3(1.0));
        // exposure
        // 用曝光做色调映射，把 HDR 颜色压缩到 [0,1]
        vec3 result = vec3(1.0) - exp(-hdrColor * exposure);
        // also gamma correct while we're at it       
        // 再做伽马校正，让显示在普通显示器上颜色正确
        result = pow(result, vec3(1.0 / gamma));
        // 输出最终颜色
        FragColor = vec4(result, 1.0);
    }
    // 如果未启用 HDR
    else
    {
        // 只做伽马校正，不做色调映射
        vec3 result = pow(hdrColor, vec3(1.0 / gamma));
        // 输出最终颜色
        FragColor = vec4(result, 1.0);
    }
}