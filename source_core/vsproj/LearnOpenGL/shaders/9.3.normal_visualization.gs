// ============ 几何着色器 ============
#version 330 core
// 输入图元是三角形
layout (triangles) in;
// 输出图元是线段带，最多输出 6 个顶点，也就是 3 条线
layout (line_strip, max_vertices = 6) out;

// 从顶点着色器传来的输入
in VS_OUT {
    vec3 normal;
} gs_in[];

// 法线可视化线段的长度
const float MAGNITUDE = 0.2;

// 投影矩阵
uniform mat4 projection;

// 为第 index 个顶点生成一条法线线段
void GenerateLine(int index)
{
    // 输出顶点本身的位置（投影到裁剪空间）
    gl_Position = projection * gl_in[index].gl_Position;
    // 发射线段起点
    EmitVertex();

    // 输出顶点位置 + 法线方向 * 长度，作为线段终点
    gl_Position = projection * (gl_in[index].gl_Position + vec4(gs_in[index].normal, 0.0) * MAGNITUDE);
    // 发射线段终点
    EmitVertex();

    // 结束当前线段
    EndPrimitive();
}

void main()
{
    // 为第一个顶点生成法线线段
    GenerateLine(0); // first vertex normal
    // 为第二个顶点生成法线线段
    GenerateLine(1); // second vertex normal
    // 为第三个顶点生成法线线段
    GenerateLine(2); // third vertex normal
}