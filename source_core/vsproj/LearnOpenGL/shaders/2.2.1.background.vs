#version 330 core
// =============================================================================
// 天空盒顶点着色器
// =============================================================================
layout (location = 0) in vec3 aPos;

uniform mat4 projection;
uniform mat4 view;

out vec3 WorldPos;   // 立方体局部坐标，片元着色器中作为立方体贴图采样方向

void main()
{
    WorldPos = aPos;

	// 去掉 view 矩阵的平移，只保留旋转：天空盒始终以相机为中心
	mat4 rotView = mat4(mat3(view));
	vec4 clipPos = projection * rotView * vec4(WorldPos, 1.0);

	// z 设为 w，透视除法后深度恒为 1.0（最远处）；
	// 配合 glDepthFunc(GL_LEQUAL)，天空盒只会画在没有物体遮挡的地方
	gl_Position = clipPos.xyww;
}
