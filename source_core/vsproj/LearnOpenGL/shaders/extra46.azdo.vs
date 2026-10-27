#version 460 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aNormal;

struct ObjectStatic
{
    vec4 posScale;
    vec3 color;
    uint meshType;
};
layout (std430, binding = 0) readonly buffer ObjectStaticBuffer { ObjectStatic objects[]; };
layout (std430, binding = 1) readonly buffer ObjectDynamicBuffer { vec4 dynamics[]; };
layout (std430, binding = 3) readonly buffer VisibleBuffer { uint visibleIndices[]; };

uniform mat4 viewProj;
// 对照模式：每个物体一次 draw call，用 uniform 告诉 VS 画的是哪个物体
uniform bool naive;
uniform uint naiveObject;

out vec3 vNormal;
out vec3 vColor;

void main()
{
    // 间接绘制下，一条命令画 instanceCount 个实例：
    //   gl_InstanceID 从 0 开始，不包含 baseInstance；gl_BaseInstance（4.6 核心）才是命令里的 baseInstance。
    //   两者相加 = 该实例在可见列表中的位置
    uint obj = naive ? naiveObject : visibleIndices[gl_BaseInstance + gl_InstanceID];
    ObjectStatic s = objects[obj];
    vec4 d = dynamics[obj];

    // 绕 y 轴旋转 d.w。GLSL 的 mat3 构造按列填充：三组分别是第 0、1、2 列
    float c = cos(d.w), sn = sin(d.w);
    mat3 rot = mat3(c, 0.0, -sn,  0.0, 1.0, 0.0,  sn, 0.0, c);

    vec3 worldPos = rot * (aPos * s.posScale.w) + s.posScale.xyz + d.xyz;
    vNormal = rot * aNormal;

    // gl_DrawID（4.6 核心）：当前是一次 MultiDraw 里的第几条命令。
    // 本例命令按网格类型排列，所以它恰好等于 meshType；实际项目常用它索引每条命令的材质。
    // 非 MultiDraw 的普通 draw call 里它恒为 0，所以对照模式改用 meshType
    uint drawIndex = naive ? s.meshType : uint(gl_DrawID);
    const vec3 meshTint[3] = vec3[](vec3(1.0, 0.85, 0.7), vec3(0.7, 0.85, 1.0), vec3(0.8, 1.0, 0.7));
    vColor = s.color * meshTint[drawIndex];

    gl_Position = viewProj * vec4(worldPos, 1.0);
}
