#version 460 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aNormal;

uniform mat4 projection;
uniform mat4 view;
uniform mat4 model;

out vec3 FragPos;
out vec3 Normal;

// 深度预渲染和着色 pass 用两个不同的 program 画同一几何体，第二遍用 GL_LEQUAL 依赖两遍深度完全相同。
// 不同 program 即使源码相同，编译器也可能做出不同优化（如乘法顺序、FMA 融合），导致深度差最后一位；
// invariant 要求编译器保证：相同输入、相同计算路径时 gl_Position 逐位一致
invariant gl_Position;

void main()
{
    FragPos = vec3(model * vec4(aPos, 1.0));
    Normal = mat3(transpose(inverse(model))) * aNormal;
    gl_Position = projection * view * vec4(FragPos, 1.0);
}
