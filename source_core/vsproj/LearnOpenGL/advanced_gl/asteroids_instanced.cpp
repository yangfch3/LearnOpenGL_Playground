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
// 自定义 Model 类
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
// 创建相机，位置在 (0, 0, 155)，方便看到整个小行星带
Camera camera(glm::vec3(0.0f, 0.0f, 155.0f));
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
    // 小行星着色器
    Shader asteroidShader("shaders/10.3.asteroids.vs", "shaders/10.3.asteroids.fs");
    // 行星着色器
    Shader planetShader("shaders/10.3.planet.vs", "shaders/10.3.planet.fs");

    // load models
    // -----------
    // 加载岩石模型
    Model rock("resources/objects/rock/rock.obj");
    // 加载行星模型
    Model planet("resources/objects/planet/planet.obj");

    // generate a large list of semi-random model transformation matrices
    // ------------------------------------------------------------------
    // 小行星数量
    unsigned int amount = 15000;
    // 存储每个小行星的模型矩阵
    glm::mat4* modelMatrices;
    // 分配内存
    modelMatrices = new glm::mat4[amount];
    // 用当前时间初始化随机种子
    srand(static_cast<unsigned int>(glfwGetTime())); // initialize random seed
    // 小行星带半径
    float radius = 150.0;
    // 随机偏移范围
    float offset = 25.0f;
    // 为每个小行星生成一个模型矩阵
    for (unsigned int i = 0; i < amount; i++)
    {
        // 单位矩阵
        glm::mat4 model = glm::mat4(1.0f);
        // 1. translation: displace along circle with 'radius' in range [-offset, offset]
        // 沿圆周均匀分布角度
        float angle = (float)i / (float)amount * 360.0f;
        // 计算随机位移
        float displacement = (rand() % (int)(2 * offset * 100)) / 100.0f - offset;
        // 计算 x 坐标
        float x = sin(angle) * radius + displacement;
        // 计算随机位移
        displacement = (rand() % (int)(2 * offset * 100)) / 100.0f - offset;
        // 计算 y 坐标，压缩高度让星带更扁平
        float y = displacement * 0.4f; // keep height of asteroid field smaller compared to width of x and z
        // 计算随机位移
        displacement = (rand() % (int)(2 * offset * 100)) / 100.0f - offset;
        // 计算 z 坐标
        float z = cos(angle) * radius + displacement;
        // 平移到目标位置
        model = glm::translate(model, glm::vec3(x, y, z));

        // 2. scale: Scale between 0.05 and 0.25f
        // 随机缩放，范围 0.05 到 0.25
        float scale = static_cast<float>((rand() % 20) / 100.0 + 0.05);
        // 应用缩放
        model = glm::scale(model, glm::vec3(scale));

        // 3. rotation: add random rotation around a (semi)randomly picked rotation axis vector
        // 随机旋转角度
        float rotAngle = static_cast<float>((rand() % 360));
        // 绕固定轴旋转
        model = glm::rotate(model, rotAngle, glm::vec3(0.4f, 0.6f, 0.8f));

        // 4. now add to list of matrices
        // 保存模型矩阵
        modelMatrices[i] = model;
    }

    // configure instanced array
    // -------------------------
    // 实例化用的缓冲
    unsigned int buffer;
    // 生成缓冲
    glGenBuffers(1, &buffer);
    // 绑定缓冲
    glBindBuffer(GL_ARRAY_BUFFER, buffer);
    // 上传所有模型矩阵数据
    glBufferData(GL_ARRAY_BUFFER, amount * sizeof(glm::mat4), &modelMatrices[0], GL_STATIC_DRAW);

    // set transformation matrices as an instance vertex attribute (with divisor 1)
    // note: we're cheating a little by taking the, now publicly declared, VAO of the model's mesh(es) and adding new vertexAttribPointers
    // normally you'd want to do this in a more organized fashion, but for learning purposes this will do.
    // -----------------------------------------------------------------------------------------------------------------------------------
    // 遍历岩石模型的每个网格，给它们的 VAO 添加实例化属性
    for (unsigned int i = 0; i < rock.meshes.size(); i++)
    {
        // 取出当前网格的 VAO
        unsigned int VAO = rock.meshes[i].VAO;
        // 绑定 VAO
        glBindVertexArray(VAO);
        // set attribute pointers for matrix (4 times vec4)
        // 模型矩阵占 4 个 vec4，分别对应属性 3、4、5、6
        // 启用属性 3
        glEnableVertexAttribArray(3);
        // 属性 3：矩阵第 1 列
        glVertexAttribPointer(3, 4, GL_FLOAT, GL_FALSE, sizeof(glm::mat4), (void*)0);
        // 启用属性 4
        glEnableVertexAttribArray(4);
        // 属性 4：矩阵第 2 列
        glVertexAttribPointer(4, 4, GL_FLOAT, GL_FALSE, sizeof(glm::mat4), (void*)(sizeof(glm::vec4)));
        // 启用属性 5
        glEnableVertexAttribArray(5);
        // 属性 5：矩阵第 3 列
        glVertexAttribPointer(5, 4, GL_FLOAT, GL_FALSE, sizeof(glm::mat4), (void*)(2 * sizeof(glm::vec4)));
        // 启用属性 6
        glEnableVertexAttribArray(6);
        // 属性 6：矩阵第 4 列
        glVertexAttribPointer(6, 4, GL_FLOAT, GL_FALSE, sizeof(glm::mat4), (void*)(3 * sizeof(glm::vec4)));

        // 每个实例前进一次，而不是每个顶点前进一次
        glVertexAttribDivisor(3, 1);
        glVertexAttribDivisor(4, 1);
        glVertexAttribDivisor(5, 1);
        glVertexAttribDivisor(6, 1);

        // 解绑 VAO
        glBindVertexArray(0);
    }

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

        // configure transformation matrices
        // 投影矩阵：透视投影，远裁剪面调到 1000 才能看到远处的小行星
        glm::mat4 projection = glm::perspective(glm::radians(45.0f), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 1000.0f);
        // 视图矩阵：来自相机
        glm::mat4 view = camera.GetViewMatrix();
        // 使用小行星着色器
        asteroidShader.use();
        // 把投影矩阵传给 shader
        asteroidShader.setMat4("projection", projection);
        // 把视图矩阵传给 shader
        asteroidShader.setMat4("view", view);
        // 使用行星着色器
        planetShader.use();
        // 把投影矩阵传给 shader
        planetShader.setMat4("projection", projection);
        // 把视图矩阵传给 shader
        planetShader.setMat4("view", view);

        // draw planet
        // 模型矩阵：单位矩阵
        glm::mat4 model = glm::mat4(1.0f);
        // 平移到下方
        model = glm::translate(model, glm::vec3(0.0f, -3.0f, 0.0f));
        // 放大 4 倍
        model = glm::scale(model, glm::vec3(4.0f, 4.0f, 4.0f));
        // 把模型矩阵传给 shader
        planetShader.setMat4("model", model);
        // 绘制行星
        planet.Draw(planetShader);

        // draw meteorites
        // 使用小行星着色器
        asteroidShader.use();
        // 设置漫反射纹理使用纹理单元 0
        asteroidShader.setInt("texture_diffuse1", 0);
        // 激活纹理单元 0
        glActiveTexture(GL_TEXTURE0);
        // 绑定岩石的漫反射纹理
        glBindTexture(GL_TEXTURE_2D, rock.textures_loaded[0].id); // note: we also made the textures_loaded vector public (instead of private) from the model class.
        // 遍历岩石模型的每个网格
        for (unsigned int i = 0; i < rock.meshes.size(); i++)
        {
            // 绑定当前网格的 VAO
            glBindVertexArray(rock.meshes[i].VAO);
            // 实例化绘制：一次画 amount 个小行星
            glDrawElementsInstanced(GL_TRIANGLES, static_cast<unsigned int>(rock.meshes[i].indices.size()), GL_UNSIGNED_INT, 0, amount);
            // 解绑 VAO
            glBindVertexArray(0);
        }

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
        camera.ProcessKeyboard(FORWARD, deltaTime * 10);
    // S 向后
    if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS)
        camera.ProcessKeyboard(BACKWARD, deltaTime * 10);
    // A 向左
    if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS)
        camera.ProcessKeyboard(LEFT, deltaTime * 10);
    // D 向右
    if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS)
        camera.ProcessKeyboard(RIGHT, deltaTime * 10);
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