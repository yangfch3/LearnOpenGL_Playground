// AZDO（Approaching Zero Driver Overhead）+ GPU-driven 绘制
// 按键：M 切换 AZDO（compute 剔除 + 1 次 MultiDrawIndirect）/ 传统（每物体 1 次 draw call）；WASD + 鼠标移动
//
// 驱动开销来自每次 draw call 前的状态校验、绑定切换、uniform 上传。AZDO 的思路是让 CPU 几乎不发命令：
//   1. 所有网格塞进同一个 VBO/EBO，用 baseVertex/firstIndex 区分 -> 无需切换 VAO
//   2. 物体数据放 SSBO，VS 自己按实例号去取 -> 无需逐物体 glUniform
//   3. glMultiDrawElementsIndirect：命令本身也放在 GPU buffer 里，一次调用画完全部网格
//   4. 由 compute 剔除并填写命令中的 instanceCount -> CPU 连「画多少个」都不用知道
//   5. 逐帧更新的数据用持久映射 + 栅栏环形缓冲 -> 无 Map/Unmap 与隐式同步
//
// 每帧流程（AZDO 模式）：
//   等栅栏 -> CPU 写本帧动态数据段 -> 重置命令 -> compute 剔除 -> 屏障 -> MultiDrawIndirect -> 插栅栏
#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>

#include <learnopengl/shader.h>
#include <learnopengl/compute_shader.h>
#include <learnopengl/camera.h>
#include <learnopengl/gl_debug.h>

#include <array>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <iostream>
#include <random>
#include <string>
#include <vector>

extern "C" { __declspec(dllexport) unsigned long NvOptimusEnablement = 1; }

void mouse_callback(GLFWwindow* window, double xpos, double ypos);
void processInput(GLFWwindow* window);

const unsigned int SCR_WIDTH = 1280;
const unsigned int SCR_HEIGHT = 720;
const unsigned int OBJECT_COUNT = 20000;
const unsigned int MESH_TYPE_COUNT = 3;
// 环形缓冲段数：CPU 写第 N 帧时，GPU 可能还在读第 N-1、N-2 帧的数据
const unsigned int FRAMES_IN_FLIGHT = 3;
// 与 extra46.azdo_cull.comp 的 local_size_x 一致
const unsigned int LOCAL_SIZE = 256;

struct Vertex
{
    glm::vec3 pos;
    glm::vec3 normal;
};

// 与 std430 的 struct ObjectStatic 逐字节对应（vec3 + uint 共占 16 字节，见 azdo_cull.comp 注释）
struct ObjectStatic
{
    glm::vec4 posScale;
    glm::vec3 color;
    uint32_t meshType;
};
static_assert(sizeof(ObjectStatic) == 32, "must match std430 layout");

// glMultiDrawElementsIndirect 规定的命令格式
struct DrawElementsIndirectCommand
{
    uint32_t count;
    uint32_t instanceCount;
    uint32_t firstIndex;
    int32_t  baseVertex;
    uint32_t baseInstance;
};

// 网格在共享 VBO/EBO 中的位置
struct MeshRange
{
    uint32_t indexCount;
    uint32_t firstIndex;
    int32_t  baseVertex;
};

bool useAZDO = true;
bool toggleKeyPressed = false;

Camera camera(glm::vec3(0.0f, 20.0f, 160.0f));
float lastX = SCR_WIDTH / 2.0f;
float lastY = SCR_HEIGHT / 2.0f;
bool firstMouse = true;
float deltaTime = 0.0f;

// ---- 网格生成：全部以原点为中心，包围球半径须与 azdo_cull.comp 的 meshRadius 一致 ----

