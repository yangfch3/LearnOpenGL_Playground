#version 330 core
// 输出颜色
out vec4 FragColor;

// 从顶点着色器传来的纹理坐标
in vec2 TexCoords;

// 深度图纹理
uniform sampler2D depthMap;
// 近裁剪面
uniform float near_plane;
// 远裁剪面
uniform float far_plane;

// required when using a perspective projection matrix
// 把非线性深度值转换成线性深度值，使用透视投影矩阵时需要
float LinearizeDepth(float depth)
{
    // 从深度值还原到 NDC 坐标 [-1, 1]
    float z = depth * 2.0 - 1.0; // Back to NDC 
    // 用近远裁剪面把 NDC 深度还原成线性深度
    return (2.0 * near_plane * far_plane) / (far_plane + near_plane - z * (far_plane - near_plane));	
}

void main()
{             
    // 从深度图中采样深度值，只取红色通道
    float depthValue = texture(depthMap, TexCoords).r;
    // FragColor = vec4(vec3(LinearizeDepth(depthValue) / far_plane), 1.0); // perspective
    // 正交投影时直接使用深度值，输出为灰度图
    FragColor = vec4(vec3(depthValue), 1.0); // orthographic
}