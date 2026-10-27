// 顺序无关透明（OIT）：Weighted Blended OIT
// 按键：T 切换 WBOIT / 普通 alpha 混合（不排序）；WASD + 鼠标移动
//
// 对比 blending_sorted.cpp：CPU 按物体距离排序只能解决「物体之间」的顺序，
// 本例中心三片互相穿插的面片，任何物体级排序都画不对；WBOIT 不需要排序，代价是结果为近似
//
// 每帧流程：
//   1. 不透明 pass -> opaqueFBO（颜色 + 深度）
//   2. 透明 pass   -> transparentFBO（accum + reveal，深度纹理与 1 共享：测试开、写入关）
//   3. 合成 pass   -> 全屏三角形把 2 的结果混合到 opaqueFBO
//   4. blit opaqueFBO -> 屏幕
#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>

#include <learnopengl/shader.h>
#include <learnopengl/camera.h>
#include <learnopengl/gl_debug.h>

#include <iostream>
#include <string>
#include <vector>

extern "C" { __declspec(dllexport) unsigned long NvOptimusEnablement = 1; }

void mouse_callback(GLFWwindow* window, double xpos, double ypos);
void processInput(GLFWwindow* window);
unsigned int createMeshVAO(const float* vertices, size_t floatCount);

const unsigned int SCR_WIDTH = 1280;
const unsigned int SCR_HEIGHT = 720;

bool useOIT = true;
bool toggleKeyPressed = false;

Camera camera(glm::vec3(0.0f, 1.5f, 6.0f));
float lastX = SCR_WIDTH / 2.0f;
float lastY = SCR_HEIGHT / 2.0f;
bool firstMouse = true;
float deltaTime = 0.0f;

