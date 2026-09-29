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

// 平行光位置变量
// 注意：这一段代码里平行光的方向是直接写死在渲染循环里的，
// 这个 lightPos 实际上没有被使用，保留只是为了和其他章节代码保持一致。
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
    // 物体着色器：使用漫反射贴图、镜面反射贴图，并接收多种光源
    Shader lightingShader("shaders/6.multiple_lights.vs", "shaders/6.multiple_lights.fs");
    // 灯源着色器：渲染小立方体，用来表示各个点光源的位置
    Shader lightCubeShader("shaders/6.light_cube.vs", "shaders/6.light_cube.fs");

    // 设置顶点数据，并配置顶点属性
    // ------------------------------------------------------------------
    // 这里定义了一个立方体的 36 个顶点
    // 每个顶点包含：
    //   前 3 个 float：位置 x, y, z
    //   中间 3 个 float：法线 nx, ny, nz
    //   后 2 个 float：纹理坐标 u, v
    float vertices[] = {
        // 位置              // 法线             // 纹理坐标
        -0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,  0.0f,  0.0f,
         0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,  1.0f,  0.0f,
         0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,  1.0f,  1.0f,
         0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,  1.0f,  1.0f,
        -0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,  0.0f,  1.0f,
        -0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,  0.0f,  0.0f,

        -0.5f, -0.5f,  0.5f,  0.0f,  0.0f,  1.0f,  0.0f,  0.0f,
         0.5f, -0.5f,  0.5f,  0.0f,  0.0f,  1.0f,  1.0f,  0.0f,
         0.5f,  0.5f,  0.5f,  0.0f,  0.0f,  1.0f,  1.0f,  1.0f,
         0.5f,  0.5f,  0.5f,  0.0f,  0.0f,  1.0f,  1.0f,  1.0f,
        -0.5f,  0.5f,  0.5f,  0.0f,  0.0f,  1.0f,  0.0f,  1.0f,
        -0.5f, -0.5f,  0.5f,  0.0f,  0.0f,  1.0f,  0.0f,  0.0f,

        -0.5f,  0.5f,  0.5f, -1.0f,  0.0f,  0.0f,  1.0f,  0.0f,
        -0.5f,  0.5f, -0.5f, -1.0f,  0.0f,  0.0f,  1.0f,  1.0f,
        -0.5f, -0.5f, -0.5f, -1.0f,  0.0f,  0.0f,  0.0f,  1.0f,
        -0.5f, -0.5f, -0.5f, -1.0f,  0.0f,  0.0f,  0.0f,  1.0f,
        -0.5f, -0.5f,  0.5f, -1.0f,  0.0f,  0.0f,  0.0f,  0.0f,
        -0.5f,  0.5f,  0.5f, -1.0f,  0.0f,  0.0f,  1.0f,  0.0f,

         0.5f,  0.5f,  0.5f,  1.0f,  0.0f,  0.0f,  1.0f,  0.0f,
         0.5f,  0.5f, -0.5f,  1.0f,  0.0f,  0.0f,  1.0f,  1.0f,
         0.5f, -0.5f, -0.5f,  1.0f,  0.0f,  0.0f,  0.0f,  1.0f,
         0.5f, -0.5f, -0.5f,  1.0f,  0.0f,  0.0f,  0.0f,  1.0f,
         0.5f, -0.5f,  0.5f,  1.0f,  0.0f,  0.0f,  0.0f,  0.0f,
         0.5f,  0.5f,  0.5f,  1.0f,  0.0f,  0.0f,  1.0f,  0.0f,

        -0.5f, -0.5f, -0.5f,  0.0f, -1.0f,  0.0f,  0.0f,  1.0f,
         0.5f, -0.5f, -0.5f,  0.0f, -1.0f,  0.0f,  1.0f,  1.0f,
         0.5f, -0.5f,  0.5f,  0.0f, -1.0f,  0.0f,  1.0f,  0.0f,
         0.5f, -0.5f,  0.5f,  0.0f, -1.0f,  0.0f,  1.0f,  0.0f,
        -0.5f, -0.5f,  0.5f,  0.0f, -1.0f,  0.0f,  0.0f,  0.0f,
        -0.5f, -0.5f, -0.5f,  0.0f, -1.0f,  0.0f,  0.0f,  1.0f,

        -0.5f,  0.5f, -0.5f,  0.0f,  1.0f,  0.0f,  0.0f,  1.0f,
         0.5f,  0.5f, -0.5f,  0.0f,  1.0f,  0.0f,  1.0f,  1.0f,
         0.5f,  0.5f,  0.5f,  0.0f,  1.0f,  0.0f,  1.0f,  0.0f,
         0.5f,  0.5f,  0.5f,  0.0f,  1.0f,  0.0f,  1.0f,  0.0f,
        -0.5f,  0.5f,  0.5f,  0.0f,  1.0f,  0.0f,  0.0f,  0.0f,
        -0.5f,  0.5f, -0.5f,  0.0f,  1.0f,  0.0f,  0.0f,  1.0f
    };

    // 所有容器（木箱）在世界空间中的位置
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

    // 4 个点光源在世界空间中的位置
    glm::vec3 pointLightPositions[] = {
        glm::vec3(0.7f,  0.2f,  2.0f),
        glm::vec3(2.3f, -3.3f, -4.0f),
        glm::vec3(-4.0f,  2.0f, -12.0f),
        glm::vec3(0.0f,  0.0f, -3.0f)
    };

    // 首先，配置立方体的 VAO 和 VBO
    unsigned int VBO, cubeVAO;
    // 生成 1 个 VAO
    glGenVertexArrays(1, &cubeVAO);
    // 生成 1 个 VBO
    glGenBuffers(1, &VBO);

    // 绑定 VBO 为当前数组缓冲
    glBindBuffer(GL_ARRAY_BUFFER, VBO);
    // 把顶点数据复制到 GPU 缓冲中
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);

    // 绑定 cubeVAO，之后对顶点属性的配置都会记录到这个 VAO 中
    glBindVertexArray(cubeVAO);

    // 位置属性，索引 0：3 个 float，步长 8 个 float，偏移 0
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(0);

    // 法线属性，索引 1：3 个 float，步长 8 个 float，偏移 3 个 float
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(3 * sizeof(float)));
    glEnableVertexAttribArray(1);

    // 纹理坐标属性，索引 2：2 个 float，步长 8 个 float，偏移 6 个 float
    glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(6 * sizeof(float)));
    glEnableVertexAttribArray(2);

    // 其次，配置光源的 VAO
    // VBO 保持不变，因为光源也是一个 3D 立方体，顶点数据相同
    unsigned int lightCubeVAO;
    glGenVertexArrays(1, &lightCubeVAO);
    glBindVertexArray(lightCubeVAO);

    // 复用同一个 VBO
    glBindBuffer(GL_ARRAY_BUFFER, VBO);
    // 只配置位置属性，步长仍然是 8 个 float
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(0);

    // 加载纹理
    // -----------------------------------------------------------------------------
    // 漫反射贴图：决定物体本身的颜色
    unsigned int diffuseMap = loadTexture("resources/textures/container2.png");
    // 镜面反射贴图：决定物体高光的分布和强度
    unsigned int specularMap = loadTexture("resources/textures/container2_specular.png");

    // 着色器配置
    // --------------------
    // 激活物体着色器
    lightingShader.use();
    // 把 material.diffuse 采样器绑定到纹理单元 0
    lightingShader.setInt("material.diffuse", 0);
    // 把 material.specular 采样器绑定到纹理单元 1
    lightingShader.setInt("material.specular", 1);

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

        // 设置 uniform 或绘制物体之前，一定要先激活对应的着色器
        lightingShader.use();
        // 把摄像机位置传给着色器，用来计算镜面反射
        lightingShader.setVec3("viewPos", camera.Position);
        // 材质光泽度：控制高光大小
        lightingShader.setFloat("material.shininess", 32.0f);

        /*
           这里我们设置所有光源的 uniform。
           我们需要手动一个个设置，并通过索引来访问 pointLights 数组中的每个 PointLight 结构体。
           如果你想要更友好的代码组织方式，可以把光源类型定义成类，把赋值放进类里；
           或者用 uniform buffer object 来更高效地传大量 uniform。
           不过那是后面 "Advanced GLSL" 章节要讨论的内容。
        */

        // 平行光（directional light）
        // 方向：从场景上方偏左后方照下来
        lightingShader.setVec3("dirLight.direction", -0.2f, -1.0f, -0.3f);
        // 环境光：非常弱
        lightingShader.setVec3("dirLight.ambient", 0.05f, 0.05f, 0.05f);
        // 漫反射：中等强度
        lightingShader.setVec3("dirLight.diffuse", 0.4f, 0.4f, 0.4f);
        // 镜面反射：中等强度
        lightingShader.setVec3("dirLight.specular", 0.5f, 0.5f, 0.5f);

        // 点光源 1
        lightingShader.setVec3("pointLights[0].position", pointLightPositions[0]);
        lightingShader.setVec3("pointLights[0].ambient", 0.05f, 0.05f, 0.05f);
        lightingShader.setVec3("pointLights[0].diffuse", 0.8f, 0.8f, 0.8f);
        lightingShader.setVec3("pointLights[0].specular", 1.0f, 1.0f, 1.0f);
        // 距离衰减参数：constant / linear / quadratic
        lightingShader.setFloat("pointLights[0].constant", 1.0f);
        lightingShader.setFloat("pointLights[0].linear", 0.09f);
        lightingShader.setFloat("pointLights[0].quadratic", 0.032f);

        // 点光源 2
        lightingShader.setVec3("pointLights[1].position", pointLightPositions[1]);
        lightingShader.setVec3("pointLights[1].ambient", 0.05f, 0.05f, 0.05f);
        lightingShader.setVec3("pointLights[1].diffuse", 0.8f, 0.8f, 0.8f);
        lightingShader.setVec3("pointLights[1].specular", 1.0f, 1.0f, 1.0f);
        lightingShader.setFloat("pointLights[1].constant", 1.0f);
        lightingShader.setFloat("pointLights[1].linear", 0.09f);
        lightingShader.setFloat("pointLights[1].quadratic", 0.032f);

        // 点光源 3
        lightingShader.setVec3("pointLights[2].position", pointLightPositions[2]);
        lightingShader.setVec3("pointLights[2].ambient", 0.05f, 0.05f, 0.05f);
        lightingShader.setVec3("pointLights[2].diffuse", 0.8f, 0.8f, 0.8f);
        lightingShader.setVec3("pointLights[2].specular", 1.0f, 1.0f, 1.0f);
        lightingShader.setFloat("pointLights[2].constant", 1.0f);
        lightingShader.setFloat("pointLights[2].linear", 0.09f);
        lightingShader.setFloat("pointLights[2].quadratic", 0.032f);

        // 点光源 4
        lightingShader.setVec3("pointLights[3].position", pointLightPositions[3]);
        lightingShader.setVec3("pointLights[3].ambient", 0.05f, 0.05f, 0.05f);
        lightingShader.setVec3("pointLights[3].diffuse", 0.8f, 0.8f, 0.8f);
        lightingShader.setVec3("pointLights[3].specular", 1.0f, 1.0f, 1.0f);
        lightingShader.setFloat("pointLights[3].constant", 1.0f);
        lightingShader.setFloat("pointLights[3].linear", 0.09f);
        lightingShader.setFloat("pointLights[3].quadratic", 0.032f);

        // 聚光灯（spotLight）
        // 位置和方向都跟随摄像机，相当于一个手电筒
        lightingShader.setVec3("spotLight.position", camera.Position);
        lightingShader.setVec3("spotLight.direction", camera.Front);
        lightingShader.setVec3("spotLight.ambient", 0.0f, 0.0f, 0.0f);
        lightingShader.setVec3("spotLight.diffuse", 1.0f, 1.0f, 1.0f);
        lightingShader.setVec3("spotLight.specular", 1.0f, 1.0f, 1.0f);
        lightingShader.setFloat("spotLight.constant", 1.0f);
        lightingShader.setFloat("spotLight.linear", 0.09f);
        lightingShader.setFloat("spotLight.quadratic", 0.032f);
        // 内圆锥角 12.5 度，外圆锥角 15 度，用来做软边缘
        lightingShader.setFloat("spotLight.cutOff", glm::cos(glm::radians(12.5f)));
        lightingShader.setFloat("spotLight.outerCutOff", glm::cos(glm::radians(15.0f)));

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
        // 这里把模型矩阵设为单位矩阵，随后会在循环里为每个物体单独设置
        glm::mat4 model = glm::mat4(1.0f);
        lightingShader.setMat4("model", model);

        // 绑定漫反射贴图到纹理单元 0
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, diffuseMap);
        // 绑定镜面反射贴图到纹理单元 1
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, specularMap);

        // 渲染所有容器
        glBindVertexArray(cubeVAO);
        for (unsigned int i = 0; i < 10; i++)
        {
            // 为每个物体计算模型矩阵，并在绘制前传给着色器
            glm::mat4 model = glm::mat4(1.0f);
            // 把立方体平移到指定位置
            model = glm::translate(model, cubePositions[i]);
            // 每个立方体旋转不同角度，避免看起来完全一样
            float angle = 20.0f * i;
            model = glm::rotate(model, glm::radians(angle), glm::vec3(1.0f, 0.3f, 0.5f));
            lightingShader.setMat4("model", model);

            // 绘制 36 个顶点，也就是一个立方体
            glDrawArrays(GL_TRIANGLES, 0, 36);
        }

        // 同时绘制所有点光源的灯泡
        lightCubeShader.use();
        lightCubeShader.setMat4("projection", projection);
        lightCubeShader.setMat4("view", view);

        // 有多少个点光源就画多少个灯泡
        glBindVertexArray(lightCubeVAO);
        for (unsigned int i = 0; i < 4; i++)
        {
            model = glm::mat4(1.0f);
            // 把灯泡移动到对应点光源的位置
            model = glm::translate(model, pointLightPositions[i]);
            // 缩小到 0.2 倍，让它看起来像一个小灯泡
            model = glm::scale(model, glm::vec3(0.2f));
            lightCubeShader.setMat4("model", model);
            glDrawArrays(GL_TRIANGLES, 0, 36);
        }

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

