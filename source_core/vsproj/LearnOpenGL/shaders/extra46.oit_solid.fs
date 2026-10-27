#version 460 core
// 不透明物体，以及「普通混合」对照模式下的透明物体
in vec3 Normal;
out vec4 FragColor;

uniform vec4 color;

void main()
{
    // 固定方向光；abs 让面片正反两面都被照亮
    float diff = abs(dot(normalize(Normal), normalize(vec3(0.4, 1.0, 0.3))));
    FragColor = vec4(color.rgb * (0.35 + 0.65 * diff), color.a);
}
