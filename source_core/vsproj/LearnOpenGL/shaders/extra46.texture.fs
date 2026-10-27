#version 460 core
out vec4 FragColor;
in vec2 TexCoords;

// 4.2+ 可在着色器里直接指定纹理单元，C++ 端不再需要 setInt("tex", 0)
layout (binding = 0) uniform sampler2D tex;

void main()
{
    FragColor = texture(tex, TexCoords);
}
