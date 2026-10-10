#version 330 core
// 输出颜色
out vec4 FragColor;

// 从顶点着色器传来的纹理坐标
in vec2 TexCoords;

// G-buffer 的位置纹理
uniform sampler2D gPosition;
// G-buffer 的法线纹理
uniform sampler2D gNormal;
// G-buffer 的颜色+高光纹理
uniform sampler2D gAlbedoSpec;

// 光源结构体
struct Light {
    // 光源位置
    vec3 Position;
    // 光源颜色
    vec3 Color;
    
    // 线性衰减系数
    float Linear;
    // 二次衰减系数
    float Quadratic;
};
// 光源数量
const int NR_LIGHTS = 32;
// 32 个光源
uniform Light lights[NR_LIGHTS];
// 相机位置
uniform vec3 viewPos;

void main()
{             
    // retrieve data from gbuffer
    // 从 G-buffer 读取片段位置
    vec3 FragPos = texture(gPosition, TexCoords).rgb;
    // 从 G-buffer 读取法线
    vec3 Normal = texture(gNormal, TexCoords).rgb;
    // 从 G-buffer 读取漫反射颜色
    vec3 Diffuse = texture(gAlbedoSpec, TexCoords).rgb;
    // 从 G-buffer 读取高光强度，存在 alpha 通道
    float Specular = texture(gAlbedoSpec, TexCoords).a;
    
    // then calculate lighting as usual
    // 用硬编码的环境光作为初始光照
    vec3 lighting  = Diffuse * 0.1; // hard-coded ambient component
    // 视线方向
    vec3 viewDir  = normalize(viewPos - FragPos);
    // 遍历所有光源
    for(int i = 0; i < NR_LIGHTS; ++i)
    {
        // diffuse
        // 第 i 个光源的方向
        vec3 lightDir = normalize(lights[i].Position - FragPos);
        // 计算漫反射
        vec3 diffuse = max(dot(Normal, lightDir), 0.0) * Diffuse * lights[i].Color;
        // specular
        // 半程向量，用于 Blinn-Phong 高光
        vec3 halfwayDir = normalize(lightDir + viewDir);  
        // 计算高光强度
        float spec = pow(max(dot(Normal, halfwayDir), 0.0), 16.0);
        // 计算高光颜色
        vec3 specular = lights[i].Color * spec * Specular;
        // attenuation
        // 片段到光源的距离
        float distance = length(lights[i].Position - FragPos);
        // 计算衰减系数
        float attenuation = 1.0 / (1.0 + lights[i].Linear * distance + lights[i].Quadratic * distance * distance);
        // 漫反射乘以衰减
        diffuse *= attenuation;
        // 高光乘以衰减
        specular *= attenuation;
        // 累加到总光照
        lighting += diffuse + specular;        
    }
    // 输出最终颜色
    FragColor = vec4(lighting, 1.0);
}