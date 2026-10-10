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
// 是否启用泛光
bool bloom = true;
// 空格键是否已经按下的标记，防止连续触发
bool bloomKeyPressed = false;
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
    // 场景光照着色器
    Shader shader("shaders/7.bloom.vs", "shaders/7.bloom.fs");
    // 光源小方块着色器
    Shader shaderLight("shaders/7.bloom.vs", "shaders/7.light_box.fs");
    // 高斯模糊着色器
    Shader shaderBlur("shaders/7.blur.vs", "shaders/7.blur.fs");
    // 泛光合成着色器
    Shader shaderBloomFinal("shaders/7.bloom_final.vs", "shaders/7.bloom_final.fs");

    // load textures
    // -------------
    // 加载木纹纹理，作为 SRGB 纹理
    unsigned int woodTexture = loadTexture("resources/textures/wood.png", true); // note that we're loading the texture as an SRGB texture
    // 加载集装箱纹理，作为 SRGB 纹理
    unsigned int containerTexture = loadTexture("resources/textures/container2.png", true); // note that we're loading the texture as an SRGB texture

    // configure (floating point) framebuffers
    // ---------------------------------------
    // HDR 浮点帧缓冲
    unsigned int hdrFBO;
    // 生成帧缓冲
    glGenFramebuffers(1, &hdrFBO);
    // 绑定帧缓冲
    glBindFramebuffer(GL_FRAMEBUFFER, hdrFBO);
    // create 2 floating point color buffers (1 for normal rendering, other for brightness threshold values)
    // 两个浮点颜色缓冲：0 用于正常渲染，1 用于亮部提取
    unsigned int colorBuffers[2];
    // 生成两个纹理
    glGenTextures(2, colorBuffers);
    // 逐个配置颜色缓冲
    for (unsigned int i = 0; i < 2; i++)
    {
        // 绑定纹理
        glBindTexture(GL_TEXTURE_2D, colorBuffers[i]);
        // 分配 16 位浮点纹理存储
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA16F, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGBA, GL_FLOAT, NULL);
        // 缩小过滤方式
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        // 放大过滤方式
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        // S 轴环绕方式，用边缘限制，避免模糊时采样到重复纹理
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);  // we clamp to the edge as the blur filter would otherwise sample repeated texture values!
        // T 轴环绕方式，用边缘限制
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        // attach texture to framebuffer
        // 把纹理附加到对应的颜色附件
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0 + i, GL_TEXTURE_2D, colorBuffers[i], 0);
    }
    // create and attach depth buffer (renderbuffer)
    // 深度渲染缓冲
    unsigned int rboDepth;
    // 生成渲染缓冲
    glGenRenderbuffers(1, &rboDepth);
    // 绑定渲染缓冲
    glBindRenderbuffer(GL_RENDERBUFFER, rboDepth);
    // 分配深度存储
    glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH_COMPONENT, SCR_WIDTH, SCR_HEIGHT);
    // 把深度缓冲附加到深度附件
    glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_RENDERBUFFER, rboDepth);
    // tell OpenGL which color attachments we'll use (of this framebuffer) for rendering 
    // 告诉 OpenGL 这个帧缓冲使用哪两个颜色附件
    unsigned int attachments[2] = { GL_COLOR_ATTACHMENT0, GL_COLOR_ATTACHMENT1 };
    // 设置绘制缓冲
    glDrawBuffers(2, attachments);
    // finally check if framebuffer is complete
    // 检查帧缓冲是否完整
    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        std::cout << "Framebuffer not complete!" << std::endl;
    // 解绑帧缓冲
    glBindFramebuffer(GL_FRAMEBUFFER, 0);

    // ping-pong-framebuffer for blurring
    // 用于模糊的乒乓帧缓冲
    unsigned int pingpongFBO[2];
    // 乒乓颜色缓冲
    unsigned int pingpongColorbuffers[2];
    // 生成两个帧缓冲
    glGenFramebuffers(2, pingpongFBO);
    // 生成两个纹理
    glGenTextures(2, pingpongColorbuffers);
    // 逐个配置乒乓帧缓冲
    for (unsigned int i = 0; i < 2; i++)
    {
        // 绑定帧缓冲
        glBindFramebuffer(GL_FRAMEBUFFER, pingpongFBO[i]);
        // 绑定纹理
        glBindTexture(GL_TEXTURE_2D, pingpongColorbuffers[i]);
        // 分配 16 位浮点纹理存储
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA16F, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGBA, GL_FLOAT, NULL);
        // 缩小过滤方式
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        // 放大过滤方式
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        // S 轴环绕方式，用边缘限制，避免模糊时采样到重复纹理
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE); // we clamp to the edge as the blur filter would otherwise sample repeated texture values!
        // T 轴环绕方式，用边缘限制
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        // 把纹理附加到颜色附件
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, pingpongColorbuffers[i], 0);
        // also check if framebuffers are complete (no need for depth buffer)
        // 检查帧缓冲是否完整，模糊不需要深度缓冲
        if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
            std::cout << "Framebuffer not complete!" << std::endl;
    }

    // lighting info
    // -------------
    // positions
    // 光源位置列表
    std::vector<glm::vec3> lightPositions;
    // 第一个光源
    lightPositions.push_back(glm::vec3(0.0f, 0.5f, 1.5f));
    // 第二个光源
    lightPositions.push_back(glm::vec3(-4.0f, 0.5f, -3.0f));
    // 第三个光源
    lightPositions.push_back(glm::vec3(3.0f, 0.5f, 1.0f));
    // 第四个光源
    lightPositions.push_back(glm::vec3(-.8f, 2.4f, -1.0f));
    // colors
    // 光源颜色列表
    std::vector<glm::vec3> lightColors;
    // 白色强光
    lightColors.push_back(glm::vec3(5.0f, 5.0f, 5.0f));
    // 红色强光
    lightColors.push_back(glm::vec3(10.0f, 0.0f, 0.0f));
    // 蓝色强光
    lightColors.push_back(glm::vec3(0.0f, 0.0f, 15.0f));
    // 绿色强光
    lightColors.push_back(glm::vec3(0.0f, 5.0f, 0.0f));


    // shader configuration
    // --------------------
    // 使用场景着色器
    shader.use();
    // 告诉 shader 里面的 diffuseTexture 使用纹理单元 0
    shader.setInt("diffuseTexture", 0);
    // 使用模糊着色器
    shaderBlur.use();
    // 告诉 shader 里面的 image 使用纹理单元 0
    shaderBlur.setInt("image", 0);
    // 使用泛光合成着色器
    shaderBloomFinal.use();
    // 告诉 shader 里面的 scene 使用纹理单元 0
    shaderBloomFinal.setInt("scene", 0);
    // 告诉 shader 里面的 bloomBlur 使用纹理单元 1
    shaderBloomFinal.setInt("bloomBlur", 1);

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
        // 设置清屏颜色为黑色
        glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
        // 清除颜色缓冲和深度缓冲
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        // 1. render scene into floating point framebuffer
        // -----------------------------------------------
        // 绑定 HDR 帧缓冲
        glBindFramebuffer(GL_FRAMEBUFFER, hdrFBO);
        // 清除颜色和深度缓冲
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
        // 投影矩阵：透视投影
        glm::mat4 projection = glm::perspective(glm::radians(camera.Zoom), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
        // 视图矩阵：来自相机
        glm::mat4 view = camera.GetViewMatrix();
        // 模型矩阵：单位矩阵
        glm::mat4 model = glm::mat4(1.0f);
        // 使用场景着色器
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
        // 逐个传入光源位置和颜色
        for (unsigned int i = 0; i < lightPositions.size(); i++)
        {
            // 传第 i 个光源位置
            shader.setVec3("lights[" + std::to_string(i) + "].Position", lightPositions[i]);
            // 传第 i 个光源颜色
            shader.setVec3("lights[" + std::to_string(i) + "].Color", lightColors[i]);
        }
        // 把相机位置传给 shader
        shader.setVec3("viewPos", camera.Position);
        // create one large cube that acts as the floor
        // 用一个大立方体当地板
        model = glm::mat4(1.0f);
        // 向下平移
        model = glm::translate(model, glm::vec3(0.0f, -1.0f, 0.0));
        // 压扁成大平板
        model = glm::scale(model, glm::vec3(12.5f, 0.5f, 12.5f));
        // 把模型矩阵传给 shader
        shader.setMat4("model", model);
        // 绘制地板
        renderCube();
        // then create multiple cubes as the scenery
        // 换成集装箱纹理，绘制多个小立方体作为装饰
        glBindTexture(GL_TEXTURE_2D, containerTexture);
        // 第一个小立方体
        model = glm::mat4(1.0f);
        // 平移到 (0, 1.5, 0)
        model = glm::translate(model, glm::vec3(0.0f, 1.5f, 0.0));
        // 缩放 0.5 倍
        model = glm::scale(model, glm::vec3(0.5f));
        // 把模型矩阵传给 shader
        shader.setMat4("model", model);
        // 绘制立方体
        renderCube();

        // 第二个小立方体
        model = glm::mat4(1.0f);
        // 平移到 (2, 0, 1)
        model = glm::translate(model, glm::vec3(2.0f, 0.0f, 1.0));
        // 缩放 0.5 倍
        model = glm::scale(model, glm::vec3(0.5f));
        // 把模型矩阵传给 shader
        shader.setMat4("model", model);
        // 绘制立方体
        renderCube();

        // 第三个小立方体
        model = glm::mat4(1.0f);
        // 平移到 (-1, -1, 2)
        model = glm::translate(model, glm::vec3(-1.0f, -1.0f, 2.0));
        // 绕轴旋转 60 度
        model = glm::rotate(model, glm::radians(60.0f), glm::normalize(glm::vec3(1.0, 0.0, 1.0)));
        // 把模型矩阵传给 shader
        shader.setMat4("model", model);
        // 绘制立方体
        renderCube();

        // 第四个小立方体
        model = glm::mat4(1.0f);
        // 平移到 (0, 2.7, 4)
        model = glm::translate(model, glm::vec3(0.0f, 2.7f, 4.0));
        // 绕轴旋转 23 度
        model = glm::rotate(model, glm::radians(23.0f), glm::normalize(glm::vec3(1.0, 0.0, 1.0)));
        // 缩放 1.25 倍
        model = glm::scale(model, glm::vec3(1.25));
        // 把模型矩阵传给 shader
        shader.setMat4("model", model);
        // 绘制立方体
        renderCube();

        // 第五个小立方体
        model = glm::mat4(1.0f);
        // 平移到 (-2, 1, -3)
        model = glm::translate(model, glm::vec3(-2.0f, 1.0f, -3.0));
        // 绕轴旋转 124 度
        model = glm::rotate(model, glm::radians(124.0f), glm::normalize(glm::vec3(1.0, 0.0, 1.0)));
        // 把模型矩阵传给 shader
        shader.setMat4("model", model);
        // 绘制立方体
        renderCube();

        // 第六个小立方体
        model = glm::mat4(1.0f);
        // 平移到 (-3, 0, 0)
        model = glm::translate(model, glm::vec3(-3.0f, 0.0f, 0.0));
        // 缩放 0.5 倍
        model = glm::scale(model, glm::vec3(0.5f));
        // 把模型矩阵传给 shader
        shader.setMat4("model", model);
        // 绘制立方体
        renderCube();

        // finally show all the light sources as bright cubes
        // 用光源着色器把所有光源画成亮色小方块
        shaderLight.use();
        // 把投影矩阵传给 shader
        shaderLight.setMat4("projection", projection);
        // 把视图矩阵传给 shader
        shaderLight.setMat4("view", view);

        // 逐个绘制光源小方块
        for (unsigned int i = 0; i < lightPositions.size(); i++)
        {
            // 模型矩阵：单位矩阵
            model = glm::mat4(1.0f);
            // 平移到光源位置
            model = glm::translate(model, glm::vec3(lightPositions[i]));
            // 缩放 0.25 倍
            model = glm::scale(model, glm::vec3(0.25f));
            // 把模型矩阵传给 shader
            shaderLight.setMat4("model", model);
            // 把光源颜色传给 shader
            shaderLight.setVec3("lightColor", lightColors[i]);
            // 绘制立方体
            renderCube();
        }
        // 解绑帧缓冲
        glBindFramebuffer(GL_FRAMEBUFFER, 0);

        // 2. blur bright fragments with two-pass Gaussian Blur 
        // --------------------------------------------------
        // 水平/垂直方向标记
        bool horizontal = true, first_iteration = true;
        // 模糊迭代次数
        unsigned int amount = 10;
        // 使用模糊着色器
        shaderBlur.use();
        // 乒乓迭代做高斯模糊
        for (unsigned int i = 0; i < amount; i++)
        {
            // 绑定乒乓帧缓冲
            glBindFramebuffer(GL_FRAMEBUFFER, pingpongFBO[horizontal]);
            // 告诉 shader 当前是水平还是垂直模糊
            shaderBlur.setInt("horizontal", horizontal);
            // 第一次用亮部纹理，之后用上一个乒乓缓冲
            glBindTexture(GL_TEXTURE_2D, first_iteration ? colorBuffers[1] : pingpongColorbuffers[!horizontal]);  // bind texture of other framebuffer (or scene if first iteration)
            // 绘制全屏四边形做模糊
            renderQuad();
            // 切换方向
            horizontal = !horizontal;
            // 第一次之后取消首帧标记
            if (first_iteration)
                first_iteration = false;
        }
        // 解绑帧缓冲
        glBindFramebuffer(GL_FRAMEBUFFER, 0);

        // 3. now render floating point color buffer to 2D quad and tonemap HDR colors to default framebuffer's (clamped) color range
        // --------------------------------------------------------------------------------------------------------------------------
        // 清除默认帧缓冲的颜色和深度
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
        // 使用泛光合成着色器
        shaderBloomFinal.use();
        // 激活纹理单元 0
        glActiveTexture(GL_TEXTURE0);
        // 绑定场景颜色缓冲
        glBindTexture(GL_TEXTURE_2D, colorBuffers[0]);
        // 激活纹理单元 1
        glActiveTexture(GL_TEXTURE1);
        // 绑定模糊后的亮部纹理
        glBindTexture(GL_TEXTURE_2D, pingpongColorbuffers[!horizontal]);
        // 把泛光开关传给 shader
        shaderBloomFinal.setInt("bloom", bloom);
        // 把曝光值传给 shader
        shaderBloomFinal.setFloat("exposure", exposure);
        // 绘制全屏四边形，合成场景和泛光
        renderQuad();

        // 输出当前泛光和曝光状态
        std::cout << "bloom: " << (bloom ? "on" : "off") << "| exposure: " << exposure << std::endl;

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

    // 按空格切换泛光开关，用标记避免连发
    if (glfwGetKey(window, GLFW_KEY_SPACE) == GLFW_PRESS && !bloomKeyPressed)
    {
        // 切换泛光开关
        bloom = !bloom;
        // 标记按键已按下
        bloomKeyPressed = true;
    }
    // 松开空格时重置标记
    if (glfwGetKey(window, GLFW_KEY_SPACE) == GLFW_RELEASE)
    {
        // 重置按键标记
        bloomKeyPressed = false;
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