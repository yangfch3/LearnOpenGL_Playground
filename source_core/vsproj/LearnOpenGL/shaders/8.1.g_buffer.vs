#version 330 core
// 顶点属性 0：位置
layout (location = 0) in vec3 aPos;
// 顶点属性 1：法线
layout (location = 1) in vec3 aNormal;
// 顶点属性 2：纹理坐标
layout (location = 2) in vec2 aTexCoords;

// 世界空间中的片段位置，传给片段着色器
out vec3 FragPos;
// 纹理坐标，传给片段着色器
out vec2 TexCoords;
// 世界空间中的法线，传给片段着色器
out vec3 Normal;

// 模型矩阵
uniform mat4 model;
// 视图矩阵
uniform mat4 view;
// 投影矩阵
uniform mat4 projection;

void main()
{
    // 计算世界空间中的顶点位置
    vec4 worldPos = model * vec4(aPos, 1.0);
    // 把世界空间位置传给片段着色器
    FragPos = worldPos.xyz; 
    // 传递纹理坐标
    TexCoords = aTexCoords;
    
    // 计算法线矩阵：模型矩阵的逆转置
    mat3 normalMatrix = transpose(inverse(mat3(model)));
    // 用 法线矩阵 变换法线
    Normal = normalMatrix * aNormal;

    // 计算裁剪空间坐标，最终输出到 gl_Position
    gl_Position = projection * view * worldPos;
}