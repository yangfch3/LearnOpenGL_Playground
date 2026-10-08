// 包含 glad 库，用来加载 OpenGL 函数指针
#include <glad/glad.h>
// 包含 GLFW 库，用来创建窗口、处理输入和 OpenGL 上下文
#include <GLFW/glfw3.h>

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
// 包含 LearnOpenGL 封装好的 Model 类，用来加载和绘制 3D 模型
#include <learnopengl/model.h>

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
Camera camera(glm::vec3(0.0f, 0.0f, 3.0f));

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

    // 告诉 stb_image 在加载模型之前，先把贴图沿 y 轴翻转
    // 注意：这一句必须放在加载模型之前，因为模型内部的贴图加载也会用到 stb_image
    stbi_set_flip_vertically_on_load(true);

    // 配置全局 OpenGL 状态
    // -----------------------------
    // 启用深度测试，保证 3D 物体前后遮挡关系正确
    glEnable(GL_DEPTH_TEST);

    // 构建并编译着色器程序
    // -------------------------
    // 模型着色器：负责渲染加载进来的 3D 模型
    Shader ourShader("shaders/1.model_loading.vs", "shaders/1.model_loading.fs");

    // 加载模型
    // -----------
    // 使用 Model 类加载 backpack.obj 模型
    // 这一步会解析 .obj 文件、加载 mtl 材质、加载对应的贴图
    Model ourModel("resources/objects/backpack/backpack.obj");

    // 如果要看线框模式，取消下面这行的注释
    //glPolygonMode(GL_FRONT_AND_BACK, GL_LINE);

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
        // 设置清屏颜色为非常深的灰色
        glClearColor(0.05f, 0.05f, 0.05f, 1.0f);
        // 清除颜色缓冲和深度缓冲
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        // 设置 uniform 之前，别忘了先激活着色器
        ourShader.use();

        // 视图 / 投影变换
        // 根据摄像机 Zoom 和窗口宽高比创建透视投影矩阵
        glm::mat4 projection = glm::perspective(
            glm::radians(camera.Zoom),
            (float)SCR_WIDTH / (float)SCR_HEIGHT,
            0.1f,
            100.0f
        );
        // 从 Camera 对象获取视图矩阵
        glm::mat4 view = camera.GetViewMatrix();
        // 把投影矩阵和视图矩阵传给模型着色器
        ourShader.setMat4("projection", projection);
        ourShader.setMat4("view", view);

        // 渲染加载进来的模型
        glm::mat4 model = glm::mat4(1.0f);
        // 把模型移到场景中心，这里其实是平移 0，也就是不移动
        model = glm::translate(model, glm::vec3(0.0f, 0.0f, 0.0f));
        // 缩放模型，如果模型太大或太小，可以改这里的比例
        model = glm::scale(model, glm::vec3(1.0f, 1.0f, 1.0f));
        // 把模型矩阵传给着色器
        ourShader.setMat4("model", model);
        // 调用 Model 类的 Draw 方法，遍历模型的所有网格并绘制
        ourModel.Draw(ourShader);

        // glfw：交换缓冲并轮询 IO 事件，比如键盘、鼠标事件
        // -------------------------------------------------------------------------------
        glfwSwapBuffers(window);
        glfwPollEvents();
    }

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