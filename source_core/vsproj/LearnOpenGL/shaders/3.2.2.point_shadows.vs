#version 330 core
// 顶点属性 0：位置
layout (location = 0) in vec3 aPos;
// 顶点属性 1：法线
layout (location = 1) in vec3 aNormal;
// 顶点属性 2：纹理坐标
layout (location = 2) in vec2 aTexCoords;

// 传给片段着色器的纹理坐标（独立声明）
out vec2 TexCoords;

// 输出给片段着色器的数据块
out VS_OUT {
    // 世界空间中的片段位置
    vec3 FragPos;
    // 世界空间中的法线
    vec3 Normal;
    // 纹理坐标
    vec2 TexCoords;
} vs_out;

// 投影矩阵
uniform mat4 projection;
// 视图矩阵
uniform mat4 view;
// 模型矩阵
uniform mat4 model;

// 是否反转法线，用于从内部看大立方体时让光照正确
uniform bool reverse_normals;

void main()
{
    // 计算世界空间中的片段位置
    vs_out.FragPos = vec3(model * vec4(aPos, 1.0));
    // 如果启用反转法线
    if(reverse_normals) // a slight hack to make sure the outer large cube displays lighting from the 'inside' instead of the default 'outside'.
        // 用法线矩阵变换法线并取反
        vs_out.Normal = transpose(inverse(mat3(model))) * (-1.0 * aNormal);
    // 否则正常变换法线
    else
        // 用法线矩阵变换法线
        vs_out.Normal = transpose(inverse(mat3(model))) * aNormal;
    // 传递纹理坐标
    vs_out.TexCoords = aTexCoords;
    // 计算裁剪空间坐标，最终输出到 gl_Position
    gl_Position = projection * view * model * vec4(aPos, 1.0);
}