// 边长 1 的立方体（半径 0.87）：每面 4 个顶点（法线不共享），法线 n 与面内两轴满足 cross(u, v) = n，保证逆时针
void appendCube(std::vector<Vertex>& v, std::vector<uint32_t>& idx)
{
    const glm::vec3 faces[6][3] = {
        { { 1, 0, 0}, {0, 1, 0}, {0, 0, 1} }, { {-1, 0, 0}, {0, 0, 1}, {0, 1, 0} },
        { { 0, 1, 0}, {0, 0, 1}, {1, 0, 0} }, { { 0,-1, 0}, {1, 0, 0}, {0, 0, 1} },
        { { 0, 0, 1}, {1, 0, 0}, {0, 1, 0} }, { { 0, 0,-1}, {0, 1, 0}, {1, 0, 0} }
    };
    for (const auto& f : faces)
    {
        const glm::vec3 n = f[0], u = f[1], w = f[2];
        uint32_t base = (uint32_t)v.size();
        v.push_back({ 0.5f * (n - u - w), n });
        v.push_back({ 0.5f * (n + u - w), n });
        v.push_back({ 0.5f * (n + u + w), n });
        v.push_back({ 0.5f * (n - u + w), n });
        idx.insert(idx.end(), { base, base + 1, base + 2, base + 2, base + 3, base });
    }
}

// 半径 0.5 的 UV 球
void appendSphere(std::vector<Vertex>& v, std::vector<uint32_t>& idx)
{
    const int stacks = 12, slices = 24;
    const float PI = 3.14159265f;
    uint32_t base = (uint32_t)v.size();
    for (int i = 0; i <= stacks; ++i)
    {
        float phi = PI * i / stacks;
        for (int j = 0; j <= slices; ++j)
        {
            float theta = 2.0f * PI * j / slices;
            glm::vec3 n(std::sin(phi) * std::cos(theta), std::cos(phi), std::sin(phi) * std::sin(theta));
            v.push_back({ 0.5f * n, n });
        }
    }
    for (int i = 0; i < stacks; ++i)
    {
        for (int j = 0; j < slices; ++j)
        {
            uint32_t a = base + i * (slices + 1) + j;
            uint32_t b = a + slices + 1;
            idx.insert(idx.end(), { a, a + 1, b, b, a + 1, b + 1 });
        }
    }
}

// 四棱锥：底面 y = -0.25，顶点 y = 0.5，到原点最远距离 0.75
void appendPyramid(std::vector<Vertex>& v, std::vector<uint32_t>& idx)
{
    const glm::vec3 apex(0.0f, 0.5f, 0.0f);
    const glm::vec3 c[4] = { {-0.5f, -0.25f, -0.5f}, {0.5f, -0.25f, -0.5f}, {0.5f, -0.25f, 0.5f}, {-0.5f, -0.25f, 0.5f} };
    uint32_t base = (uint32_t)v.size();
    for (int i = 0; i < 4; ++i)
        v.push_back({ c[i], glm::vec3(0.0f, -1.0f, 0.0f) });
    idx.insert(idx.end(), { base, base + 1, base + 2, base + 2, base + 3, base });
    for (int i = 0; i < 4; ++i)
    {
        const glm::vec3& p0 = c[(i + 1) % 4];
        const glm::vec3& p1 = c[i];
        glm::vec3 n = glm::normalize(glm::cross(p1 - p0, apex - p0));
        uint32_t s = (uint32_t)v.size();
        v.push_back({ p0, n });
        v.push_back({ p1, n });
        v.push_back({ apex, n });
        idx.insert(idx.end(), { s, s + 1, s + 2 });
    }
}

