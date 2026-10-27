#ifndef ANIMDATA_H
#define ANIMDATA_H

#include <glm/glm.hpp>

struct BoneInfo
{
    // 在 finalBonesMatrices 中的下标
    int id;
    // 逆绑定矩阵：模型空间 -> 该骨骼局部空间（绑定姿势下）
    glm::mat4 offset;
};

#endif
