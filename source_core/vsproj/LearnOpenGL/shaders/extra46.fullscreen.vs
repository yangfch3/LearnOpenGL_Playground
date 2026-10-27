#version 460 core
// 全屏三角形：不需要任何顶点缓冲，用 gl_VertexID (0,1,2) 直接算出覆盖整个屏幕的大三角形。
// 顶点 (-1,-1) (3,-1) (-1,3)，超出屏幕部分被裁剪；比两个三角形拼的四边形少一条对角线上的重复着色
out vec2 TexCoords;

void main()
{
    // 位运算取出 ID 的位：ID=0 -> (0,0)，ID=1 -> (2,0)，ID=2 -> (0,2)
    vec2 pos = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    // UV 范围 [0,2]，屏幕内可见部分恰好是 [0,1]
    TexCoords = pos;
    gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}
