// 加载 OpenGL 函数指针
#include <glad/glad.h>
// 窗口、输入、上下文管理
#include <GLFW/glfw3.h>
// 加载图片纹理（含 HDR）
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
// 渲染一个球体
void renderSphere();
// 渲染一个 1x1x1 的立方体
void renderCube();

// settings
// 窗口宽度
const unsigned int SCR_WIDTH = 1280;
// 窗口高度
const unsigned int SCR_HEIGHT = 720;

// camera
// 创建相机，位置在 (0, 0, 3)
Camera camera(glm::vec3(0.0f, 0.0f, 3.0f));
// 上一帧鼠标 X 位置
float lastX = 800.0f / 2.0;
// 上一帧鼠标 Y 位置
float lastY = 600.0 / 2.0;
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
    // 开启 4 倍多重采样抗锯齿
    glfwWindowHint(GLFW_SAMPLES, 4);
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
    // 让当前窗口的 OpenGL 上下文成为当前上下文
    glfwMakeContextCurrent(window);
    // 如果窗口创建失败
    if (window == NULL)
    {
        // 输出错误信息
        std::cout << "Failed to create GLFW window" << std::endl;
        // 终止 GLFW
        glfwTerminate();
        return -1;
    }
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
    // 深度函数设为 LEQUAL，方便天空盒最后绘制
    glDepthFunc(GL_LEQUAL); // set depth function to less than AND equal for skybox depth trick.

    // build and compile shaders
    // -------------------------
    // PBR 着色器：使用 IBL（基于图像的光照）
    Shader pbrShader("shaders/2.1.2.pbr.vs", "shaders/2.1.2.pbr.fs");
    // 把等距柱状投影 HDR 图转换成环境立方体贴图
    Shader equirectangularToCubemapShader("shaders/2.1.2.cubemap.vs", "shaders/2.1.2.equirectangular_to_cubemap.fs");
    // 辐照度卷积着色器：计算漫反射 IBL
    Shader irradianceShader("shaders/2.1.2.cubemap.vs", "shaders/2.1.2.irradiance_convolution.fs");
    // 背景着色器：绘制天空盒
    Shader backgroundShader("shaders/2.1.2.background.vs", "shaders/2.1.2.background.fs");


    // 使用 PBR 着色器
    pbrShader.use();
    // 告诉 shader 里面的 irradianceMap 使用纹理单元 0
    pbrShader.setInt("irradianceMap", 0);
    // 设置基础反照率颜色：偏红色
    pbrShader.setVec3("albedo", 0.5f, 0.0f, 0.0f);
    // 设置环境光遮蔽系数为 1（不遮蔽）
    pbrShader.setFloat("ao", 1.0f);

    // 使用背景着色器
    backgroundShader.use();
    // 告诉 shader 里面的 environmentMap 使用纹理单元 0
    backgroundShader.setInt("environmentMap", 0);


    // lights
    // ------
    // 4 个点光源位置，分布在四个角落
    glm::vec3 lightPositions[] = {
        glm::vec3(-10.0f,  10.0f, 10.0f),
        glm::vec3(10.0f,  10.0f, 10.0f),
        glm::vec3(-10.0f, -10.0f, 10.0f),
        glm::vec3(10.0f, -10.0f, 10.0f),
    };
    // 4 个光源颜色，都是很亮的白色，亮度 300
    glm::vec3 lightColors[] = {
        glm::vec3(300.0f, 300.0f, 300.0f),
        glm::vec3(300.0f, 300.0f, 300.0f),
        glm::vec3(300.0f, 300.0f, 300.0f),
        glm::vec3(300.0f, 300.0f, 300.0f)
    };
    // 球体排列的行数
    int nrRows = 7;
    // 球体排列的列数
    int nrColumns = 7;
    // 球体之间的间距
    float spacing = 2.5;

    // pbr: setup framebuffer
    // ----------------------
    // 捕获帧缓冲，用于渲染立方体贴图
    unsigned int captureFBO;
    // 捕获渲染缓冲，用于深度
    unsigned int captureRBO;
    // 生成帧缓冲
    glGenFramebuffers(1, &captureFBO);
    // 生成渲染缓冲
    glGenRenderbuffers(1, &captureRBO);

    // 绑定捕获帧缓冲
    glBindFramebuffer(GL_FRAMEBUFFER, captureFBO);
    // 绑定捕获渲染缓冲
    glBindRenderbuffer(GL_RENDERBUFFER, captureRBO);
    // 分配 24 位深度存储，尺寸 512x512
    glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH_COMPONENT24, 512, 512);
    // 把渲染缓冲附加到帧缓冲深度附件
    glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_RENDERBUFFER, captureRBO);

    // pbr: load the HDR environment map
    // ---------------------------------
    // HDR 加载时上下翻转
    stbi_set_flip_vertically_on_load(true);
    // 图片宽度、高度、通道数
    int width, height, nrComponents;
    // 加载 HDR 环境贴图，返回浮点数据
    float* data = stbi_loadf("resources/textures/hdr/newport_loft.hdr", &width, &height, &nrComponents, 0);
    // HDR 纹理
    unsigned int hdrTexture;
    // 如果加载成功
    if (data)
    {
        // 生成纹理
        glGenTextures(1, &hdrTexture);
        // 绑定为 2D 纹理
        glBindTexture(GL_TEXTURE_2D, hdrTexture);
        // 用浮点数据上传 HDR 纹理，格式 RGB16F 支持超过 1.0 的亮度
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB16F, width, height, 0, GL_RGB, GL_FLOAT, data); // note how we specify the texture's data value to be float

        // S 轴环绕方式，用边缘限制
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        // T 轴环绕方式，用边缘限制
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        // 缩小过滤方式
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        // 放大过滤方式
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

        // 释放图片内存
        stbi_image_free(data);
    }
    // 如果加载失败
    else
    {
        // 输出错误信息
        std::cout << "Failed to load HDR image." << std::endl;
    }

    // pbr: setup cubemap to render to and attach to framebuffer
    // ---------------------------------------------------------
    // 环境立方体贴图
    unsigned int envCubemap;
    // 生成纹理
    glGenTextures(1, &envCubemap);
    // 绑定为立方体贴图
    glBindTexture(GL_TEXTURE_CUBE_MAP, envCubemap);
    // 为 6 个面各分配 512x512 的 RGB16F 浮点存储
    for (unsigned int i = 0; i < 6; ++i)
    {
        glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, GL_RGB16F, 512, 512, 0, GL_RGB, GL_FLOAT, nullptr);
    }
    // S 轴环绕方式
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    // T 轴环绕方式
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    // R 轴环绕方式
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_R, GL_CLAMP_TO_EDGE);
    // 缩小过滤方式
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    // 放大过滤方式
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

    // pbr: set up projection and view matrices for capturing data onto the 6 cubemap face directions
    // ----------------------------------------------------------------------------------------------
    // 捕获用投影矩阵：90 度 FOV，正方形
    glm::mat4 captureProjection = glm::perspective(glm::radians(90.0f), 1.0f, 0.1f, 10.0f);
    // 6 个面的视图矩阵，对应 +X -X +Y -Y +Z -Z
    glm::mat4 captureViews[] =
    {
        glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3(1.0f,  0.0f,  0.0f), glm::vec3(0.0f, -1.0f,  0.0f)),
        glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3(-1.0f,  0.0f,  0.0f), glm::vec3(0.0f, -1.0f,  0.0f)),
        glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3(0.0f,  1.0f,  0.0f), glm::vec3(0.0f,  0.0f,  1.0f)),
        glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3(0.0f, -1.0f,  0.0f), glm::vec3(0.0f,  0.0f, -1.0f)),
        glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3(0.0f,  0.0f,  1.0f), glm::vec3(0.0f, -1.0f,  0.0f)),
        glm::lookAt(glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3(0.0f,  0.0f, -1.0f), glm::vec3(0.0f, -1.0f,  0.0f))
    };

    // pbr: convert HDR equirectangular environment map to cubemap equivalent
    // ----------------------------------------------------------------------
    // 使用等距柱状到立方体贴图的转换着色器
    equirectangularToCubemapShader.use();
    // 告诉 shader 里面的 equirectangularMap 使用纹理单元 0
    equirectangularToCubemapShader.setInt("equirectangularMap", 0);
    // 把捕获投影矩阵传给 shader
    equirectangularToCubemapShader.setMat4("projection", captureProjection);
    // 激活纹理单元 0
    glActiveTexture(GL_TEXTURE0);
    // 绑定 HDR 等距柱状纹理
    glBindTexture(GL_TEXTURE_2D, hdrTexture);

    // 视口改为捕获尺寸
    glViewport(0, 0, 512, 512); // don't forget to configure the viewport to the capture dimensions.
    // 绑定捕获帧缓冲
    glBindFramebuffer(GL_FRAMEBUFFER, captureFBO);
    // 遍历立方体贴图 6 个面
    for (unsigned int i = 0; i < 6; ++i)
    {
        // 设置当前面的视图矩阵
        equirectangularToCubemapShader.setMat4("view", captureViews[i]);
        // 把立方体贴图的当前面附加到颜色附件
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, envCubemap, 0);
        // 清除颜色和深度
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        // 渲染立方体，把 HDR 图投影到该面
        renderCube();
    }
    // 解绑帧缓冲
    glBindFramebuffer(GL_FRAMEBUFFER, 0);

    // pbr: create an irradiance cubemap, and re-scale capture FBO to irradiance scale.
    // --------------------------------------------------------------------------------
    // 辐照度立方体贴图，用于漫反射 IBL
    unsigned int irradianceMap;
    // 生成纹理
    glGenTextures(1, &irradianceMap);
    // 绑定为立方体贴图
    glBindTexture(GL_TEXTURE_CUBE_MAP, irradianceMap);
    // 为 6 个面各分配 32x32 的 RGB16F 存储，辐照度图分辨率可以很低
    for (unsigned int i = 0; i < 6; ++i)
    {
        glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, GL_RGB16F, 32, 32, 0, GL_RGB, GL_FLOAT, nullptr);
    }
    // S 轴环绕方式
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    // T 轴环绕方式
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    // R 轴环绕方式
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_R, GL_CLAMP_TO_EDGE);
    // 缩小过滤方式
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    // 放大过滤方式
    glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

    // 绑定捕获帧缓冲
    glBindFramebuffer(GL_FRAMEBUFFER, captureFBO);
    // 绑定捕获渲染缓冲
    glBindRenderbuffer(GL_RENDERBUFFER, captureRBO);
    // 深度存储也调整为 32x32
    glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH_COMPONENT24, 32, 32);

    // pbr: solve diffuse integral by convolution to create an irradiance (cube)map.
    // -----------------------------------------------------------------------------
    // 使用辐照度卷积着色器
    irradianceShader.use();
    // 告诉 shader 里面的 environmentMap 使用纹理单元 0
    irradianceShader.setInt("environmentMap", 0);
    // 把捕获投影矩阵传给 shader
    irradianceShader.setMat4("projection", captureProjection);
    // 激活纹理单元 0
    glActiveTexture(GL_TEXTURE0);
    // 绑定环境立方体贴图作为输入
    glBindTexture(GL_TEXTURE_CUBE_MAP, envCubemap);

    // 视口改为辐照度图尺寸
    glViewport(0, 0, 32, 32); // don't forget to configure the viewport to the capture dimensions.
    // 绑定捕获帧缓冲
    glBindFramebuffer(GL_FRAMEBUFFER, captureFBO);
    // 遍历 6 个面
    for (unsigned int i = 0; i < 6; ++i)
    {
        // 设置当前面的视图矩阵
        irradianceShader.setMat4("view", captureViews[i]);
        // 把辐照度图的当前面附加到颜色附件
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, irradianceMap, 0);
        // 清除颜色和深度
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        // 渲染立方体，卷积计算辐照度
        renderCube();
    }
    // 解绑帧缓冲
    glBindFramebuffer(GL_FRAMEBUFFER, 0);

    // initialize static shader uniforms before rendering
    // --------------------------------------------------
    // 投影矩阵：透视投影
    glm::mat4 projection = glm::perspective(glm::radians(camera.Zoom), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
    // 使用 PBR 着色器
    pbrShader.use();
    // 把投影矩阵传给 shader
    pbrShader.setMat4("projection", projection);
    // 使用背景着色器
    backgroundShader.use();
    // 把投影矩阵传给 shader
    backgroundShader.setMat4("projection", projection);

    // then before rendering, configure the viewport to the original framebuffer's screen dimensions
    // 恢复视口为窗口大小
    int scrWidth, scrHeight;
    glfwGetFramebufferSize(window, &scrWidth, &scrHeight);
    glViewport(0, 0, scrWidth, scrHeight);

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
        // 设置清屏颜色
        glClearColor(0.2f, 0.3f, 0.3f, 1.0f);
        // 清除颜色缓冲和深度缓冲
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        // render scene, supplying the convoluted irradiance map to the final shader.
        // ------------------------------------------------------------------------------------------
        // 使用 PBR 着色器
        pbrShader.use();
        // 视图矩阵：来自相机
        glm::mat4 view = camera.GetViewMatrix();
        // 把视图矩阵传给 shader
        pbrShader.setMat4("view", view);
        // 把相机位置传给 shader
        pbrShader.setVec3("camPos", camera.Position);

        // bind pre-computed IBL data
        // 激活纹理单元 0
        glActiveTexture(GL_TEXTURE0);
        // 绑定预先计算好的辐照度图
        glBindTexture(GL_TEXTURE_CUBE_MAP, irradianceMap);

        // render rows*column number of spheres with varying metallic/roughness values scaled by rows and columns respectively
        // 渲染一行行一列列的球体，金属度按行变化，粗糙度按列变化
        glm::mat4 model = glm::mat4(1.0f);
        // 遍历每一行
        for (int row = 0; row < nrRows; ++row)
        {
            // 金属度：从 0 到 1 按行递增
            pbrShader.setFloat("metallic", (float)row / (float)nrRows);
            // 遍历每一列
            for (int col = 0; col < nrColumns; ++col)
            {
                // we clamp the roughness to 0.025 - 1.0 as perfectly smooth surfaces (roughness of 0.0) tend to look a bit off
                // on direct lighting.
                // 粗糙度：从 0 到 1 按列递增，下限钳制到 0.05，避免完全镜面
                pbrShader.setFloat("roughness", glm::clamp((float)col / (float)nrColumns, 0.05f, 1.0f));

                // 模型矩阵：单位矩阵
                model = glm::mat4(1.0f);
                // 平移到网格位置，居中排列
                model = glm::translate(model, glm::vec3(
                    (float)(col - (nrColumns / 2)) * spacing,
                    (float)(row - (nrRows / 2)) * spacing,
                    -2.0f
                ));
                // 把模型矩阵传给 shader
                pbrShader.setMat4("model", model);
                // 把法线矩阵传给 shader
                pbrShader.setMat3("normalMatrix", glm::transpose(glm::inverse(glm::mat3(model))));
                // 渲染球体
                renderSphere();
            }
        }


        // render light source (simply re-render sphere at light positions)
        // this looks a bit off as we use the same shader, but it'll make their positions obvious and 
        // keeps the codeprint small.
        // 用同样的球体渲染光源位置，方便看到光源
        for (unsigned int i = 0; i < sizeof(lightPositions) / sizeof(lightPositions[0]); ++i)
        {
            // 让光源左右摆动（但随后被下面一行覆盖，实际位置固定）
            glm::vec3 newPos = lightPositions[i] + glm::vec3(sin(glfwGetTime() * 5.0) * 5.0, 0.0, 0.0);
            // 用固定位置覆盖，所以光源不动
            newPos = lightPositions[i];
            // 把第 i 个光源位置传给 shader
            pbrShader.setVec3("lightPositions[" + std::to_string(i) + "]", newPos);
            // 把第 i 个光源颜色传给 shader
            pbrShader.setVec3("lightColors[" + std::to_string(i) + "]", lightColors[i]);

            // 模型矩阵：单位矩阵
            model = glm::mat4(1.0f);
            // 平移到光源位置
            model = glm::translate(model, newPos);
            // 缩小到 0.5 倍
            model = glm::scale(model, glm::vec3(0.5f));
            // 把模型矩阵传给 shader
            pbrShader.setMat4("model", model);
            // 把法线矩阵传给 shader
            pbrShader.setMat3("normalMatrix", glm::transpose(glm::inverse(glm::mat3(model))));
            // 渲染球体作为光源可视化
            renderSphere();
        }

        // render skybox (render as last to prevent overdraw)
        // 用背景着色器绘制天空盒，最后绘制避免过度绘制
        backgroundShader.use();
        // 把视图矩阵传给 shader
        backgroundShader.setMat4("view", view);
        // 激活纹理单元 0
        glActiveTexture(GL_TEXTURE0);
        // 绑定环境立方体贴图
        glBindTexture(GL_TEXTURE_CUBE_MAP, envCubemap);
        //glBindTexture(GL_TEXTURE_CUBE_MAP, irradianceMap); // display irradiance map
        // 渲染立方体，作为天空盒
        renderCube();


        // glfw: swap buffers and poll IO events (keys pressed/released, mouse moved etc.)
        // -------------------------------------------------------------------------------
        // 交换前后缓冲
        glfwSwapBuffers(window);
        // 处理事件
        glfwPollEvents();
    }

    // glfw: terminate, clearing all previously allocated GLFW resources.
    // ------------------------------------------------------------------
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

