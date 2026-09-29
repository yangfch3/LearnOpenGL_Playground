// 包含 glad 库，用来加载 OpenGL 函数指针
#include <glad/glad.h>
// 包含 GLFW 库，用来创建窗口、处理输入和 OpenGL 上下文
#include <GLFW/glfw3.h>
// 包含 stb_image 库，用来加载图片纹理
#include <stb_image.h>

// 包含 glm 数学库
#include <glm/glm.hpp>
// 包含矩阵变换相关功能，如 translate、rotate、perspective
#include <glm/gtc/matrix_transform.hpp>
// 包含把 glm 矩阵传给 OpenGL 时用到的 type_ptr
#include <glm/gtc/type_ptr.hpp>

// 包含 LearnOpenGL 封装好的 Shader 类
#include <learnopengl/shader_m.h>
// 包含 LearnOpenGL 封装好的 Camera 类
#include <learnopengl/camera.h>
#include <learnopengl/camera_fps.h>

// 标准输入输出库
#include <iostream>

// 窗口大小变化时的回调函数声明
void framebuffer_size_callback(GLFWwindow* window, int width, int height);
// 鼠标移动时的回调函数声明
void mouse_callback(GLFWwindow* window, double xpos, double ypos);
// 鼠标滚轮滚动时的回调函数声明
void scroll_callback(GLFWwindow* window, double xoffset, double yoffset);
// 处理键盘输入的函数声明
void processInput(GLFWwindow* window);

// 设置窗口宽度
const unsigned int SCR_WIDTH = 800;
// 设置窗口高度
const unsigned int SCR_HEIGHT = 600;

// 摄像机
// 创建一个 Camera 对象，初始位置在 (0.0, 0.0, 3.0)
// 也就是说摄像机在原点后方 3 个单位，看向 -z 方向
#define USE_FPS_CAMERA
#ifdef USE_FPS_CAMERA
CameraFPS camera(glm::vec3(0.0f, 0.0f, 3.0f));
#else
Camera camera(glm::vec3(0.0f, 0.0f, 3.0f));
#endif

// 记录鼠标上一帧的位置，初始设为屏幕中心
float lastX = SCR_WIDTH / 2.0f;
float lastY = SCR_HEIGHT / 2.0f;

// 是否是第一次接收鼠标移动
// 第一次时只记录位置，不计算偏移，避免画面突然跳动
bool firstMouse = true;

// 时间相关变量
// 当前帧与上一帧之间的时间差，用来让移动速度与帧率无关
float deltaTime = 0.0f;
// 上一帧的时间
float lastFrame = 0.0f;

int main()
{
    // glfw：初始化并配置
    // ------------------------------
    // 初始化 GLFW
    glfwInit();
    // 设置 OpenGL 主版本号为 3
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    // 设置 OpenGL 次版本号为 3，也就是 OpenGL 3.3
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
    // 使用核心模式，只包含现代 OpenGL 功能
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

#ifdef __APPLE__
    // macOS 上前向兼容必须开启
    glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GL_TRUE);
