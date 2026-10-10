#version 330 core
// 输出颜色
out vec4 FragColor;

// 从顶点着色器传来的纹理坐标
in vec2 TexCoords;

// G-buffer 的位置纹理
uniform sampler2D gPosition;
// G-buffer 的法线纹理
uniform sampler2D gNormal;
// G-buffer 的颜色纹理
uniform sampler2D gAlbedo;
// SSAO 纹理
uniform sampler2D ssao;

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
// 单个光源
uniform Light light;

void main()
{             
    // retrieve data from gbuffer
    // 从 G-buffer 读取片段位置
    vec3 FragPos = texture(gPosition, TexCoords).rgb;
    // 从 G-buffer 读取法线
    vec3 Normal = texture(gNormal, TexCoords).rgb;
    // 从 G-buffer 读取漫反射颜色
    vec3 Diffuse = texture(gAlbedo, TexCoords).rgb;
    // 从 SSAO 纹理读取环境光遮蔽系数
    float AmbientOcclusion = texture(ssao, TexCoords).r;
    
    // then calculate lighting as usual
    // 环境光乘以 SSAO 遮蔽系数
    vec3 ambient = vec3(0.3 * Diffuse * AmbientOcclusion);
    // 光照初始化为环境光
    vec3 lighting  = ambient; 
    // 视线方向，因为位置在视图空间，相机在原点
    vec3 viewDir  = normalize(-FragPos); // viewpos is (0.0.0)
    // diffuse
    // 光源方向
    vec3 lightDir = normalize(light.Position - FragPos);
    // 计算漫反射
    vec3 diffuse = max(dot(Normal, lightDir), 0.0) * Diffuse * light.Color;
    // specular
    // 半程向量，用于 Blinn-Phong 高光
    vec3 halfwayDir = normalize(lightDir + viewDir);  
    // 计算高光强度
    float spec = pow(max(dot(Normal, halfwayDir), 0.0), 8.0);
    // 计算高光颜色
    vec3 specular = light.Color * spec;
    // attenuation
    // 片段到光源的距离
    float distance = length(light.Position - FragPos);
    // 计算衰减系数
    float attenuation = 1.0 / (1.0 + light.Linear * distance + light.Quadratic * distance * distance);
    // 漫反射乘以衰减
    diffuse *= attenuation;
    // 高光乘以衰减
    specular *= attenuation;
    // 累加到总光照
    lighting += diffuse + specular;

    // 输出最终颜色
    FragColor = vec4(lighting, 1.0);
}