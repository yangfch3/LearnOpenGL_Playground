// Forward+（Tiled Forward）：用 compute 按屏幕分块剔除光源，着色时每像素只算所在块的光源
// 按键：1 Forward+ / 2 传统 forward（每像素遍历全部光源）/ 3 Forward+ 热力图；WASD + 鼠标移动
//
// 对比 deferred_shading_volumes.cpp：延迟渲染用光源体积限制每盏灯影响的像素，但 G-Buffer 带宽大、
// 难以处理透明和 MSAA；Forward+ 仍是前向着色（材质自由、支持透明/MSAA），用分块列表解决多光源问题
//
// 每帧流程：
//   深度预渲染（只写深度）-> compute 分块剔除（读深度，写每块光源列表）-> 屏障
//   -> 着色 pass（GL_LEQUAL、不写深度，只有最终可见的片段会着色）-> blit 到屏幕
#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>

#include <learnopengl/shader.h>
#include <learnopengl/compute_shader.h>
#include <learnopengl/camera.h>
#include <learnopengl/gl_debug.h>

#include <algorithm>
#include <cmath>
#include <iostream>
#include <random>
#include <string>
#include <vector>

extern "C" { __declspec(dllexport) unsigned long NvOptimusEnablement = 1; }

void mouse_callback(GLFWwindow* window, double xpos, double ypos);
void processInput(GLFWwindow* window);
unsigned int createMeshVAO(const float* vertices, size_t floatCount);
void renderScene(const Shader& shader);

const unsigned int SCR_WIDTH = 1280;
const unsigned int SCR_HEIGHT = 720;
// 须与 extra46.light_culling.comp / extra46.forward_plus.fs 一致
const unsigned int TILE_SIZE = 16;
const unsigned int MAX_LIGHTS_PER_TILE = 256;
const unsigned int LIGHT_COUNT = 1024;
const float NEAR_PLANE = 0.1f;
const float FAR_PLANE = 200.0f;

// 与着色器中 std430 的 struct PointLight 逐字节对应
struct PointLight
{
    glm::vec4 posRadius;
    glm::vec4 color;
};

int shadingMode = 0;

Camera camera(glm::vec3(0.0f, 8.0f, 30.0f));
float lastX = SCR_WIDTH / 2.0f;
float lastY = SCR_HEIGHT / 2.0f;
bool firstMouse = true;
float deltaTime = 0.0f;

