// 包含 glad 库，用来加载 OpenGL 函数指针
#include <glad/glad.h>
// 包含 GLFW 库，用来创建窗口、处理输入和 OpenGL 上下文
#include <GLFW/glfw3.h>
// 包含 stb_image 库，用来加载图片纹理
#include <stb_image.h>

// 包含 LearnOpenGL 封装好的 Shader 类
#include <learnopengl/shader_s.h>

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

// 存储两张纹理混合的比例
// 0.0 表示只显示 texture1，1.0 表示只显示 texture2
// 初始值为 0.2，表示主要显示 texture1，混入少量 texture2
float mixValue = 0.2f;

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
    // 使用顶点着色器和片元着色器文件创建 Shader 对象
    Shader ourShader("shaders/4.5.texture.vs", "shaders/4.5.texture.fs");

    // 设置顶点数据，并配置顶点属性
    // ------------------------------------------------------------------
    // 这里定义了一个矩形的 4 个顶点
    // 每个顶点包含：
    //   前 3 个 float：位置 x, y, z
    //   中间 3 个 float：颜色 r, g, b
    //   后 2 个 float：纹理坐标 u, v
    float vertices[] = {
        // 位置              // 颜色             // 纹理坐标
         0.5f,  0.5f, 0.0f,   1.0f, 0.0f, 0.0f,   1.0f, 1.0f, // 右上角
         0.5f, -0.5f, 0.0f,   0.0f, 1.0f, 0.0f,   1.0f, 0.0f, // 右下角
        -0.5f, -0.5f, 0.0f,   0.0f, 0.0f, 1.0f,   0.0f, 0.0f, // 左下角
        -0.5f,  0.5f, 0.0f,   1.0f, 1.0f, 0.0f,   0.0f, 1.0f  // 左上角
    };

    // 索引数据，告诉 OpenGL 如何用 4 个顶点组成 2 个三角形
    unsigned int indices[] = {
        0, 1, 3, // 第一个三角形
        1, 2, 3  // 第二个三角形
    };

    // 顶点缓冲对象 VBO、顶点数组对象 VAO、索引缓冲对象 EBO
    unsigned int VBO, VAO, EBO;
    // 生成 1 个 VAO
    glGenVertexArrays(1, &VAO);
    // 生成 1 个 VBO
    glGenBuffers(1, &VBO);
    // 生成 1 个 EBO
    glGenBuffers(1, &EBO);

    // 绑定 VAO，之后对顶点属性的配置都会记录到这个 VAO 中
    glBindVertexArray(VAO);

    // 绑定 VBO 为当前数组缓冲
    glBindBuffer(GL_ARRAY_BUFFER, VBO);
    // 把顶点数据复制到 GPU 缓冲中，STATIC_DRAW 表示数据基本不会变
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);

    // 绑定 EBO 为当前元素数组缓冲
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, EBO);
    // 把索引数据复制到 GPU 缓冲中
    glBufferData(GL_ELEMENT_ARRAY_BUFFER, sizeof(indices), indices, GL_STATIC_DRAW);

    // 位置属性
    // 索引 0：每个顶点 3 个 float，步长为 8 个 float，偏移为 0
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)0);
    // 启用顶点属性 0
    glEnableVertexAttribArray(0);

    // 颜色属性
    // 索引 1：每个顶点 3 个 float，步长为 8 个 float，偏移为 3 个 float
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(3 * sizeof(float)));
    // 启用顶点属性 1
    glEnableVertexAttribArray(1);

    // 纹理坐标属性
    // 索引 2：每个顶点 2 个 float，步长为 8 个 float，偏移为 6 个 float
    glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(6 * sizeof(float)));
    // 启用顶点属性 2
    glEnableVertexAttribArray(2);

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
    // The FileSystem::getPath(...) 是 GitHub 仓库的一部分，用来在不同 IDE/平台上找到文件；
    // 你可以替换成自己的图片路径。
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

    // 设置纹理环绕参数：S 轴重复
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
    // 设置纹理环绕参数：T 轴重复
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);

    // 设置纹理过滤参数：缩小使用线性过滤
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    // 设置纹理过滤参数：放大使用线性过滤
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
    // 激活着色器程序，设置 uniform 之前必须先使用着色器
    ourShader.use();

    // 手动设置：把 texture1 这个采样器绑定到纹理单元 0
    glUniform1i(glGetUniformLocation(ourShader.ID, "texture1"), 0);

    // 或者通过 Shader 类封装的方法设置：把 texture2 绑定到纹理单元 1
    ourShader.setInt("texture2", 1);

    // 渲染循环
    // -----------
    // 只要窗口没有被关闭，就持续循环
    while (!glfwWindowShouldClose(window))
    {
        // 输入
        // -----
        // 处理键盘输入，包括 ESC 退出和上下键调整 mixValue
        processInput(window);

        // 渲染
        // ------
        // 设置清屏颜色为深青色
        glClearColor(0.2f, 0.3f, 0.3f, 1.0f);
        // 清除颜色缓冲
        glClear(GL_COLOR_BUFFER_BIT);

        // 把纹理绑定到对应的纹理单元
        // 激活纹理单元 0
        glActiveTexture(GL_TEXTURE0);
        // 绑定 texture1 到纹理单元 0
        glBindTexture(GL_TEXTURE_2D, texture1);
        // 激活纹理单元 1
        glActiveTexture(GL_TEXTURE1);
        // 绑定 texture2 到纹理单元 1
        glBindTexture(GL_TEXTURE_2D, texture2);

        // 把纹理混合比例传给着色器中的 mixValue uniform
        ourShader.setFloat("mixValue", mixValue);

        // 渲染矩形
        // 激活着色器
        ourShader.use();
        // 绑定 VAO
        glBindVertexArray(VAO);
        // 使用索引绘制：绘制 6 个索引，组成 2 个三角形，也就是一个矩形
        glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, 0);

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
    // 删除 EBO
    glDeleteBuffers(1, &EBO);

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

    // 如果按下向上方向键
    if (glfwGetKey(window, GLFW_KEY_UP) == GLFW_PRESS)
    {
        // 增大混合值，让 texture2 显示得更多
        // 这个增量可能需要根据硬件性能调整，可能太慢或太快
        mixValue += 0.001f;
        // 限制最大值为 1.0
        if (mixValue >= 1.0f)
            mixValue = 1.0f;
    }

    // 如果按下向下方向键
    if (glfwGetKey(window, GLFW_KEY_DOWN) == GLFW_PRESS)
    {
        // 减小混合值，让 texture1 显示得更多
        // 这个增量可能需要根据硬件性能调整，可能太慢或太快
        mixValue -= 0.001f;
        // 限制最小值为 0.0
        if (mixValue <= 0.0f)
            mixValue = 0.0f;
    }
}

// glfw：每当窗口大小改变时，比如操作系统或用户调整窗口大小，这个回调函数会执行
// ---------------------------------------------------------------------------------------------
void framebuffer_size_callback(GLFWwindow* window, int width, int height)
{
    // 确保视口与新窗口尺寸匹配
    // 注意：在 Retina 显示屏上，width 和 height 会明显大于指定的窗口尺寸
    glViewport(0, 0, width, height);
}