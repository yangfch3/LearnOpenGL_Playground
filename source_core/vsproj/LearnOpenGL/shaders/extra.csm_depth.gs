#version 330 core
// 须与 csm.cpp 中 CASCADE_COUNT 一致
#define CASCADE_COUNT 5

layout (triangles) in;
// 每个输入三角形向每一层各输出一份：3 * CASCADE_COUNT 个顶点。
// 3.3 的 layout 里不能写常量表达式，只能手填数字
layout (triangle_strip, max_vertices = 15) out;

uniform mat4 lightSpaceMatrices[CASCADE_COUNT];

// 与点光源阴影（3.2.2.point_shadows_depth.gs）是同一机制：GS 写 gl_Layer 决定图元落到哪一层。
// 区别只在于这里每层用的是不同的正交投影，而不是立方体的 6 个透视面。
// 代价：几何量放大 CASCADE_COUNT 倍；落在某级正交体外的三角形会被裁剪掉，但仍要走完 GS。
// GL 4.0 可用 invocations = N 让硬件并行多次调用 GS，每次只输出一层；3.3 下只能在单次调用里循环
void main()
{
    for (int layer = 0; layer < CASCADE_COUNT; ++layer)
    {
        for (int i = 0; i < 3; ++i)
        {
            gl_Position = lightSpaceMatrices[layer] * gl_in[i].gl_Position;
            // 写入纹理数组的第 layer 层（FBO 需用 glFramebufferTexture 做分层附件）。
            // 同一图元各顶点的 gl_Layer 不一致时取哪个由实现决定，所以每个顶点都写同一个值
            gl_Layer = layer;
            EmitVertex();
        }
        EndPrimitive();
    }
}
