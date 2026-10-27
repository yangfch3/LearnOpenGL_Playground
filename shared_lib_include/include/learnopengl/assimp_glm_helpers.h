#ifndef ASSIMP_GLM_HELPERS_H
#define ASSIMP_GLM_HELPERS_H

#include <assimp/matrix4x4.h>
#include <assimp/quaternion.h>
#include <assimp/vector3.h>

#include <glm/glm.hpp>
#include <glm/gtc/quaternion.hpp>

// assimp 类型 -> glm 类型
class AssimpGLMHelpers
{
public:
    // aiMatrix4x4 行主序（a1..a4 是第一行），glm 列主序（to[列][行]），逐元素转置拷贝
    static glm::mat4 ConvertMatrixToGLMFormat(const aiMatrix4x4& from)
    {
        glm::mat4 to;
        to[0][0] = from.a1; to[1][0] = from.a2; to[2][0] = from.a3; to[3][0] = from.a4;
        to[0][1] = from.b1; to[1][1] = from.b2; to[2][1] = from.b3; to[3][1] = from.b4;
        to[0][2] = from.c1; to[1][2] = from.c2; to[2][2] = from.c3; to[3][2] = from.c4;
        to[0][3] = from.d1; to[1][3] = from.d2; to[2][3] = from.d3; to[3][3] = from.d4;
        return to;
    }

    static glm::vec3 GetGLMVec(const aiVector3D& vec)
    {
        return glm::vec3(vec.x, vec.y, vec.z);
    }

    // glm::quat 构造参数顺序是 (w, x, y, z)
    static glm::quat GetGLMQuat(const aiQuaternion& q)
    {
        return glm::quat(q.w, q.x, q.y, q.z);
    }
};

#endif
