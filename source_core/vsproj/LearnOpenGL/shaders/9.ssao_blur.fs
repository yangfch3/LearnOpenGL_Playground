#version 330 core
// 输出模糊后的 SSAO 遮蔽系数，单通道
out float FragColor;

// 从顶点着色器传来的纹理坐标
in vec2 TexCoords;

// 输入的 SSAO 纹理
uniform sampler2D ssaoInput;

void main() 
{
    // 计算一个纹素的大小
    vec2 texelSize = 1.0 / vec2(textureSize(ssaoInput, 0));
    // 模糊结果累加器
    float result = 0.0;
    // 遍历 4x4 邻域
    for (int x = -2; x < 2; ++x) 
    {
        // 遍历 4x4 邻域
        for (int y = -2; y < 2; ++y) 
        {
            // 计算邻域纹素偏移
            vec2 offset = vec2(float(x), float(y)) * texelSize;
            // 累加邻域的 SSAO 值
            result += texture(ssaoInput, TexCoords + offset).r;
        }
    }
    // 取平均，得到模糊后的 SSAO 值
    FragColor = result / (4.0 * 4.0);
}  