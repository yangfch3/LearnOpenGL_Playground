#version 330 core
// PBR 通用顶点着色器：把位置、法线变换到世界空间，供片元着色器做光照计算
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aNormal;
layout (location = 2) in vec2 aTexCoords;

out vec2 TexCoords;
out vec3 WorldPos;
out vec3 Normal;

uniform mat4 projection;
uniform mat4 view;
uniform mat4 model;
uniform mat3 normalMatrix;   // = transpose(inverse(mat3(model)))，保证非均匀缩放下法线仍垂直于表面

void main()
{
    TexCoords = aTexCoords;
    WorldPos = vec3(model * vec4(aPos, 1.0));
    Normal = normalMatrix * aNormal;   

    gl_Position =  projection * view * vec4(WorldPos, 1.0);
}
