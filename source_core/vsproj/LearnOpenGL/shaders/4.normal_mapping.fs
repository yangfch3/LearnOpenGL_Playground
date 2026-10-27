#version 330 core
out vec4 FragColor;

in VS_OUT {
    vec3 FragPos;
    vec2 TexCoords;
    vec3 TangentLightPos;
    vec3 TangentViewPos;
    vec3 TangentFragPos;
} fs_in;

uniform sampler2D diffuseMap;
uniform sampler2D normalMap;

void main()
{
    // 贴图存的是切线空间法线，按 rgb = n * 0.5 + 0.5 编码到 [0,1]，这里反解回 [-1,1]。
    // 多数法线大致朝 +z，即 (0.5, 0.5, 1.0)，所以法线贴图整体偏蓝紫色。
    // 另：OpenGL 约定 +y 为 v 增大方向，DirectX 风格贴图的绿通道相反，混用会出现凹凸反向
    vec3 normal = texture(normalMap, fs_in.TexCoords).rgb;
    normal = normalize(normal * 2.0 - 1.0);

    vec3 color = texture(diffuseMap, fs_in.TexCoords).rgb;

    // 以下 Blinn-Phong 全部在切线空间计算，与世界空间版本相比只是换了坐标系，公式不变
    vec3 ambient = 0.1 * color;

    vec3 lightDir = normalize(fs_in.TangentLightPos - fs_in.TangentFragPos);
    float diff = max(dot(lightDir, normal), 0.0);
    vec3 diffuse = diff * color;

    vec3 viewDir = normalize(fs_in.TangentViewPos - fs_in.TangentFragPos);
    vec3 halfwayDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfwayDir), 0.0), 32.0);
    vec3 specular = vec3(0.2) * spec;

    FragColor = vec4(ambient + diffuse + specular, 1.0);
}
