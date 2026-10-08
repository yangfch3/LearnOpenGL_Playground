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
// 包含 LearnOpenGL 封装好的 Model 类（本段代码其实没用到，可能是从其他示例复制过来的）
#include <learnopengl/model.h>

// 标准库
#include <iostream>
#include <vector>
#include <numeric>
#include <algorithm>

// 窗口大小变化时的回调函数声明
void framebuffer_size_callback(GLFWwindow* window, int width, int height);
// 鼠标移动时的回调函数声明
void mouse_callback(GLFWwindow* window, double xpos, double ypos);
// 鼠标滚轮滚动时的回调函数声明
void scroll_callback(GLFWwindow* window, double xoffset, double yoffset);
// 处理键盘输入的函数声明
void processInput(GLFWwindow* window);
// 从文件加载 2D 纹理的工具函数声明
unsigned int loadTexture(const char* path);

// 设置窗口宽度
const unsigned int SCR_WIDTH = 800;
// 设置窗口高度
const unsigned int SCR_HEIGHT = 600;

// 摄像机
// 创建一个 Camera 对象，初始位置在 (0.0, 0.0, 3.0)
Camera camera(glm::vec3(0.0f, 0.0f, 3.0f));

// 记录鼠标上一帧的位置，初始设为屏幕中心
float lastX = (float)SCR_WIDTH / 2.0;
float lastY = (float)SCR_HEIGHT / 2.0;

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
    // 启用深度测试
    glEnable(GL_DEPTH_TEST);
    // 深度测试函数：默认就是 GL_LESS，小于则通过
    glDepthFunc(GL_LESS);

    // 启用模板测试
    glEnable(GL_STENCIL_TEST);

    // 设置模板函数：默认情况下，只有模板值不等于 1 的像素才通过
    // 参数含义：比较函数、参考值、掩码
    glStencilFunc(GL_NOTEQUAL, 1, 0xFF);

    // 设置模板操作：
    //   stencil fail：模板测试失败时，保留当前模板值
    //   depth fail：深度测试失败时，保留当前模板值
    //   both pass：模板和深度都通过时，用参考值替换模板值
    glStencilOp(GL_KEEP, GL_KEEP, GL_REPLACE);

    // 构建并编译着色器程序
    // -------------------------
    // 正常着色器：渲染带贴图的箱子
    Shader shader("shaders/2.stencil_testing.vs", "shaders/2.stencil_testing.fs");
    // 单色着色器：渲染纯色放大的箱子，用来做描边
    Shader shaderSingleColor("shaders/2.stencil_testing.vs", "shaders/2.stencil_single_color.fs");

    // 设置顶点数据，并配置顶点属性
    // ------------------------------------------------------------------
    // 立方体顶点数据：位置 + 纹理坐标
    float cubeVertices[] = {
        // 位置              // 纹理坐标
        -0.5f, -0.5f, -0.5f,  0.0f, 0.0f,
         0.5f, -0.5f, -0.5f,  1.0f, 0.0f,
         0.5f,  0.5f, -0.5f,  1.0f, 1.0f,
         0.5f,  0.5f, -0.5f,  1.0f, 1.0f,
        -0.5f,  0.5f, -0.5f,  0.0f, 1.0f,
        -0.5f, -0.5f, -0.5f,  0.0f, 0.0f,

        -0.5f, -0.5f,  0.5f,  0.0f, 0.0f,
         0.5f, -0.5f,  0.5f,  1.0f, 0.0f,
         0.5f,  0.5f,  0.5f,  1.0f, 1.0f,
         0.5f,  0.5f,  0.5f,  1.0f, 1.0f,
        -0.5f,  0.5f,  0.5f,  0.0f, 1.0f,
        -0.5f, -0.5f,  0.5f,  0.0f, 0.0f,

        -0.5f,  0.5f,  0.5f,  1.0f, 0.0f,
        -0.5f,  0.5f, -0.5f,  1.0f, 1.0f,
        -0.5f, -0.5f, -0.5f,  0.0f, 1.0f,
        -0.5f, -0.5f, -0.5f,  0.0f, 1.0f,
        -0.5f, -0.5f,  0.5f,  0.0f, 0.0f,
        -0.5f,  0.5f,  0.5f,  1.0f, 0.0f,

         0.5f,  0.5f,  0.5f,  1.0f, 0.0f,
         0.5f,  0.5f, -0.5f,  1.0f, 1.0f,
         0.5f, -0.5f, -0.5f,  0.0f, 1.0f,
         0.5f, -0.5f, -0.5f,  0.0f, 1.0f,
         0.5f, -0.5f,  0.5f,  0.0f, 0.0f,
         0.5f,  0.5f,  0.5f,  1.0f, 0.0f,

        -0.5f, -0.5f, -0.5f,  0.0f, 1.0f,
         0.5f, -0.5f, -0.5f,  1.0f, 1.0f,
         0.5f, -0.5f,  0.5f,  1.0f, 0.0f,
         0.5f, -0.5f,  0.5f,  1.0f, 0.0f,
        -0.5f, -0.5f,  0.5f,  0.0f, 0.0f,
        -0.5f, -0.5f, -0.5f,  0.0f, 1.0f,

        -0.5f,  0.5f, -0.5f,  0.0f, 1.0f,
         0.5f,  0.5f, -0.5f,  1.0f, 1.0f,
         0.5f,  0.5f,  0.5f,  1.0f, 0.0f,
         0.5f,  0.5f,  0.5f,  1.0f, 0.0f,
        -0.5f,  0.5f,  0.5f,  0.0f, 0.0f,
        -0.5f,  0.5f, -0.5f,  0.0f, 1.0f
    };

    // 地板顶点数据：位置 + 纹理坐标
    // 注意：纹理坐标设得比 1 大，配合 GL_REPEAT 会让地板纹理重复
    float planeVertices[] = {
         5.0f, -0.5f,  5.0f,  2.0f, 0.0f,
        -5.0f, -0.5f,  5.0f,  0.0f, 0.0f,
        -5.0f, -0.5f, -5.0f,  0.0f, 2.0f,

         5.0f, -0.5f,  5.0f,  2.0f, 0.0f,
        -5.0f, -0.5f, -5.0f,  0.0f, 2.0f,
         5.0f, -0.5f, -5.0f,  2.0f, 2.0f
    };

    // 立方体 VAO
    unsigned int cubeVAO, cubeVBO;
    glGenVertexArrays(1, &cubeVAO);
    glGenBuffers(1, &cubeVBO);
    glBindVertexArray(cubeVAO);
    glBindBuffer(GL_ARRAY_BUFFER, cubeVBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(cubeVertices), &cubeVertices, GL_STATIC_DRAW);
    // 位置属性
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)0);
    // 纹理坐标属性
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)(3 * sizeof(float)));
    glBindVertexArray(0);

    // 地板 VAO
    unsigned int planeVAO, planeVBO;
    glGenVertexArrays(1, &planeVAO);
    glGenBuffers(1, &planeVBO);
    glBindVertexArray(planeVAO);
    glBindBuffer(GL_ARRAY_BUFFER, planeVBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(planeVertices), &planeVertices, GL_STATIC_DRAW);
    // 位置属性
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)0);
    // 纹理坐标属性
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)(3 * sizeof(float)));
    glBindVertexArray(0);

    // 箱子位置
    const glm::vec3 cubePositions[] = {
        glm::vec3(-1.0f, 0.0f, -1.0f),
        glm::vec3(2.0f, 0.0f,  0.0f)
    };
    // 箱子数量
    const int cubeCount = sizeof(cubePositions) / sizeof(cubePositions[0]);

    // 加载纹理
    // -------------
    // 箱子纹理：大理石
    unsigned int cubeTexture = loadTexture("resources/textures/marble.jpg");
    // 地板纹理：金属
    unsigned int floorTexture = loadTexture("resources/textures/metal.png");

    // 着色器配置
    // --------------------
    shader.use();
    // 把 texture1 采样器绑定到纹理单元 0
    shader.setInt("texture1", 0);

    // 渲染循环
    // -----------
    while (!glfwWindowShouldClose(window))
    {
        // 每帧时间逻辑
        // --------------------
        float currentFrame = static_cast<float>(glfwGetTime());
        deltaTime = currentFrame - lastFrame;
        lastFrame = currentFrame;

        // 输入
        // -----
        processInput(window);

        // 渲染
        // ------
        glClearColor(0.1f, 0.1f, 0.1f, 1.0f);
        // 清除颜色、深度和模板缓冲，别忘了模板缓冲
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT | GL_STENCIL_BUFFER_BIT);

        // 设置 uniform
        // 先激活单色描边着色器，设置视图和投影矩阵
        shaderSingleColor.use();
        glm::mat4 model = glm::mat4(1.0f);
        glm::mat4 view = camera.GetViewMatrix();
        glm::mat4 projection = glm::perspective(
            glm::radians(camera.Zoom),
            (float)SCR_WIDTH / (float)SCR_HEIGHT,
            0.1f,
            100.0f
        );
        shaderSingleColor.setMat4("view", view);
        shaderSingleColor.setMat4("projection", projection);

        // 再激活正常着色器，设置视图和投影矩阵
        shader.use();
        shader.setMat4("view", view);
        shader.setMat4("projection", projection);

        // 正常绘制地板，但不要把地板写入模板缓冲
        // 我们只关心箱子，所以把模板掩码设为 0x00，不写模板缓冲
        glStencilMask(0x00);
        // 绘制地板
        glBindVertexArray(planeVAO);
        glBindTexture(GL_TEXTURE_2D, floorTexture);
        shader.setMat4("model", glm::mat4(1.0f));
        glDrawArrays(GL_TRIANGLES, 0, 6);
        glBindVertexArray(0);

        // 每个箱子独立描边：
        // 1. 每个箱子写入自己唯一的模板 ID（索引 + 1，0 留给背景），轮廓只排除自己的 ID，
        //    这样轮廓不会被别的箱子的模板区域“吃掉”，也就不会融合成一个整体外轮廓。
        // 2. 物体与轮廓按“从远到近”逐个交替绘制：近处箱子的本体会盖住远处箱子的轮廓，
        //    近处箱子的轮廓又会完整画在远处箱子之上，遮挡关系正确。
        // ----------------------------------------------------------------------------
        // 创建一个顺序数组，用于按距离排序
        std::vector<int> order(cubeCount);
        // 填充 0, 1, 2, ...
        std::iota(order.begin(), order.end(), 0);
        // 按到摄像机的距离从远到近排序
        // 远的先画，近的后画，保证近处物体覆盖远处物体
        std::sort(order.begin(), order.end(), [&](int a, int b) {
            return glm::length(camera.Position - cubePositions[a]) > glm::length(camera.Position - cubePositions[b]);
            });

        // 描边时箱子放大的比例
        const float scale = 1.1f;

        glBindVertexArray(cubeVAO);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, cubeTexture);

        // 按从远到近的顺序逐个箱子处理
        for (int idx : order)
        {
            // 每个箱子用唯一的模板 ID
            // 8 位模板缓冲，最多支持 255 个物体
            const int stencilId = idx + 1;

            // 第 1 遍：正常绘制物体，并把自己的 ID 写入模板缓冲
            glEnable(GL_DEPTH_TEST);
            // 模板函数：总是通过，参考值为 stencilId
            glStencilFunc(GL_ALWAYS, stencilId, 0xFF);
            // 允许写模板缓冲
            glStencilMask(0xFF);
            shader.use();
            // 平移到箱子位置
            model = glm::translate(glm::mat4(1.0f), cubePositions[idx]);
            shader.setMat4("model", model);
            // 绘制箱子
            glDrawArrays(GL_TRIANGLES, 0, 36);

            // 第 2 遍：绘制放大的纯色版本，只在“不是自己 ID”的像素上输出，形成轮廓
            // 模板函数：模板值不等于 stencilId 的像素通过
            // 也就是只在箱子外面的区域画轮廓
            glStencilFunc(GL_NOTEQUAL, stencilId, 0xFF);
            // 不写模板缓冲
            glStencilMask(0x00);
            // 关闭深度测试，保证轮廓能画在箱子上面
            glDisable(GL_DEPTH_TEST);
            shaderSingleColor.use();
            // 放大模型
            model = glm::scale(model, glm::vec3(scale));
            shaderSingleColor.setMat4("model", model);
            // 绘制放大的纯色箱子，形成轮廓
            glDrawArrays(GL_TRIANGLES, 0, 36);
        }
        glBindVertexArray(0);

        // 恢复模板和深度状态
        glStencilMask(0xFF);
        glStencilFunc(GL_ALWAYS, 0, 0xFF);
        glEnable(GL_DEPTH_TEST);

        // glfw：交换缓冲并轮询 IO 事件
        // -------------------------------------------------------------------------------
        glfwSwapBuffers(window);
        glfwPollEvents();
    }

    // 释放资源
    // ------------------------------------------------------------------------
    glDeleteVertexArrays(1, &cubeVAO);
    glDeleteVertexArrays(1, &planeVAO);
    glDeleteBuffers(1, &cubeVBO);
    glDeleteBuffers(1, &planeVBO);

    glfwTerminate();
    return 0;
}