// 从文件加载 2D 纹理的工具函数
// ---------------------------------------------------
unsigned int loadTexture(char const* path)
{
    // 纹理 ID
    unsigned int textureID;
    // 生成 1 个纹理对象
    glGenTextures(1, &textureID);

    // 图片宽、高、通道数
    int width, height, nrComponents;
    // 加载图片
    unsigned char* data = stbi_load(path, &width, &height, &nrComponents, 0);
    // 如果加载成功
    if (data)
    {
        // 根据通道数决定像素格式
        GLenum format;
        if (nrComponents == 1)
            format = GL_RED;
        else if (nrComponents == 3)
            format = GL_RGB;
        else if (nrComponents == 4)
            format = GL_RGBA;

        // 绑定纹理
        glBindTexture(GL_TEXTURE_2D, textureID);
        // 上传图片数据
        glTexImage2D(GL_TEXTURE_2D, 0, format, width, height, 0, format, GL_UNSIGNED_BYTE, data);
        // 生成 mipmap
        glGenerateMipmap(GL_TEXTURE_2D);

        // 设置环绕方式为重复
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
        // 缩小使用三线性过滤，放大使用线性过滤
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

        // 释放图片内存
        stbi_image_free(data);
    }
    else
    {
        // 加载失败输出错误
        std::cout << "Texture failed to load at path: " << path << std::endl;
        // 释放图片内存
        stbi_image_free(data);
    }

    // 返回纹理 ID
    return textureID;
}