unsigned int planeVAO, cubeVAO;

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

    Shader depthShader("shaders/extra46.forward_plus.vs", "shaders/extra46.empty.fs");
    Shader shadingShader("shaders/extra46.forward_plus.vs", "shaders/extra46.forward_plus.fs");
    ComputeShader cullingShader("shaders/extra46.light_culling.comp");

    // ---- 几何体：顶点布局 位置(3) 法线(3) ----
    const float planeVertices[] = {
         40.0f, 0.0f,  40.0f, 0.0f, 1.0f, 0.0f,
        -40.0f, 0.0f, -40.0f, 0.0f, 1.0f, 0.0f,
        -40.0f, 0.0f,  40.0f, 0.0f, 1.0f, 0.0f,
         40.0f, 0.0f,  40.0f, 0.0f, 1.0f, 0.0f,
         40.0f, 0.0f, -40.0f, 0.0f, 1.0f, 0.0f,
        -40.0f, 0.0f, -40.0f, 0.0f, 1.0f, 0.0f
    };
    const float cubeVertices[] = {
        -1,-1,-1, 0,0,-1,   1, 1,-1, 0,0,-1,   1,-1,-1, 0,0,-1,
         1, 1,-1, 0,0,-1,  -1,-1,-1, 0,0,-1,  -1, 1,-1, 0,0,-1,
        -1,-1, 1, 0,0, 1,   1,-1, 1, 0,0, 1,   1, 1, 1, 0,0, 1,
         1, 1, 1, 0,0, 1,  -1, 1, 1, 0,0, 1,  -1,-1, 1, 0,0, 1,
        -1, 1, 1,-1,0, 0,  -1, 1,-1,-1,0, 0,  -1,-1,-1,-1,0, 0,
        -1,-1,-1,-1,0, 0,  -1,-1, 1,-1,0, 0,  -1, 1, 1,-1,0, 0,
         1, 1, 1, 1,0, 0,   1,-1,-1, 1,0, 0,   1, 1,-1, 1,0, 0,
         1,-1,-1, 1,0, 0,   1, 1, 1, 1,0, 0,   1,-1, 1, 1,0, 0,
        -1,-1,-1, 0,-1,0,   1,-1,-1, 0,-1,0,   1,-1, 1, 0,-1,0,
         1,-1, 1, 0,-1,0,  -1,-1, 1, 0,-1,0,  -1,-1,-1, 0,-1,0,
        -1, 1,-1, 0, 1,0,   1, 1, 1, 0, 1,0,   1, 1,-1, 0, 1,0,
         1, 1, 1, 0, 1,0,  -1, 1,-1, 0, 1,0,  -1, 1, 1, 0, 1,0
    };
    planeVAO = createMeshVAO(planeVertices, sizeof(planeVertices) / sizeof(float));
    cubeVAO = createMeshVAO(cubeVertices, sizeof(cubeVertices) / sizeof(float));

    // ---- 光源：随机分布在地面上方，每帧绕各自的基准点转圈 ----
    std::mt19937 rng(1);
    std::uniform_real_distribution<float> uni(0.0f, 1.0f);
    std::vector<PointLight> lights(LIGHT_COUNT);
    std::vector<glm::vec4> lightBase(LIGHT_COUNT);   // xyz 基准位置，w 相位
    for (unsigned int i = 0; i < LIGHT_COUNT; ++i)
    {
        lightBase[i] = glm::vec4(uni(rng) * 70.0f - 35.0f, 0.3f + uni(rng) * 3.0f, uni(rng) * 70.0f - 35.0f, uni(rng) * 6.2831f);
        glm::vec3 c(uni(rng), uni(rng), uni(rng));
        lights[i].color = glm::vec4(c / std::max(c.r, std::max(c.g, c.b)) * 1.5f, 1.0f);
        lights[i].posRadius.w = 3.0f + uni(rng) * 2.0f;
    }

    // GL_DYNAMIC_STORAGE_BIT：允许之后用 glNamedBufferSubData 更新（不可变存储默认不允许）
    unsigned int lightBuffer;
    glCreateBuffers(1, &lightBuffer);
    glNamedBufferStorage(lightBuffer, sizeof(PointLight) * LIGHT_COUNT, nullptr, GL_DYNAMIC_STORAGE_BIT);

    // 每块的光源索引表与计数：只由 GPU 读写，flags = 0
    const unsigned int numTilesX = (SCR_WIDTH + TILE_SIZE - 1) / TILE_SIZE;
    const unsigned int numTilesY = (SCR_HEIGHT + TILE_SIZE - 1) / TILE_SIZE;
    const unsigned int numTiles = numTilesX * numTilesY;
    unsigned int tileIndexBuffer, tileCountBuffer;
    glCreateBuffers(1, &tileIndexBuffer);
    glNamedBufferStorage(tileIndexBuffer, sizeof(unsigned int) * numTiles * MAX_LIGHTS_PER_TILE, nullptr, 0);
    glCreateBuffers(1, &tileCountBuffer);
    glNamedBufferStorage(tileCountBuffer, sizeof(unsigned int) * numTiles, nullptr, 0);

    glBindBufferBase(GL_SHADER_STORAGE_BUFFER, 0, lightBuffer);
    glBindBufferBase(GL_SHADER_STORAGE_BUFFER, 1, tileIndexBuffer);
    glBindBufferBase(GL_SHADER_STORAGE_BUFFER, 2, tileCountBuffer);

    // ---- 离屏 FBO：深度要作为纹理给 compute 读，默认帧缓冲的深度做不到 ----
    unsigned int colorTex, depthTex, fbo;
    glCreateTextures(GL_TEXTURE_2D, 1, &colorTex);
    glTextureStorage2D(colorTex, 1, GL_RGBA8, SCR_WIDTH, SCR_HEIGHT);
    glCreateTextures(GL_TEXTURE_2D, 1, &depthTex);
    glTextureStorage2D(depthTex, 1, GL_DEPTH_COMPONENT32F, SCR_WIDTH, SCR_HEIGHT);
    glCreateFramebuffers(1, &fbo);
    glNamedFramebufferTexture(fbo, GL_COLOR_ATTACHMENT0, colorTex, 0);
    glNamedFramebufferTexture(fbo, GL_DEPTH_ATTACHMENT, depthTex, 0);
    if (glCheckNamedFramebufferStatus(fbo, GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "ERROR::FRAMEBUFFER:: Framebuffer is not complete!" << std::endl;

    glEnable(GL_DEPTH_TEST);
    glfwSwapInterval(0);

    const glm::mat4 projection = glm::perspective(glm::radians(45.0f), (float)SCR_WIDTH / (float)SCR_HEIGHT, NEAR_PLANE, FAR_PLANE);
    const glm::mat4 inverseProjection = glm::inverse(projection);

    float lastFrame = (float)glfwGetTime();
    double lastTitleTime = 0.0;
    int frameCount = 0;

    while (!glfwWindowShouldClose(window))
    {
        float now = (float)glfwGetTime();
        deltaTime = now - lastFrame;
        lastFrame = now;
        processInput(window);

        // 更新光源位置并上传（32KB/帧，量小，用 SubData 即可；大量逐帧数据见 azdo.cpp 的持久映射）
        for (unsigned int i = 0; i < LIGHT_COUNT; ++i)
        {
            const glm::vec4& b = lightBase[i];
            float a = now * 0.5f + b.w;
            lights[i].posRadius = glm::vec4(b.x + 2.0f * std::cos(a), b.y, b.z + 2.0f * std::sin(a), lights[i].posRadius.w);
        }
        glNamedBufferSubData(lightBuffer, 0, sizeof(PointLight) * LIGHT_COUNT, lights.data());

        const glm::mat4 view = camera.GetViewMatrix();

        // ---- 1. 深度预渲染 ----
        glBindFramebuffer(GL_FRAMEBUFFER, fbo);
        glViewport(0, 0, SCR_WIDTH, SCR_HEIGHT);
        // glClear 受写掩码影响：上一帧末尾 depthMask 为 FALSE，必须先打开，否则深度清不掉
        glDepthMask(GL_TRUE);
        glColorMask(GL_TRUE, GL_TRUE, GL_TRUE, GL_TRUE);
        const float clearColor[] = { 0.0f, 0.0f, 0.0f, 1.0f };
        const float clearDepth = 1.0f;
        glClearNamedFramebufferfv(fbo, GL_COLOR, 0, clearColor);
        glClearNamedFramebufferfv(fbo, GL_DEPTH, 0, &clearDepth);

        glColorMask(GL_FALSE, GL_FALSE, GL_FALSE, GL_FALSE);
        glDepthFunc(GL_LESS);
        depthShader.use();
        depthShader.setMat4("projection", projection);
        depthShader.setMat4("view", view);
        renderScene(depthShader);

        // ---- 2. 光源分块剔除 ----
        // 光栅化写深度 -> 之后的纹理采样，属于 GL 自动同步的范围，不需要 glMemoryBarrier
        cullingShader.use();
        cullingShader.setMat4("view", view);
        cullingShader.setMat4("inverseProjection", inverseProjection);
        cullingShader.setIVec2("screenSize", glm::ivec2(SCR_WIDTH, SCR_HEIGHT));
        cullingShader.setUInt("lightCount", LIGHT_COUNT);
        cullingShader.setFloat("nearPlane", NEAR_PLANE);
        cullingShader.setFloat("farPlane", FAR_PLANE);
        glBindTextureUnit(0, depthTex);
        // 一个工作组 = 一个 tile
        glDispatchCompute(numTilesX, numTilesY, 1);
        // compute 写 SSBO -> FS 读 SSBO：非一致性写入，需要屏障
        glMemoryBarrier(GL_SHADER_STORAGE_BARRIER_BIT);

        // ---- 3. 着色 ----
        // 深度已是最终结果：LEQUAL 只让「最前面」的片段通过，昂贵的光照每像素只算一次（无 overdraw）。
        // 不再写深度，也省一点带宽
        glColorMask(GL_TRUE, GL_TRUE, GL_TRUE, GL_TRUE);
        glDepthMask(GL_FALSE);
        glDepthFunc(GL_LEQUAL);
        shadingShader.use();
        shadingShader.setMat4("projection", projection);
        shadingShader.setMat4("view", view);
        shadingShader.setVec3("viewPos", camera.Position);
        // uniform 声明为 uint 时必须用 glUniform1ui，用 1i 会报 GL_INVALID_OPERATION（Shader 类没有 uint 版本）
        glUniform1ui(glGetUniformLocation(shadingShader.ID, "numTilesX"), numTilesX);
        glUniform1ui(glGetUniformLocation(shadingShader.ID, "lightCount"), LIGHT_COUNT);
        shadingShader.setInt("mode", shadingMode);
        renderScene(shadingShader);

        // ---- 4. 拷到默认帧缓冲 ----
        glBlitNamedFramebuffer(fbo, 0, 0, 0, SCR_WIDTH, SCR_HEIGHT, 0, 0, SCR_WIDTH, SCR_HEIGHT, GL_COLOR_BUFFER_BIT, GL_NEAREST);

        glfwSwapBuffers(window);
        glfwPollEvents();

        ++frameCount;
        if (now - lastTitleTime >= 0.5)
        {
            const char* modeName[] = { "Forward+", "Brute force", "Forward+ heatmap" };
            std::string title = std::string("forward_plus  ") + modeName[shadingMode] + "  " + std::to_string(LIGHT_COUNT)
                              + " lights  " + std::to_string(1000.0 * (now - lastTitleTime) / frameCount) + " ms";
            glfwSetWindowTitle(window, title.c_str());
            lastTitleTime = now;
            frameCount = 0;
        }
    }

    glfwTerminate();
    return 0;
}

// 地面 + 9x9 立方体阵列
void renderScene(const Shader& shader)
{
    shader.setVec3("albedo", glm::vec3(0.8f));
    shader.setMat4("model", glm::mat4(1.0f));
    glBindVertexArray(planeVAO);
    glDrawArrays(GL_TRIANGLES, 0, 6);

    shader.setVec3("albedo", glm::vec3(0.9f, 0.85f, 0.8f));
    glBindVertexArray(cubeVAO);
    for (int x = -4; x <= 4; ++x)
    {
        for (int z = -4; z <= 4; ++z)
        {
            float h = 1.0f + 0.5f * ((x + z + 8) % 3);
            glm::mat4 model = glm::translate(glm::mat4(1.0f), glm::vec3(x * 7.0f, h, z * 7.0f));
            model = glm::scale(model, glm::vec3(1.0f, h, 1.0f));
            shader.setMat4("model", model);
            glDrawArrays(GL_TRIANGLES, 0, 36);
        }
    }
}

// DSA 版 VAO：顶点格式（属性如何解读）与数据来源（哪个 buffer）分开描述。
//   glVertexArrayVertexBuffer：把 buffer 挂到绑定点 0，并给出步长
//   glVertexArrayAttribFormat：属性 i 的分量数、类型、在顶点内的偏移
//   glVertexArrayAttribBinding：属性 i 从绑定点 0 取数据
// 换 buffer 只需改第一步，格式不变；旧的 glVertexAttribPointer 把三者揉在一起，且依赖当前绑定的 VBO
unsigned int createMeshVAO(const float* vertices, size_t floatCount)
{
    unsigned int vbo, vao;
    glCreateBuffers(1, &vbo);
    glNamedBufferStorage(vbo, floatCount * sizeof(float), vertices, 0);

    glCreateVertexArrays(1, &vao);
    glVertexArrayVertexBuffer(vao, 0, vbo, 0, 6 * sizeof(float));
    glEnableVertexArrayAttrib(vao, 0);
    glVertexArrayAttribFormat(vao, 0, 3, GL_FLOAT, GL_FALSE, 0);
    glVertexArrayAttribBinding(vao, 0, 0);
    glEnableVertexArrayAttrib(vao, 1);
    glVertexArrayAttribFormat(vao, 1, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float));
    glVertexArrayAttribBinding(vao, 1, 0);
    return vao;
}

void processInput(GLFWwindow* window)
{
    if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS)
        glfwSetWindowShouldClose(window, true);

    float speedScale = 4.0f;
    if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS)
        camera.ProcessKeyboard(FORWARD, deltaTime * speedScale);
    if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS)
        camera.ProcessKeyboard(BACKWARD, deltaTime * speedScale);
    if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS)
        camera.ProcessKeyboard(LEFT, deltaTime * speedScale);
    if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS)
        camera.ProcessKeyboard(RIGHT, deltaTime * speedScale);

    if (glfwGetKey(window, GLFW_KEY_1) == GLFW_PRESS) shadingMode = 0;
    if (glfwGetKey(window, GLFW_KEY_2) == GLFW_PRESS) shadingMode = 1;
    if (glfwGetKey(window, GLFW_KEY_3) == GLFW_PRESS) shadingMode = 2;
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
