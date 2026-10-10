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

// settings
// 窗口宽度
const unsigned int SCR_WIDTH = 800;
// 窗口高度
const unsigned int SCR_HEIGHT = 600;

// camera
// 创建相机，位置在 (0, 0, 3)
Camera camera(glm::vec3(0.0f, 0.0f, 3.0f));
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
    // 场景着色器
    Shader shader("shaders/11.2.anti_aliasing.vs", "shaders/11.2.anti_aliasing.fs");
    // 后处理着色器，用来把屏幕纹理画到四边形上
    Shader screenShader("shaders/11.2.aa_post.vs", "shaders/11.2.aa_post.fs");

    // set up vertex data (and buffer(s)) and configure vertex attributes
    // ------------------------------------------------------------------
    // 立方体顶点数据：只有位置
    float cubeVertices[] = {
        // positions       
        -0.5f, -0.5f, -0.5f,
         0.5f, -0.5f, -0.5f,
         0.5f,  0.5f, -0.5f,
         0.5f,  0.5f, -0.5f,
        -0.5f,  0.5f, -0.5f,
        -0.5f, -0.5f, -0.5f,

        -0.5f, -0.5f,  0.5f,
         0.5f, -0.5f,  0.5f,
         0.5f,  0.5f,  0.5f,
         0.5f,  0.5f,  0.5f,
        -0.5f,  0.5f,  0.5f,
        -0.5f, -0.5f,  0.5f,

        -0.5f,  0.5f,  0.5f,
        -0.5f,  0.5f, -0.5f,
        -0.5f, -0.5f, -0.5f,
        -0.5f, -0.5f, -0.5f,
        -0.5f, -0.5f,  0.5f,
        -0.5f,  0.5f,  0.5f,

         0.5f,  0.5f,  0.5f,
         0.5f,  0.5f, -0.5f,
         0.5f, -0.5f, -0.5f,
         0.5f, -0.5f, -0.5f,
         0.5f, -0.5f,  0.5f,
         0.5f,  0.5f,  0.5f,

        -0.5f, -0.5f, -0.5f,
         0.5f, -0.5f, -0.5f,
         0.5f, -0.5f,  0.5f,
         0.5f, -0.5f,  0.5f,
        -0.5f, -0.5f,  0.5f,
        -0.5f, -0.5f, -0.5f,

        -0.5f,  0.5f, -0.5f,
         0.5f,  0.5f, -0.5f,
         0.5f,  0.5f,  0.5f,
         0.5f,  0.5f,  0.5f,
        -0.5f,  0.5f,  0.5f,
        -0.5f,  0.5f, -0.5f
    };
    // 屏幕四边形顶点数据：位置(2) + 纹理坐标(2)
    float quadVertices[] = {   // vertex attributes for a quad that fills the entire screen in Normalized Device Coordinates.
        // positions   // texCoords
        -1.0f,  1.0f,  0.0f, 1.0f,
        -1.0f, -1.0f,  0.0f, 0.0f,
         1.0f, -1.0f,  1.0f, 0.0f,

        -1.0f,  1.0f,  0.0f, 1.0f,
         1.0f, -1.0f,  1.0f, 0.0f,
         1.0f,  1.0f,  1.0f, 1.0f
    };
    // setup cube VAO
    // 立方体 VAO、VBO
    unsigned int cubeVAO, cubeVBO;
    // 生成立方体 VAO
    glGenVertexArrays(1, &cubeVAO);
    // 生成立方体 VBO
    glGenBuffers(1, &cubeVBO);
    // 绑定立方体 VAO
    glBindVertexArray(cubeVAO);
    // 绑定立方体 VBO
    glBindBuffer(GL_ARRAY_BUFFER, cubeVBO);
    // 上传立方体顶点数据
    glBufferData(GL_ARRAY_BUFFER, sizeof(cubeVertices), &cubeVertices, GL_STATIC_DRAW);
    // 启用顶点属性 0：位置
    glEnableVertexAttribArray(0);
    // 位置属性配置
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
    // setup screen VAO
    // 屏幕四边形 VAO、VBO
    unsigned int quadVAO, quadVBO;
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
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 4 * sizeof(float), (void*)0);
    // 启用顶点属性 1：纹理坐标
    glEnableVertexAttribArray(1);
    // 纹理坐标属性配置
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 4 * sizeof(float), (void*)(2 * sizeof(float)));


    // configure MSAA framebuffer
    // --------------------------
    // 多重采样帧缓冲
    unsigned int framebuffer;
    // 生成帧缓冲
    glGenFramebuffers(1, &framebuffer);
    // 绑定帧缓冲
    glBindFramebuffer(GL_FRAMEBUFFER, framebuffer);
    // create a multisampled color attachment texture
    // 多重采样颜色附件纹理
    unsigned int textureColorBufferMultiSampled;
    // 生成纹理
    glGenTextures(1, &textureColorBufferMultiSampled);
    // 绑定为多重采样纹理
    glBindTexture(GL_TEXTURE_2D_MULTISAMPLE, textureColorBufferMultiSampled);
    // 分配多重采样纹理存储，4 个采样点
    glTexImage2DMultisample(GL_TEXTURE_2D_MULTISAMPLE, 4, GL_RGB, SCR_WIDTH, SCR_HEIGHT, GL_TRUE);
    // 解绑纹理
    glBindTexture(GL_TEXTURE_2D_MULTISAMPLE, 0);
    // 把多重采样纹理附加到帧缓冲的颜色附件
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D_MULTISAMPLE, textureColorBufferMultiSampled, 0);
    // create a (also multisampled) renderbuffer object for depth and stencil attachments
    // 多重采样的深度模板渲染缓冲
    unsigned int rbo;
    // 生成渲染缓冲
    glGenRenderbuffers(1, &rbo);
    // 绑定渲染缓冲
    glBindRenderbuffer(GL_RENDERBUFFER, rbo);
    // 分配多重采样深度模板存储，4 个采样点
    glRenderbufferStorageMultisample(GL_RENDERBUFFER, 4, GL_DEPTH24_STENCIL8, SCR_WIDTH, SCR_HEIGHT);
    // 解绑渲染缓冲
    glBindRenderbuffer(GL_RENDERBUFFER, 0);
    // 把渲染缓冲附加到帧缓冲的深度模板附件
    glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_STENCIL_ATTACHMENT, GL_RENDERBUFFER, rbo);

    // 检查帧缓冲是否完整
    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        cout << "ERROR::FRAMEBUFFER:: Framebuffer is not complete!" << endl;
    // 解绑帧缓冲
    glBindFramebuffer(GL_FRAMEBUFFER, 0);

    // configure second post-processing framebuffer
    // 第二个后处理帧缓冲，用来把多重采样结果解析成普通纹理
    unsigned int intermediateFBO;
    // 生成帧缓冲
    glGenFramebuffers(1, &intermediateFBO);
    // 绑定帧缓冲
    glBindFramebuffer(GL_FRAMEBUFFER, intermediateFBO);
    // create a color attachment texture
    // 屏幕纹理，用来接收解析后的图像
    unsigned int screenTexture;
    // 生成纹理
    glGenTextures(1, &screenTexture);
    // 绑定为普通 2D 纹理
    glBindTexture(GL_TEXTURE_2D, screenTexture);
    // 分配纹理存储
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, SCR_WIDTH, SCR_HEIGHT, 0, GL_RGB, GL_UNSIGNED_BYTE, NULL);
    // 缩小过滤方式
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    // 放大过滤方式
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    // 把纹理附加到帧缓冲的颜色附件
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, screenTexture, 0);	// we only need a color buffer

    // 检查帧缓冲是否完整
    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        cout << "ERROR::FRAMEBUFFER:: Intermediate framebuffer is not complete!" << endl;
    // 解绑帧缓冲
    glBindFramebuffer(GL_FRAMEBUFFER, 0);

    // shader configuration
    // --------------------
    // 使用后处理着色器
    screenShader.use();
    // 告诉 shader 里面的 screenTexture 使用纹理单元 0
    screenShader.setInt("screenTexture", 0);

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

        // 1. draw scene as normal in multisampled buffers
        // 绑定多重采样帧缓冲
        glBindFramebuffer(GL_FRAMEBUFFER, framebuffer);
        // 设置清屏颜色为深灰色
        glClearColor(0.1f, 0.1f, 0.1f, 1.0f);
        // 清除多重采样帧缓冲的颜色和深度
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
        // 开启深度测试
        glEnable(GL_DEPTH_TEST);

        // set transformation matrices		
        // 使用场景着色器
        shader.use();
        // 投影矩阵：透视投影
        glm::mat4 projection = glm::perspective(glm::radians(camera.Zoom), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 1000.0f);
        // 把投影矩阵传给 shader
        shader.setMat4("projection", projection);
        // 把视图矩阵传给 shader
        shader.setMat4("view", camera.GetViewMatrix());
        // 把模型矩阵传给 shader
        shader.setMat4("model", glm::mat4(1.0f));

        // 绑定立方体 VAO
        glBindVertexArray(cubeVAO);
        // 绘制立方体
        glDrawArrays(GL_TRIANGLES, 0, 36);

        // 2. now blit multisampled buffer(s) to normal colorbuffer of intermediate FBO. Image is stored in screenTexture
        // 把多重采样帧缓冲绑定为读取源
        glBindFramebuffer(GL_READ_FRAMEBUFFER, framebuffer);
        // 把中间帧缓冲绑定为写入目标
        glBindFramebuffer(GL_DRAW_FRAMEBUFFER, intermediateFBO);
        // 把多重采样颜色缓冲解析并拷贝到普通纹理
        glBlitFramebuffer(0, 0, SCR_WIDTH, SCR_HEIGHT, 0, 0, SCR_WIDTH, SCR_HEIGHT, GL_COLOR_BUFFER_BIT, GL_NEAREST);

        // 3. now render quad with scene's visuals as its texture image
        // 绑定默认帧缓冲，回到屏幕
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
        // 设置清屏颜色为白色
        glClearColor(1.0f, 1.0f, 1.0f, 1.0f);
        // 清除颜色缓冲
        glClear(GL_COLOR_BUFFER_BIT);
        // 关闭深度测试，因为只是画一个全屏四边形
        glDisable(GL_DEPTH_TEST);

        // draw Screen quad
        // 使用后处理着色器
        screenShader.use();
        // 绑定屏幕四边形 VAO
        glBindVertexArray(quadVAO);
        // 激活纹理单元 0
        glActiveTexture(GL_TEXTURE0);
        // 绑定屏幕纹理
        glBindTexture(GL_TEXTURE_2D, screenTexture); // use the now resolved color attachment as the quad's texture
        // 绘制全屏四边形
        glDrawArrays(GL_TRIANGLES, 0, 6);

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