// 加载 OpenGL 函数指针
#include <glad/glad.h>
// 窗口、输入、上下文管理
#include <GLFW/glfw3.h>
// 加载图片纹理
#include <stb_image.h>

// 数学库
#include <glm/glm.hpp>
// 矩阵变换：透视、平移等
#include <glm/gtc/matrix_transform.hpp>
// 把 glm 矩阵传给 OpenGL
#include <glm/gtc/type_ptr.hpp>

// 自定义 Shader 类
#include <learnopengl/shader.h>
// 自定义 Camera 类
#include <learnopengl/camera.h>
// 自定义 Model 类（本文件没用到）
#include <learnopengl/model.h>

#include <iostream>

// 窗口大小改变回调
void framebuffer_size_callback(GLFWwindow* window, int width, int height);
// 鼠标移动回调
void mouse_callback(GLFWwindow* window, double xpos, double ypos);
// 滚轮回调
void scroll_callback(GLFWwindow* window, double xoffset, double yoffset);
// 处理键盘输入
void processInput(GLFWwindow* window);
// 加载 2D 纹理，支持伽马校正
unsigned int loadTexture(const char* path, bool gammaCorrection);
// 渲染一个 1x1 的屏幕四边形
void renderQuad();
// 渲染一个 1x1x1 的立方体
void renderCube();

// settings
// 窗口宽度
const unsigned int SCR_WIDTH = 800;
// 窗口高度
const unsigned int SCR_HEIGHT = 600;
// 是否启用 HDR
bool hdr = true;
// 空格键是否已经按下的标记，防止连续触发
bool hdrKeyPressed = false;
// 曝光值
float exposure = 1.0f;

// camera
// 创建相机，位置在 (0, 0, 5)
Camera camera(glm::vec3(0.0f, 0.0f, 5.0f));
// 上一帧鼠标 X 位置
float lastX = (float)SCR_WIDTH / 2.0;
// 上一帧鼠标 Y 位置
float lastY = (float)SCR_HEIGHT / 2.0;
// 是否是第一次接收鼠标输入
bool firstMouse = true;

// timing
// 每帧时间差
float deltaTime = 0.0f;
// 上一帧时间
float lastFrame = 0.0f;

int main()
{
    // glfw: initialize and configure
    // ------------------------------
    // 初始化 GLFW
    glfwInit();
    // 设置 OpenGL 主版本为 3
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    // 设置 OpenGL 次版本为 3
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
    // 使用核心模式
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

#ifdef __APPLE__
    // macOS 需要前向兼容
    glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GL_TRUE);
