// Compute Shader 入门：计算着色器用 imageStore 写纹理，再用普通 VS/FS 把纹理画到屏幕
// 知识点：工作组与线程索引、image load/store、glDispatchCompute、glMemoryBarrier、DSA 创建纹理
//
// 每帧流程：
//   compute（写 image）-> 内存屏障 -> 全屏三角形采样该纹理
#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <learnopengl/shader.h>
#include <learnopengl/compute_shader.h>
#include <learnopengl/gl_debug.h>

#include <iostream>

// 双显卡笔记本上让 NVIDIA 驱动默认选用独显（驱动在 exe 的导出表里查这个符号）
extern "C" { __declspec(dllexport) unsigned long NvOptimusEnablement = 1; }

const unsigned int SCR_WIDTH = 1280;
const unsigned int SCR_HEIGHT = 720;
// 与 extra46.julia.comp 的 local_size 一致
const unsigned int LOCAL_SIZE = 16;

int main()
{
    glfwInit();
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 4);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 6);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
    glfwWindowHint(GLFW_OPENGL_DEBUG_CONTEXT, GL_TRUE);
    // extra_46 的 demo 均固定窗口尺寸，省去 FBO/纹理随窗口重建的代码
    glfwWindowHint(GLFW_RESIZABLE, GL_FALSE);

    GLFWwindow* window = glfwCreateWindow(SCR_WIDTH, SCR_HEIGHT, "LearnOpenGL", NULL, NULL);
    if (window == NULL)
    {
        std::cout << "Failed to create GLFW window" << std::endl;
        glfwTerminate();
        return -1;
    }
    glfwMakeContextCurrent(window);

    if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress))
    {
        std::cout << "Failed to initialize GLAD" << std::endl;
        return -1;
    }
    setupGLDebug();

    // 硬件限制：每维工作组数量上限、单个工作组每维线程数上限、单个工作组总线程数上限
    int groupCount[3], groupSize[3], maxInvocations;
    for (int i = 0; i < 3; ++i)
    {
        glGetIntegeri_v(GL_MAX_COMPUTE_WORK_GROUP_COUNT, i, &groupCount[i]);
        glGetIntegeri_v(GL_MAX_COMPUTE_WORK_GROUP_SIZE, i, &groupSize[i]);
    }
    glGetIntegerv(GL_MAX_COMPUTE_WORK_GROUP_INVOCATIONS, &maxInvocations);
    std::cout << "max work group count: " << groupCount[0] << ", " << groupCount[1] << ", " << groupCount[2] << "\n"
              << "max work group size:  " << groupSize[0] << ", " << groupSize[1] << ", " << groupSize[2] << "\n"
              << "max invocations:      " << maxInvocations << std::endl;

    Shader screenShader("shaders/extra46.fullscreen.vs", "shaders/extra46.texture.fs");
    ComputeShader computeShader("shaders/extra46.julia.comp");

    // DSA（Direct State Access, 4.5）：函数直接接收对象名，不必先 glBind 再操作。
    // 旧写法 glGenTextures + glBindTexture + glTexImage2D 会改动全局绑定状态，容易误伤其他代码
    unsigned int texture;
    glCreateTextures(GL_TEXTURE_2D, 1, &texture);
    // 不可变存储（immutable storage）：一次性分配好尺寸、格式与 mip 层数，之后不能再改。
    // 驱动无需追踪格式变化，也是 image 绑定的推荐用法
    glTextureStorage2D(texture, 1, GL_RGBA32F, SCR_WIDTH, SCR_HEIGHT);
    glTextureParameteri(texture, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTextureParameteri(texture, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTextureParameteri(texture, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTextureParameteri(texture, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);

    // 同一张纹理两种用法：作为 image 绑到 image 单元 0 给 compute 写，作为 sampler 绑到纹理单元 0 给 FS 读。
    // image 单元和纹理单元是两套独立的绑定点
    glBindImageTexture(0, texture, 0, GL_FALSE, 0, GL_WRITE_ONLY, GL_RGBA32F);
    glBindTextureUnit(0, texture);

    // 核心模式下 glDrawArrays 必须绑定一个 VAO，哪怕全屏三角形不读任何顶点属性
    unsigned int emptyVAO;
    glCreateVertexArrays(1, &emptyVAO);

    // 关垂直同步，标题栏显示的帧时间才能反映真实开销
    glfwSwapInterval(0);
    double lastTitleTime = 0.0;
    int frameCount = 0;

    while (!glfwWindowShouldClose(window))
    {
        if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS)
            glfwSetWindowShouldClose(window, true);

        // 1. 计算：工作组数向上取整，保证覆盖每个像素
        computeShader.use();
        computeShader.setFloat("time", (float)glfwGetTime());
        glDispatchCompute((SCR_WIDTH + LOCAL_SIZE - 1) / LOCAL_SIZE, (SCR_HEIGHT + LOCAL_SIZE - 1) / LOCAL_SIZE, 1);

        // 2. 屏障：imageStore 属于「非一致性写入」，GL 不会自动保证后续命令能看到结果。
        // 屏障位描述的是「之后要怎么读」：这里 FS 通过 sampler 采样，所以是 TEXTURE_FETCH；
        // 若之后仍用 imageLoad 读，则应是 SHADER_IMAGE_ACCESS
        glMemoryBarrier(GL_TEXTURE_FETCH_BARRIER_BIT);

        // 3. 显示
        glClear(GL_COLOR_BUFFER_BIT);
        screenShader.use();
        glBindVertexArray(emptyVAO);
        glDrawArrays(GL_TRIANGLES, 0, 3);

        glfwSwapBuffers(window);
        glfwPollEvents();

        ++frameCount;
        double now = glfwGetTime();
        if (now - lastTitleTime >= 0.5)
        {
            std::string title = "compute_image  " + std::to_string(1000.0 * (now - lastTitleTime) / frameCount) + " ms";
            glfwSetWindowTitle(window, title.c_str());
            lastTitleTime = now;
            frameCount = 0;
        }
    }

    glDeleteTextures(1, &texture);
    glDeleteVertexArrays(1, &emptyVAO);
    glfwTerminate();
    return 0;
}
