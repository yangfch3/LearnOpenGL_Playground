#version 460 core
in vec3 vColor;
out vec4 FragColor;

void main()
{
    // 加性混合下，粒子越密越亮，系数小一些避免大片过曝
    FragColor = vec4(vColor * 0.25, 1.0);
}