#endif

    // glfw window creation
    // --------------------
    // 创建窗口
    GLFWwindow* window = glfwCreateWindow(SCR_WIDTH, SCR_HEIGHT, "LearnOpenGL", NULL, NULL);
    // 如果窗口创建失败
    if (window == NULL)
    {
        // 输出错误信息
        std::cout << "Failed to create GLFW window" << std::endl;
        // 终止 GLFW
        glfwTerminate();
        return -1;
    }
    // 让当前窗口的 OpenGL 上下文成为当前上下文
    glfwMakeContextCurrent(window);
    // 注册窗口大小改变回调
    glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);
    // 注册鼠标移动回调
    glfwSetCursorPosCallback(window, mouse_callback);
    // 注册滚轮回调
    glfwSetScrollCallback(window, scroll_callback);

    // tell GLFW to capture our mouse
    // 隐藏鼠标光标并捕获鼠标
    glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);

    // glad: load all OpenGL function pointers
    // ---------------------------------------
    // 用 GLAD 加载 OpenGL 函数指针
    if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress))
    {
        // 输出错误信息
        std::cout << "Failed to initialize GLAD" << std::endl;
        return -1;
    }

    // configure global opengl state
    // -----------------------------
    // 开启深度测试
    glEnable(GL_DEPTH_TEST);

    // build and compile shaders
    // -------------------------
    // 光照着色器，把场景渲染到浮点帧缓冲
    Shader shader("shaders/6.lighting.vs", "shaders/6.lighting.fs");
    // HDR 后处理着色器，把浮点颜色缓冲做色调映射后画到屏幕
    Shader hdrShader("shaders/6.hdr.vs", "shaders/6.hdr.fs");

    // load textures
    // -------------
    // 加载木纹纹理，作为 SRGB 纹理
    unsigned int woodTexture = loadTexture("resources/textures/wood.png", true); // note that we're loading the texture as an SRGB texture

    // configure floating point framebuffer
    // ------------------------------------
    // 浮点帧缓冲
    unsigned int hdrFBO;
    // 生成帧缓冲
    glGenFramebuffers(1, &hdrFBO);
    // create floating point color buffer
    // 浮点颜色缓冲
    unsigned int colorBuffer;
    // 生成纹理
    glGenTextures(1, &colorBuffer);
    // 绑定纹理
    glBindTexture(GL_TEXTURE_2D, colorBuffer);
    // 分配 16 位浮点纹理存储，可以存储超过 1.0 的亮度
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA16F, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGBA, GL_FLOAT, NULL);
    // 缩小过滤方式
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    // 放大过滤方式
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    // create depth buffer (renderbuffer)
    // 深度渲染缓冲
    unsigned int rboDepth;
    // 生成渲染缓冲
    glGenRenderbuffers(1, &rboDepth);
    // 绑定渲染缓冲
    glBindRenderbuffer(GL_RENDERBUFFER, rboDepth);
    // 分配深度存储
    glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH_COMPONENT, SCR_WIDTH, SCR_HEIGHT);
    // attach buffers
    // 绑定帧缓冲
    glBindFramebuffer(GL_FRAMEBUFFER, hdrFBO);
    // 把颜色缓冲附加到颜色附件
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, colorBuffer, 0);
    // 把深度缓冲附加到深度附件
    glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_RENDERBUFFER, rboDepth);
    // 检查帧缓冲是否完整
    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "Framebuffer not complete!" << std::endl;
    // 解绑帧缓冲
    glBindFramebuffer(GL_FRAMEBUFFER, 0);

    // lighting info
    // -------------
    // positions
    // 光源位置列表
    std::vector<glm::vec3> lightPositions;
    // 后方光源
    lightPositions.push_back(glm::vec3(0.0f, 0.0f, 49.5f)); // back light
    // 第二个光源
    lightPositions.push_back(glm::vec3(-1.4f, -1.9f, 9.0f));
    // 第三个光源
    lightPositions.push_back(glm::vec3(0.0f, -1.8f, 4.0f));
    // 第四个光源
    lightPositions.push_back(glm::vec3(0.8f, -1.7f, 6.0f));
    // colors
    // 光源颜色列表
    std::vector<glm::vec3> lightColors;
    // 非常亮的白色光源，用来演示 HDR
    lightColors.push_back(glm::vec3(200.0f, 200.0f, 200.0f));
    // 红色光源
    lightColors.push_back(glm::vec3(0.1f, 0.0f, 0.0f));
    // 蓝色光源
    lightColors.push_back(glm::vec3(0.0f, 0.0f, 0.2f));
    // 绿色光源
    lightColors.push_back(glm::vec3(0.0f, 0.1f, 0.0f));

    // shader configuration
    // --------------------
    // 使用光照着色器
    shader.use();
    // 告诉 shader 里面的 diffuseTexture 使用纹理单元 0
    shader.setInt("diffuseTexture", 0);
    // 使用 HDR 后处理着色器
    hdrShader.use();
    // 告诉 shader 里面的 hdrBuffer 使用纹理单元 0
    hdrShader.setInt("hdrBuffer", 0);

    // render loop
    // -----------
    // 渲染循环
    while (!glfwWindowShouldClose(window))
    {
        // per-frame time logic
        // --------------------
        // 获取当前时间
        float currentFrame = static_cast<float>(glfwGetTime());
        // 计算每帧时间差
        deltaTime = currentFrame - lastFrame;
        // 更新上一帧时间
        lastFrame = currentFrame;

        // input
        // -----
        // 处理输入
        processInput(window);

        // render
        // ------
        // 设置清屏颜色为深灰色
        glClearColor(0.1f, 0.1f, 0.1f, 1.0f);
        // 清除颜色缓冲和深度缓冲
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        // 1. render scene into floating point framebuffer
        // -----------------------------------------------
        // 绑定浮点帧缓冲
        glBindFramebuffer(GL_FRAMEBUFFER, hdrFBO);
        // 清除颜色和深度缓冲
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
        // 投影矩阵：透视投影
        glm::mat4 projection = glm::perspective(glm::radians(camera.Zoom), (GLfloat)SCR_WIDTH / (GLfloat)SCR_HEIGHT, 0.1f, 100.0f);
        // 视图矩阵：来自相机
        glm::mat4 view = camera.GetViewMatrix();
        // 使用光照着色器
        shader.use();
        // 把投影矩阵传给 shader
        shader.setMat4("projection", projection);
        // 把视图矩阵传给 shader
        shader.setMat4("view", view);
        // 激活纹理单元 0
        glActiveTexture(GL_TEXTURE0);
        // 绑定木纹纹理
        glBindTexture(GL_TEXTURE_2D, woodTexture);
        // set lighting uniforms
        // 逐个传入光源的位置和颜色
        for (unsigned int i = 0; i < lightPositions.size(); i++)
        {
            // 传第 i 个光源位置
            shader.setVec3("lights[" + std::to_string(i) + "].Position", lightPositions[i]);
            // 传第 i 个光源颜色
            shader.setVec3("lights[" + std::to_string(i) + "].Color", lightColors[i]);
        }
        // 把相机位置传给 shader
        shader.setVec3("viewPos", camera.Position);
        // render tunnel
        // 隧道模型矩阵：单位矩阵
        glm::mat4 model = glm::mat4(1.0f);
        // 平移到 (0, 0, 25)
        model = glm::translate(model, glm::vec3(0.0f, 0.0f, 25.0));
        // 缩放成细长的隧道
        model = glm::scale(model, glm::vec3(2.5f, 2.5f, 27.5f));
        // 把模型矩阵传给 shader
        shader.setMat4("model", model);
        // 反转法线，因为我们从内部看这个立方体
        shader.setInt("inverse_normals", true);
        // 绘制隧道立方体
        renderCube();
        // 解绑帧缓冲
        glBindFramebuffer(GL_FRAMEBUFFER, 0);

        // 2. now render floating point color buffer to 2D quad and tonemap HDR colors to default framebuffer's (clamped) color range
        // --------------------------------------------------------------------------------------------------------------------------
        // 清除默认帧缓冲的颜色和深度
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
        // 使用 HDR 后处理着色器
        hdrShader.use();
        // 激活纹理单元 0
        glActiveTexture(GL_TEXTURE0);
        // 绑定浮点颜色缓冲
        glBindTexture(GL_TEXTURE_2D, colorBuffer);
        // 把 HDR 开关传给 shader
        hdrShader.setInt("hdr", hdr);
        // 把曝光值传给 shader
        hdrShader.setFloat("exposure", exposure);
        // 绘制全屏四边形，做色调映射
        renderQuad();

        // 输出当前 HDR 和曝光状态
        std::cout << "hdr: " << (hdr ? "on" : "off") << "| exposure: " << exposure << std::endl;

        // glfw: swap buffers and poll IO events (keys pressed/released, mouse moved etc.)
        // -------------------------------------------------------------------------------
        // 交换前后缓冲
        glfwSwapBuffers(window);
        // 处理事件
        glfwPollEvents();
    }

    // 终止 GLFW
    glfwTerminate();
    return 0;
}

