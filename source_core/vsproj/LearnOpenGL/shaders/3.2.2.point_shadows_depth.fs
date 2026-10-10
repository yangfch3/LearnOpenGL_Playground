#version 330 core
// 从顶点着色器传来的片段位置
in vec4 FragPos;

// 光源位置
uniform vec3 lightPos;
// 远裁剪面
uniform float far_plane;

void main()
{
    // 计算片段到光源的距离
    float lightDistance = length(FragPos.xyz - lightPos);
    
    // map to [0;1] range by dividing by far_plane
    // 把距离除以远裁剪面，映射到 [0, 1] 范围
    lightDistance = lightDistance / far_plane;
    
    // write this as modified depth
    // 把这个归一化距离写入深度值
    gl_FragDepth = lightDistance;
}