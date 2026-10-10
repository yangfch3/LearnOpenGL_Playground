// ============ 顶点着色器 ============
#version 330 core
// 顶点属性 0：位置
layout (location = 0) in vec3 aPos;
// 顶点属性 1：法线
layout (location = 1) in vec3 aNormal;

// 输出给几何着色器的数据块
out VS_OUT {
    vec3 normal;
} vs_out;

// 视图矩阵
uniform mat4 view;
// 模型矩阵
uniform mat4 model;

void main()
{
    // 计算法线矩阵：视图 * 模型 的逆转置，用来正确变换法线
    mat3 normalMatrix = mat3(transpose(inverse(view * model)));
    // 用法线矩阵变换法线，并传给几何着色器
    vs_out.normal = vec3(vec4(normalMatrix * aNormal, 0.0));
    // 计算裁剪空间坐标：投影在后面几何着色器里做
    gl_Position = view * model * vec4(aPos, 1.0);
}