// 从 viewProj 提取 6 个视锥平面（Gribb-Hartmann）：裁剪条件 -w <= x,y,z <= w 逐条改写成 dot(plane, p) >= 0。
// glm 列主序，m[col][row]，所以第 r 行是 (m[0][r], m[1][r], m[2][r], m[3][r])
std::array<glm::vec4, 6> extractFrustumPlanes(const glm::mat4& m)
{
    glm::vec4 row[4];
    for (int r = 0; r < 4; ++r)
        row[r] = glm::vec4(m[0][r], m[1][r], m[2][r], m[3][r]);
    std::array<glm::vec4, 6> planes = {
        row[3] + row[0], row[3] - row[0],   // 左、右
        row[3] + row[1], row[3] - row[1],   // 下、上
        row[3] + row[2], row[3] - row[2]    // 近、远
    };
    // 归一化后 dot(n, p) + d 才是真正的有符号距离，才能和包围球半径比较
    for (glm::vec4& p : planes)
        p /= glm::length(glm::vec3(p));
    return planes;
}

int main()
{
    glfwInit();
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 4);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 6);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
    glfwWindowHint(GLFW_OPENGL_DEBUG_CONTEXT, GL_TRUE);
    glfwWindowHint(GLFW_RESIZABLE, GL_FALSE);

    GLFWwindow* window = glfwCreateWindow(SCR_WIDTH, SCR_HEIGHT, "LearnOpenGL", NULL, NULL);
    if (window == NULL)
    {
        std::cout << "Failed to create GLFW window" << std::endl;
        glfwTerminate();
        return -1;
    }
    glfwMakeContextCurrent(window);
    glfwSetCursorPosCallback(window, mouse_callback);
    glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);

    if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress))
    {
        std::cout << "Failed to initialize GLAD" << std::endl;
        return -1;
    }
    setupGLDebug();

    Shader drawShader("shaders/extra46.azdo.vs", "shaders/extra46.azdo.fs");
    ComputeShader cullShader("shaders/extra46.azdo_cull.comp");

    // ---- 1. 共享几何缓冲：三种网格首尾相接 ----
    std::vector<Vertex> vertices;
    std::vector<uint32_t> indices;
    MeshRange meshes[MESH_TYPE_COUNT];
    // 函数指针数组，下标即 meshType
    void (*generators[MESH_TYPE_COUNT])(std::vector<Vertex>&, std::vector<uint32_t>&) = { appendCube, appendSphere, appendPyramid };
    for (unsigned int t = 0; t < MESH_TYPE_COUNT; ++t)
    {
        // 生成函数写出的是全局编号，这里减回网格内局部编号（从 0 开始）；
        // 绘制时 GPU 用 index + baseVertex 去取顶点，同一份索引数据可以放在 VBO 的任意位置
        meshes[t].baseVertex = (int32_t)vertices.size();
        meshes[t].firstIndex = (uint32_t)indices.size();
        uint32_t vertexStart = (uint32_t)vertices.size();
        generators[t](vertices, indices);
        for (size_t k = meshes[t].firstIndex; k < indices.size(); ++k)
            indices[k] -= vertexStart;
        meshes[t].indexCount = (uint32_t)indices.size() - meshes[t].firstIndex;
    }

    unsigned int vbo, ebo, vao;
    glCreateBuffers(1, &vbo);
    glNamedBufferStorage(vbo, sizeof(Vertex) * vertices.size(), vertices.data(), 0);
    glCreateBuffers(1, &ebo);
    glNamedBufferStorage(ebo, sizeof(uint32_t) * indices.size(), indices.data(), 0);
    glCreateVertexArrays(1, &vao);
    glVertexArrayVertexBuffer(vao, 0, vbo, 0, sizeof(Vertex));
    glVertexArrayElementBuffer(vao, ebo);
    glEnableVertexArrayAttrib(vao, 0);
    glVertexArrayAttribFormat(vao, 0, 3, GL_FLOAT, GL_FALSE, offsetof(Vertex, pos));
    glVertexArrayAttribBinding(vao, 0, 0);
    glEnableVertexArrayAttrib(vao, 1);
    glVertexArrayAttribFormat(vao, 1, 3, GL_FLOAT, GL_FALSE, offsetof(Vertex, normal));
    glVertexArrayAttribBinding(vao, 1, 0);

    // ---- 2. 物体静态数据：按网格类型连续存放，每种类型占一段 ----
    // 前 1/3 是立方体、中间 1/3 是球、最后 1/3 是四棱锥；typeOffset[t] 记录每段起点，
    // 之后作为该类型间接命令的 baseInstance，也就是可见列表中该类型的起始位置
    std::vector<ObjectStatic> objects(OBJECT_COUNT);
    uint32_t typeOffset[MESH_TYPE_COUNT] = {};
    std::mt19937 rng(3);
    std::uniform_real_distribution<float> uni(0.0f, 1.0f);
    for (unsigned int i = 0; i < OBJECT_COUNT; ++i)
    {
        uint32_t type = i * MESH_TYPE_COUNT / OBJECT_COUNT;
        if (i == 0 || type != objects[i - 1].meshType)
            typeOffset[type] = i;
        objects[i].posScale = glm::vec4(uni(rng) * 300.0f - 150.0f, uni(rng) * 40.0f - 10.0f, uni(rng) * 300.0f - 150.0f, 0.5f + uni(rng) * 1.5f);
        objects[i].color = glm::vec3(0.4f) + 0.6f * glm::vec3(uni(rng), uni(rng), uni(rng));
        objects[i].meshType = type;
    }
    unsigned int staticBuffer;
    glCreateBuffers(1, &staticBuffer);
    glNamedBufferStorage(staticBuffer, sizeof(ObjectStatic) * OBJECT_COUNT, objects.data(), 0);

    // ---- 3. 物体动态数据：持久映射环形缓冲 ----
    // PERSISTENT：映射期间 GPU 仍可使用该 buffer，指针可一直保留，不必每帧 Map/Unmap；
    // COHERENT：CPU 写入无需手动 glFlushMappedBufferRange 就对之后提交的 GL 命令可见。
    // 代价：驱动不再帮你同步，CPU 改写 GPU 正在读的数据会产生撕裂 -> 必须用栅栏自己保证
    GLint ssboAlign = 0;
    glGetIntegerv(GL_SHADER_STORAGE_BUFFER_OFFSET_ALIGNMENT, &ssboAlign);
    const size_t dynamicBytes = sizeof(glm::vec4) * OBJECT_COUNT;
    // glBindBufferRange 的偏移必须是该对齐值的整数倍，每段大小向上取整
    const size_t segmentBytes = (dynamicBytes + ssboAlign - 1) / ssboAlign * ssboAlign;
    const GLbitfield mapFlags = GL_MAP_WRITE_BIT | GL_MAP_PERSISTENT_BIT | GL_MAP_COHERENT_BIT;
    unsigned int dynamicBuffer;
    glCreateBuffers(1, &dynamicBuffer);
    glNamedBufferStorage(dynamicBuffer, segmentBytes * FRAMES_IN_FLIGHT, nullptr, mapFlags);
    char* dynamicMapped = (char*)glMapNamedBufferRange(dynamicBuffer, 0, segmentBytes * FRAMES_IN_FLIGHT, mapFlags);
    GLsync fences[FRAMES_IN_FLIGHT] = {};

    // ---- 4. 间接命令：每种网格一条，baseInstance 指向该类型在可见列表中的区间起点 ----
    DrawElementsIndirectCommand commandTemplate[MESH_TYPE_COUNT];
    for (unsigned int t = 0; t < MESH_TYPE_COUNT; ++t)
        commandTemplate[t] = { meshes[t].indexCount, 0u, meshes[t].firstIndex, meshes[t].baseVertex, typeOffset[t] };
    unsigned int commandBuffer;
    glCreateBuffers(1, &commandBuffer);
    glNamedBufferStorage(commandBuffer, sizeof(commandTemplate), commandTemplate, GL_DYNAMIC_STORAGE_BIT);

    unsigned int visibleBuffer;
    glCreateBuffers(1, &visibleBuffer);
    glNamedBufferStorage(visibleBuffer, sizeof(uint32_t) * OBJECT_COUNT, nullptr, 0);

    glBindBufferBase(GL_SHADER_STORAGE_BUFFER, 0, staticBuffer);
    glBindBufferBase(GL_SHADER_STORAGE_BUFFER, 2, commandBuffer);
    glBindBufferBase(GL_SHADER_STORAGE_BUFFER, 3, visibleBuffer);
    // DSA 只免去了「为编辑而绑定」，「为使用而绑定」仍需要：glMultiDraw*Indirect 从这个绑定点读命令
    glBindBuffer(GL_DRAW_INDIRECT_BUFFER, commandBuffer);

    const GLint locNaive = glGetUniformLocation(drawShader.ID, "naive");
    const GLint locNaiveObject = glGetUniformLocation(drawShader.ID, "naiveObject");

    glEnable(GL_DEPTH_TEST);
    glfwSwapInterval(0);

    const glm::mat4 projection = glm::perspective(glm::radians(45.0f), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 400.0f);

    unsigned long long frameNumber = 0;
    float lastFrame = (float)glfwGetTime();
    double lastTitleTime = 0.0;
    int frameCount = 0;

    while (!glfwWindowShouldClose(window))
    {
        float now = (float)glfwGetTime();
        deltaTime = now - lastFrame;
        lastFrame = now;
        processInput(window);

        // ---- a. 等待本段数据不再被 GPU 使用 ----
        // 该段上次使用是 FRAMES_IN_FLIGHT 帧之前，正常情况下早已完成，等待几乎为零；
        // 若 GPU 跟不上，CPU 在这里被阻塞，自然限制了领先的帧数
        const unsigned int seg = frameNumber % FRAMES_IN_FLIGHT;
        if (fences[seg])
        {
            // FLUSH_COMMANDS_BIT：确保栅栏命令已提交给 GPU，否则可能永远等不到
            while (glClientWaitSync(fences[seg], GL_SYNC_FLUSH_COMMANDS_BIT, 1000000) == GL_TIMEOUT_EXPIRED) {}
            glDeleteSync(fences[seg]);
            fences[seg] = nullptr;
        }

        // ---- b. CPU 直接写映射内存：上下浮动 + 自转 ----
        glm::vec4* dyn = (glm::vec4*)(dynamicMapped + seg * segmentBytes);
        for (unsigned int i = 0; i < OBJECT_COUNT; ++i)
        {
            float phase = i * 0.37f;
            dyn[i] = glm::vec4(0.0f, 1.5f * std::sin(now * 1.3f + phase), 0.0f, now * (0.5f + (i % 7) * 0.2f));
        }
        // 着色器只看到本帧这一段
        glBindBufferRange(GL_SHADER_STORAGE_BUFFER, 1, dynamicBuffer, seg * segmentBytes, dynamicBytes);

        const glm::mat4 viewProj = projection * camera.GetViewMatrix();

        glClearColor(0.05f, 0.05f, 0.08f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        drawShader.use();
        drawShader.setMat4("viewProj", viewProj);
        glBindVertexArray(vao);

        if (useAZDO)
        {
            // ---- c. 重置 instanceCount 为 0（其余字段不变）----
            // 上一帧的绘制可能还在读这个 buffer，SubData 的同步由驱动处理（可能内部换一块存储），只有 60 字节，可接受
            glNamedBufferSubData(commandBuffer, 0, sizeof(commandTemplate), commandTemplate);

            // ---- d. GPU 剔除，填写命令 ----
            cullShader.use();
            const std::array<glm::vec4, 6> planes = extractFrustumPlanes(viewProj);
            for (int p = 0; p < 6; ++p)
                cullShader.setVec4("frustumPlanes[" + std::to_string(p) + "]", planes[p]);
            cullShader.setUInt("objectCount", OBJECT_COUNT);
            glDispatchCompute((OBJECT_COUNT + LOCAL_SIZE - 1) / LOCAL_SIZE, 1, 1);
            // 两种后续读取：命令被 MultiDrawIndirect 读（COMMAND），可见列表被 VS 读（SHADER_STORAGE）
            glMemoryBarrier(GL_COMMAND_BARRIER_BIT | GL_SHADER_STORAGE_BARRIER_BIT);

            // ---- e. 一次调用画完所有网格的所有可见实例 ----
            // CPU 不知道也不需要知道可见数量；indirect = nullptr 表示从 GL_DRAW_INDIRECT_BUFFER 偏移 0 处读
            drawShader.use();
            glUniform1i(locNaive, 0);
            glMultiDrawElementsIndirect(GL_TRIANGLES, GL_UNSIGNED_INT, nullptr, MESH_TYPE_COUNT, 0);
        }
        else
        {
            // 对照：无剔除，每个物体一次 glUniform + 一次 draw call，CPU 提交开销随物体数线性增长
            glUniform1i(locNaive, 1);
            for (unsigned int i = 0; i < OBJECT_COUNT; ++i)
            {
                const MeshRange& m = meshes[objects[i].meshType];
                glUniform1ui(locNaiveObject, i);
                // 绑定了 EBO 时，indices 指针参数实际含义是 EBO 内的字节偏移（历史遗留的写法）
                glDrawElementsBaseVertex(GL_TRIANGLES, m.indexCount, GL_UNSIGNED_INT,
                                         (void*)(sizeof(uint32_t) * m.firstIndex), m.baseVertex);
            }
        }

        // ---- f. 标记：本帧所有读取本段数据的命令都在此之前 ----
        fences[seg] = glFenceSync(GL_SYNC_GPU_COMMANDS_COMPLETE, 0);
        ++frameNumber;

        glfwSwapBuffers(window);
        glfwPollEvents();

        ++frameCount;
        if (now - lastTitleTime >= 0.5)
        {
            std::string title = std::string("azdo  ") + (useAZDO ? "GPU cull + MultiDrawIndirect (1 call)" : "Naive (1 draw call per object)")
                              + "  " + std::to_string(OBJECT_COUNT) + " objects  [M] toggle  "
                              + std::to_string(1000.0 * (now - lastTitleTime) / frameCount) + " ms";
            glfwSetWindowTitle(window, title.c_str());
            lastTitleTime = now;
            frameCount = 0;
        }
    }

    for (GLsync f : fences)
        if (f) glDeleteSync(f);
    glUnmapNamedBuffer(dynamicBuffer);
    glfwTerminate();
    return 0;
}

