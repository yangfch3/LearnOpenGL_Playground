#ifndef MESH_H
#define MESH_H

// 包含 glad，里面有所有 OpenGL 类型声明
#include <glad/glad.h>

// 包含 glm 数学库
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>

// 包含 LearnOpenGL 封装好的 Shader 类
#include <learnopengl/shader.h>

// 标准库
#include <string>
#include <vector>
using namespace std;

// 每个顶点最多受多少根骨骼影响
// 用于骨骼动画，这里先定义好，后面骨骼动画章节会用到
#define MAX_BONE_INFLUENCE 4

// 顶点结构体
// 描述一个顶点包含的所有数据
struct Vertex {
    // 位置
    glm::vec3 Position;
    // 法线
    glm::vec3 Normal;
    // 纹理坐标
    glm::vec2 TexCoords;
    // 切线
    glm::vec3 Tangent;
    // 副切线
    glm::vec3 Bitangent;
    // 影响这个顶点的骨骼索引
    int m_BoneIDs[MAX_BONE_INFLUENCE];
    // 每根骨骼对应的权重
    float m_Weights[MAX_BONE_INFLUENCE];
};

// 纹理结构体
// 描述一张已经加载到 GPU 的纹理
struct Texture {
    // 纹理 ID
    unsigned int id;
    // 纹理类型，比如 texture_diffuse、texture_specular
    string type;
    // 纹理文件路径
    string path;
};

class Mesh {
public:
    // 网格数据
    // 顶点列表
    vector<Vertex>       vertices;
    // 索引列表
    vector<unsigned int> indices;
    // 这个网格用到的所有纹理
    vector<Texture>      textures;
    // 顶点数组对象 ID
    unsigned int VAO;

    // 构造函数
    // 接收顶点、索引、纹理，然后配置好顶点缓冲和属性指针
    Mesh(vector<Vertex> vertices, vector<unsigned int> indices, vector<Texture> textures)
    {
        // 保存顶点数据
        this->vertices = vertices;
        // 保存索引数据
        this->indices = indices;
        // 保存纹理数据
        this->textures = textures;

        // 现在所有数据都有了，配置顶点缓冲和属性指针
        setupMesh();
    }

    // 渲染网格
    void Draw(Shader& shader)
    {
        // 绑定对应的纹理
        // 因为着色器里的采样器名字是 texture_diffuse1、texture_diffuse2 这样的格式
        // 所以这里要为每种类型分别计数
        unsigned int diffuseNr = 1;
        unsigned int specularNr = 1;
        unsigned int normalNr = 1;
        unsigned int heightNr = 1;

        // 遍历所有纹理
        for (unsigned int i = 0; i < textures.size(); i++)
        {
            // 激活对应的纹理单元
            // 第 i 张贴图绑定到纹理单元 i
            glActiveTexture(GL_TEXTURE0 + i);

            // 取出纹理编号，也就是 diffuse_textureN 里的 N
            string number;
            string name = textures[i].type;

            if (name == "texture_diffuse")
                number = std::to_string(diffuseNr++);
            else if (name == "texture_specular")
                number = std::to_string(specularNr++);
            else if (name == "texture_normal")
                number = std::to_string(normalNr++);
            else if (name == "texture_height")
                number = std::to_string(heightNr++);

            // 把着色器里对应采样器设置为正确的纹理单元
            // 例如 texture_diffuse1 设置为纹理单元 i
            glUniform1i(glGetUniformLocation(shader.ID, (name + number).c_str()), i);

            // 绑定纹理
            glBindTexture(GL_TEXTURE_2D, textures[i].id);
        }

        // 绘制网格
        // 绑定 VAO
        glBindVertexArray(VAO);
        // 使用索引绘制三角形
        glDrawElements(GL_TRIANGLES, static_cast<unsigned int>(indices.size()), GL_UNSIGNED_INT, 0);
        // 解绑 VAO
        glBindVertexArray(0);

        // 配置完成后，最好把状态恢复成默认值
        glActiveTexture(GL_TEXTURE0);
    }

private:
    // 渲染用到的数据
    // 顶点缓冲对象 ID
    unsigned int VBO;
    // 索引缓冲对象 ID
    unsigned int EBO;

    // 初始化所有缓冲对象和数组对象
    void setupMesh()
    {
        // 创建缓冲和数组
        glGenVertexArrays(1, &VAO);
        glGenBuffers(1, &VBO);
        glGenBuffers(1, &EBO);

        // 绑定 VAO，之后对顶点属性的配置都会记录到这个 VAO 中
        glBindVertexArray(VAO);

        // 把数据加载到顶点缓冲
        glBindBuffer(GL_ARRAY_BUFFER, VBO);

        // 结构体的一个好处是它的内存布局是连续的
        // 所以可以直接把结构体指针传进去，它会自动转成 glm::vec3/2 数组
        // 进而转成 3/2 个 float，再转成字节数组
        glBufferData(GL_ARRAY_BUFFER, vertices.size() * sizeof(Vertex), &vertices[0], GL_STATIC_DRAW);

        // 把索引数据加载到索引缓冲
        glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, EBO);
        glBufferData(GL_ELEMENT_ARRAY_BUFFER, indices.size() * sizeof(unsigned int), &indices[0], GL_STATIC_DRAW);

        // 设置顶点属性指针
        // 顶点位置
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)0);

        // 顶点法线
        glEnableVertexAttribArray(1);
        glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)offsetof(Vertex, Normal));

        // 顶点纹理坐标
        glEnableVertexAttribArray(2);
        glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)offsetof(Vertex, TexCoords));

        // 顶点切线
        glEnableVertexAttribArray(3);
        glVertexAttribPointer(3, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)offsetof(Vertex, Tangent));

        // 顶点副切线
        glEnableVertexAttribArray(4);
        glVertexAttribPointer(4, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)offsetof(Vertex, Bitangent));

        // 骨骼索引
        // 注意：这里用的是 glVertexAttribIPointer，因为骨骼索引是整数
        glEnableVertexAttribArray(5);
        glVertexAttribIPointer(5, 4, GL_INT, sizeof(Vertex), (void*)offsetof(Vertex, m_BoneIDs));

        // 骨骼权重
        glEnableVertexAttribArray(6);
        glVertexAttribPointer(6, 4, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)offsetof(Vertex, m_Weights));

        // 解绑 VAO
        glBindVertexArray(0);
    }
};
#endif