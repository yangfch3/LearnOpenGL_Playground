#ifndef ANIMATOR_H
#define ANIMATOR_H

#include <glm/glm.hpp>

#include <learnopengl/animation.h>

#include <cmath>
#include <vector>

// 须与着色器中 finalBonesMatrices 数组长度一致
#define MAX_BONES 100

// 推进动画时间，沿节点层级算出每根骨骼的最终蒙皮矩阵
class Animator
{
public:
    Animator(Animation* animation)
        : m_CurrentAnimation(animation), m_CurrentTime(0.0f),
          m_FinalBoneMatrices(MAX_BONES, glm::mat4(1.0f))
    {
    }

    // 动画时间以 tick 计（关键帧时间戳的单位），秒 * tick/秒 = tick；取模实现循环播放
    void UpdateAnimation(float dt)
    {
        m_CurrentTime += m_CurrentAnimation->GetTicksPerSecond() * dt;
        m_CurrentTime = std::fmod(m_CurrentTime, m_CurrentAnimation->GetDuration());
        CalculateBoneTransform(m_CurrentAnimation->GetRootNode(), glm::mat4(1.0f));
    }

    const std::vector<glm::mat4>& GetFinalBoneMatrices() const { return m_FinalBoneMatrices; }

private:
    // 自根向下累乘：global = parentGlobal * local（子骨骼随父骨骼运动，如前臂随上臂）。
    // 蒙皮矩阵 = global * offset，从右往左读：
    //   offset：绑定姿势下，模型空间 -> 该骨骼局部空间（「顶点相对这根骨骼在哪」）
    //   global：当前帧，该骨骼局部空间 -> 模型空间（「这根骨骼现在在哪」）
    // 绑定姿势下（且网格节点本身无额外变换时）global 恰为 offset 的逆，蒙皮矩阵 = 单位阵，模型保持原样
    void CalculateBoneTransform(const AssimpNodeData& node, const glm::mat4& parentTransform)
    {
        glm::mat4 nodeTransform = node.transformation;
        // 有关键帧的节点用插值结果替换其静态变换；没有的（如中间组节点）沿用文件里的变换，
        // 它们本身不蒙皮顶点，但必须参与累乘，否则子骨骼位置会错
        if (Bone* bone = m_CurrentAnimation->FindBone(node.name))
        {
            bone->Update(m_CurrentTime);
            nodeTransform = bone->GetLocalTransform();
        }
        glm::mat4 globalTransformation = parentTransform * nodeTransform;

        const auto& boneInfoMap = m_CurrentAnimation->GetBoneIDMap();
        auto it = boneInfoMap.find(node.name);
        if (it != boneInfoMap.end())
            m_FinalBoneMatrices[it->second.id] = globalTransformation * it->second.offset;

        for (const AssimpNodeData& child : node.children)
            CalculateBoneTransform(child, globalTransformation);
    }

    Animation* m_CurrentAnimation;
    float m_CurrentTime;
    std::vector<glm::mat4> m_FinalBoneMatrices;
};

#endif
