#ifndef MODEL_H
#define MODEL_H

// 包含 glad 库，用来加载 OpenGL 函数指针
#include <glad/glad.h> 

// 包含 glm 数学库
#include <glm/glm.hpp>
// 包含矩阵变换相关功能
#include <glm/gtc/matrix_transform.hpp>
// 包含 stb_image，用来加载贴图
#include <stb_image.h>
// 包含 assimp 库，用来解析 .obj、.fbx 等模型文件
#include <assimp/Importer.hpp>
// 包含 assimp 场景数据结构
#include <assimp/scene.h>
// 包含 assimp 后处理选项
#include <assimp/postprocess.h>

// 包含 LearnOpenGL 封装好的 Mesh 类
#include <learnopengl/mesh.h>
// 包含 LearnOpenGL 封装好的 Shader 类
#include <learnopengl/shader.h>

// 标准库
#include <string>
#include <fstream>
#include <sstream>
#include <iostream>
#include <map>
#include <vector>
using namespace std;

// 从文件加载纹理的工具函数声明
// path：纹理相对路径
// directory：模型所在目录
// gamma：是否做 gamma 校正
unsigned int TextureFromFile(const char *path, const string &directory, bool gamma = false);

class Model 
{
public:
    // 模型数据
    // 已经加载过的纹理，避免同一个纹理被重复加载
    vector<Texture> textures_loaded;
    // 模型包含的所有网格
    vector<Mesh>    meshes;
    // 模型文件所在目录，用来拼接贴图的相对路径
    string directory;
    // 是否做 gamma 校正
    bool gammaCorrection;

    // 构造函数，参数是 3D 模型文件路径
    Model(string const &path, bool gamma = false) : gammaCorrection(gamma)
    {
        // 调用 loadModel 加载模型
        loadModel(path);
    }

    // 绘制模型，也就是绘制它包含的所有网格
    void Draw(Shader &shader)
    {
        // 遍历每个网格并绘制
        for(unsigned int i = 0; i < meshes.size(); i++)
            meshes[i].Draw(shader);
    }
    
private:
    // 加载模型文件，并把得到的网格存入 meshes 向量
    void loadModel(string const &path)
    {
        // 用 ASSIMP 读取文件
        Assimp::Importer importer;

        // ReadFile 的第二个参数是后处理选项：
        //   aiProcess_Triangulate          把所有图元三角化
        //   aiProcess_GenSmoothNormals     如果模型没有法线，就生成平滑法线
        //   aiProcess_FlipUVs              翻转 UV 的 y 轴
        //   aiProcess_CalcTangentSpace     计算切线空间，用于法线贴图
        const aiScene* scene = importer.ReadFile(
            path,
            aiProcess_Triangulate |
            aiProcess_GenSmoothNormals |
            aiProcess_FlipUVs |
            aiProcess_CalcTangentSpace
        );

        // 检查是否有错误
        if(!scene || scene->mFlags & AI_SCENE_FLAGS_INCOMPLETE || !scene->mRootNode)
        {
            // 输出 assimp 的错误信息
            cout << "ERROR::ASSIMP:: " << importer.GetErrorString() << endl;
            return;
        }

        // 获取模型文件所在目录
        // 例如 path = "resources/objects/backpack/backpack.obj"
        // 那么 directory = "resources/objects/backpack"
        directory = path.substr(0, path.find_last_of('/'));

        // 递归处理 assimp 的根节点
        processNode(scene->mRootNode, scene);
    }

    // 递归处理节点
    // 处理当前节点上的每个网格，并递归处理它的子节点
    void processNode(aiNode *node, const aiScene *scene)
    {
        // 处理当前节点上的每个网格
        for(unsigned int i = 0; i < node->mNumMeshes; i++)
        {
            // node 只包含索引，真正的数据在 scene 里
            // node 只是用来组织层级关系，比如父子节点关系
            aiMesh* mesh = scene->mMeshes[node->mMeshes[i]];
            // 把处理后的网格加入 meshes 向量
            meshes.push_back(processMesh(mesh, scene));
        }

        // 处理完当前节点的所有网格后，递归处理它的子节点
        for(unsigned int i = 0; i < node->mNumChildren; i++)
        {
            processNode(node->mChildren[i], scene);
        }
    }

