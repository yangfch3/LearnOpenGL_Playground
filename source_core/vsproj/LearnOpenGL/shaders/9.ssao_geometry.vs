#version 330 core
// 顶点属性 0：位置
layout (location = 0) in vec3 aPos;
// 顶点属性 1：法线
layout (location = 1) in vec3 aNormal;
// 顶点属性 2：纹理坐标
layout (location = 2) in vec2 aTexCoords;

// 视图空间中的片段位置，传给片段着色器
out vec3 FragPos;
// 纹理坐标，传给片段着色器
out vec2 TexCoords;
// 视图空间中的法线，传给片段着色器
out vec3 Normal;

// 是否反转法线，用于从内部看立方体
uniform bool invertedNormals;

// 模型矩阵
uniform mat4 model;
// 视图矩阵
uniform mat4 view;
// 投影矩阵
uniform mat4 projection;

void main()
{
    // 计算视图空间中的顶点位置
    vec4 viewPos = view * model * vec4(aPos, 1.0);
    // 把视图空间位置传给片段着色器
    FragPos = viewPos.xyz; 
    // 传递纹理坐标
    TexCoords = aTexCoords;
    
    // 计算法线矩阵：视图 * 模型 的逆转置
    mat3 normalMatrix = transpose(inverse(mat3(view * model)));
    // 用 法线矩阵 变换法线，如果启用反转则取反
    Normal = normalMatrix * (invertedNormals ? -aNormal : aNormal);
    
    // 计算裁剪空间坐标，最终输出到 gl_Position
    gl_Position = projection * viewPos;
}