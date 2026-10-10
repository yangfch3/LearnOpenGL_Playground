// 包含 glad 库，用来加载 OpenGL 函数指针
#include <glad/glad.h>
// 包含 GLFW 库，用来创建窗口、处理输入和 OpenGL 上下文
#include <GLFW/glfw3.h>

// 标准输入输出库
#include <iostream>

// 窗口大小变化时的回调函数声明
void framebuffer_size_callback(GLFWwindow* window, int width, int height);
// 处理键盘输入的函数声明
void processInput(GLFWwindow* window);

// 设置窗口宽度
const unsigned int SCR_WIDTH = 800;
// 设置窗口高度
const unsigned int SCR_HEIGHT = 600;

// 顶点着色器源码，以字符串形式内嵌在代码里
// 版本 330 core，对应 OpenGL 3.3 核心模式
// 输入：location = 0 的 vec3 顶点位置
// 输出：把顶点位置直接写入 gl_Position
const char* vertexShaderSource = "#version 330 core\n"
"layout (location = 0) in vec3 aPos;\n"
"void main()\n"
"{\n"
"   gl_Position = vec4(aPos.x, aPos.y, aPos.z, 1.0);\n"
"}\0";

// 片元着色器源码，以字符串形式内嵌在代码里
// 版本 330 core
// 输出：固定颜色 (1.0, 0.5, 0.2, 1.0)，也就是橙色
const char* fragmentShaderSource = "#version 330 core\n"
"out vec4 FragColor;\n"
"void main()\n"
"{\n"
"   FragColor = vec4(1.0f, 0.5f, 0.2f, 1.0f);\n"
"}\n\0";

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

    // 构建并编译着色器程序
    // ------------------------------------
    // 顶点着色器
    // 创建一个顶点着色器对象
    unsigned int vertexShader = glCreateShader(GL_VERTEX_SHADER);
    // 把顶点着色器源码附加到着色器对象上
    glShaderSource(vertexShader, 1, &vertexShaderSource, NULL);
    // 编译顶点着色器
    glCompileShader(vertexShader);

    // 检查顶点着色器是否编译成功
    int success;
    char infoLog[512];
    glGetShaderiv(vertexShader, GL_COMPILE_STATUS, &success);
    if (!success)
    {
        // 获取编译错误日志并输出
        glGetShaderInfoLog(vertexShader, 512, NULL, infoLog);
        std::cout << "ERROR::SHADER::VERTEX::COMPILATION_FAILED\n" << infoLog << std::endl;
    }

    // 片元着色器
    // 创建一个片元着色器对象
    unsigned int fragmentShader = glCreateShader(GL_FRAGMENT_SHADER);
    // 把片元着色器源码附加到着色器对象上
    glShaderSource(fragmentShader, 1, &fragmentShaderSource, NULL);
    // 编译片元着色器
    glCompileShader(fragmentShader);

    // 检查片元着色器是否编译成功
    glGetShaderiv(fragmentShader, GL_COMPILE_STATUS, &success);
    if (!success)
    {
        // 获取编译错误日志并输出
        glGetShaderInfoLog(fragmentShader, 512, NULL, infoLog);
        std::cout << "ERROR::SHADER::FRAGMENT::COMPILATION_FAILED\n" << infoLog << std::endl;
    }

    // 链接着色器
    // 创建一个着色器程序对象
    unsigned int shaderProgram = glCreateProgram();
    // 把顶点着色器附加到程序对象上
    glAttachShader(shaderProgram, vertexShader);
    // 把片元着色器附加到程序对象上
    glAttachShader(shaderProgram, fragmentShader);
    // 链接程序对象
    glLinkProgram(shaderProgram);

    // 检查链接是否成功
    glGetProgramiv(shaderProgram, GL_LINK_STATUS, &success);
    if (!success) {
        // 获取链接错误日志并输出
        glGetProgramInfoLog(shaderProgram, 512, NULL, infoLog);
        std::cout << "ERROR::SHADER::PROGRAM::LINKING_FAILED\n" << infoLog << std::endl;
    }

    // 链接完成后，着色器对象就可以删除了
    glDeleteShader(vertexShader);
    glDeleteShader(fragmentShader);

    // 设置顶点数据，并配置顶点属性
    // ------------------------------------------------------------------
    // 一个三角形的 3 个顶点，每个顶点 3 个 float：x, y, z
    float vertices[] = {
        -0.5f, -0.5f, 0.0f, // 左下
         0.5f, -0.5f, 0.0f, // 右下
         0.0f,  0.5f, 0.0f  // 顶部
    };

    // 顶点缓冲对象 VBO、顶点数组对象 VAO
    unsigned int VBO, VAO;
    // 生成 1 个 VAO
    glGenVertexArrays(1, &VAO);
    // 生成 1 个 VBO
    glGenBuffers(1, &VBO);

    // 先绑定 VAO，再绑定和设置 VBO，最后配置顶点属性
    glBindVertexArray(VAO);

    // 绑定 VBO 为当前数组缓冲
    glBindBuffer(GL_ARRAY_BUFFER, VBO);
    // 把顶点数据复制到 GPU 缓冲中，STATIC_DRAW 表示数据基本不会变
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);

    // 位置属性，索引 0：每个顶点 3 个 float，步长 3 个 float，偏移 0
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
    // 启用顶点属性 0
    glEnableVertexAttribArray(0);

    // 注意：这里可以解绑 VBO，因为 glVertexAttribPointer 已经把 VBO 注册为顶点属性的绑定缓冲
    glBindBuffer(GL_ARRAY_BUFFER, 0);

    // 也可以解绑 VAO，避免其他 VAO 调用意外修改这个 VAO
    // 但通常没必要，因为修改其他 VAO 本来就需要重新绑定
    glBindVertexArray(0);

    // 取消下面这行的注释，可以用线框模式绘制多边形
    //glPolygonMode(GL_FRONT_AND_BACK, GL_LINE);

    // 渲染循环
    // -----------
    // 只要窗口没有被关闭，就持续循环
    while (!glfwWindowShouldClose(window))
    {
        // 输入
        // -----
        // 处理键盘输入
        processInput(window);

        // 渲染
        // ------
        // 设置清屏颜色为深青色
        glClearColor(0.2f, 0.3f, 0.3f, 1.0f);
        // 清除颜色缓冲
        glClear(GL_COLOR_BUFFER_BIT);

        // 绘制第一个三角形
        // 激活着色器程序
        glUseProgram(shaderProgram);
        // 绑定 VAO
        // 因为只有一个 VAO，其实不必每次绑定，但为了结构清晰还是绑一下
        glBindVertexArray(VAO);
        // 绘制 3 个顶点，组成一个三角形
        glDrawArrays(GL_TRIANGLES, 0, 3);
        // glBindVertexArray(0); // 不需要每次解绑

        // glfw：交换缓冲并轮询 IO 事件
        // -------------------------------------------------------------------------------
        glfwSwapBuffers(window);
        glfwPollEvents();
    }

    // 释放资源
    // ------------------------------------------------------------------------
    // 删除 VAO
    glDeleteVertexArrays(1, &VAO);
    // 删除 VBO
    glDeleteBuffers(1, &VBO);
    // 删除着色器程序
    glDeleteProgram(shaderProgram);

    // glfw：终止 GLFW，释放之前分配的所有 GLFW 资源
    // ------------------------------------------------------------------
    glfwTerminate();
    return 0;
}

// 处理所有输入
// ---------------------------------------------------------------------------------------------------------
void processInput(GLFWwindow* window)
{
    // 如果按下 ESC 键，设置窗口应该关闭
    if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS)
        glfwSetWindowShouldClose(window, true);
}

// 窗口大小变化回调
// ---------------------------------------------------------------------------------------------
void framebuffer_size_callback(GLFWwindow* window, int width, int height)
{
    // 确保视口与新窗口尺寸匹配
    // 注意：在 Retina 显示屏上，width 和 height 会明显大于指定的窗口尺寸
    glViewport(0, 0, width, height);
}