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
#include <learnopengl/shader_m.h>
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
// 加载 2D 纹理
unsigned int loadTexture(const char* path);
// 加载立方体贴图
unsigned int loadCubemap(vector<std::string> faces);

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
    // 普通物体着色器，用来绘制带反射效果的立方体
    Shader shader("shaders/6.2.cubemaps.vs", "shaders/6.2.cubemaps.fs");
    // 天空盒着色器，用来绘制天空盒
    Shader skyboxShader("shaders/6.2.skybox.vs", "shaders/6.2.skybox.fs");

    // set up vertex data (and buffer(s)) and configure vertex attributes
    // ------------------------------------------------------------------
    // 普通立方体顶点数据：位置(3) + 法线(3)
    float cubeVertices[] = {
        // positions          // normals
        -0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
         0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
         0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
         0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
        -0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
        -0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,

        -0.5f, -0.5f,  0.5f,  0.0f,  0.0f, 1.0f,
         0.5f, -0.5f,  0.5f,  0.0f,  0.0f, 1.0f,
         0.5f,  0.5f,  0.5f,  0.0f,  0.0f, 1.0f,
         0.5f,  0.5f,  0.5f,  0.0f,  0.0f, 1.0f,
        -0.5f,  0.5f,  0.5f,  0.0f,  0.0f, 1.0f,
        -0.5f, -0.5f,  0.5f,  0.0f,  0.0f, 1.0f,

        -0.5f,  0.5f,  0.5f, -1.0f,  0.0f,  0.0f,
        -0.5f,  0.5f, -0.5f, -1.0f,  0.0f,  0.0f,
        -0.5f, -0.5f, -0.5f, -1.0f,  0.0f,  0.0f,
        -0.5f, -0.5f, -0.5f, -1.0f,  0.0f,  0.0f,
        -0.5f, -0.5f,  0.5f, -1.0f,  0.0f,  0.0f,
        -0.5f,  0.5f,  0.5f, -1.0f,  0.0f,  0.0f,

         0.5f,  0.5f,  0.5f,  1.0f,  0.0f,  0.0f,
         0.5f,  0.5f, -0.5f,  1.0f,  0.0f,  0.0f,
         0.5f, -0.5f, -0.5f,  1.0f,  0.0f,  0.0f,
         0.5f, -0.5f, -0.5f,  1.0f,  0.0f,  0.0f,
         0.5f, -0.5f,  0.5f,  1.0f,  0.0f,  0.0f,
         0.5f,  0.5f,  0.5f,  1.0f,  0.0f,  0.0f,

        -0.5f, -0.5f, -0.5f,  0.0f, -1.0f,  0.0f,
         0.5f, -0.5f, -0.5f,  0.0f, -1.0f,  0.0f,
         0.5f, -0.5f,  0.5f,  0.0f, -1.0f,  0.0f,
         0.5f, -0.5f,  0.5f,  0.0f, -1.0f,  0.0f,
        -0.5f, -0.5f,  0.5f,  0.0f, -1.0f,  0.0f,
        -0.5f, -0.5f, -0.5f,  0.0f, -1.0f,  0.0f,

        -0.5f,  0.5f, -0.5f,  0.0f,  1.0f,  0.0f,
         0.5f,  0.5f, -0.5f,  0.0f,  1.0f,  0.0f,
         0.5f,  0.5f,  0.5f,  0.0f,  1.0f,  0.0f,
         0.5f,  0.5f,  0.5f,  0.0f,  1.0f,  0.0f,
        -0.5f,  0.5f,  0.5f,  0.0f,  1.0f,  0.0f,
        -0.5f,  0.5f, -0.5f,  0.0f,  1.0f,  0.0f
    };
    // 天空盒立方体顶点数据：只需要位置
    float skyboxVertices[] = {
        // positions          
        -1.0f,  1.0f, -1.0f,
        -1.0f, -1.0f, -1.0f,
         1.0f, -1.0f, -1.0f,
         1.0f, -1.0f, -1.0f,
         1.0f,  1.0f, -1.0f,
        -1.0f,  1.0f, -1.0f,

        -1.0f, -1.0f,  1.0f,
        -1.0f, -1.0f, -1.0f,
        -1.0f,  1.0f, -1.0f,
        -1.0f,  1.0f, -1.0f,
        -1.0f,  1.0f,  1.0f,
        -1.0f, -1.0f,  1.0f,

         1.0f, -1.0f, -1.0f,
         1.0f, -1.0f,  1.0f,
         1.0f,  1.0f,  1.0f,
         1.0f,  1.0f,  1.0f,
         1.0f,  1.0f, -1.0f,
         1.0f, -1.0f, -1.0f,

        -1.0f, -1.0f,  1.0f,
        -1.0f,  1.0f,  1.0f,
         1.0f,  1.0f,  1.0f,
         1.0f,  1.0f,  1.0f,
         1.0f, -1.0f,  1.0f,
        -1.0f, -1.0f,  1.0f,

        -1.0f,  1.0f, -1.0f,
         1.0f,  1.0f, -1.0f,
         1.0f,  1.0f,  1.0f,
         1.0f,  1.0f,  1.0f,
        -1.0f,  1.0f,  1.0f,
        -1.0f,  1.0f, -1.0f,

        -1.0f, -1.0f, -1.0f,
        -1.0f, -1.0f,  1.0f,
         1.0f, -1.0f, -1.0f,
         1.0f, -1.0f, -1.0f,
        -1.0f, -1.0f,  1.0f,
         1.0f, -1.0f,  1.0f
    };

    // cube VAO
    // 普通立方体 VAO、VBO
    unsigned int cubeVAO, cubeVBO;
    // 生成普通立方体 VAO
    glGenVertexArrays(1, &cubeVAO);
    // 生成普通立方体 VBO
    glGenBuffers(1, &cubeVBO);
    // 绑定普通立方体 VAO
    glBindVertexArray(cubeVAO);
    // 绑定普通立方体 VBO
    glBindBuffer(GL_ARRAY_BUFFER, cubeVBO);
    // 上传普通立方体顶点数据
    glBufferData(GL_ARRAY_BUFFER, sizeof(cubeVertices), &cubeVertices, GL_STATIC_DRAW);
    // 启用顶点属性 0：位置
    glEnableVertexAttribArray(0);
    // 位置属性配置
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)0);
    // 启用顶点属性 1：法线
    glEnableVertexAttribArray(1);
    // 法线属性配置
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)(3 * sizeof(float)));
    // skybox VAO
    // 天空盒 VAO、VBO
    unsigned int skyboxVAO, skyboxVBO;
    // 生成天空盒 VAO
    glGenVertexArrays(1, &skyboxVAO);
    // 生成天空盒 VBO
    glGenBuffers(1, &skyboxVBO);
    // 绑定天空盒 VAO
    glBindVertexArray(skyboxVAO);
    // 绑定天空盒 VBO
    glBindBuffer(GL_ARRAY_BUFFER, skyboxVBO);
    // 上传天空盒顶点数据
    glBufferData(GL_ARRAY_BUFFER, sizeof(skyboxVertices), &skyboxVertices, GL_STATIC_DRAW);
    // 启用顶点属性 0：位置
    glEnableVertexAttribArray(0);
    // 位置属性配置
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);

    // load textures
    // -------------
    // 立方体贴图 6 个面的图片路径
    vector<std::string> faces
    {
        "resources/textures/skybox/right.jpg",
        "resources/textures/skybox/left.jpg",
        "resources/textures/skybox/top.jpg",
        "resources/textures/skybox/bottom.jpg",
        "resources/textures/skybox/front.jpg",
        "resources/textures/skybox/back.jpg",
    };
    // 加载立方体贴图
    unsigned int cubemapTexture = loadCubemap(faces);

    // shader configuration
    // --------------------
    // 使用普通物体着色器
    shader.use();
    // 告诉 shader 里面的 samplerCube 使用纹理单元 0
    shader.setInt("skybox", 0);

    // 使用天空盒着色器
    skyboxShader.use();
    // 告诉 shader 里面的 samplerCube 使用纹理单元 0
    skyboxShader.setInt("skybox", 0);

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

        // draw scene as normal
        // 使用普通物体着色器
        shader.use();
        // 模型矩阵：单位矩阵
        glm::mat4 model = glm::mat4(1.0f);
        // 视图矩阵：来自相机
        glm::mat4 view = camera.GetViewMatrix();
        // 投影矩阵：透视投影
        glm::mat4 projection = glm::perspective(glm::radians(camera.Zoom), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
        // 把模型矩阵传给 shader
        shader.setMat4("model", model);
        // 把视图矩阵传给 shader
        shader.setMat4("view", view);
        // 把投影矩阵传给 shader
        shader.setMat4("projection", projection);
        // 把相机位置传给 shader，用于计算反射方向
        shader.setVec3("cameraPos", camera.Position);
        // cubes
        // 绑定普通立方体 VAO
        glBindVertexArray(cubeVAO);
        // 激活纹理单元 0
        glActiveTexture(GL_TEXTURE0);
        // 绑定立方体贴图
        glBindTexture(GL_TEXTURE_CUBE_MAP, cubemapTexture);
        // 绘制普通立方体，36 个顶点
        glDrawArrays(GL_TRIANGLES, 0, 36);
        // 解绑 VAO
        glBindVertexArray(0);

        // draw skybox as last
        // 把深度函数改成 GL_LEQUAL，方便绘制天空盒
        glDepthFunc(GL_LEQUAL);  // change depth function so depth test passes when values are equal to depth buffer's content
        // 使用天空盒着色器
        skyboxShader.use();
        // 去掉视图矩阵中的平移部分，只保留旋转
        view = glm::mat4(glm::mat3(camera.GetViewMatrix())); // remove translation from the view matrix
        // 把视图矩阵传给天空盒 shader
        skyboxShader.setMat4("view", view);
        // 把投影矩阵传给天空盒 shader
        skyboxShader.setMat4("projection", projection);
        // skybox cube
        // 绑定天空盒 VAO
        glBindVertexArray(skyboxVAO);
        // 激活纹理单元 0
        glActiveTexture(GL_TEXTURE0);
        // 绑定立方体贴图
        glBindTexture(GL_TEXTURE_CUBE_MAP, cubemapTexture);
        // 绘制天空盒，36 个顶点
        glDrawArrays(GL_TRIANGLES, 0, 36);
        // 解绑 VAO
        glBindVertexArray(0);
        // 恢复默认深度函数
        glDepthFunc(GL_LESS); // set depth function back to default

        // glfw: swap buffers and poll IO events (keys pressed/released, mouse moved etc.)
        // -------------------------------------------------------------------------------
        // 交换前后缓冲
        glfwSwapBuffers(window);
        // 处理事件
        glfwPollEvents();
    }

    // optional: de-allocate all resources once they've outlived their purpose:
    // ------------------------------------------------------------------------
    // 删除普通立方体 VAO
    glDeleteVertexArrays(1, &cubeVAO);
    // 删除天空盒 VAO
    glDeleteVertexArrays(1, &skyboxVAO);
    // 删除普通立方体 VBO
    glDeleteBuffers(1, &cubeVBO);
    // 删除天空盒 VBO
    glDeleteBuffers(1, &skyboxVBO);

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

