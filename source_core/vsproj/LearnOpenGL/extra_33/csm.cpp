// 级联阴影 (CSM)：把相机视锥按深度切成若干段，每段配一张紧贴它的方向光正交 shadow map
// 存储：GL_TEXTURE_2D_ARRAY 一层一级；生成：GS 循环各级并写 gl_Layer，一个 pass 画完所有层
// 按键：C 切换级联染色
//
// 要解决的问题：shadow_mapping.cpp 里一张 shadow map 覆盖固定范围。范围小则远处没阴影，
// 范围大则近处一个纹素覆盖很大面积，阴影锯齿严重。透视下近处物体占屏幕多、远处少，
// 所以按深度分段，近段用小范围（高精度），远段用大范围（低精度），屏幕上的阴影精度大致均匀
//
// 每帧流程：
//   相机视锥按 cascadeLevels 切段 -> 每段求 8 个角 -> 光源视角下包住它的正交投影
//   -> 深度 pass（GS 一次写满所有层）-> 着色 pass（按片段深度选层采样）
#include <glad/glad.h>
#include <GLFW/glfw3.h>
#include <stb_image.h>

#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>

#include <learnopengl/shader.h>
#include <learnopengl/camera.h>

#include <algorithm>
#include <array>
#include <iostream>
#include <limits>
#include <random>
#include <string>
#include <vector>

void framebuffer_size_callback(GLFWwindow* window, int width, int height);
void mouse_callback(GLFWwindow* window, double xpos, double ypos);
void scroll_callback(GLFWwindow* window, double xoffset, double yoffset);
void processInput(GLFWwindow* window);
unsigned int loadTexture(const char* path);
void renderScene(const Shader& shader);
void renderCube();
void renderPlane();

const unsigned int SCR_WIDTH = 800;
const unsigned int SCR_HEIGHT = 600;
int fbWidth = SCR_WIDTH;
int fbHeight = SCR_HEIGHT;

// 须与 extra.csm*.gs/fs 中的 CASCADE_COUNT 一致
constexpr int CASCADE_COUNT = 5;
const unsigned int SHADOW_RES = 2048;
const float cameraNearPlane = 0.1f;
const float cameraFarPlane = 200.0f;
// 级联分割的视空间深度：近处切得密，远处切得疏。
// 这里是原教程的手填值；常见的自动方案是对数分割与均匀分割按比例混合（Practical Split Scheme）
const std::array<float, CASCADE_COUNT - 1> cascadeLevels = {
    cameraFarPlane / 50.0f, cameraFarPlane / 25.0f, cameraFarPlane / 10.0f, cameraFarPlane / 2.0f
};
// 指向光源
const glm::vec3 lightDir = glm::normalize(glm::vec3(20.0f, 50.0f, 20.0f));

bool showCascades = false;
bool showCascadesKeyPressed = false;

std::vector<glm::mat4> cubeModels;

Camera camera(glm::vec3(0.0f, 3.0f, 10.0f));
float lastX = SCR_WIDTH / 2.0f;
float lastY = SCR_HEIGHT / 2.0f;
bool firstMouse = true;

float deltaTime = 0.0f;
float lastFrame = 0.0f;

// 用 (proj*view) 的逆把 NDC 立方体 8 个角变回世界空间，即该段视锥的 8 个角。
// OpenGL 的 NDC 三轴都是 [-1,1]（D3D 的 z 是 [0,1]）；
// 逆变换后 w != 1，必须做一次透视除法才是真正的世界坐标
std::vector<glm::vec4> getFrustumCornersWorldSpace(const glm::mat4& projView)
{
    const glm::mat4 inv = glm::inverse(projView);
    std::vector<glm::vec4> corners;
    for (int x = 0; x < 2; ++x)
        for (int y = 0; y < 2; ++y)
            for (int z = 0; z < 2; ++z)
            {
                glm::vec4 pt = inv * glm::vec4(2.0f * x - 1.0f, 2.0f * y - 1.0f, 2.0f * z - 1.0f, 1.0f);
                corners.push_back(pt / pt.w);
            }
    return corners;
}

