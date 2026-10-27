#ifndef ANIMATION_H
#define ANIMATION_H

#include <assimp/Importer.hpp>
#include <assimp/scene.h>
#include <assimp/postprocess.h>

#include <glm/glm.hpp>

#include <learnopengl/animdata.h>
#include <learnopengl/assimp_glm_helpers.h>
#include <learnopengl/bone.h>
#include <learnopengl/model_animation.h>

#include <algorithm>
#include <cassert>
#include <map>
#include <string>
#include <vector>

// 节点层级的拷贝（Importer 析构后 aiScene 失效，必须自己保存）
struct AssimpNodeData
{
    glm::mat4 transformation;
    std::string name;
    std::vector<AssimpNodeData> children;
};

// 一段动画：节点层级 + 各骨骼关键帧轨道。
// assimp 里「骨骼」并不是独立的树：骨架就是场景节点树（aiNode），
// aiBone 只是按名字引用某个节点并附带 offset 和权重，aiNodeAnim 也按名字引用节点。
// 所以三者之间全靠节点名字关联
class Animation
{
public:
    // 默认取文件中第 0 段动画；model 用于对齐骨骼 ID，使轨道算出的矩阵写进顶点引用的同一下标
    Animation(const std::string& animationPath, Model* model)
    {
        Assimp::Importer importer;
        const aiScene* scene = importer.ReadFile(animationPath, aiProcess_Triangulate);
        assert(scene && scene->mRootNode && scene->mNumAnimations > 0);

        const aiAnimation* animation = scene->mAnimations[0];
        m_Duration = (float)animation->mDuration;
        // 部分格式不写 tick 率，此时按 25 处理
        m_TicksPerSecond = animation->mTicksPerSecond != 0.0 ? (float)animation->mTicksPerSecond : 25.0f;

        ReadHierarchyData(m_RootNode, scene->mRootNode);
        ReadBones(animation, *model);
    }

    // 节点名 -> 骨骼轨道；无轨道的节点返回 nullptr（使用其静态变换）
    Bone* FindBone(const std::string& name)
    {
        auto it = std::find_if(m_Bones.begin(), m_Bones.end(),
                               [&](const Bone& bone) { return bone.GetBoneName() == name; });
        return it == m_Bones.end() ? nullptr : &(*it);
    }

    float GetTicksPerSecond() const { return m_TicksPerSecond; }
    float GetDuration() const { return m_Duration; }
    const AssimpNodeData& GetRootNode() const { return m_RootNode; }
    const std::map<std::string, BoneInfo>& GetBoneIDMap() const { return m_BoneInfoMap; }

private:
    void ReadBones(const aiAnimation* animation, Model& model)
    {
        std::map<std::string, BoneInfo>& boneInfoMap = model.GetBoneInfoMap();
        int& boneCount = model.GetBoneCount();

        for (unsigned int i = 0; i < animation->mNumChannels; ++i)
        {
            const aiNodeAnim* channel = animation->mChannels[i];
            std::string boneName = channel->mNodeName.data;

            // 有动画轨道但不蒙皮任何顶点的骨骼，网格里不存在，这里补一个 ID
            if (boneInfoMap.find(boneName) == boneInfoMap.end())
            {
                boneInfoMap[boneName] = { boneCount, glm::mat4(1.0f) };
                ++boneCount;
            }
            m_Bones.push_back(Bone(boneName, boneInfoMap[boneName].id, channel));
        }
        m_BoneInfoMap = boneInfoMap;
    }

    void ReadHierarchyData(AssimpNodeData& dest, const aiNode* src)
    {
        dest.name = src->mName.data;
        dest.transformation = AssimpGLMHelpers::ConvertMatrixToGLMFormat(src->mTransformation);
        for (unsigned int i = 0; i < src->mNumChildren; ++i)
        {
            AssimpNodeData child;
            ReadHierarchyData(child, src->mChildren[i]);
            dest.children.push_back(child);
        }
    }

    float m_Duration;
    float m_TicksPerSecond;
    std::vector<Bone> m_Bones;
    AssimpNodeData m_RootNode;
    std::map<std::string, BoneInfo> m_BoneInfoMap;
};

#endif
