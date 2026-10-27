#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aNormal;
layout (location = 2) in vec2 aTexCoords;
// 与 mesh.h 的属性位置一致。ID 必须用 glVertexAttribIPointer 上传、这里声明为 ivec4，
// 若用 glVertexAttribPointer，整数会被转成浮点，ID 就全错了
layout (location = 5) in ivec4 aBoneIds;
layout (location = 6) in vec4 aWeights;

// 须与 animator.h 的 MAX_BONES、mesh.h 的 MAX_BONE_INFLUENCE 一致
const int MAX_BONES = 100;
const int MAX_BONE_INFLUENCE = 4;
// 每根骨骼的蒙皮矩阵：把绑定姿势（T-pose）下的模型空间顶点，变到当前帧该骨骼带动后的模型空间位置
uniform mat4 finalBonesMatrices[MAX_BONES];

uniform mat4 projection;
uniform mat4 view;
uniform mat4 model;

out vec2 TexCoords;
out vec3 Normal;

void main()
{
    // 线性混合蒙皮 (LBS)：每根骨骼各自把顶点搬到一个位置，再按权重加权平均（权重和为 1）。
    // 等价于先把矩阵按权重混合再乘顶点。矩阵线性混合不保持刚性，
    // 关节大幅扭转时会塌陷（candy-wrapper），改进方案是对偶四元数蒙皮 (DQS)
    vec4 skinnedPos = vec4(0.0);
    vec3 skinnedNormal = vec3(0.0);
    for (int i = 0; i < MAX_BONE_INFLUENCE; i++)
    {
        // -1 表示该槽位为空（见 model_animation.h 的初始化）
        if (aBoneIds[i] < 0)
            continue;
        mat4 boneMatrix = finalBonesMatrices[aBoneIds[i]];
        skinnedPos += boneMatrix * vec4(aPos, 1.0) * aWeights[i];
        // 骨骼矩阵只含旋转/平移/均匀缩放，直接取 mat3 变换法线
        skinnedNormal += mat3(boneMatrix) * aNormal * aWeights[i];
    }

    TexCoords = aTexCoords;
    // 蒙皮后仍在模型空间，之后与静态模型完全一样走 model/view/projection
    Normal = mat3(transpose(inverse(model))) * skinnedNormal;
    gl_Position = projection * view * model * skinnedPos;
}
