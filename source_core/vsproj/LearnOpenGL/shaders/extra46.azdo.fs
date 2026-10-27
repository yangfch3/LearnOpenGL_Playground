#version 460 core
in vec3 vNormal;
in vec3 vColor;
out vec4 FragColor;

void main()
{
    float diff = max(dot(normalize(vNormal), normalize(vec3(0.4, 1.0, 0.3))), 0.0);
    FragColor = vec4(vColor * (0.25 + 0.75 * diff), 1.0);
}