struct TransparentObject
{
    glm::mat4 model;
    glm::vec4 color;
};

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

    Shader solidShader("shaders/extra46.oit.vs", "shaders/extra46.oit_solid.fs");
    Shader accumShader("shaders/extra46.oit.vs", "shaders/extra46.oit_accum.fs");
    Shader compositeShader("shaders/extra46.fullscreen.vs", "shaders/extra46.oit_composite.fs");

    // ---- 几何体：位置(3) 法线(3) ----
    const float quadVertices[] = {
        -1.0f, -1.0f, 0.0f, 0.0f, 0.0f, 1.0f,
         1.0f, -1.0f, 0.0f, 0.0f, 0.0f, 1.0f,
         1.0f,  1.0f, 0.0f, 0.0f, 0.0f, 1.0f,
         1.0f,  1.0f, 0.0f, 0.0f, 0.0f, 1.0f,
        -1.0f,  1.0f, 0.0f, 0.0f, 0.0f, 1.0f,
        -1.0f, -1.0f, 0.0f, 0.0f, 0.0f, 1.0f
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
    unsigned int quadVAO = createMeshVAO(quadVertices, sizeof(quadVertices) / sizeof(float));
    unsigned int cubeVAO = createMeshVAO(cubeVertices, sizeof(cubeVertices) / sizeof(float));

    // ---- 透明物体 ----
    std::vector<TransparentObject> transparents;
    // 中心：三片绕 y 轴互成 60° 的面片，两两穿插
    const glm::vec4 crossColors[3] = { {1.0f, 0.2f, 0.2f, 0.5f}, {0.2f, 1.0f, 0.2f, 0.5f}, {0.2f, 0.4f, 1.0f, 0.5f} };
    for (int i = 0; i < 3; ++i)
    {
        glm::mat4 m = glm::translate(glm::mat4(1.0f), glm::vec3(0.0f, 1.2f, 0.0f));
        m = glm::rotate(m, glm::radians(60.0f * i), glm::vec3(0.0f, 1.0f, 0.0f));
        transparents.push_back({ m, crossColors[i] });
    }
    // 右侧：一排前后平行的面片，故意按「从近到远」的错误顺序存放，普通混合下顺序问题一目了然
    const glm::vec4 rowColors[4] = { {1.0f, 0.9f, 0.2f, 0.4f}, {0.2f, 0.9f, 0.9f, 0.5f}, {0.9f, 0.3f, 0.9f, 0.6f}, {1.0f, 0.5f, 0.1f, 0.7f} };
    for (int i = 0; i < 4; ++i)
    {
        glm::mat4 m = glm::translate(glm::mat4(1.0f), glm::vec3(3.5f + 0.3f * i, 1.0f, 1.5f - 1.0f * i));
        m = glm::scale(m, glm::vec3(0.8f));
        transparents.push_back({ m, rowColors[i] });
    }

    // ---- FBO ----
    // 两个 FBO 共享同一张深度纹理：透明 pass 要用不透明物体的深度做遮挡测试
    unsigned int opaqueColor, depthTex, accumTex, revealTex;
    glCreateTextures(GL_TEXTURE_2D, 1, &opaqueColor);
    glTextureStorage2D(opaqueColor, 1, GL_RGBA16F, SCR_WIDTH, SCR_HEIGHT);
    glCreateTextures(GL_TEXTURE_2D, 1, &depthTex);
    glTextureStorage2D(depthTex, 1, GL_DEPTH_COMPONENT32F, SCR_WIDTH, SCR_HEIGHT);
    // accum 需要浮点：权重可达 3000，且要累加多层；reveal 是 [0,1] 的连乘，R8 足够
    glCreateTextures(GL_TEXTURE_2D, 1, &accumTex);
    glTextureStorage2D(accumTex, 1, GL_RGBA16F, SCR_WIDTH, SCR_HEIGHT);
    glCreateTextures(GL_TEXTURE_2D, 1, &revealTex);
    glTextureStorage2D(revealTex, 1, GL_R8, SCR_WIDTH, SCR_HEIGHT);

    unsigned int opaqueFBO, transparentFBO;
    glCreateFramebuffers(1, &opaqueFBO);
    glNamedFramebufferTexture(opaqueFBO, GL_COLOR_ATTACHMENT0, opaqueColor, 0);
    glNamedFramebufferTexture(opaqueFBO, GL_DEPTH_ATTACHMENT, depthTex, 0);

    glCreateFramebuffers(1, &transparentFBO);
    glNamedFramebufferTexture(transparentFBO, GL_COLOR_ATTACHMENT0, accumTex, 0);
    glNamedFramebufferTexture(transparentFBO, GL_COLOR_ATTACHMENT1, revealTex, 0);
    glNamedFramebufferTexture(transparentFBO, GL_DEPTH_ATTACHMENT, depthTex, 0);
    // MRT：声明 FS 的 location 0/1 分别写哪两个附件
    const GLenum drawBuffers[] = { GL_COLOR_ATTACHMENT0, GL_COLOR_ATTACHMENT1 };
    glNamedFramebufferDrawBuffers(transparentFBO, 2, drawBuffers);

    if (glCheckNamedFramebufferStatus(opaqueFBO, GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE ||
        glCheckNamedFramebufferStatus(transparentFBO, GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "ERROR::FRAMEBUFFER:: Framebuffer is not complete!" << std::endl;

    unsigned int emptyVAO;
    glCreateVertexArrays(1, &emptyVAO);

    const glm::mat4 projection = glm::perspective(glm::radians(45.0f), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);

    float lastFrame = (float)glfwGetTime();
    double lastTitleTime = 0.0;
    int frameCount = 0;

    while (!glfwWindowShouldClose(window))
    {
        float now = (float)glfwGetTime();
        deltaTime = now - lastFrame;
        lastFrame = now;
        processInput(window);

        const glm::mat4 view = camera.GetViewMatrix();
        glViewport(0, 0, SCR_WIDTH, SCR_HEIGHT);

        // ---- 1. 不透明 pass ----
        glBindFramebuffer(GL_FRAMEBUFFER, opaqueFBO);
        glEnable(GL_DEPTH_TEST);
        glDepthFunc(GL_LESS);
        glDepthMask(GL_TRUE);
        glDisable(GL_BLEND);
        const float bgColor[] = { 0.1f, 0.1f, 0.12f, 1.0f };
        const float clearDepth = 1.0f;
        glClearNamedFramebufferfv(opaqueFBO, GL_COLOR, 0, bgColor);
        glClearNamedFramebufferfv(opaqueFBO, GL_DEPTH, 0, &clearDepth);

        solidShader.use();
        solidShader.setMat4("projection", projection);
        solidShader.setMat4("view", view);
        // 地面
        glm::mat4 floorModel = glm::rotate(glm::mat4(1.0f), glm::radians(-90.0f), glm::vec3(1.0f, 0.0f, 0.0f));
        solidShader.setMat4("model", glm::scale(floorModel, glm::vec3(10.0f)));
        solidShader.setVec4("color", glm::vec4(0.6f, 0.6f, 0.6f, 1.0f));
        glBindVertexArray(quadVAO);
        glDrawArrays(GL_TRIANGLES, 0, 6);
        // 一个穿过中心面片的不透明立方体，验证透明物体能被不透明物体正确遮挡
        glm::mat4 cubeModel = glm::translate(glm::mat4(1.0f), glm::vec3(-0.6f, 0.5f, 0.6f));
        solidShader.setMat4("model", glm::scale(cubeModel, glm::vec3(0.5f)));
        solidShader.setVec4("color", glm::vec4(0.9f, 0.9f, 0.9f, 1.0f));
        glBindVertexArray(cubeVAO);
        glDrawArrays(GL_TRIANGLES, 0, 36);

        // ---- 2. 透明 pass ----
        // 透明物体之间不能互相深度遮挡（否则后画的被挡掉就失去了「混合」）：关深度写入，保留深度测试
        glDepthMask(GL_FALSE);
        glEnable(GL_BLEND);
        glBindVertexArray(quadVAO);

        if (useOIT)
        {
            glBindFramebuffer(GL_FRAMEBUFFER, transparentFBO);
            // 只清两个颜色附件；深度是共享的，清了就丢掉不透明 pass 的结果
            const float zero[] = { 0.0f, 0.0f, 0.0f, 0.0f };
            const float one[] = { 1.0f, 1.0f, 1.0f, 1.0f };
            glClearNamedFramebufferfv(transparentFBO, GL_COLOR, 0, zero);
            glClearNamedFramebufferfv(transparentFBO, GL_COLOR, 1, one);

            // glBlendFunci（4.0）：每个绘制缓冲独立的混合函数，WBOIT 两张附件的混合方式完全不同
            glBlendFunci(0, GL_ONE, GL_ONE);
            glBlendFunci(1, GL_ZERO, GL_ONE_MINUS_SRC_COLOR);
            glBlendEquation(GL_FUNC_ADD);

            accumShader.use();
            accumShader.setMat4("projection", projection);
            accumShader.setMat4("view", view);
            for (const TransparentObject& obj : transparents)
            {
                accumShader.setMat4("model", obj.model);
                accumShader.setVec4("color", obj.color);
                glDrawArrays(GL_TRIANGLES, 0, 6);
            }

            // ---- 3. 合成 pass：回到 opaqueFBO，全屏混合 ----
            glBindFramebuffer(GL_FRAMEBUFFER, opaqueFBO);
            // 全屏三角形不需要深度测试；透明物体的遮挡在第 2 步已经处理
            glDisable(GL_DEPTH_TEST);
            glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
            compositeShader.use();
            glBindTextureUnit(0, accumTex);
            glBindTextureUnit(1, revealTex);
            glBindVertexArray(emptyVAO);
            glDrawArrays(GL_TRIANGLES, 0, 3);
        }
        else
        {
            // 对照：普通 alpha 混合，按数组顺序直接画，不排序
            glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
            solidShader.use();
            for (const TransparentObject& obj : transparents)
            {
                solidShader.setMat4("model", obj.model);
                solidShader.setVec4("color", obj.color);
                glDrawArrays(GL_TRIANGLES, 0, 6);
            }
        }

        // ---- 4. 输出 ----
        glBlitNamedFramebuffer(opaqueFBO, 0, 0, 0, SCR_WIDTH, SCR_HEIGHT, 0, 0, SCR_WIDTH, SCR_HEIGHT, GL_COLOR_BUFFER_BIT, GL_NEAREST);

        glfwSwapBuffers(window);
        glfwPollEvents();

        ++frameCount;
        if (now - lastTitleTime >= 0.5)
        {
            std::string title = std::string("oit  ") + (useOIT ? "Weighted Blended OIT" : "Plain alpha blending (unsorted)")
                              + "  [T] toggle  " + std::to_string(1000.0 * (now - lastTitleTime) / frameCount) + " ms";
            glfwSetWindowTitle(window, title.c_str());
            lastTitleTime = now;
            frameCount = 0;
        }
    }

    glfwTerminate();
    return 0;
}

// DSA 版 VAO，格式与数据源分离（说明见 forward_plus.cpp）
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

    if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS)
        camera.ProcessKeyboard(FORWARD, deltaTime);
    if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS)
        camera.ProcessKeyboard(BACKWARD, deltaTime);
    if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS)
        camera.ProcessKeyboard(LEFT, deltaTime);
    if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS)
        camera.ProcessKeyboard(RIGHT, deltaTime);

    if (glfwGetKey(window, GLFW_KEY_T) == GLFW_PRESS && !toggleKeyPressed)
    {
        useOIT = !useOIT;
        toggleKeyPressed = true;
    }
    if (glfwGetKey(window, GLFW_KEY_T) == GLFW_RELEASE)
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