// utility function for loading a 2D texture from file
// ---------------------------------------------------
// 加载 2D 纹理
unsigned int loadTexture(char const* path)
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
        // 图片格式
        GLenum format;
        // 1 个通道
        if (nrComponents == 1)
            format = GL_RED;
        // 3 个通道
        else if (nrComponents == 3)
            format = GL_RGB;
        // 4 个通道
        else if (nrComponents == 4)
            format = GL_RGBA;

        // 绑定纹理
        glBindTexture(GL_TEXTURE_2D, textureID);
        // 上传纹理数据
        glTexImage2D(GL_TEXTURE_2D, 0, format, width, height, 0, format, GL_UNSIGNED_BYTE, data);
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

// loads a cubemap texture from 6 individual texture faces
// order:
// +X (right)
// -X (left)
// +Y (top)
// -Y (bottom)
// +Z (front) 
// -Z (back)
// -------------------------------------------------------
// 加载立方体贴图
unsigned int loadCubemap(vector<std::string> faces)
{
    // 纹理 ID
    unsigned int textureID;
    // 生成纹理
    glGenTextures(1, &textureID);
    // 绑定为立方体贴图
    glBindTexture(GL_TEXTURE_CUBE_MAP, textureID);

    // 图片宽度、高度、通道数
    int width, height, nrComponents;
    // 依次加载 6 张图片
    for (unsigned int i = 0; i < faces.size(); i++)
    {
        // 加载当前面的图片
        unsigned char* data = stbi_load(faces[i].c_str(), &width, &height, &nrComponents, 0);
        // 如果图片加载成功
        if (data)
        {
            // 把图片上传到立方体贴图对应的面
            glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, data);
            // 释放图片内存
            stbi_image_free(data);
        }
        // 如果图片加载失败
        else
        {
            // 输出错误信息
            std::cout << "Cubemap texture failed to load at path: " << faces[i] << std::endl;
            // 释放图片内存
            stbi_image_free(data);
        }
    }
    // 缩小过滤方式
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    // 放大过滤方式
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    // S 轴环绕方式
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    // T 轴环绕方式
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    // R 轴环绕方式
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_R, GL_CLAMP_TO_EDGE);

    // 返回纹理 ID
    return textureID;
}