#endif

    // glfw：创建窗口
    // --------------------
    // 创建宽 800、高 600、标题为 LearnOpenGL 的窗口
    GLFWwindow* window = glfwCreateWindow(SCR_WIDTH, SCR_HEIGHT, "LearnOpenGL", NULL, NULL);
    // 如果窗口创建失败
    if (window == NULL)
    {
        // 输出错误信息
        std::cout << "Failed to create GLFW window" << std::endl;
        // 终止 GLFW
        glfwTerminate();
        // 返回 -1 表示程序异常结束
        return -1;
    }
    // 把当前窗口的 OpenGL 上下文设为当前线程的主上下文
    glfwMakeContextCurrent(window);
    // 注册窗口大小变化回调函数
    glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);
    // 注册鼠标移动回调函数
    glfwSetCursorPosCallback(window, mouse_callback);
    // 注册鼠标滚轮回调函数
    glfwSetScrollCallback(window, scroll_callback);

    // 告诉 GLFW 捕获鼠标，隐藏光标并把鼠标锁定在窗口内
    glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);

    // glad：加载所有 OpenGL 函数指针
    // ---------------------------------------
    // 使用 GLFW 提供的 glfwGetProcAddress 加载 OpenGL 函数
    if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress))
    {
        // 如果 GLAD 初始化失败，输出错误
        std::cout << "Failed to initialize GLAD" << std::endl;
        // 返回 -1
        return -1;
    }

    // 配置全局 OpenGL 状态
    // -----------------------------
    // 启用深度测试，保证 3D 物体前后遮挡关系正确
    glEnable(GL_DEPTH_TEST);

    // 构建并编译着色器程序
    // ------------------------------------
    // 使用顶点着色器和片元着色器文件创建 Shader 对象
    Shader ourShader("shaders/7.4.camera.vs", "shaders/7.4.camera.fs");

    // 设置顶点数据，并配置顶点属性
    // ------------------------------------------------------------------
    // 这里定义了一个立方体的 36 个顶点
    // 每个顶点包含：
    //   前 3 个 float：位置 x, y, z
    //   后 2 个 float：纹理坐标 u, v
    float vertices[] = {
        // 后面 -0.5 这个面
        -0.5f, -0.5f, -0.5f,  0.0f, 0.0f,
         0.5f, -0.5f, -0.5f,  1.0f, 0.0f,
         0.5f,  0.5f, -0.5f,  1.0f, 1.0f,
         0.5f,  0.5f, -0.5f,  1.0f, 1.0f,
        -0.5f,  0.5f, -0.5f,  0.0f, 1.0f,
        -0.5f, -0.5f, -0.5f,  0.0f, 0.0f,

        // 前面 +0.5 这个面
        -0.5f, -0.5f,  0.5f,  0.0f, 0.0f,
         0.5f, -0.5f,  0.5f,  1.0f, 0.0f,
         0.5f,  0.5f,  0.5f,  1.0f, 1.0f,
         0.5f,  0.5f,  0.5f,  1.0f, 1.0f,
        -0.5f,  0.5f,  0.5f,  0.0f, 1.0f,
        -0.5f, -0.5f,  0.5f,  0.0f, 0.0f,

        // 左面 -0.5 这个面
        -0.5f,  0.5f,  0.5f,  1.0f, 0.0f,
        -0.5f,  0.5f, -0.5f,  1.0f, 1.0f,
        -0.5f, -0.5f, -0.5f,  0.0f, 1.0f,
        -0.5f, -0.5f, -0.5f,  0.0f, 1.0f,
        -0.5f, -0.5f,  0.5f,  0.0f, 0.0f,
        -0.5f,  0.5f,  0.5f,  1.0f, 0.0f,

        // 右面 +0.5 这个面
         0.5f,  0.5f,  0.5f,  1.0f, 0.0f,
         0.5f,  0.5f, -0.5f,  1.0f, 1.0f,
         0.5f, -0.5f, -0.5f,  0.0f, 1.0f,
         0.5f, -0.5f, -0.5f,  0.0f, 1.0f,
         0.5f, -0.5f,  0.5f,  0.0f, 0.0f,
         0.5f,  0.5f,  0.5f,  1.0f, 0.0f,

         // 底面 -0.5 y 这个面
         -0.5f, -0.5f, -0.5f,  0.0f, 1.0f,
          0.5f, -0.5f, -0.5f,  1.0f, 1.0f,
          0.5f, -0.5f,  0.5f,  1.0f, 0.0f,
          0.5f, -0.5f,  0.5f,  1.0f, 0.0f,
         -0.5f, -0.5f,  0.5f,  0.0f, 0.0f,
         -0.5f, -0.5f, -0.5f,  0.0f, 1.0f,

         // 顶面 +0.5 y 这个面
         -0.5f,  0.5f, -0.5f,  0.0f, 1.0f,
          0.5f,  0.5f, -0.5f,  1.0f, 1.0f,
          0.5f,  0.5f,  0.5f,  1.0f, 0.0f,
          0.5f,  0.5f,  0.5f,  1.0f, 0.0f,
         -0.5f,  0.5f,  0.5f,  0.0f, 0.0f,
         -0.5f,  0.5f, -0.5f,  0.0f, 1.0f
    };

    // 10 个立方体在世界空间中的位置
    glm::vec3 cubePositions[] = {
        glm::vec3(0.0f,  0.0f,  0.0f),
        glm::vec3(2.0f,  5.0f, -15.0f),
        glm::vec3(-1.5f, -2.2f, -2.5f),
        glm::vec3(-3.8f, -2.0f, -12.3f),
        glm::vec3(2.4f, -0.4f, -3.5f),
        glm::vec3(-1.7f,  3.0f, -7.5f),
        glm::vec3(1.3f, -2.0f, -2.5f),
        glm::vec3(1.5f,  2.0f, -2.5f),
        glm::vec3(1.5f,  0.2f, -1.5f),
        glm::vec3(-1.3f,  1.0f, -1.5f)
    };

    // 顶点缓冲对象 VBO 和顶点数组对象 VAO
    unsigned int VBO, VAO;
    // 生成 1 个 VAO
    glGenVertexArrays(1, &VAO);
    // 生成 1 个 VBO
    glGenBuffers(1, &VBO);

    // 绑定 VAO，之后对顶点属性的配置都会记录到这个 VAO 中
    glBindVertexArray(VAO);

    // 绑定 VBO 为当前数组缓冲
    glBindBuffer(GL_ARRAY_BUFFER, VBO);
    // 把顶点数据复制到 GPU 缓冲中，STATIC_DRAW 表示数据基本不会变
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);

    // 位置属性
    // 索引 0：每个顶点 3 个 float，步长为 5 个 float，偏移为 0
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)0);
    // 启用顶点属性 0
    glEnableVertexAttribArray(0);

    // 纹理坐标属性
    // 索引 1：每个顶点 2 个 float，步长为 5 个 float，偏移为 3 个 float
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)(3 * sizeof(float)));
    // 启用顶点属性 1
    glEnableVertexAttribArray(1);

    // 加载并创建纹理
    // -------------------------
    unsigned int texture1, texture2;

    // 纹理 1
    // ---------
    // 生成 1 个纹理对象
    glGenTextures(1, &texture1);
    // 绑定为 2D 纹理
    glBindTexture(GL_TEXTURE_2D, texture1);

    // 设置纹理环绕参数：S 轴重复
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
    // 设置纹理环绕参数：T 轴重复
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);

    // 设置纹理过滤参数：缩小使用线性过滤
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    // 设置纹理过滤参数：放大使用线性过滤
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

    // 加载图片，创建纹理并生成 mipmap
    int width, height, nrChannels;
    // 告诉 stb_image 加载图片时沿 y 轴翻转
    stbi_set_flip_vertically_on_load(true);

    // 加载 container.jpg
    unsigned char* data = stbi_load("resources/textures/container.jpg", &width, &height, &nrChannels, 0);

    // 如果加载成功
    if (data)
    {
        // 把图片数据上传到当前绑定的 2D 纹理
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, data);
        // 生成 mipmap
        glGenerateMipmap(GL_TEXTURE_2D);
    }
    else
    {
        // 加载失败输出错误
        std::cout << "Failed to load texture" << std::endl;
    }
    // 释放图片内存
    stbi_image_free(data);

    // 纹理 2
    // ---------
    // 生成 1 个纹理对象
    glGenTextures(1, &texture2);
    // 绑定为 2D 纹理
    glBindTexture(GL_TEXTURE_2D, texture2);

    // 设置纹理环绕参数
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);

    // 设置纹理过滤参数
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

    // 加载 awesomeface.png
    data = stbi_load("resources/textures/awesomeface.png", &width, &height, &nrChannels, 0);

    // 如果加载成功
    if (data)
    {
        // awesomeface.png 有透明度，因此像素格式使用 GL_RGBA
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, width, height, 0, GL_RGBA, GL_UNSIGNED_BYTE, data);
        // 生成 mipmap
        glGenerateMipmap(GL_TEXTURE_2D);
    }
    else
    {
        // 加载失败输出错误
        std::cout << "Failed to load texture" << std::endl;
    }
    // 释放图片内存
    stbi_image_free(data);

    // 告诉 OpenGL 每个采样器属于哪个纹理单元，只需要设置一次
    // -------------------------------------------------------------------------------------------
    // 激活着色器程序
    ourShader.use();
    // 设置 uniform 变量 texture1 使用纹理单元 0
    ourShader.setInt("texture1", 0);
    // 设置 uniform 变量 texture2 使用纹理单元 1
    ourShader.setInt("texture2", 1);

    // 渲染循环
    // -----------
    // 只要窗口没有被关闭，就持续循环
    while (!glfwWindowShouldClose(window))
    {
        // 每帧时间逻辑
        // --------------------
        // 获取当前时间
        float currentFrame = static_cast<float>(glfwGetTime());
        // 计算当前帧与上一帧的时间差
        deltaTime = currentFrame - lastFrame;
        // 更新上一帧时间
        lastFrame = currentFrame;

        // 输入
        // -----
        // 处理键盘输入
        processInput(window);

        // 渲染
        // ------
        // 设置清屏颜色为深青色
        glClearColor(0.2f, 0.3f, 0.3f, 1.0f);
        // 清除颜色缓冲和深度缓冲
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        // 把纹理绑定到对应的纹理单元
        // 激活纹理单元 0
        glActiveTexture(GL_TEXTURE0);
        // 绑定 texture1 到纹理单元 0
        glBindTexture(GL_TEXTURE_2D, texture1);
        // 激活纹理单元 1
        glActiveTexture(GL_TEXTURE1);
        // 绑定 texture2 到纹理单元 1
        glBindTexture(GL_TEXTURE_2D, texture2);

        // 激活着色器
        ourShader.use();

        // 把投影矩阵传给着色器
        // 注意：这里投影矩阵每帧都可能变化，因为摄像机的 Zoom 可能被滚轮改变
        glm::mat4 projection = glm::perspective(
            glm::radians(camera.Zoom),
            (float)SCR_WIDTH / (float)SCR_HEIGHT,
            0.1f,
            100.0f
        );
        ourShader.setMat4("projection", projection);

        // 摄像机 / 视图变换
        // 从 Camera 对象获取视图矩阵
        glm::mat4 view = camera.GetViewMatrix();
        ourShader.setMat4("view", view);

        // 渲染多个立方体
        glBindVertexArray(VAO);
        for (unsigned int i = 0; i < 10; i++)
        {
            // 为每个物体计算模型矩阵，并在绘制前传给着色器
            glm::mat4 model = glm::mat4(1.0f);
            // 把立方体平移到指定位置
            model = glm::translate(model, cubePositions[i]);

            // 每个立方体的基础旋转角度为 20 度乘以索引
            float angle = 20.0f * i;

            // 每第 3 个立方体，包括第 0 个，使用 GLFW 时间函数让角度持续变化
            if (i % 3 == 0)
                angle = glfwGetTime() * 25.0f;

            // 绕轴 (1.0, 0.3, 0.5) 旋转
            model = glm::rotate(model, glm::radians(angle), glm::vec3(1.0f, 0.3f, 0.5f));
            // 把模型矩阵传给着色器
            ourShader.setMat4("model", model);

            // 绘制 36 个顶点，也就是一个立方体
            glDrawArrays(GL_TRIANGLES, 0, 36);
        }

        // glfw：交换缓冲并轮询 IO 事件，比如键盘、鼠标事件
        // -------------------------------------------------------------------------------
        glfwSwapBuffers(window);
        glfwPollEvents();
    }

    // 可选：当资源不再使用时释放它们
    // ------------------------------------------------------------------------
    // 删除 VAO
    glDeleteVertexArrays(1, &VAO);
    // 删除 VBO
    glDeleteBuffers(1, &VBO);

    // glfw：终止 GLFW，释放之前分配的所有 GLFW 资源
    // ------------------------------------------------------------------
    glfwTerminate();
    return 0;
}