// 处理所有输入
// ---------------------------------------------------------------------------------------------------------
void processInput(GLFWwindow* window)
{
    // ESC 退出
    if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS)
        glfwSetWindowShouldClose(window, true);

    // WASD 移动摄像机
    if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS)
        camera.ProcessKeyboard(FORWARD, deltaTime);
    if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS)
        camera.ProcessKeyboard(BACKWARD, deltaTime);
    if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS)
        camera.ProcessKeyboard(LEFT, deltaTime);
    if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS)
        camera.ProcessKeyboard(RIGHT, deltaTime);
}

// 窗口大小变化回调
// ---------------------------------------------------------------------------------------------
void framebuffer_size_callback(GLFWwindow* window, int width, int height)
{
    glViewport(0, 0, width, height);
}

// 鼠标移动回调
// -------------------------------------------------------
void mouse_callback(GLFWwindow* window, double xposIn, double yposIn)
{
    float xpos = static_cast<float>(xposIn);
    float ypos = static_cast<float>(yposIn);

    // 第一次移动时只记录位置
    if (firstMouse)
    {
        lastX = xpos;
        lastY = ypos;
        firstMouse = false;
    }

    // 计算鼠标偏移
    float xoffset = xpos - lastX;
    // y 轴反过来
    float yoffset = lastY - ypos;

    lastX = xpos;
    lastY = ypos;

    // 传给摄像机
    camera.ProcessMouseMovement(xoffset, yoffset);
}

// 鼠标滚轮回调
// ----------------------------------------------------------------------
void scroll_callback(GLFWwindow* window, double xoffset, double yoffset)
{
    camera.ProcessMouseScroll(static_cast<float>(yoffset));
}

// 从文件加载 2D 纹理的工具函数
// ---------------------------------------------------
unsigned int loadTexture(char const* path)
{
    unsigned int textureID;
    glGenTextures(1, &textureID);

    int width, height, nrComponents;
    unsigned char* data = stbi_load(path, &width, &height, &nrComponents, 0);
    if (data)
    {
        GLenum format;
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

        stbi_image_free(data);
    }
    else
    {
        std::cout << "Texture failed to load at path: " << path << std::endl;
        stbi_image_free(data);
    }

    return textureID;
}