// 为视锥段 [nearPlane, farPlane] 求一个包住它的光源正交投影。
// 技巧：用与主相机相同的 fov/宽高比、只换近远平面构造一个透视矩阵，它的视锥正好就是这一段
glm::mat4 getLightSpaceMatrix(float nearPlane, float farPlane)
{
    const glm::mat4 proj = glm::perspective(glm::radians(camera.Zoom), (float)fbWidth / (float)fbHeight, nearPlane, farPlane);
    const std::vector<glm::vec4> corners = getFrustumCornersWorldSpace(proj * camera.GetViewMatrix());

    glm::vec3 center(0.0f);
    for (const glm::vec4& c : corners)
        center += glm::vec3(c);
    center /= (float)corners.size();

    // 方向光没有位置，只有方向：把「眼睛」放在段中心沿光源方向 1 个单位处即可，
    // 眼睛离多远无所谓，真正的近/远范围由下面的正交投影决定。
    // 注意 lightDir 若与 up(0,1,0) 平行，lookAt 会退化
    const glm::mat4 lightView = glm::lookAt(center + lightDir, center, glm::vec3(0.0f, 1.0f, 0.0f));

    // 光源视图空间下的 AABB：正交投影就是一个长方体，取刚好包住 8 个角的那个
    float minX = std::numeric_limits<float>::max(), maxX = std::numeric_limits<float>::lowest();
    float minY = minX, maxY = maxX, minZ = minX, maxZ = maxX;
    for (const glm::vec4& c : corners)
    {
        const glm::vec4 p = lightView * c;
        minX = std::min(minX, p.x); maxX = std::max(maxX, p.x);
        minY = std::min(minY, p.y); maxY = std::max(maxY, p.y);
        minZ = std::min(minZ, p.z); maxZ = std::max(maxZ, p.z);
    }

    // 视图空间看向 -z，ortho 的 near/far 取距离，即 -maxZ / -minZ。
    // 视锥外但位于光源一侧的物体仍可能把阴影投进视锥，故把近平面向光源方向额外推远
    constexpr float zMult = 10.0f;
    const float zNear = -maxZ - (maxZ - minZ) * zMult;
    const float zFar  = -minZ;
    const glm::mat4 lightProjection = glm::ortho(minX, maxX, minY, maxY, zNear, zFar);
    // 已知问题：相机平移/旋转时包围盒逐帧变化，纹素网格跟着漂移，阴影边缘会闪烁（shimmering）。
    // 常见修复是用包围球代替 AABB 固定尺寸，并把正交体原点对齐到纹素整数倍（本例未做）
    return lightProjection * lightView;
}

std::array<glm::mat4, CASCADE_COUNT> getLightSpaceMatrices()
{
    std::array<glm::mat4, CASCADE_COUNT> ret;
    for (int i = 0; i < CASCADE_COUNT; ++i)
    {
        const float n = i == 0 ? cameraNearPlane : cascadeLevels[i - 1];
        const float f = i == CASCADE_COUNT - 1 ? cameraFarPlane : cascadeLevels[i];
        ret[i] = getLightSpaceMatrix(n, f);
    }
    return ret;
}