// renders (and builds at first invocation) a sphere
// -------------------------------------------------
// 球体 VAO 和索引数量
unsigned int sphereVAO = 0;
unsigned int indexCount;
// 渲染一个球体，第一次调用时构建球体网格
void renderSphere()
{
    // 如果还没构建球体
    if (sphereVAO == 0)
    {
        // 生成 VAO
        glGenVertexArrays(1, &sphereVAO);

        // 顶点缓冲和索引缓冲
        unsigned int vbo, ebo;
        // 生成 VBO
        glGenBuffers(1, &vbo);
        // 生成 EBO
        glGenBuffers(1, &ebo);

        // 位置、纹理坐标、法线、索引数据
        std::vector<glm::vec3> positions;
        std::vector<glm::vec2> uv;
        std::vector<glm::vec3> normals;
        std::vector<unsigned int> indices;

        // 经度方向分段数
        const unsigned int X_SEGMENTS = 64;
        // 纬度方向分段数
        const unsigned int Y_SEGMENTS = 64;
        // 圆周率
        const float PI = 3.14159265359f;
        // 遍历经度
        for (unsigned int x = 0; x <= X_SEGMENTS; ++x)
        {
            // 遍历纬度
            for (unsigned int y = 0; y <= Y_SEGMENTS; ++y)
            {
                // 经度归一化参数
                float xSegment = (float)x / (float)X_SEGMENTS;
                // 纬度归一化参数
                float ySegment = (float)y / (float)Y_SEGMENTS;
                // 球面坐标转笛卡尔坐标：x
                float xPos = std::cos(xSegment * 2.0f * PI) * std::sin(ySegment * PI);
                // 球面坐标转笛卡尔坐标：y
                float yPos = std::cos(ySegment * PI);
                // 球面坐标转笛卡尔坐标：z
                float zPos = std::sin(xSegment * 2.0f * PI) * std::sin(ySegment * PI);

                // 保存位置
                positions.push_back(glm::vec3(xPos, yPos, zPos));
                // 保存纹理坐标
                uv.push_back(glm::vec2(xSegment, ySegment));
                // 球体法线就是归一化的位置
                normals.push_back(glm::vec3(xPos, yPos, zPos));
            }
        }

        // 是否奇数行标记，用于生成三角形带索引
        bool oddRow = false;
        // 遍历纬度行
        for (unsigned int y = 0; y < Y_SEGMENTS; ++y)
        {
            // 偶数行
            if (!oddRow) // even rows: y == 0, y == 2; and so on
            {
                // 从左到右生成索引
                for (unsigned int x = 0; x <= X_SEGMENTS; ++x)
                {
                    // 当前行顶点
                    indices.push_back(y * (X_SEGMENTS + 1) + x);
                    // 下一行顶点
                    indices.push_back((y + 1) * (X_SEGMENTS + 1) + x);
                }
            }
            // 奇数行
            else
            {
                // 从右到左生成索引
                for (int x = X_SEGMENTS; x >= 0; --x)
                {
                    // 下一行顶点
                    indices.push_back((y + 1) * (X_SEGMENTS + 1) + x);
                    // 当前行顶点
                    indices.push_back(y * (X_SEGMENTS + 1) + x);
                }
            }
            // 切换奇偶行
            oddRow = !oddRow;
        }
        // 保存索引数量
        indexCount = static_cast<unsigned int>(indices.size());

        // 交错顶点数据
        std::vector<float> data;
        // 遍历所有顶点
        for (unsigned int i = 0; i < positions.size(); ++i)
        {
            // 位置 x
            data.push_back(positions[i].x);
            // 位置 y
            data.push_back(positions[i].y);
            // 位置 z
            data.push_back(positions[i].z);
            // 如果有法线
            if (normals.size() > 0)
            {
                // 法线 x
                data.push_back(normals[i].x);
                // 法线 y
                data.push_back(normals[i].y);
                // 法线 z
                data.push_back(normals[i].z);
            }
            // 如果有纹理坐标
            if (uv.size() > 0)
            {
                // 纹理坐标 u
                data.push_back(uv[i].x);
                // 纹理坐标 v
                data.push_back(uv[i].y);
            }
        }
        // 绑定球体 VAO
        glBindVertexArray(sphereVAO);
        // 绑定 VBO
        glBindBuffer(GL_ARRAY_BUFFER, vbo);
        // 上传顶点数据
        glBufferData(GL_ARRAY_BUFFER, data.size() * sizeof(float), &data[0], GL_STATIC_DRAW);
        // 绑定 EBO
        glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, ebo);
        // 上传索引数据
        glBufferData(GL_ELEMENT_ARRAY_BUFFER, indices.size() * sizeof(unsigned int), &indices[0], GL_STATIC_DRAW);
        // 顶点步长：位置 3 + 法线 3 + 纹理 2
        unsigned int stride = (3 + 2 + 3) * sizeof(float);
        // 启用顶点属性 0：位置
        glEnableVertexAttribArray(0);
        // 位置属性配置
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, stride, (void*)0);
        // 启用顶点属性 1：法线
        glEnableVertexAttribArray(1);
        // 法线属性配置
        glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, stride, (void*)(3 * sizeof(float)));
        // 启用顶点属性 2：纹理坐标
        glEnableVertexAttribArray(2);
        // 纹理坐标属性配置
        glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, stride, (void*)(6 * sizeof(float)));
    }

    // 绑定球体 VAO
    glBindVertexArray(sphereVAO);
    // 用三角形带绘制球体
    glDrawElements(GL_TRIANGLE_STRIP, indexCount, GL_UNSIGNED_INT, 0);
}