// renderCube() renders a 1x1 3D cube in NDC.
// -------------------------------------------------
// 立方体 VAO、VBO
unsigned int cubeVAO = 0;
unsigned int cubeVBO = 0;
// 渲染一个 1x1x1 的立方体
void renderCube()
{
    // initialize (if necessary)
    // 如果还没有初始化
    if (cubeVAO == 0)
    {
        // 立方体顶点数据：位置(3) + 法线(3) + 纹理坐标(2)
        float vertices[] = {
            // back face
            -1.0f, -1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 0.0f, 0.0f, // bottom-left
             1.0f,  1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 1.0f, 1.0f, // top-right
             1.0f, -1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 1.0f, 0.0f, // bottom-right         
             1.0f,  1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 1.0f, 1.0f, // top-right
            -1.0f, -1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 0.0f, 0.0f, // bottom-left
            -1.0f,  1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 0.0f, 1.0f, // top-left
            // front face
            -1.0f, -1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 0.0f, 0.0f, // bottom-left
             1.0f, -1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 1.0f, 0.0f, // bottom-right
             1.0f,  1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 1.0f, 1.0f, // top-right
             1.0f,  1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 1.0f, 1.0f, // top-right
            -1.0f,  1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 0.0f, 1.0f, // top-left
            -1.0f, -1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 0.0f, 0.0f, // bottom-left
            // left face
            -1.0f,  1.0f,  1.0f, -1.0f,  0.0f,  0.0f, 1.0f, 0.0f, // top-right
            -1.0f,  1.0f, -1.0f, -1.0f,  0.0f,  0.0f, 1.0f, 1.0f, // top-left
            -1.0f, -1.0f, -1.0f, -1.0f,  0.0f,  0.0f, 0.0f, 1.0f, // bottom-left
            -1.0f, -1.0f, -1.0f, -1.0f,  0.0f,  0.0f, 0.0f, 1.0f, // bottom-left
            -1.0f, -1.0f,  1.0f, -1.0f,  0.0f,  0.0f, 0.0f, 0.0f, // bottom-right
            -1.0f,  1.0f,  1.0f, -1.0f,  0.0f,  0.0f, 1.0f, 0.0f, // top-right
            // right face
             1.0f,  1.0f,  1.0f,  1.0f,  0.0f,  0.0f, 1.0f, 0.0f, // top-left
             1.0f, -1.0f, -1.0f,  1.0f,  0.0f,  0.0f, 0.0f, 1.0f, // bottom-right
             1.0f,  1.0f, -1.0f,  1.0f,  0.0f,  0.0f, 1.0f, 1.0f, // top-right         
             1.0f, -1.0f, -1.0f,  1.0f,  0.0f,  0.0f, 0.0f, 1.0f, // bottom-right
             1.0f,  1.0f,  1.0f,  1.0f,  0.0f,  0.0f, 1.0f, 0.0f, // top-left
             1.0f, -1.0f,  1.0f,  1.0f,  0.0f,  0.0f, 0.0f, 0.0f, // bottom-left     
             // bottom face
             -1.0f, -1.0f, -1.0f,  0.0f, -1.0f,  0.0f, 0.0f, 1.0f, // top-right
              1.0f, -1.0f, -1.0f,  0.0f, -1.0f,  0.0f, 1.0f, 1.0f, // top-left
              1.0f, -1.0f,  1.0f,  0.0f, -1.0f,  0.0f, 1.0f, 0.0f, // bottom-left
              1.0f, -1.0f,  1.0f,  0.0f, -1.0f,  0.0f, 1.0f, 0.0f, // bottom-left
             -1.0f, -1.0f,  1.0f,  0.0f, -1.0f,  0.0f, 0.0f, 0.0f, // bottom-right
             -1.0f, -1.0f, -1.0f,  0.0f, -1.0f,  0.0f, 0.0f, 1.0f, // top-right
             // top face
             -1.0f,  1.0f, -1.0f,  0.0f,  1.0f,  0.0f, 0.0f, 1.0f, // top-left
              1.0f,  1.0f , 1.0f,  0.0f,  1.0f,  0.0f, 1.0f, 0.0f, // bottom-right
              1.0f,  1.0f, -1.0f,  0.0f,  1.0f,  0.0f, 1.0f, 1.0f, // top-right     
              1.0f,  1.0f,  1.0f,  0.0f,  1.0f,  0.0f, 1.0f, 0.0f, // bottom-right
             -1.0f,  1.0f, -1.0f,  0.0f,  1.0f,  0.0f, 0.0f, 1.0f, // top-left
             -1.0f,  1.0f,  1.0f,  0.0f,  1.0f,  0.0f, 0.0f, 0.0f  // bottom-left        
        };
        // 生成立方体 VAO
        glGenVertexArrays(1, &cubeVAO);
        // 生成立方体 VBO
        glGenBuffers(1, &cubeVBO);
        // fill buffer
        // 绑定立方体 VBO
        glBindBuffer(GL_ARRAY_BUFFER, cubeVBO);
        // 上传立方体顶点数据
        glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
        // link vertex attributes
        // 绑定立方体 VAO
        glBindVertexArray(cubeVAO);
        // 启用顶点属性 0：位置
        glEnableVertexAttribArray(0);
        // 位置属性配置
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)0);
        // 启用顶点属性 1：法线
        glEnableVertexAttribArray(1);
        // 法线属性配置
        glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(3 * sizeof(float)));
        // 启用顶点属性 2：纹理坐标
        glEnableVertexAttribArray(2);
        // 纹理坐标属性配置
        glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(6 * sizeof(float)));
        // 解绑 VBO
        glBindBuffer(GL_ARRAY_BUFFER, 0);
        // 解绑 VAO
        glBindVertexArray(0);
    }
    // render Cube
    // 绑定立方体 VAO
    glBindVertexArray(cubeVAO);
    // 绘制立方体，36 个顶点
    glDrawArrays(GL_TRIANGLES, 0, 36);
    // 解绑 VAO
    glBindVertexArray(0);
}