int main()
{
    glfwInit();
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

    GLFWwindow* window = glfwCreateWindow(SCR_WIDTH, SCR_HEIGHT, "LearnOpenGL", NULL, NULL);
    if (window == NULL)
    {
        std::cout << "Failed to create GLFW window" << std::endl;
        glfwTerminate();
        return -1;
    }
    glfwMakeContextCurrent(window);
    glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);
    glfwSetCursorPosCallback(window, mouse_callback);
    glfwSetScrollCallback(window, scroll_callback);
    glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);

    if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress))
    {
        std::cout << "Failed to initialize GLAD" << std::endl;
        return -1;
    }

    glEnable(GL_DEPTH_TEST);

    Shader shader("shaders/extra.csm.vs", "shaders/extra.csm.fs");
    Shader depthShader("shaders/extra.csm_depth.vs", "shaders/extra.csm_depth.fs", "shaders/extra.csm_depth.gs");

    unsigned int woodTexture = loadTexture("resources/textures/wood.png");

    // 深度纹理数组：每层一个级联。相比 5 张独立纹理，数组只占一个纹理单元，
    // 且能作为分层附件被 GS 一次写入；要求各层尺寸、格式相同。
    // 32F 浮点深度：zMult 拉长了深度范围，用更高精度减少深度量化误差
    unsigned int depthMaps;
    glGenTextures(1, &depthMaps);
    glBindTexture(GL_TEXTURE_2D_ARRAY, depthMaps);
    glTexImage3D(GL_TEXTURE_2D_ARRAY, 0, GL_DEPTH_COMPONENT32F, SHADOW_RES, SHADOW_RES, CASCADE_COUNT,
                 0, GL_DEPTH_COMPONENT, GL_FLOAT, nullptr);
    // 深度值不能线性插值后再比较，手写 PCF 时用 NEAREST。
    // 另一做法：设 GL_TEXTURE_COMPARE_MODE + sampler2DArrayShadow + LINEAR，硬件先比较再插值，免费得到 2x2 PCF
    glTexParameteri(GL_TEXTURE_2D_ARRAY, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D_ARRAY, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    // 采样越界返回深度 1.0（最远），即不在阴影中
    glTexParameteri(GL_TEXTURE_2D_ARRAY, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_BORDER);
    glTexParameteri(GL_TEXTURE_2D_ARRAY, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_BORDER);
    const float borderColor[] = { 1.0f, 1.0f, 1.0f, 1.0f };
    glTexParameterfv(GL_TEXTURE_2D_ARRAY, GL_TEXTURE_BORDER_COLOR, borderColor);

    unsigned int depthMapFBO;
    glGenFramebuffers(1, &depthMapFBO);
    glBindFramebuffer(GL_FRAMEBUFFER, depthMapFBO);
    // glFramebufferTexture（非 ...Layer 版本）把整个数组作为分层附件，GS 才能用 gl_Layer 选层
    glFramebufferTexture(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, depthMaps, 0);
    glDrawBuffer(GL_NONE);
    glReadBuffer(GL_NONE);
    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "ERROR::FRAMEBUFFER:: Framebuffer is not complete!" << std::endl;
    glBindFramebuffer(GL_FRAMEBUFFER, 0);

    // 固定种子，在地面上撒一批立方体，近处远处都有
    std::mt19937 rng(42);
    std::uniform_real_distribution<float> posDist(-60.0f, 60.0f);
    std::uniform_real_distribution<float> scaleDist(0.5f, 2.0f);
    std::uniform_real_distribution<float> angleDist(0.0f, 180.0f);
    for (int i = 0; i < 40; ++i)
    {
        const float s = scaleDist(rng);
        glm::mat4 model(1.0f);
        model = glm::translate(model, glm::vec3(posDist(rng), s, posDist(rng)));
        model = glm::rotate(model, glm::radians(angleDist(rng)), glm::normalize(glm::vec3(1.0f, 0.0f, 1.0f)));
        model = glm::scale(model, glm::vec3(s));
        cubeModels.push_back(model);
    }

    shader.use();
    shader.setInt("diffuseTexture", 0);
    shader.setInt("shadowMap", 1);

    camera.MovementSpeed = 10.0f;

    while (!glfwWindowShouldClose(window))
    {
        float currentFrame = static_cast<float>(glfwGetTime());
        deltaTime = currentFrame - lastFrame;
        lastFrame = currentFrame;

        processInput(window);

        // 1. 相机每帧变化，级联矩阵每帧重算
        const std::array<glm::mat4, CASCADE_COUNT> lightMatrices = getLightSpaceMatrices();

        // 2. 一个 pass 渲染所有级联的深度
        depthShader.use();
        for (int i = 0; i < CASCADE_COUNT; ++i)
            depthShader.setMat4("lightSpaceMatrices[" + std::to_string(i) + "]", lightMatrices[i]);
        glBindFramebuffer(GL_FRAMEBUFFER, depthMapFBO);
        // 视口作用于所有层，切到 shadow map 尺寸
        glViewport(0, 0, SHADOW_RES, SHADOW_RES);
        // 分层附件下 glClear 会清除所有层
        glClear(GL_DEPTH_BUFFER_BIT);
        renderScene(depthShader);
        glBindFramebuffer(GL_FRAMEBUFFER, 0);

        // 3. 正常渲染，FS 按深度选级联采样
        glViewport(0, 0, fbWidth, fbHeight);
        glClearColor(0.1f, 0.1f, 0.1f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        shader.use();
        const glm::mat4 projection = glm::perspective(glm::radians(camera.Zoom), (float)fbWidth / (float)fbHeight, cameraNearPlane, cameraFarPlane);
        const glm::mat4 view = camera.GetViewMatrix();
        shader.setMat4("projection", projection);
        shader.setMat4("view", view);
        shader.setVec3("viewPos", camera.Position);
        shader.setVec3("lightDir", lightDir);
        shader.setFloat("farPlane", cameraFarPlane);
        shader.setBool("showCascades", showCascades);
        for (int i = 0; i < CASCADE_COUNT; ++i)
            shader.setMat4("lightSpaceMatrices[" + std::to_string(i) + "]", lightMatrices[i]);
        for (int i = 0; i < CASCADE_COUNT - 1; ++i)
            shader.setFloat("cascadePlaneDistances[" + std::to_string(i) + "]", cascadeLevels[i]);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, woodTexture);
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D_ARRAY, depthMaps);
        renderScene(shader);

        glfwSwapBuffers(window);
        glfwPollEvents();
    }

    glfwTerminate();
    return 0;
}

