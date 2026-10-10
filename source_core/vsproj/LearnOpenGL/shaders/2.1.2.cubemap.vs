#version 330 core
// 立方体贴图捕获用顶点着色器（equirect 转换 / 辐照度卷积 / 预滤波 共用）
// 相机位于原点、90° FOV、宽高比 1，依次朝 6 个轴向渲染单位立方体，
// 每次正好铺满立方体贴图的一个面；WorldPos 即该像素对应的采样方向
layout (location = 0) in vec3 aPos;

out vec3 WorldPos;

uniform mat4 projection;
uniform mat4 view;

void main()
{
    WorldPos = aPos;  
    gl_Position =  projection * view * vec4(WorldPos, 1.0);
}