// renderQuad() renders a 1x1 XY quad in NDC
// -----------------------------------------
// 四边形 VAO、VBO
unsigned int quadVAO = 0;
unsigned int quadVBO;
// 渲染一个 1x1 的屏幕四边形
void renderQuad()
{
    // 如果还没有初始化
    if (quadVAO == 0)
    {
        // 四边形顶点数据：位置(3) + 纹理坐标(2)
        float quadVertices[] = {
            // positions        // texture Coords
            -1.0f,  1.0f, 0.0f, 0.0f, 1.0f,
            -1.0f, -1.0f, 0.0f, 0.0f, 0.0f,
             1.0f,  1.0f, 0.0f, 1.0f, 1.0f,
             1.0f, -1.0f, 0.0f, 1.0f, 0.0f,
        };
        // setup plane VAO
        // 生成四边形 VAO
        glGenVertexArrays(1, &quadVAO);
        // 生成四边形 VBO
        glGenBuffers(1, &quadVBO);
        // 绑定四边形 VAO
        glBindVertexArray(quadVAO);
        // 绑定四边形 VBO
        glBindBuffer(GL_ARRAY_BUFFER, quadVBO);
        // 上传四边形顶点数据
        glBufferData(GL_ARRAY_BUFFER, sizeof(quadVertices), &quadVertices, GL_STATIC_DRAW);
        // 启用顶点属性 0：位置
        glEnableVertexAttribArray(0);
        // 位置属性配置
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)0);
        // 启用顶点属性 1：纹理坐标
        glEnableVertexAttribArray(1);
        // 纹理坐标属性配置
        glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)(3 * sizeof(float)));
    }
    // 绑定四边形 VAO
    glBindVertexArray(quadVAO);
    // 用三角形带绘制四边形
    glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);
    // 解绑 VAO
    glBindVertexArray(0);
}

