#version 330 core
// 输出 SSAO 遮蔽系数，单通道
out float FragColor;

// 从顶点着色器传来的纹理坐标
in vec2 TexCoords;

// G-buffer 的位置纹理
uniform sampler2D gPosition;
// G-buffer 的法线纹理
uniform sampler2D gNormal;
// 噪声纹理
uniform sampler2D texNoise;

// 64 个采样点
uniform vec3 samples[64];

// parameters (you'd probably want to use them as uniforms to more easily tweak the effect)
// 采样核大小
int kernelSize = 64;
// 采样半径
float radius = 0.5;
// 偏移量，避免自遮蔽
float bias = 0.025;

// tile noise texture over screen based on screen dimensions divided by noise size
// 噪声纹理平铺比例：屏幕尺寸除以噪声尺寸
const vec2 noiseScale = vec2(800.0/4.0, 600.0/4.0); 

// 投影矩阵
uniform mat4 projection;

void main()
{
    // get input for SSAO algorithm
    // 从 G-buffer 读取片段位置
    vec3 fragPos = texture(gPosition, TexCoords).xyz;
    // 从 G-buffer 读取并归一化法线
    vec3 normal = normalize(texture(gNormal, TexCoords).rgb);
    // 从噪声纹理读取并归一化随机向量
    vec3 randomVec = normalize(texture(texNoise, TexCoords * noiseScale).xyz);
    // create TBN change-of-basis matrix: from tangent-space to view-space
    // 用 Gram-Schmidt 过程计算切线
    vec3 tangent = normalize(randomVec - normal * dot(randomVec, normal));
    // 计算副切线
    vec3 bitangent = cross(normal, tangent);
    // 构造 TBN 矩阵：从切线空间到视图空间
    mat3 TBN = mat3(tangent, bitangent, normal);
    // iterate over the sample kernel and calculate occlusion factor
    // 遮蔽系数累加器
    float occlusion = 0.0;
    // 遍历采样核
    for(int i = 0; i < kernelSize; ++i)
    {
        // get sample position
        // 把采样点从切线空间变换到视图空间
        vec3 samplePos = TBN * samples[i]; // from tangent to view-space
        // 把采样点偏移到片段位置附近
        samplePos = fragPos + samplePos * radius; 
        
        // project sample position (to sample texture) (to get position on screen/texture)
        // 采样点的裁剪空间坐标
        vec4 offset = vec4(samplePos, 1.0);
        // 从视图空间变换到裁剪空间
        offset = projection * offset; // from view to clip-space
        // 透视除法
        offset.xyz /= offset.w; // perspective divide
        // 变换到 [0, 1] 范围，用于采样纹理
        offset.xyz = offset.xyz * 0.5 + 0.5; // transform to range 0.0 - 1.0
        
        // get sample depth
        // 采样该位置在 G-buffer 中的深度
        float sampleDepth = texture(gPosition, offset.xy).z; // get depth value of kernel sample
        
        // range check & accumulate
        // 范围检查，避免远处物体错误遮蔽
        float rangeCheck = smoothstep(0.0, 1.0, radius / abs(fragPos.z - sampleDepth));
        // 如果采样点被遮挡则累加遮蔽
        occlusion += (sampleDepth >= samplePos.z + bias ? 1.0 : 0.0) * rangeCheck;           
    }
    // 计算最终遮蔽系数：1 表示完全不被遮挡
    occlusion = 1.0 - (occlusion / kernelSize);
    
    // 输出遮蔽系数
    FragColor = occlusion;
}