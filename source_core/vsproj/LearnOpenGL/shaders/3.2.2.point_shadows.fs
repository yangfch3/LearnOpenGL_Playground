#version 330 core
// 输出颜色
out vec4 FragColor;

// 从顶点着色器传来的数据
in VS_OUT {
    // 世界空间中的片段位置
    vec3 FragPos;
    // 世界空间中的法线
    vec3 Normal;
    // 纹理坐标
    vec2 TexCoords;
} fs_in;

// 漫反射纹理
uniform sampler2D diffuseTexture;
// 深度立方体贴图，存储点光源的深度
uniform samplerCube depthMap;

// 光源位置
uniform vec3 lightPos;
// 相机位置
uniform vec3 viewPos;

// 远裁剪面
uniform float far_plane;
// 是否启用阴影
uniform bool shadows;


// array of offset direction for sampling
// 用于采样偏移的 20 个方向数组，PCF 采样用
vec3 gridSamplingDisk[20] = vec3[]
(
   vec3(1, 1,  1), vec3( 1, -1,  1), vec3(-1, -1,  1), vec3(-1, 1,  1), 
   vec3(1, 1, -1), vec3( 1, -1, -1), vec3(-1, -1, -1), vec3(-1, 1, -1),
   vec3(1, 1,  0), vec3( 1, -1,  0), vec3(-1, -1,  0), vec3(-1, 1,  0),
   vec3(1, 0,  1), vec3(-1,  0,  1), vec3( 1,  0, -1), vec3(-1, 0, -1),
   vec3(0, 1,  1), vec3( 0, -1,  1), vec3( 0, -1, -1), vec3( 0, 1, -1)
);

// 计算当前片段是否在阴影中
float ShadowCalculation(vec3 fragPos)
{
    // get vector between fragment position and light position
    // 从光源指向片段的向量
    vec3 fragToLight = fragPos - lightPos;
    // use the fragment to light vector to sample from the depth map    
    // float closestDepth = texture(depthMap, fragToLight).r;
    // it is currently in linear range between [0,1], let's re-transform it back to original depth value
    // closestDepth *= far_plane;
    // now get current linear depth as the length between the fragment and light position
    // 当前片段到光源的线性距离
    float currentDepth = length(fragToLight);
    // test for shadows
    // float bias = 0.05; // we use a much larger bias since depth is now in [near_plane, far_plane] range
    // float shadow = currentDepth -  bias > closestDepth ? 1.0 : 0.0;
    // PCF
    // float shadow = 0.0;
    // float bias = 0.05; 
    // float samples = 4.0;
    // float offset = 0.1;
    // for(float x = -offset; x < offset; x += offset / (samples * 0.5))
    // {
        // for(float y = -offset; y < offset; y += offset / (samples * 0.5))
        // {
            // for(float z = -offset; z < offset; z += offset / (samples * 0.5))
            // {
                // float closestDepth = texture(depthMap, fragToLight + vec3(x, y, z)).r; // use lightdir to lookup cubemap
                // closestDepth *= far_plane;   // Undo mapping [0;1]
                // if(currentDepth - bias > closestDepth)
                    // shadow += 1.0;
            // }
        // }
    // }
    // shadow /= (samples * samples * samples);
    // 阴影系数
    float shadow = 0.0;
    // 偏移量，因为深度范围是 [near_plane, far_plane]，需要较大偏移
    float bias = 0.15;
    // 采样次数
    int samples = 20;
    // 相机到片段的距离
    float viewDistance = length(viewPos - fragPos);
    // 采样圆盘半径，距离越远半径越大
    float diskRadius = (1.0 + (viewDistance / far_plane)) / 25.0;
    // 遍历 20 个采样点
    for(int i = 0; i < samples; ++i)
    {
        // 从深度立方体贴图采样最近深度
        float closestDepth = texture(depthMap, fragToLight + gridSamplingDisk[i] * diskRadius).r;
        // 把 [0,1] 的深度还原成原始深度值
        closestDepth *= far_plane;   // undo mapping [0;1]
        // 当前深度大于最近深度则判定为在阴影中
        if(currentDepth - bias > closestDepth)
            shadow += 1.0;
    }
    // 取平均
    shadow /= float(samples);
        
    // display closestDepth as debug (to visualize depth cubemap)
    // FragColor = vec4(vec3(closestDepth / far_plane), 1.0);    
        
    // 返回阴影系数
    return shadow;
}

void main()
{           
    // 采样漫反射纹理颜色
    vec3 color = texture(diffuseTexture, fs_in.TexCoords).rgb;
    // 归一化法线
    vec3 normal = normalize(fs_in.Normal);
    // 光照颜色
    vec3 lightColor = vec3(0.3);
    // ambient
    // 环境光
    vec3 ambient = 0.3 * lightColor;
    // diffuse
    // 光源方向
    vec3 lightDir = normalize(lightPos - fs_in.FragPos);
    // 漫反射系数
    float diff = max(dot(lightDir, normal), 0.0);
    // 漫反射光
    vec3 diffuse = diff * lightColor;
    // specular
    // 视线方向
    vec3 viewDir = normalize(viewPos - fs_in.FragPos);
    // 反射方向
    vec3 reflectDir = reflect(-lightDir, normal);
    // 高光系数
    float spec = 0.0;
    // 半程向量，用于 Blinn-Phong 高光
    vec3 halfwayDir = normalize(lightDir + viewDir);  
    // 计算高光强度
    spec = pow(max(dot(normal, halfwayDir), 0.0), 64.0);
    // 高光颜色
    vec3 specular = spec * lightColor;    
    // calculate shadow
    // 计算阴影系数，如果未启用阴影则为 0
    float shadow = shadows ? ShadowCalculation(fs_in.FragPos) : 0.0;                      
    // 最终光照：环境光 + (1-阴影) * (漫反射 + 高光)，再乘上纹理颜色
    vec3 lighting = (ambient + (1.0 - shadow) * (diffuse + specular)) * color;    
    
    // 输出最终颜色
    FragColor = vec4(lighting, 1.0);
}