// process all input: query GLFW whether relevant keys are pressed/released this frame and react accordingly
// ---------------------------------------------------------------------------------------------------------
// 处理输入：按键按下时做出反应
void processInput(GLFWwindow* window)
{
    // 按 ESC 关闭窗口
    if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS)
        glfwSetWindowShouldClose(window, true);

    // W 向前
    if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS)
        camera.ProcessKeyboard(FORWARD, deltaTime);
    // S 向后
    if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS)
        camera.ProcessKeyboard(BACKWARD, deltaTime);
    // A 向左
    if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS)
        camera.ProcessKeyboard(LEFT, deltaTime);
    // D 向右
    if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS)
        camera.ProcessKeyboard(RIGHT, deltaTime);

    // 按空格切换 HDR 开关，用标记避免连发
    if (glfwGetKey(window, GLFW_KEY_SPACE) == GLFW_PRESS && !hdrKeyPressed)
    {
        // 切换 HDR 开关
        hdr = !hdr;
        // 标记按键已按下
        hdrKeyPressed = true;
    }
    // 松开空格时重置标记
    if (glfwGetKey(window, GLFW_KEY_SPACE) == GLFW_RELEASE)
    {
        // 重置按键标记
        hdrKeyPressed = false;
    }

    // 按 Q 降低曝光
    if (glfwGetKey(window, GLFW_KEY_Q) == GLFW_PRESS)
    {
        // 曝光不能小于 0
        if (exposure > 0.0f)
            exposure -= 0.001f;
        else
            exposure = 0.0f;
    }
    // 按 E 提高曝光
    else if (glfwGetKey(window, GLFW_KEY_E) == GLFW_PRESS)
    {
        // 增加曝光
        exposure += 0.001f;
    }
}

