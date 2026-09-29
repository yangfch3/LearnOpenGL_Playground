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

// 光源位置
// 初始放在 (1.2, 1.0, 2.0)，后面会在渲染循环里动态改变
glm::vec3 lightPos(1.2f, 1.0f, 2.0f);

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
    // 物体着色器：负责用材质 + 光源模型渲染被照亮的立方体
    Shader lightingShader("shaders/3.2.materials.vs", "shaders/3.2.materials.fs");
    // 灯源着色器：负责渲染一个小立方体，表示光源位置
    Shader lightCubeShader("shaders/3.2.light_cube.vs", "shaders/3.2.light_cube.fs");

    // 设置顶点数据，并配置顶点属性
    // ------------------------------------------------------------------
    // 这里定义了一个立方体的 36 个顶点
    // 每个顶点包含：
    //   前 3 个 float：位置 x, y, z
    //   后 3 个 float：法线 nx, ny, nz
    float vertices[] = {
        // 后面 -0.5 z 这个面，法线朝 -z
        -0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
         0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
         0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
         0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
        -0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
        -0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,

        // 前面 +0.5 z 这个面，法线朝 +z
        -0.5f, -0.5f,  0.5f,  0.0f,  0.0f,  1.0f,
         0.5f, -0.5f,  0.5f,  0.0f,  0.0f,  1.0f,
         0.5f,  0.5f,  0.5f,  0.0f,  0.0f,  1.0f,
         0.5f,  0.5f,  0.5f,  0.0f,  0.0f,  1.0f,
        -0.5f,  0.5f,  0.5f,  0.0f,  0.0f,  1.0f,
        -0.5f, -0.5f,  0.5f,  0.0f,  0.0f,  1.0f,

        // 左面 -0.5 x 这个面，法线朝 -x
        -0.5f,  0.5f,  0.5f, -1.0f,  0.0f,  0.0f,
        -0.5f,  0.5f, -0.5f, -1.0f,  0.0f,  0.0f,
        -0.5f, -0.5f, -0.5f, -1.0f,  0.0f,  0.0f,
        -0.5f, -0.5f, -0.5f, -1.0f,  0.0f,  0.0f,
        -0.5f, -0.5f,  0.5f, -1.0f,  0.0f,  0.0f,
        -0.5f,  0.5f,  0.5f, -1.0f,  0.0f,  0.0f,

        // 右面 +0.5 x 这个面，法线朝 +x
         0.5f,  0.5f,  0.5f,  1.0f,  0.0f,  0.0f,
         0.5f,  0.5f, -0.5f,  1.0f,  0.0f,  0.0f,
         0.5f, -0.5f, -0.5f,  1.0f,  0.0f,  0.0f,
         0.5f, -0.5f, -0.5f,  1.0f,  0.0f,  0.0f,
         0.5f, -0.5f,  0.5f,  1.0f,  0.0f,  0.0f,
         0.5f,  0.5f,  0.5f,  1.0f,  0.0f,  0.0f,

         // 底面 -0.5 y 这个面，法线朝 -y
         -0.5f, -0.5f, -0.5f,  0.0f, -1.0f,  0.0f,
          0.5f, -0.5f, -0.5f,  0.0f, -1.0f,  0.0f,
          0.5f, -0.5f,  0.5f,  0.0f, -1.0f,  0.0f,
          0.5f, -0.5f,  0.5f,  0.0f, -1.0f,  0.0f,
         -0.5f, -0.5f,  0.5f,  0.0f, -1.0f,  0.0f,
         -0.5f, -0.5f, -0.5f,  0.0f, -1.0f,  0.0f,

         // 顶面 +0.5 y 这个面，法线朝 +y
         -0.5f,  0.5f, -0.5f,  0.0f,  1.0f,  0.0f,
          0.5f,  0.5f, -0.5f,  0.0f,  1.0f,  0.0f,
          0.5f,  0.5f,  0.5f,  0.0f,  1.0f,  0.0f,
          0.5f,  0.5f,  0.5f,  0.0f,  1.0f,  0.0f,
         -0.5f,  0.5f,  0.5f,  0.0f,  1.0f,  0.0f,
         -0.5f,  0.5f, -0.5f,  0.0f,  1.0f,  0.0f
    };

    // 首先，配置立方体的 VAO 和 VBO
    unsigned int VBO, cubeVAO;
    // 生成 1 个 VAO
    glGenVertexArrays(1, &cubeVAO);
    // 生成 1 个 VBO
    glGenBuffers(1, &VBO);

    // 绑定 VBO 为当前数组缓冲
    glBindBuffer(GL_ARRAY_BUFFER, VBO);
    // 把顶点数据复制到 GPU 缓冲中，STATIC_DRAW 表示数据基本不会变
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);

    // 绑定 cubeVAO，之后对顶点属性的配置都会记录到这个 VAO 中
    glBindVertexArray(cubeVAO);

    // 位置属性
    // 索引 0：每个顶点 3 个 float，步长为 6 个 float，偏移为 0
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)0);
    // 启用顶点属性 0
    glEnableVertexAttribArray(0);

    // 法线属性
    // 索引 1：每个顶点 3 个 float，步长为 6 个 float，偏移为 3 个 float
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)(3 * sizeof(float)));
    // 启用顶点属性 1
    glEnableVertexAttribArray(1);

    // 其次，配置光源的 VAO
    // VBO 保持不变，因为光源也是一个 3D 立方体，顶点数据相同
    unsigned int lightCubeVAO;
    // 生成 1 个 VAO
    glGenVertexArrays(1, &lightCubeVAO);
    // 绑定 lightCubeVAO
    glBindVertexArray(lightCubeVAO);

    // 复用同一个 VBO
    glBindBuffer(GL_ARRAY_BUFFER, VBO);
    // 注意：这里只配置位置属性，步长仍然是 6 个 float
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)0);
    // 启用顶点属性 0
    glEnableVertexAttribArray(0);

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
        // 设置清屏颜色为深灰色
        glClearColor(0.1f, 0.1f, 0.1f, 1.0f);
        // 清除颜色缓冲和深度缓冲
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        // 随时间改变光源位置
        // 这个可以在渲染循环里任意位置做，但至少要在使用光源位置之前做
        lightPos.x = 1.0f + sin(glfwGetTime()) * 2.0f;
        lightPos.y = sin(glfwGetTime() / 2.0f) * 1.0f;

        // 随时间改变光源颜色
        // 用三条不同频率的正弦波分别控制 R、G、B
        glm::vec3 lightColor;
        lightColor.x = sin(glfwGetTime() * 2.0f);
        lightColor.y = sin(glfwGetTime() * 0.7f);
        lightColor.z = sin(glfwGetTime() * 1.3f);

        // 漫反射颜色：把光源颜色乘以 0.5，降低影响
        glm::vec3 diffuseColor = lightColor * glm::vec3(0.5f);
        // 环境光颜色：在漫反射基础上再乘以 0.2，影响更低
        glm::vec3 ambientColor = diffuseColor * glm::vec3(0.2f);

        // 设置 uniform 或绘制物体之前，一定要先激活对应的着色器
        lightingShader.use();
        // 把光源位置传给着色器
        lightingShader.setVec3("light.position", lightPos);
        // 把摄像机位置传给着色器，用来计算镜面反射
        lightingShader.setVec3("viewPos", camera.Position);

        // 光源属性
        // 环境光：很弱的基础亮度
        lightingShader.setVec3("light.ambient", ambientColor);
        // 漫反射：与光线方向有关的主要亮度
        lightingShader.setVec3("light.diffuse", diffuseColor);
        // 镜面反射：光源的高光颜色，这里固定为白色
        lightingShader.setVec3("light.specular", 1.0f, 1.0f, 1.0f);

        // 材质属性
        // 材质环境光：物体在环境光下的颜色
        lightingShader.setVec3("material.ambient", 0.0f, 0.1f, 0.06f);
        // 材质漫反射：物体在漫反射下的颜色，这里是一种青色
        lightingShader.setVec3("material.diffuse", 0.0f, 0.50980392f, 0.50980392f);
        // 材质镜面反射：物体的高光颜色，这里是灰色
        lightingShader.setVec3("material.specular", 0.50196078f, 0.50196078f, 0.50196078f);
        // 材质光泽度：控制高光的大小和锐利程度
        lightingShader.setFloat("material.shininess", 32.0f);

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
        // 把投影矩阵和视图矩阵传给物体着色器
        lightingShader.setMat4("projection", projection);
        lightingShader.setMat4("view", view);

        // 世界变换
        // 这里把模型矩阵设为单位矩阵，也就是立方体放在原点
        glm::mat4 model = glm::mat4(1.0f);
        // 把模型矩阵传给物体着色器
        lightingShader.setMat4("model", model);

        // 渲染被照亮的立方体
        glBindVertexArray(cubeVAO);
        glDrawArrays(GL_TRIANGLES, 0, 36);

        // 同时绘制灯源物体
        // 使用灯源着色器
        lightCubeShader.use();
        // 同样传入投影矩阵和视图矩阵
        lightCubeShader.setMat4("projection", projection);
        lightCubeShader.setMat4("view", view);

        // 模型矩阵：把灯源立方体移动到 lightPos 位置
        model = glm::mat4(1.0f);
        model = glm::translate(model, lightPos);
        // 缩小到 0.2 倍，让它看起来像一个小灯泡
        model = glm::scale(model, glm::vec3(0.2f));
        // 把模型矩阵传给灯源着色器
        lightCubeShader.setMat4("model", model);

        // 绑定灯源 VAO 并绘制
        glBindVertexArray(lightCubeVAO);
        glDrawArrays(GL_TRIANGLES, 0, 36);

        // glfw：交换缓冲并轮询 IO 事件，比如键盘、鼠标事件
        // -------------------------------------------------------------------------------
        glfwSwapBuffers(window);
        glfwPollEvents();
    }

    // 可选：当资源不再使用时释放它们
    // ------------------------------------------------------------------------
    // 删除 cubeVAO
    glDeleteVertexArrays(1, &cubeVAO);
    // 删除 lightCubeVAO
    glDeleteVertexArrays(1, &lightCubeVAO);
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