#ifndef BONE_H
#define BONE_H

#include <assimp/anim.h>

#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/quaternion.hpp>

#include <learnopengl/assimp_glm_helpers.h>

#include <string>
#include <vector>

struct KeyPosition { glm::vec3 position;    float timeStamp; };
struct KeyRotation { glm::quat orientation; float timeStamp; };
struct KeyScale    { glm::vec3 scale;       float timeStamp; };

// 一根骨骼的关键帧轨道（对应 aiNodeAnim），按动画时间插值出局部变换（相对父节点）。
// 平移/旋转/缩放三条轨道分开存、关键帧数量与时间点可各不相同，所以要分别查找、分别插值，
// 最后再合成矩阵；直接对矩阵插值会引入错误的缩放与剪切
class Bone
{
public:
    Bone(const std::string& name, int ID, const aiNodeAnim* channel)
        : m_Name(name), m_ID(ID), m_LocalTransform(1.0f)
    {
        for (unsigned int i = 0; i < channel->mNumPositionKeys; ++i)
            m_Positions.push_back({ AssimpGLMHelpers::GetGLMVec(channel->mPositionKeys[i].mValue),
                                    (float)channel->mPositionKeys[i].mTime });
        for (unsigned int i = 0; i < channel->mNumRotationKeys; ++i)
            m_Rotations.push_back({ AssimpGLMHelpers::GetGLMQuat(channel->mRotationKeys[i].mValue),
                                    (float)channel->mRotationKeys[i].mTime });
        for (unsigned int i = 0; i < channel->mNumScalingKeys; ++i)
            m_Scales.push_back({ AssimpGLMHelpers::GetGLMVec(channel->mScalingKeys[i].mValue),
                                 (float)channel->mScalingKeys[i].mTime });
    }

    // animationTime 单位是 tick
    void Update(float animationTime)
    {
        glm::mat4 translation = InterpolatePosition(animationTime);
        glm::mat4 rotation    = InterpolateRotation(animationTime);
        glm::mat4 scale       = InterpolateScaling(animationTime);
        // 先缩放、再旋转、再平移
        m_LocalTransform = translation * rotation * scale;
    }

    const glm::mat4& GetLocalTransform() const { return m_LocalTransform; }
    const std::string& GetBoneName() const { return m_Name; }
    int GetBoneID() const { return m_ID; }

private:
    // 找 t 所在区间 [keys[i], keys[i+1]) 的 i；超出末帧时钳到最后一段
    template <typename Key>
    static int FindKeyIndex(const std::vector<Key>& keys, float t)
    {
        for (int i = 0; i + 1 < (int)keys.size(); ++i)
            if (t < keys[i + 1].timeStamp)
                return i;
        return (int)keys.size() - 2;
    }

    // 区间内归一化插值因子 [0,1]
    static float GetScaleFactor(float lastTimeStamp, float nextTimeStamp, float t)
    {
        return glm::clamp((t - lastTimeStamp) / (nextTimeStamp - lastTimeStamp), 0.0f, 1.0f);
    }

    glm::mat4 InterpolatePosition(float t) const
    {
        if (m_Positions.size() == 1)
            return glm::translate(glm::mat4(1.0f), m_Positions[0].position);
        int i = FindKeyIndex(m_Positions, t);
        float f = GetScaleFactor(m_Positions[i].timeStamp, m_Positions[i + 1].timeStamp, t);
        return glm::translate(glm::mat4(1.0f), glm::mix(m_Positions[i].position, m_Positions[i + 1].position, f));
    }

    // 旋转用四元数球面插值，避免矩阵线性插值导致的缩放/剪切
    glm::mat4 InterpolateRotation(float t) const
    {
        if (m_Rotations.size() == 1)
            return glm::mat4_cast(glm::normalize(m_Rotations[0].orientation));
        int i = FindKeyIndex(m_Rotations, t);
        float f = GetScaleFactor(m_Rotations[i].timeStamp, m_Rotations[i + 1].timeStamp, t);
        glm::quat q = glm::slerp(m_Rotations[i].orientation, m_Rotations[i + 1].orientation, f);
        return glm::mat4_cast(glm::normalize(q));
    }

    glm::mat4 InterpolateScaling(float t) const
    {
        if (m_Scales.size() == 1)
            return glm::scale(glm::mat4(1.0f), m_Scales[0].scale);
        int i = FindKeyIndex(m_Scales, t);
        float f = GetScaleFactor(m_Scales[i].timeStamp, m_Scales[i + 1].timeStamp, t);
        return glm::scale(glm::mat4(1.0f), glm::mix(m_Scales[i].scale, m_Scales[i + 1].scale, f));
    }

    std::vector<KeyPosition> m_Positions;
    std::vector<KeyRotation> m_Rotations;
    std::vector<KeyScale> m_Scales;

    std::string m_Name;
    int m_ID;
    glm::mat4 m_LocalTransform;
};

#endif