// glfw: whenever the window size changed (by OS or user resize) this callback function executes
// ---------------------------------------------------------------------------------------------
// 窗口大小改变时，调整视口
void framebuffer_size_callback(GLFWwindow* window, int width, int height)
{
    // make sure the viewport matches the new window dimensions; note that width and 
    // height will be significantly larger than specified on retina displays.
    // 设置视口大小
    glViewport(0, 0, width, height);
}

// glfw: whenever the mouse moves, this callback is called
// -------------------------------------------------------
// 鼠标移动回调：控制相机朝向
void mouse_callback(GLFWwindow* window, double xposIn, double yposIn)
{
    // 当前鼠标 X 位置
    float xpos = static_cast<float>(xposIn);
    // 当前鼠标 Y 位置
    float ypos = static_cast<float>(yposIn);
    // 第一次进入时
    if (firstMouse)
    {
        // 记录鼠标 X 位置
        lastX = xpos;
        // 记录鼠标 Y 位置
        lastY = ypos;
        // 取消第一次标记
        firstMouse = false;
    }

    // 计算鼠标 X 偏移量
    float xoffset = xpos - lastX;
    // 计算鼠标 Y 偏移量，因为屏幕坐标 y 轴向下，所以反过来
    float yoffset = lastY - ypos; // reversed since y-coordinates go from bottom to top

    // 更新上一帧鼠标 X 位置
    lastX = xpos;
    // 更新上一帧鼠标 Y 位置
    lastY = ypos;

    // 把鼠标移动传给相机
    camera.ProcessMouseMovement(xoffset, yoffset);
}

// glfw: whenever the mouse scroll wheel scrolls, this callback is called
// ----------------------------------------------------------------------
// 滚轮回调：控制相机缩放/视野
void scroll_callback(GLFWwindow* window, double xoffset, double yoffset)
{
    // 把滚轮偏移传给相机
    camera.ProcessMouseScroll(static_cast<float>(yoffset));
}

// utility function for loading a 2D texture from file
// ---------------------------------------------------
// 加载 2D 纹理，支持伽马校正
unsigned int loadTexture(char const* path, bool gammaCorrection)
{
    // 纹理 ID
    unsigned int textureID;
    // 生成纹理
    glGenTextures(1, &textureID);

    // 图片宽度、高度、通道数
    int width, height, nrComponents;
    // 从文件加载图片
    unsigned char* data = stbi_load(path, &width, &height, &nrComponents, 0);
    // 如果图片加载成功
    if (data)
    {
        // 纹理内部格式
        GLenum internalFormat;
        // 纹理数据格式
        GLenum dataFormat;
        // 1 个通道
        if (nrComponents == 1)
        {
            // 内部格式和数据格式都是 RED
            internalFormat = dataFormat = GL_RED;
        }
        // 3 个通道
        else if (nrComponents == 3)
        {
            // 根据是否伽马校正选择 SRGB 或 RGB
            internalFormat = gammaCorrection ? GL_SRGB : GL_RGB;
            // 数据格式是 RGB
            dataFormat = GL_RGB;
        }
        // 4 个通道
        else if (nrComponents == 4)
        {
            // 根据是否伽马校正选择 SRGB_ALPHA 或 RGBA
            internalFormat = gammaCorrection ? GL_SRGB_ALPHA : GL_RGBA;
            // 数据格式是 RGBA
            dataFormat = GL_RGBA;
        }

        // 绑定纹理
        glBindTexture(GL_TEXTURE_2D, textureID);
        // 上传纹理数据
        glTexImage2D(GL_TEXTURE_2D, 0, internalFormat, width, height, 0, dataFormat, GL_UNSIGNED_BYTE, data);
        // 生成 mipmap
        glGenerateMipmap(GL_TEXTURE_2D);

        // S 轴环绕方式
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
        // T 轴环绕方式
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
        // 缩小过滤方式
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
        // 放大过滤方式
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

        // 释放图片内存
        stbi_image_free(data);
    }
    // 如果图片加载失败
    else
    {
        // 输出错误信息
        std::cout << "Texture failed to load at path: " << path << std::endl;
        // 释放图片内存
        stbi_image_free(data);
    }

    // 返回纹理 ID
    return textureID;
}