// 处理所有输入：查询 GLFW 当前帧相关按键是否按下或释放，并作出反应
// ---------------------------------------------------------------------------------------------------------
void processInput(GLFWwindow* window)
{
    // 如果按下 ESC 键
    if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS)
        // 设置窗口应该关闭
        glfwSetWindowShouldClose(window, true);

    // 如果按下 W 键，摄像机向前移动
    if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS)
        camera.ProcessKeyboard(FORWARD, deltaTime);
    // 如果按下 S 键，摄像机向后移动
    if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS)
        camera.ProcessKeyboard(BACKWARD, deltaTime);
    // 如果按下 A 键，摄像机向左移动
    if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS)
        camera.ProcessKeyboard(LEFT, deltaTime);
    // 如果按下 D 键，摄像机向右移动
    if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS)
        camera.ProcessKeyboard(RIGHT, deltaTime);
}

// glfw：每当窗口大小改变时，比如操作系统或用户调整窗口大小，这个回调函数会执行
// ---------------------------------------------------------------------------------------------
void framebuffer_size_callback(GLFWwindow* window, int width, int height)
{
    // 确保视口与新窗口尺寸匹配
    // 注意：在 Retina 显示屏上，width 和 height 会明显大于指定的窗口尺寸
    glViewport(0, 0, width, height);
}

