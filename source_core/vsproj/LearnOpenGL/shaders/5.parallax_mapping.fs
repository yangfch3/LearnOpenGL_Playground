#version 330 core
// 视差贴图的核心思想：几何体仍是平的，但根据深度图「假装」表面有凹凸，
// 沿视线方向偏移 UV，让像素去采样「如果真有凹凸，视线实际会击中的那一点」。
// 法线贴图只改光照；视差贴图改的是采样位置，所以能产生遮挡与错位的立体感
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
// 深度图（高度图取反）：白 = 深，黑 = 表面。用深度而非高度，是为了让「往表面下走」的步进写起来更直观
uniform sampler2D depthMap;

// 深度图值 1.0 对应的实际深度（切线空间单位），过大时失真明显
uniform float heightScale;
// 0 普通视差 / 1 陡峭视差 / 2 视差遮蔽 (POM)
uniform int mode;

// 循环内属于非一致控制流，texture() 的隐式导数未定义，统一用循环外算好的梯度
vec2 gdx;
vec2 gdy;
float sampleDepth(vec2 uv)
{
    return textureGrad(depthMap, uv, gdx, gdy).r;
}

// 普通视差：只采样一次深度，沿视线方向偏移 UV。
// viewDir 指向相机，视线进入表面的方向是 -viewDir，所以是减。
// viewDir.xy / viewDir.z 是视线每下降 1 单位深度在表面上平移的距离：掠射角时 z 小、偏移大；
// 角度过低会严重失真，去掉除法即「Offset Limiting」变体，偏移更保守
vec2 parallaxBasic(vec2 texCoords, vec3 viewDir)
{
    float depth = sampleDepth(texCoords);
    return texCoords - viewDir.xy / viewDir.z * (depth * heightScale);
}

// 陡峭视差：把深度 [0,1] 切成若干层，沿视线逐层步进，直到「视线所在层深度 >= 深度图值」，
// 即视线第一次钻到表面以下，取该点 UV。
// occlusion = true 时再在最后两步之间线性插值（POM），消除分层台阶
vec2 parallaxSteep(vec2 texCoords, vec3 viewDir, bool occlusion)
{
    // 视线越贴近表面，横向走得越远，需要的层数越多；正视时 8 层足够
    const float minLayers = 8.0;
    const float maxLayers = 32.0;
    float numLayers = mix(maxLayers, minLayers, abs(viewDir.z));

    float layerDepth = 1.0 / numLayers;
    float currentLayerDepth = 0.0;
    // 视线下降到最大深度 (=heightScale) 时的总 UV 偏移，按层均分
    vec2 deltaTexCoords = viewDir.xy / viewDir.z * heightScale / numLayers;

    // 深度图值 <= 1，层深度走满 numLayers 步后到 1，循环必定结束
    vec2 currentTexCoords = texCoords;
    float currentDepth = sampleDepth(currentTexCoords);
    while (currentLayerDepth < currentDepth)
    {
        currentTexCoords -= deltaTexCoords;
        currentDepth = sampleDepth(currentTexCoords);
        currentLayerDepth += layerDepth;
    }

    if (!occlusion)
        return currentTexCoords;

    // 此时交点夹在上一步（视线在表面上方）与当前步（视线在表面下方）之间。
    // 把这一小段的视线和表面都近似为直线，求交：
    //   afterDepth  < 0：当前步视线低于表面多少
    //   beforeDepth > 0：上一步视线高于表面多少
    // 权重即交点离当前步的比例
    vec2 prevTexCoords = currentTexCoords + deltaTexCoords;
    float afterDepth  = currentDepth - currentLayerDepth;
    float beforeDepth = sampleDepth(prevTexCoords) - (currentLayerDepth - layerDepth);
    float weight = afterDepth / (afterDepth - beforeDepth);
    return prevTexCoords * weight + currentTexCoords * (1.0 - weight);
}

void main()
{
    gdx = dFdx(fs_in.TexCoords);
    gdy = dFdy(fs_in.TexCoords);

    // 视差在切线空间计算：此时 z 轴即表面法线，xy 与 UV 的 u/v 方向对齐，
    // 视线的 xy 分量可以直接当 UV 偏移用 —— 这正是需要切线空间的原因
    vec3 viewDir = normalize(fs_in.TangentViewPos - fs_in.TangentFragPos);
    vec2 texCoords = mode == 0 ? parallaxBasic(fs_in.TexCoords, viewDir)
                               : parallaxSteep(fs_in.TexCoords, viewDir, mode == 2);
    // 偏移出 [0,1] 的片段丢弃，否则边缘会采样到重复纹理。
    // 只对 UV 恰好铺满一次的平面有效；轮廓仍是平的，这是视差贴图的固有局限
    if (texCoords.x > 1.0 || texCoords.y > 1.0 || texCoords.x < 0.0 || texCoords.y < 0.0)
        discard;

    // 之后所有贴图都用偏移后的 UV，光照与法线贴图相同
    vec3 normal = textureGrad(normalMap, texCoords, gdx, gdy).rgb;
    normal = normalize(normal * 2.0 - 1.0);
    vec3 color = textureGrad(diffuseMap, texCoords, gdx, gdy).rgb;

    vec3 ambient = 0.1 * color;
    vec3 lightDir = normalize(fs_in.TangentLightPos - fs_in.TangentFragPos);
    float diff = max(dot(lightDir, normal), 0.0);
    vec3 diffuse = diff * color;
    vec3 halfwayDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfwayDir), 0.0), 32.0);
    vec3 specular = vec3(0.2) * spec;

    FragColor = vec4(ambient + diffuse + specular, 1.0);
}