void renderScene(const Shader& shader)
{
    shader.setMat4("model", glm::mat4(1.0f));
    renderPlane();
    for (const glm::mat4& m : cubeModels)
    {
        shader.setMat4("model", m);
        renderCube();
    }
}

// 200x200 地面，y = 0，顶点布局：位置(3) 法线(3) UV(2)
unsigned int planeVAO = 0;
unsigned int planeVBO;
void renderPlane()
{
    if (planeVAO == 0)
    {
        float planeVertices[] = {
             100.0f, 0.0f,  100.0f,  0.0f, 1.0f, 0.0f,  50.0f,  0.0f,
            -100.0f, 0.0f, -100.0f,  0.0f, 1.0f, 0.0f,   0.0f, 50.0f,
            -100.0f, 0.0f,  100.0f,  0.0f, 1.0f, 0.0f,   0.0f,  0.0f,

             100.0f, 0.0f,  100.0f,  0.0f, 1.0f, 0.0f,  50.0f,  0.0f,
             100.0f, 0.0f, -100.0f,  0.0f, 1.0f, 0.0f,  50.0f, 50.0f,
            -100.0f, 0.0f, -100.0f,  0.0f, 1.0f, 0.0f,   0.0f, 50.0f
        };
        glGenVertexArrays(1, &planeVAO);
        glGenBuffers(1, &planeVBO);
        glBindVertexArray(planeVAO);
        glBindBuffer(GL_ARRAY_BUFFER, planeVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(planeVertices), planeVertices, GL_STATIC_DRAW);
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(1);
        glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(3 * sizeof(float)));
        glEnableVertexAttribArray(2);
        glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(6 * sizeof(float)));
    }
    glBindVertexArray(planeVAO);
    glDrawArrays(GL_TRIANGLES, 0, 6);
    glBindVertexArray(0);
}

