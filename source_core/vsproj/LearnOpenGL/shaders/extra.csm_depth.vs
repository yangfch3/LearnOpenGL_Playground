#version 330 core
layout (location = 0) in vec3 aPos;

uniform mat4 model;

void main()
{
    // 只变到世界空间，各级联的光源矩阵在 GS 里乘
    gl_Position = model * vec4(aPos, 1.0);
}
