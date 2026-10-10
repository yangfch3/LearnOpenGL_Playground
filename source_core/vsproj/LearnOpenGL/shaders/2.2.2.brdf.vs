#version 330 core
// BRDF LUT 生成用顶点着色器：直接输出 NDC 全屏四边形（无变换），
// TexCoords 在片元着色器中被解释为 (NdotV, roughness)
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec2 aTexCoords;

out vec2 TexCoords;

void main()
{
    TexCoords = aTexCoords;
	gl_Position = vec4(aPos, 1.0);
}