// glfw：每当鼠标移动时，这个回调函数会被调用
// -------------------------------------------------------
void mouse_callback(GLFWwindow* window, double xposIn, double yposIn)
{
    // 把鼠标坐标从 double 转成 float
    float xpos = static_cast<float>(xposIn);
    float ypos = static_cast<float>(yposIn);

    // 如果是第一次接收鼠标移动
    if (firstMouse)
    {
        // 只记录当前位置，不计算偏移
        lastX = xpos;
        lastY = ypos;
        // 以后不再当作第一次
        firstMouse = false;
    }

    // 计算当前帧与上一帧的鼠标偏移
    float xoffset = xpos - lastX;
    // y 坐标要反过来，因为屏幕坐标从上到下，而 OpenGL 坐标从下到上
    float yoffset = lastY - ypos;

    // 更新上一帧鼠标位置
    lastX = xpos;
    lastY = ypos;

    // 把鼠标偏移传给摄像机，用来旋转视角
    camera.ProcessMouseMovement(xoffset, yoffset);
}

// glfw：每当鼠标滚轮滚动时，这个回调函数会被调用
// ----------------------------------------------------------------------
void scroll_callback(GLFWwindow* window, double xoffset, double yoffset)
{
    // 把滚轮偏移传给摄像机，用来缩放视野
    camera.ProcessMouseScroll(static_cast<float>(yoffset));
}