void processInput(GLFWwindow* window)
{
    if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS)
        glfwSetWindowShouldClose(window, true);

    float speedScale = 15.0f;
    if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS)
        camera.ProcessKeyboard(FORWARD, deltaTime * speedScale);
    if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS)
        camera.ProcessKeyboard(BACKWARD, deltaTime * speedScale);
    if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS)
        camera.ProcessKeyboard(LEFT, deltaTime * speedScale);
    if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS)
        camera.ProcessKeyboard(RIGHT, deltaTime * speedScale);

    if (glfwGetKey(window, GLFW_KEY_M) == GLFW_PRESS && !toggleKeyPressed)
    {
        useAZDO = !useAZDO;
        toggleKeyPressed = true;
    }
    if (glfwGetKey(window, GLFW_KEY_M) == GLFW_RELEASE)
        toggleKeyPressed = false;
}

void mouse_callback(GLFWwindow* window, double xposIn, double yposIn)
{
    float xpos = static_cast<float>(xposIn);
    float ypos = static_cast<float>(yposIn);
    if (firstMouse)
    {
        lastX = xpos;
        lastY = ypos;
        firstMouse = false;
    }
    float xoffset = xpos - lastX;
    float yoffset = lastY - ypos;
    lastX = xpos;
    lastY = ypos;
    camera.ProcessMouseMovement(xoffset, yoffset);
}
