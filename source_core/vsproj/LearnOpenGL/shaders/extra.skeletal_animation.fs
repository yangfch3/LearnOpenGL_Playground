#version 330 core
out vec4 FragColor;

in vec2 TexCoords;
in vec3 Normal;

uniform sampler2D texture_diffuse1;
uniform vec3 lightDir;

void main()
{
    vec3 color = texture(texture_diffuse1, TexCoords).rgb;
    // 简单方向光漫反射，用来观察蒙皮后的法线是否随动作正确变化
    float diff = max(dot(normalize(Normal), lightDir), 0.0);
    FragColor = vec4((0.3 + 0.7 * diff) * color, 1.0);
}
