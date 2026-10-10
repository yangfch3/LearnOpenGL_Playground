#version 330 core
// 输出到颜色附件 0：正常场景颜色
layout (location = 0) out vec4 FragColor;
// 输出到颜色附件 1：亮部颜色，用于泛光
layout (location = 1) out vec4 BrightColor;

// 从顶点着色器传来的数据
in VS_OUT {
    // 世界空间中的片段位置
    vec3 FragPos;
    // 世界空间中的法线
    vec3 Normal;
    // 纹理坐标
    vec2 TexCoords;
} fs_in;

// 光源结构体
struct Light {
    // 光源位置
    vec3 Position;
    // 光源颜色
    vec3 Color;
};

// 4 个光源
uniform Light lights[4];
// 漫反射纹理
uniform sampler2D diffuseTexture;
// 相机位置
uniform vec3 viewPos;

void main()
{           
    // 采样漫反射纹理颜色
    vec3 color = texture(diffuseTexture, fs_in.TexCoords).rgb;
    // 归一化法线
    vec3 normal = normalize(fs_in.Normal);
    // ambient
    // 环境光，这里设为 0，让泛光效果更明显
    vec3 ambient = 0.0 * color;
    // lighting
    // 累加光照结果
    vec3 lighting = vec3(0.0);
    // 视线方向
    vec3 viewDir = normalize(viewPos - fs_in.FragPos);
    // 遍历 4 个光源
    for(int i = 0; i < 4; i++)
    {
        // diffuse
        // 第 i 个光源的方向
        vec3 lightDir = normalize(lights[i].Position - fs_in.FragPos);
        // 漫反射系数
        float diff = max(dot(lightDir, normal), 0.0);
        // 第 i 个光源的贡献
        vec3 result = lights[i].Color * diff * color;      
        // attenuation (use quadratic as we have gamma correction)
        // 计算衰减，使用平方反比
        float distance = length(fs_in.FragPos - lights[i].Position);
        // 应用衰减
        result *= 1.0 / (distance * distance);
        // 累加到总光照
        lighting += result;
                
    }
    // 最终结果 = 环境光 + 光照
    vec3 result = ambient + lighting;
    // check whether result is higher than some threshold, if so, output as bloom threshold color
    // 计算亮度，用感知亮度加权公式
    float brightness = dot(result, vec3(0.2126, 0.7152, 0.0722));
    // 如果亮度超过阈值
    if(brightness > 1.0)
        // 输出亮部颜色，用于后续泛光
        BrightColor = vec4(result, 1.0);
    // 否则亮部为黑色
    else
        BrightColor = vec4(0.0, 0.0, 0.0, 1.0);
    // 输出正常场景颜色
    FragColor = vec4(result, 1.0);
}