// 边长 2、中心在原点的立方体，布局同上
unsigned int cubeVAO = 0;
unsigned int cubeVBO = 0;
void renderCube()
{
    if (cubeVAO == 0)
    {
        float vertices[] = {
            // back face
            -1.0f, -1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 0.0f, 0.0f,
             1.0f,  1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 1.0f, 1.0f,
             1.0f, -1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 1.0f, 0.0f,
             1.0f,  1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 1.0f, 1.0f,
            -1.0f, -1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 0.0f, 0.0f,
            -1.0f,  1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 0.0f, 1.0f,
            // front face
            -1.0f, -1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 0.0f, 0.0f,
             1.0f, -1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 1.0f, 0.0f,
             1.0f,  1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 1.0f, 1.0f,
             1.0f,  1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 1.0f, 1.0f,
            -1.0f,  1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 0.0f, 1.0f,
            -1.0f, -1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 0.0f, 0.0f,
            // left face
            -1.0f,  1.0f,  1.0f, -1.0f,  0.0f,  0.0f, 1.0f, 0.0f,
            -1.0f,  1.0f, -1.0f, -1.0f,  0.0f,  0.0f, 1.0f, 1.0f,
            -1.0f, -1.0f, -1.0f, -1.0f,  0.0f,  0.0f, 0.0f, 1.0f,
            -1.0f, -1.0f, -1.0f, -1.0f,  0.0f,  0.0f, 0.0f, 1.0f,
            -1.0f, -1.0f,  1.0f, -1.0f,  0.0f,  0.0f, 0.0f, 0.0f,
            -1.0f,  1.0f,  1.0f, -1.0f,  0.0f,  0.0f, 1.0f, 0.0f,
            // right face
             1.0f,  1.0f,  1.0f,  1.0f,  0.0f,  0.0f, 1.0f, 0.0f,
             1.0f, -1.0f, -1.0f,  1.0f,  0.0f,  0.0f, 0.0f, 1.0f,
             1.0f,  1.0f, -1.0f,  1.0f,  0.0f,  0.0f, 1.0f, 1.0f,
             1.0f, -1.0f, -1.0f,  1.0f,  0.0f,  0.0f, 0.0f, 1.0f,
             1.0f,  1.0f,  1.0f,  1.0f,  0.0f,  0.0f, 1.0f, 0.0f,
             1.0f, -1.0f,  1.0f,  1.0f,  0.0f,  0.0f, 0.0f, 0.0f,
            // bottom face
            -1.0f, -1.0f, -1.0f,  0.0f, -1.0f,  0.0f, 0.0f, 1.0f,
             1.0f, -1.0f, -1.0f,  0.0f, -1.0f,  0.0f, 1.0f, 1.0f,
             1.0f, -1.0f,  1.0f,  0.0f, -1.0f,  0.0f, 1.0f, 0.0f,
             1.0f, -1.0f,  1.0f,  0.0f, -1.0f,  0.0f, 1.0f, 0.0f,
            -1.0f, -1.0f,  1.0f,  0.0f, -1.0f,  0.0f, 0.0f, 0.0f,
            -1.0f, -1.0f, -1.0f,  0.0f, -1.0f,  0.0f, 0.0f, 1.0f,
            // top face
            -1.0f,  1.0f, -1.0f,  0.0f,  1.0f,  0.0f, 0.0f, 1.0f,
             1.0f,  1.0f,  1.0f,  0.0f,  1.0f,  0.0f, 1.0f, 0.0f,
             1.0f,  1.0f, -1.0f,  0.0f,  1.0f,  0.0f, 1.0f, 1.0f,
             1.0f,  1.0f,  1.0f,  0.0f,  1.0f,  0.0f, 1.0f, 0.0f,
            -1.0f,  1.0f, -1.0f,  0.0f,  1.0f,  0.0f, 0.0f, 1.0f,
            -1.0f,  1.0f,  1.0f,  0.0f,  1.0f,  0.0f, 0.0f, 0.0f
        };
        glGenVertexArrays(1, &cubeVAO);
        glGenBuffers(1, &cubeVBO);
        glBindBuffer(GL_ARRAY_BUFFER, cubeVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
        glBindVertexArray(cubeVAO);
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(1);
        glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(3 * sizeof(float)));
        glEnableVertexAttribArray(2);
        glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(6 * sizeof(float)));
        glBindBuffer(GL_ARRAY_BUFFER, 0);
    }
    glBindVertexArray(cubeVAO);
    glDrawArrays(GL_TRIANGLES, 0, 36);
    glBindVertexArray(0);
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

    if (glfwGetKey(window, GLFW_KEY_C) == GLFW_PRESS && !showCascadesKeyPressed)
    {
        showCascades = !showCascades;
        showCascadesKeyPressed = true;
    }
    if (glfwGetKey(window, GLFW_KEY_C) == GLFW_RELEASE)
        showCascadesKeyPressed = false;
}

void framebuffer_size_callback(GLFWwindow* window, int width, int height)
{
    // 级联矩阵依赖相机宽高比，需记录实际尺寸
    fbWidth = width;
    fbHeight = height;
    glViewport(0, 0, width, height);
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

void scroll_callback(GLFWwindow* window, double xoffset, double yoffset)
{
    camera.ProcessMouseScroll(static_cast<float>(yoffset));
}

unsigned int loadTexture(char const* path)
{
    unsigned int textureID;
    glGenTextures(1, &textureID);

    int width, height, nrComponents;
    unsigned char* data = stbi_load(path, &width, &height, &nrComponents, 0);
    if (data)
    {
        GLenum format = GL_RGB;
        if (nrComponents == 1)
            format = GL_RED;
        else if (nrComponents == 3)
            format = GL_RGB;
        else if (nrComponents == 4)
            format = GL_RGBA;

        glBindTexture(GL_TEXTURE_2D, textureID);
        glTexImage2D(GL_TEXTURE_2D, 0, format, width, height, 0, format, GL_UNSIGNED_BYTE, data);
        glGenerateMipmap(GL_TEXTURE_2D);

        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    }
    else
    {
        std::cout << "Texture failed to load at path: " << path << std::endl;
    }
    stbi_image_free(data);
    return textureID;
}
