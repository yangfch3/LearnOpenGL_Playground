#version 330 core
// 须与 csm.cpp 中 CASCADE_COUNT 一致
#define CASCADE_COUNT 5

out vec4 FragColor;

in VS_OUT {
    vec3 FragPos;
    vec3 Normal;
    vec2 TexCoords;
} fs_in;

uniform sampler2D diffuseTexture;
// 纹理数组：采样坐标是 vec3(u, v, layer)，layer 是层号（不归一化），与 cubemap 的方向向量不同
uniform sampler2DArray shadowMap;

uniform vec3 lightDir;
uniform vec3 viewPos;
uniform float farPlane;

uniform mat4 view;
uniform mat4 lightSpaceMatrices[CASCADE_COUNT];
// 第 i 级覆盖视空间深度 [dist[i-1], dist[i])，最后一级到 farPlane
uniform float cascadePlaneDistances[CASCADE_COUNT - 1];

uniform bool showCascades;

// 按片段在视空间的深度选级联：近处用覆盖范围小、纹素密的级，远处用覆盖范围大的级。
// 用视空间 z 而不是到相机的距离，是因为 CPU 端切分视锥时用的就是近/远平面（即视空间 z）
int selectLayer()
{
    float depthValue = abs((view * vec4(fs_in.FragPos, 1.0)).z);
    for (int i = 0; i < CASCADE_COUNT - 1; ++i)
    {
        if (depthValue < cascadePlaneDistances[i])
            return i;
    }
    return CASCADE_COUNT - 1;
}

float shadowCalculation(int layer, vec3 normal)
{
    // 以下与普通 shadow mapping 完全一样，只是矩阵和采样层由 layer 决定
    vec4 fragPosLightSpace = lightSpaceMatrices[layer] * vec4(fs_in.FragPos, 1.0);
    // 正交投影 w = 1，除法其实可省，保留是为了与透视情形写法一致
    vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    projCoords = projCoords * 0.5 + 0.5;
    float currentDepth = projCoords.z;
    // 超出该级光源正交体远平面，视为不在阴影中
    if (currentDepth > 1.0)
        return 0.0;

    // 坡度相关 bias：表面越斜对光源，shadow map 一个纹素覆盖的深度跨度越大，越容易自遮挡（acne）。
    // 再按该级远平面距离缩放（原教程经验值）：远级联深度范围大，同样的 bias 在归一化深度里要更小
    float bias = max(0.05 * (1.0 - dot(normal, lightDir)), 0.005);
    const float biasModifier = 0.5;
    float layerFar = layer == CASCADE_COUNT - 1 ? farPlane : cascadePlaneDistances[layer];
    bias *= 1.0 / (layerFar * biasModifier);

    // 3x3 PCF。各级分辨率相同但覆盖范围不同，所以同样 3x3 在远级联里模糊半径（世界单位）更大
    float shadow = 0.0;
    vec2 texelSize = 1.0 / vec2(textureSize(shadowMap, 0).xy);
    for (int x = -1; x <= 1; ++x)
    {
        for (int y = -1; y <= 1; ++y)
        {
            float pcfDepth = texture(shadowMap, vec3(projCoords.xy + vec2(x, y) * texelSize, layer)).r;
            shadow += (currentDepth - bias) > pcfDepth ? 1.0 : 0.0;
        }
    }
    return shadow / 9.0;
}

void main()
{
    vec3 color = texture(diffuseTexture, fs_in.TexCoords).rgb;
    vec3 normal = normalize(fs_in.Normal);
    vec3 lightColor = vec3(0.3);

    // 方向光 Blinn-Phong，lightDir 指向光源
    vec3 ambient = 0.3 * color;
    float diff = max(dot(lightDir, normal), 0.0);
    vec3 diffuse = diff * lightColor;
    vec3 viewDir = normalize(viewPos - fs_in.FragPos);
    vec3 halfwayDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfwayDir), 0.0), 64.0);
    vec3 specular = spec * lightColor;

    int layer = selectLayer();
    float shadow = shadowCalculation(layer, normal);
    vec3 lighting = (ambient + (1.0 - shadow) * (diffuse + specular)) * color;

    // 调试：按级联染色，观察分割位置。
    // 级联交界处阴影精度突变会形成可见接缝，常见改进是在交界带内混合相邻两级（本例未做）
    if (showCascades)
    {
        const vec3 tints[CASCADE_COUNT] = vec3[](
            vec3(1.0, 0.3, 0.3), vec3(0.3, 1.0, 0.3), vec3(0.3, 0.3, 1.0),
            vec3(1.0, 1.0, 0.3), vec3(1.0, 0.3, 1.0));
        lighting *= tints[layer];
    }

    FragColor = vec4(lighting, 1.0);
}
