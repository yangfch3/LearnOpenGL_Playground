// 加载 OpenGL 函数指针
#include <glad/glad.h>
// 窗口、输入、上下文管理
#include <GLFW/glfw3.h>

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
// 自定义 Model 类
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

    // tell stb_image.h to flip loaded texture's on the y-axis (before loading model).
    // 让 stb_image 加载纹理时上下翻转
    stbi_set_flip_vertically_on_load(true);

    // configure global opengl state
    // -----------------------------
    // 开启深度测试
    glEnable(GL_DEPTH_TEST);

    // build and compile shaders
    // -------------------------
    // 几何处理阶段着色器，把几何数据写入 G-buffer
    Shader shaderGeometryPass("shaders/8.1.g_buffer.vs", "shaders/8.1.g_buffer.fs");
    // 光照处理阶段着色器，从 G-buffer 读取数据计算光照
    Shader shaderLightingPass("shaders/8.1.deferred_shading.vs", "shaders/8.1.deferred_shading.fs");
    // 光源小方块着色器
    Shader shaderLightBox("shaders/8.1.deferred_light_box.vs", "shaders/8.1.deferred_light_box.fs");

    // load models
    // -----------
    // 加载背包模型
    Model backpack("resources/objects/backpack/backpack.obj");
    // 存放物体的位置
    std::vector<glm::vec3> objectPositions;
    // 位置 1
    objectPositions.push_back(glm::vec3(-3.0, -0.5, -3.0));
    // 位置 2
    objectPositions.push_back(glm::vec3(0.0, -0.5, -3.0));
    // 位置 3
    objectPositions.push_back(glm::vec3(3.0, -0.5, -3.0));
    // 位置 4
    objectPositions.push_back(glm::vec3(-3.0, -0.5, 0.0));
    // 位置 5
    objectPositions.push_back(glm::vec3(0.0, -0.5, 0.0));
    // 位置 6
    objectPositions.push_back(glm::vec3(3.0, -0.5, 0.0));
    // 位置 7
    objectPositions.push_back(glm::vec3(-3.0, -0.5, 3.0));
    // 位置 8
    objectPositions.push_back(glm::vec3(0.0, -0.5, 3.0));
    // 位置 9
    objectPositions.push_back(glm::vec3(3.0, -0.5, 3.0));


    // configure g-buffer framebuffer
    // ------------------------------
    // G-buffer 帧缓冲
    unsigned int gBuffer;
    // 生成帧缓冲
    glGenFramebuffers(1, &gBuffer);
    // 绑定帧缓冲
    glBindFramebuffer(GL_FRAMEBUFFER, gBuffer);
    // 位置、法线、颜色+高光三个颜色缓冲
    unsigned int gPosition, gNormal, gAlbedoSpec;
    // position color buffer
    // 生成位置颜色缓冲
    glGenTextures(1, &gPosition);
    // 绑定位置纹理
    glBindTexture(GL_TEXTURE_2D, gPosition);
    // 分配 16 位浮点纹理存储
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA16F, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGBA, GL_FLOAT, NULL);
    // 缩小过滤方式
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    // 放大过滤方式
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    // 附加到颜色附件 0
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, gPosition, 0);
    // normal color buffer
    // 生成法线颜色缓冲
    glGenTextures(1, &gNormal);
    // 绑定法线纹理
    glBindTexture(GL_TEXTURE_2D, gNormal);
    // 分配 16 位浮点纹理存储
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA16F, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGBA, GL_FLOAT, NULL);
    // 缩小过滤方式
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    // 放大过滤方式
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    // 附加到颜色附件 1
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT1, GL_TEXTURE_2D, gNormal, 0);
    // color + specular color buffer
    // 生成颜色+高光缓冲
    glGenTextures(1, &gAlbedoSpec);
    // 绑定纹理
    glBindTexture(GL_TEXTURE_2D, gAlbedoSpec);
    // 分配普通 RGBA 纹理存储
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGBA, GL_UNSIGNED_BYTE, NULL);
    // 缩小过滤方式
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    // 放大过滤方式
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    // 附加到颜色附件 2
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT2, GL_TEXTURE_2D, gAlbedoSpec, 0);
    // tell OpenGL which color attachments we'll use (of this framebuffer) for rendering 
    // 告诉 OpenGL 这个帧缓冲使用哪三个颜色附件
    unsigned int attachments[3] = { GL_COLOR_ATTACHMENT0, GL_COLOR_ATTACHMENT1, GL_COLOR_ATTACHMENT2 };
    // 设置绘制缓冲
    glDrawBuffers(3, attachments);
    // create and attach depth buffer (renderbuffer)
    // 深度渲染缓冲
    unsigned int rboDepth;
    // 生成渲染缓冲
    glGenRenderbuffers(1, &rboDepth);
    // 绑定渲染缓冲
    glBindRenderbuffer(GL_RENDERBUFFER, rboDepth);
    // 分配深度存储
    glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH_COMPONENT, SCR_WIDTH, SCR_HEIGHT);
    // 附加到深度附件
    glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_RENDERBUFFER, rboDepth);
    // finally check if framebuffer is complete
    // 检查帧缓冲是否完整
    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "Framebuffer not complete!" << std::endl;
    // 解绑帧缓冲
    glBindFramebuffer(GL_FRAMEBUFFER, 0);

    // lighting info
    // -------------
    // 光源数量
    const unsigned int NR_LIGHTS = 32;
    // 光源位置列表
    std::vector<glm::vec3> lightPositions;
    // 光源颜色列表
    std::vector<glm::vec3> lightColors;
    // 用固定种子初始化随机数
    srand(13);
    // 生成 32 个随机光源
    for (unsigned int i = 0; i < NR_LIGHTS; i++)
    {
        // calculate slightly random offsets
        // 随机 X 位置
        float xPos = static_cast<float>(((rand() % 100) / 100.0) * 6.0 - 3.0);
        // 随机 Y 位置
        float yPos = static_cast<float>(((rand() % 100) / 100.0) * 6.0 - 4.0);
        // 随机 Z 位置
        float zPos = static_cast<float>(((rand() % 100) / 100.0) * 6.0 - 3.0);
        // 保存光源位置
        lightPositions.push_back(glm::vec3(xPos, yPos, zPos));
        // also calculate random color
        // 随机红色分量，范围 0.5 到 1.0
        float rColor = static_cast<float>(((rand() % 100) / 200.0f) + 0.5); // between 0.5 and 1.0
        // 随机绿色分量，范围 0.5 到 1.0
        float gColor = static_cast<float>(((rand() % 100) / 200.0f) + 0.5); // between 0.5 and 1.0
        // 随机蓝色分量，范围 0.5 到 1.0
        float bColor = static_cast<float>(((rand() % 100) / 200.0f) + 0.5); // between 0.5 and 1.0
        // 保存光源颜色
        lightColors.push_back(glm::vec3(rColor, gColor, bColor));
    }

    // shader configuration
    // --------------------
    // 使用光照处理着色器
    shaderLightingPass.use();
    // 告诉 shader 里面的 gPosition 使用纹理单元 0
    shaderLightingPass.setInt("gPosition", 0);
    // 告诉 shader 里面的 gNormal 使用纹理单元 1
    shaderLightingPass.setInt("gNormal", 1);
    // 告诉 shader 里面的 gAlbedoSpec 使用纹理单元 2
    shaderLightingPass.setInt("gAlbedoSpec", 2);

    // render loop
    // -----------
    // 渲染循环
    while (!glfwWindowShouldClose(window))
    {
        // per-frame time logic
        // --------------------
        // 获取当前时间
        auto currentFrame = static_cast<float>(glfwGetTime());
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
        // 设置清屏颜色为黑色
        glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
        // 清除颜色缓冲和深度缓冲
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        // 1. geometry pass: render scene's geometry/color data into gbuffer
        // -----------------------------------------------------------------
        // 绑定 G-buffer 帧缓冲
        glBindFramebuffer(GL_FRAMEBUFFER, gBuffer);
        // 清除颜色和深度缓冲
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
        // 投影矩阵：透视投影
        glm::mat4 projection = glm::perspective(glm::radians(camera.Zoom), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
        // 视图矩阵：来自相机
        glm::mat4 view = camera.GetViewMatrix();
        // 模型矩阵：单位矩阵
        glm::mat4 model = glm::mat4(1.0f);
        // 使用几何处理着色器
        shaderGeometryPass.use();
        // 把投影矩阵传给 shader
        shaderGeometryPass.setMat4("projection", projection);
        // 把视图矩阵传给 shader
        shaderGeometryPass.setMat4("view", view);
        // 遍历所有物体位置
        for (unsigned int i = 0; i < objectPositions.size(); i++)
        {
            // 模型矩阵：单位矩阵
            model = glm::mat4(1.0f);
            // 平移到目标位置
            model = glm::translate(model, objectPositions[i]);
            // 缩放 0.5 倍
            model = glm::scale(model, glm::vec3(0.5f));
            // 把模型矩阵传给 shader
            shaderGeometryPass.setMat4("model", model);
            // 绘制背包模型
            backpack.Draw(shaderGeometryPass);
        }
        // 解绑帧缓冲
        glBindFramebuffer(GL_FRAMEBUFFER, 0);

        // 2. lighting pass: calculate lighting by iterating over a screen filled quad pixel-by-pixel using the gbuffer's content.
        // -----------------------------------------------------------------------------------------------------------------------
        // 清除默认帧缓冲的颜色和深度
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
        // 使用光照处理着色器
        shaderLightingPass.use();
        // 激活纹理单元 0
        glActiveTexture(GL_TEXTURE0);
        // 绑定位置纹理
        glBindTexture(GL_TEXTURE_2D, gPosition);
        // 激活纹理单元 1
        glActiveTexture(GL_TEXTURE1);
        // 绑定法线纹理
        glBindTexture(GL_TEXTURE_2D, gNormal);
        // 激活纹理单元 2
        glActiveTexture(GL_TEXTURE2);
        // 绑定颜色+高光纹理
        glBindTexture(GL_TEXTURE_2D, gAlbedoSpec);
        // send light relevant uniforms
        // 逐个传入光源的位置、颜色和衰减参数
        for (unsigned int i = 0; i < lightPositions.size(); i++)
        {
            // 传第 i 个光源位置
            shaderLightingPass.setVec3("lights[" + std::to_string(i) + "].Position", lightPositions[i]);
            // 传第 i 个光源颜色
            shaderLightingPass.setVec3("lights[" + std::to_string(i) + "].Color", lightColors[i]);
            // update attenuation parameters and calculate radius
            // 线性衰减系数
            const float linear = 0.7f;
            // 二次衰减系数
            const float quadratic = 1.8f;
            // 传线性衰减
            shaderLightingPass.setFloat("lights[" + std::to_string(i) + "].Linear", linear);
            // 传二次衰减
            shaderLightingPass.setFloat("lights[" + std::to_string(i) + "].Quadratic", quadratic);
        }
        // 把相机位置传给 shader
        shaderLightingPass.setVec3("viewPos", camera.Position);
        // finally render quad
        // 绘制全屏四边形，逐像素计算光照
        renderQuad();

        // 2.5. copy content of geometry's depth buffer to default framebuffer's depth buffer
        // ----------------------------------------------------------------------------------
        // 把 G-buffer 绑定为读取源
        glBindFramebuffer(GL_READ_FRAMEBUFFER, gBuffer);
        // 把默认帧缓冲绑定为写入目标
        glBindFramebuffer(GL_DRAW_FRAMEBUFFER, 0); // write to default framebuffer
        // blit to default framebuffer. Note that this may or may not work as the internal formats of both the FBO and default framebuffer have to match.
        // the internal formats are implementation defined. This works on all of my systems, but if it doesn't on yours you'll likely have to write to the 		
        // depth buffer in another shader stage (or somehow see to match the default framebuffer's internal format with the FBO's internal format).
        // 把 G-buffer 的深度缓冲拷贝到默认帧缓冲
        glBlitFramebuffer(0, 0, SCR_WIDTH, SCR_HEIGHT, 0, 0, SCR_WIDTH, SCR_HEIGHT, GL_DEPTH_BUFFER_BIT, GL_NEAREST);
        // 解绑帧缓冲
        glBindFramebuffer(GL_FRAMEBUFFER, 0);

        // 3. render lights on top of scene
        // --------------------------------
        // 使用光源小方块着色器
        shaderLightBox.use();
        // 把投影矩阵传给 shader
        shaderLightBox.setMat4("projection", projection);
        // 把视图矩阵传给 shader
        shaderLightBox.setMat4("view", view);
        // 逐个绘制光源小方块
        for (unsigned int i = 0; i < lightPositions.size(); i++)
        {
            // 模型矩阵：单位矩阵
            model = glm::mat4(1.0f);
            // 平移到光源位置
            model = glm::translate(model, lightPositions[i]);
            // 缩放 0.125 倍
            model = glm::scale(model, glm::vec3(0.125f));
            // 把模型矩阵传给 shader
            shaderLightBox.setMat4("model", model);
            // 把光源颜色传给 shader
            shaderLightBox.setVec3("lightColor", lightColors[i]);
            // 绘制立方体
            renderCube();
        }


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