// renderCube() renders a 1x1 3D cube in NDC.
// -------------------------------------------------
// 立方体 VAO、VBO
unsigned int cubeVAO = 0;
unsigned int cubeVBO = 0;
// 渲染一个 1x1x1 的立方体
void renderCube()
{
    // initialize (if necessary)
    // 如果还没有初始化
    if (cubeVAO == 0)
    {
        // 立方体顶点数据：位置(3) + 法线(3) + 纹理坐标(2)
        float vertices[] = {
            // back face
            -1.0f, -1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 0.0f, 0.0f, // bottom-left
             1.0f,  1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 1.0f, 1.0f, // top-right
             1.0f, -1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 1.0f, 0.0f, // bottom-right         
             1.0f,  1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 1.0f, 1.0f, // top-right
            -1.0f, -1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 0.0f, 0.0f, // bottom-left
            -1.0f,  1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 0.0f, 1.0f, // top-left
            // front face
            -1.0f, -1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 0.0f, 0.0f, // bottom-left
             1.0f, -1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 1.0f, 0.0f, // bottom-right
             1.0f,  1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 1.0f, 1.0f, // top-right
             1.0f,  1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 1.0f, 1.0f, // top-right
            -1.0f,  1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 0.0f, 1.0f, // top-left
            -1.0f, -1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 0.0f, 0.0f, // bottom-left
            // left face
            -1.0f,  1.0f,  1.0f, -1.0f,  0.0f,  0.0f, 1.0f, 0.0f, // top-right
            -1.0f,  1.0f, -1.0f, -1.0f,  0.0f,  0.0f, 1.0f, 1.0f, // top-left
            -1.0f, -1.0f, -1.0f, -1.0f,  0.0f,  0.0f, 0.0f, 1.0f, // bottom-left
            -1.0f, -1.0f, -1.0f, -1.0f,  0.0f,  0.0f, 0.0f, 1.0f, // bottom-left
            -1.0f, -1.0f,  1.0f, -1.0f,  0.0f,  0.0f, 0.0f, 0.0f, // bottom-right
            -1.0f,  1.0f,  1.0f, -1.0f,  0.0f,  0.0f, 1.0f, 0.0f, // top-right
            // right face
             1.0f,  1.0f,  1.0f,  1.0f,  0.0f,  0.0f, 1.0f, 0.0f, // top-left
             1.0f, -1.0f, -1.0f,  1.0f,  0.0f,  0.0f, 0.0f, 1.0f, // bottom-right
             1.0f,  1.0f, -1.0f,  1.0f,  0.0f,  0.0f, 1.0f, 1.0f, // top-right         
             1.0f, -1.0f, -1.0f,  1.0f,  0.0f,  0.0f, 0.0f, 1.0f, // bottom-right
             1.0f,  1.0f,  1.0f,  1.0f,  0.0f,  0.0f, 1.0f, 0.0f, // top-left
             1.0f, -1.0f,  1.0f,  1.0f,  0.0f,  0.0f, 0.0f, 0.0f, // bottom-left     
             // bottom face
             -1.0f, -1.0f, -1.0f,  0.0f, -1.0f,  0.0f, 0.0f, 1.0f, // top-right
              1.0f, -1.0f, -1.0f,  0.0f, -1.0f,  0.0f, 1.0f, 1.0f, // top-left
              1.0f, -1.0f,  1.0f,  0.0f, -1.0f,  0.0f, 1.0f, 0.0f, // bottom-left
              1.0f, -1.0f,  1.0f,  0.0f, -1.0f,  0.0f, 1.0f, 0.0f, // bottom-left
             -1.0f, -1.0f,  1.0f,  0.0f, -1.0f,  0.0f, 0.0f, 0.0f, // bottom-right
             -1.0f, -1.0f, -1.0f,  0.0f, -1.0f,  0.0f, 0.0f, 1.0f, // top-right
             // top face
             -1.0f,  1.0f, -1.0f,  0.0f,  1.0f,  0.0f, 0.0f, 1.0f, // top-left
              1.0f,  1.0f , 1.0f,  0.0f,  1.0f,  0.0f, 1.0f, 0.0f, // bottom-right
              1.0f,  1.0f, -1.0f,  0.0f,  1.0f,  0.0f, 1.0f, 1.0f, // top-right     
              1.0f,  1.0f,  1.0f,  0.0f,  1.0f,  0.0f, 1.0f, 0.0f, // bottom-right
             -1.0f,  1.0f, -1.0f,  0.0f,  1.0f,  0.0f, 0.0f, 1.0f, // top-left
             -1.0f,  1.0f,  1.0f,  0.0f,  1.0f,  0.0f, 0.0f, 0.0f  // bottom-left        
        };
        // 生成立方体 VAO
        glGenVertexArrays(1, &cubeVAO);
        // 生成立方体 VBO
        glGenBuffers(1, &cubeVBO);
        // fill buffer
        // 绑定立方体 VBO
        glBindBuffer(GL_ARRAY_BUFFER, cubeVBO);
        // 上传立方体顶点数据
        glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
        // link vertex attributes
        // 绑定立方体 VAO
        glBindVertexArray(cubeVAO);
        // 启用顶点属性 0：位置
        glEnableVertexAttribArray(0);
        // 位置属性配置
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)0);
        // 启用顶点属性 1：法线
        glEnableVertexAttribArray(1);
        // 法线属性配置
        glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(3 * sizeof(float)));
        // 启用顶点属性 2：纹理坐标
        glEnableVertexAttribArray(2);
        // 纹理坐标属性配置
        glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(6 * sizeof(float)));
        // 解绑 VBO
        glBindBuffer(GL_ARRAY_BUFFER, 0);
        // 解绑 VAO
        glBindVertexArray(0);
    }
    // render Cube
    // 绑定立方体 VAO
    glBindVertexArray(cubeVAO);
    // 绘制立方体，36 个顶点
    glDrawArrays(GL_TRIANGLES, 0, 36);
    // 解绑 VAO
    glBindVertexArray(0);
}