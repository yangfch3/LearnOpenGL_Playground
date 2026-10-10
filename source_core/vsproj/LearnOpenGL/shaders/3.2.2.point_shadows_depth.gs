#version 330 core
// 输入图元是三角形
layout (triangles) in;
// 输出图元是三角形带，最多输出 18 个顶点（6 个面 * 3 个顶点）
layout (triangle_strip, max_vertices=18) out;

// 6 个面的光源空间矩阵
uniform mat4 shadowMatrices[6];

// 输出给片段着色器的片段位置
out vec4 FragPos; // FragPos from GS (output per emitvertex)

void main()
{
    // 遍历立方体贴图的 6 个面
    for(int face = 0; face < 6; ++face)
    {
        // 指定当前渲染到立方体贴图的哪个面
        gl_Layer = face; // built-in variable that specifies to which face we render.
        // 遍历三角形的 3 个顶点
        for(int i = 0; i < 3; ++i) // for each triangle's vertices
        {
            // 把输入顶点的位置传给片段着色器
            FragPos = gl_in[i].gl_Position;
            // 用当前面的光源空间矩阵变换顶点位置
            gl_Position = shadowMatrices[face] * FragPos;
            // 发射顶点
            EmitVertex();
        }    
        // 结束当前图元
        EndPrimitive();
    }
} 