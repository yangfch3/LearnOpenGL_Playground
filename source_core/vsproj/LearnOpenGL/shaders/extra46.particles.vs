#version 460 core
// 没有任何顶点属性：直接用 gl_VertexID 去 SSBO 里取粒子数据（「顶点拉取」vertex pulling）。
// 另一种做法是把同一个 buffer 当 VBO 绑到 VAO，用 layout(location=0) 读，两者等价
struct Particle
{
    vec4 pos;
    vec4 vel;
};
layout (std430, binding = 0) readonly buffer ParticleBuffer
{
    Particle particles[];
};

uniform mat4 viewProj;

out vec3 vColor;

void main()
{
    Particle pt = particles[gl_VertexID];
    // 按速度着色：慢 = 蓝，快 = 橙
    float speed = length(pt.vel.xyz);
    vColor = mix(vec3(0.1, 0.3, 1.0), vec3(1.0, 0.5, 0.1), clamp(speed / 6.0, 0.0, 1.0));

    gl_Position = viewProj * vec4(pt.pos.xyz, 1.0);
    // 需 glEnable(GL_PROGRAM_POINT_SIZE) 才生效
    gl_PointSize = 1.5;
}
