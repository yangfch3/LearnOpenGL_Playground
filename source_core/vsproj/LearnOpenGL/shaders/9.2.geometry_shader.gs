#version 330 core
// 输入图元是三角形
layout (triangles) in;
// 输出图元是三角形带，最多输出 3 个顶点
layout (triangle_strip, max_vertices = 3) out;

// 从顶点着色器传来的输入
in VS_OUT {
    vec2 texCoords;
} gs_in[];

// 传给片段着色器的纹理坐标
out vec2 TexCoords;

// 时间变量，用于动画
uniform float time;

// 沿着法线方向把顶点向外推，实现爆炸效果
vec4 explode(vec4 position, vec3 normal)
{
    // 爆炸强度
    float magnitude = 2.0;
    // 计算移动方向：法线方向 * 随时间变化的系数 * 强度
    vec3 direction = normal * ((sin(time) + 1.0) / 2.0) * magnitude;
    // 把顶点沿 direction 方向移动
    return position + vec4(direction, 0.0);
}

// 根据三角形三个顶点计算面法线
vec3 GetNormal()
{
    // 边向量 a
    vec3 a = vec3(gl_in[0].gl_Position) - vec3(gl_in[1].gl_Position);
    // 边向量 b
    vec3 b = vec3(gl_in[2].gl_Position) - vec3(gl_in[1].gl_Position);
    // 叉乘得到法线并归一化
    return normalize(cross(a, b));
}

void main() {
    // 计算当前三角形的法线
    vec3 normal = GetNormal();

    // 处理第一个顶点：沿法线爆炸并输出
    gl_Position = explode(gl_in[0].gl_Position, normal);
    // 传递第一个顶点的纹理坐标
    TexCoords = gs_in[0].texCoords;
    // 发射顶点
    EmitVertex();

    // 处理第二个顶点：沿法线爆炸并输出
    gl_Position = explode(gl_in[1].gl_Position, normal);
    // 传递第二个顶点的纹理坐标
    TexCoords = gs_in[1].texCoords;
    // 发射顶点
    EmitVertex();

    // 处理第三个顶点：沿法线爆炸并输出
    gl_Position = explode(gl_in[2].gl_Position, normal);
    // 传递第三个顶点的纹理坐标
    TexCoords = gs_in[2].texCoords;
    // 发射顶点
    EmitVertex();

    // 结束当前图元
    EndPrimitive();
}