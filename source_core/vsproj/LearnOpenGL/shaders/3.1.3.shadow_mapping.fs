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
    // 光源空间中的片段位置
    vec4 FragPosLightSpace;
} fs_in;

// 漫反射纹理
uniform sampler2D diffuseTexture;
// 阴影贴图
uniform sampler2D shadowMap;

// 光源位置
uniform vec3 lightPos;
// 相机位置
uniform vec3 viewPos;

// 计算当前片段是否在阴影中
float ShadowCalculation(vec4 fragPosLightSpace)
{
    // perform perspective divide
    // 透视除法，得到归一化的光源空间坐标
    vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    // transform to [0,1] range
    // 把坐标从 [-1,1] 变换到 [0,1]，用于采样纹理
    projCoords = projCoords * 0.5 + 0.5;
    // get closest depth value from light's perspective (using [0,1] range fragPosLight as coords)
    // 从阴影贴图中采样，得到光源视角下最近的深度值
    float closestDepth = texture(shadowMap, projCoords.xy).r; 
    // get depth of current fragment from light's perspective
    // 当前片段在光源视角下的深度
    float currentDepth = projCoords.z;
    // calculate bias (based on depth map resolution and slope)
    // 计算偏移量，根据表面法线和光照方向的夹角调整，避免阴影失真
    vec3 normal = normalize(fs_in.Normal);
    // 光源方向
    vec3 lightDir = normalize(lightPos - fs_in.FragPos);
    // 偏移量：夹角越大偏移越大，最少 0.005
    float bias = max(0.05 * (1.0 - dot(normal, lightDir)), 0.005);
    // check whether current frag pos is in shadow
    // float shadow = currentDepth - bias > closestDepth  ? 1.0 : 0.0;
    // PCF
    // 用 PCF 做软阴影：对周围 3x3 个纹素采样求平均
    float shadow = 0.0;
    // 一个纹素的大小
    vec2 texelSize = 1.0 / textureSize(shadowMap, 0);
    // 遍历 3x3 邻域
    for(int x = -1; x <= 1; ++x)
    {
        for(int y = -1; y <= 1; ++y)
        {
            // 采样邻域的深度
            float pcfDepth = texture(shadowMap, projCoords.xy + vec2(x, y) * texelSize).r; 
            // 当前深度大于邻域深度则判定为在阴影中
            shadow += currentDepth - bias > pcfDepth  ? 1.0 : 0.0;        
        }    
    }
    // 取平均
    shadow /= 9.0;
    
    // keep the shadow at 0.0 when outside the far_plane region of the light's frustum.
    // 超出光源视锥远平面时不算阴影，避免出现错误的黑边
    if(projCoords.z > 1.0)
        shadow = 0.0;
        
    // 返回阴影系数：0 表示不在阴影，1 表示完全在阴影
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
    // 计算阴影系数
    float shadow = ShadowCalculation(fs_in.FragPosLightSpace);                      
    // 最终光照：环境光 + (1-阴影) * (漫反射 + 高光)，再乘上纹理颜色
    vec3 lighting = (ambient + (1.0 - shadow) * (diffuse + specular)) * color;    
    
    // 输出最终颜色
    FragColor = vec4(lighting, 1.0);
}