    // 把一个 aiMesh 转换成我们自己的 Mesh 对象
    Mesh processMesh(aiMesh *mesh, const aiScene *scene)
    {
        // 用来填充的数据
        vector<Vertex> vertices;
        vector<unsigned int> indices;
        vector<Texture> textures;

        // 遍历网格的每个顶点
        for(unsigned int i = 0; i < mesh->mNumVertices; i++)
        {
            Vertex vertex;

            // 临时向量，因为 assimp 有自己的向量类型，不能直接转成 glm::vec3
            glm::vec3 vector;

            // 位置
            vector.x = mesh->mVertices[i].x;
            vector.y = mesh->mVertices[i].y;
            vector.z = mesh->mVertices[i].z;
            vertex.Position = vector;

            // 法线
            if (mesh->HasNormals())
            {
                vector.x = mesh->mNormals[i].x;
                vector.y = mesh->mNormals[i].y;
                vector.z = mesh->mNormals[i].z;
                vertex.Normal = vector;
            }

            // 纹理坐标
            if(mesh->mTextureCoords[0]) // 网格是否包含纹理坐标
            {
                glm::vec2 vec;
                // 一个顶点最多可以有 8 组纹理坐标
                // 这里假设模型不会用到多组纹理坐标，所以总是取第一组 (0)
                vec.x = mesh->mTextureCoords[0][i].x;
                vec.y = mesh->mTextureCoords[0][i].y;
                vertex.TexCoords = vec;

                // 切线
                vector.x = mesh->mTangents[i].x;
                vector.y = mesh->mTangents[i].y;
                vector.z = mesh->mTangents[i].z;
                vertex.Tangent = vector;

                // 副切线
                vector.x = mesh->mBitangents[i].x;
                vector.y = mesh->mBitangents[i].y;
                vector.z = mesh->mBitangents[i].z;
                vertex.Bitangent = vector;
            }
            else
            {
                // 如果没有纹理坐标，就设为 (0, 0)
                vertex.TexCoords = glm::vec2(0.0f, 0.0f);
            }

            vertices.push_back(vertex);
        }

        // 遍历网格的每个面，取出对应的顶点索引
        // 一个面就是一个三角形
        for(unsigned int i = 0; i < mesh->mNumFaces; i++)
        {
            aiFace face = mesh->mFaces[i];
            // 取出这个面的所有索引，加入 indices 向量
            for(unsigned int j = 0; j < face.mNumIndices; j++)
                indices.push_back(face.mIndices[j]);
        }

        // 处理材质
        aiMaterial* material = scene->mMaterials[mesh->mMaterialIndex];

        // 这里假设着色器里采样器的命名规则是：
        //   diffuse:  texture_diffuseN
        //   specular: texture_specularN
        //   normal:   texture_normalN
        // 其中 N 是从 1 开始的连续编号

        // 1. 漫反射贴图
        vector<Texture> diffuseMaps = loadMaterialTextures(material, aiTextureType_DIFFUSE, "texture_diffuse");
        textures.insert(textures.end(), diffuseMaps.begin(), diffuseMaps.end());

        // 2. 镜面反射贴图
        vector<Texture> specularMaps = loadMaterialTextures(material, aiTextureType_SPECULAR, "texture_specular");
        textures.insert(textures.end(), specularMaps.begin(), specularMaps.end());

        // 3. 法线贴图
        // 注意：assimp 里法线贴图类型是 aiTextureType_HEIGHT
        std::vector<Texture> normalMaps = loadMaterialTextures(material, aiTextureType_HEIGHT, "texture_normal");
        textures.insert(textures.end(), normalMaps.begin(), normalMaps.end());

        // 4. 高度贴图
        std::vector<Texture> heightMaps = loadMaterialTextures(material, aiTextureType_AMBIENT, "texture_height");
        textures.insert(textures.end(), heightMaps.begin(), heightMaps.end());

        // 用提取出的数据创建一个 Mesh 对象并返回
        return Mesh(vertices, indices, textures);
    }

    // 检查给定类型的所有材质纹理，如果还没有加载过就加载
    // 返回一个 Texture 结构体向量
    vector<Texture> loadMaterialTextures(aiMaterial *mat, aiTextureType type, string typeName)
    {
        vector<Texture> textures;

        // 遍历这种类型的所有贴图
        for(unsigned int i = 0; i < mat->GetTextureCount(type); i++)
        {
            aiString str;
            // 获取贴图路径
            mat->GetTexture(type, i, &str);

            // 检查这个贴图之前是否已经加载过
            // 如果加载过，就跳过，不再重复加载
            bool skip = false;
            for(unsigned int j = 0; j < textures_loaded.size(); j++)
            {
                // 用路径比较，判断是否是同一张贴图
                if(std::strcmp(textures_loaded[j].path.data(), str.C_Str()) == 0)
                {
                    // 已经加载过，直接复用
                    textures.push_back(textures_loaded[j]);
                    // 标记跳过
                    skip = true;
                    break;
                }
            }

            // 如果没加载过，就加载
            if(!skip)
            {
                Texture texture;
                // 从文件加载纹理
                texture.id = TextureFromFile(str.C_Str(), this->directory);
                // 记录纹理类型
                texture.type = typeName;
                // 记录纹理路径
                texture.path = str.C_Str();
                // 加入当前网格的纹理列表
                textures.push_back(texture);
                // 加入全局已加载纹理列表，避免重复加载
                textures_loaded.push_back(texture);
            }
        }

        return textures;
    }
};

// 从文件加载纹理的工具函数
unsigned int TextureFromFile(const char *path, const string &directory, bool gamma)
{
    // 把相对路径和模型目录拼接成完整路径
    string filename = string(path);
    filename = directory + '/' + filename;

    // 纹理 ID
    unsigned int textureID;
    glGenTextures(1, &textureID);

    int width, height, nrComponents;
    // 用 stb_image 加载图片
    unsigned char *data = stbi_load(filename.c_str(), &width, &height, &nrComponents, 0);

    if (data)
    {
        // 根据通道数决定像素格式
        GLenum format;
        if (nrComponents == 1)
            format = GL_RED;
        else if (nrComponents == 3)
            format = GL_RGB;
        else if (nrComponents == 4)
            format = GL_RGBA;

        // 绑定纹理并上传数据
        glBindTexture(GL_TEXTURE_2D, textureID);
        glTexImage2D(GL_TEXTURE_2D, 0, format, width, height, 0, format, GL_UNSIGNED_BYTE, data);
        // 生成 mipmap
        glGenerateMipmap(GL_TEXTURE_2D);

        // 设置环绕方式和过滤方式
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

        // 释放图片内存
        stbi_image_free(data);
    }
    else
    {
        // 加载失败输出错误
        std::cout << "Texture failed to load at path: " << path << std::endl;
        stbi_image_free(data);
    }

    return textureID;
}
#endif