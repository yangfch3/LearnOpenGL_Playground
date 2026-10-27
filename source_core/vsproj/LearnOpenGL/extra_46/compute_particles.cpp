// Compute 粒子：粒子状态常驻 GPU 的 SSBO，compute 每帧更新，VS 直接从同一 SSBO 读出绘制
// 知识点：SSBO / std430、一维 dispatch、SSBO 写后读的屏障、vertex pulling、glNamedBufferStorage
//
// 对比 asteroids_instanced.cpp：那里实例数据由 CPU 生成后上传、此后不变；
// 这里数据只在初始化上传一次，之后 CPU 完全不碰，100 万粒子的模拟也不占 CPU 和总线带宽
#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>

#include <learnopengl/shader.h>
#include <learnopengl/compute_shader.h>
#include <learnopengl/gl_debug.h>

#include <algorithm>
#include <cmath>
#include <iostream>
#include <random>
#include <string>
#include <vector>

extern "C" { __declspec(dllexport) unsigned long NvOptimusEnablement = 1; }

const unsigned int SCR_WIDTH = 1280;
const unsigned int SCR_HEIGHT = 720;
const unsigned int PARTICLE_COUNT = 1000000;
// 与 extra46.particles.comp 的 local_size_x 一致
const unsigned int LOCAL_SIZE = 256;

// 与着色器中 std430 的 struct Particle 逐字节对应
struct Particle
{
    glm::vec4 pos;
    glm::vec4 vel;
};

int main()
{
    glfwInit();
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 4);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 6);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
    glfwWindowHint(GLFW_OPENGL_DEBUG_CONTEXT, GL_TRUE);
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

    Shader renderShader("shaders/extra46.particles.vs", "shaders/extra46.particles.fs");
    ComputeShader computeShader("shaders/extra46.particles.comp");

    // 初始状态：球壳内随机分布，带一点绕 y 轴的切向速度，形成旋涡
    std::vector<Particle> particles(PARTICLE_COUNT);
    std::mt19937 rng(7);
    std::uniform_real_distribution<float> uni(-1.0f, 1.0f);
    for (Particle& pt : particles)
    {
        glm::vec3 p;
        do { p = glm::vec3(uni(rng), uni(rng), uni(rng)); } while (glm::dot(p, p) > 1.0f);
        p *= 8.0f;
        pt.pos = glm::vec4(p, 1.0f);
        pt.vel = glm::vec4(glm::vec3(-p.z, 0.0f, p.x) * 0.3f, 0.0f);
    }

    // 不可变存储：大小一次定死。flags = 0 表示 CPU 之后不再读写（不能 Map、不能 SubData），
    // 只限制 CPU 端；GPU 端照样可以作为 SSBO 读写。驱动据此可把它放在纯显存里
    unsigned int particleBuffer;
    glCreateBuffers(1, &particleBuffer);
    glNamedBufferStorage(particleBuffer, sizeof(Particle) * particles.size(), particles.data(), 0);
    // 绑定到 SSBO 绑定点 0，compute 和 VS 里的 binding = 0 都指向它
    glBindBufferBase(GL_SHADER_STORAGE_BUFFER, 0, particleBuffer);

    unsigned int emptyVAO;
    glCreateVertexArrays(1, &emptyVAO);

    glEnable(GL_PROGRAM_POINT_SIZE);
    // 加性混合：与绘制顺序无关，粒子不必排序；也不写深度
    glEnable(GL_BLEND);
    glBlendFunc(GL_ONE, GL_ONE);
    glDisable(GL_DEPTH_TEST);

    glm::mat4 projection = glm::perspective(glm::radians(45.0f), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 200.0f);

    glfwSwapInterval(0);
    float lastFrame = (float)glfwGetTime();
    double lastTitleTime = 0.0;
    int frameCount = 0;

    while (!glfwWindowShouldClose(window))
    {
        if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS)
            glfwSetWindowShouldClose(window, true);

        float now = (float)glfwGetTime();
        // 卡顿（如拖动窗口）时 dt 过大会让积分发散，限制上限
        float dt = std::min(now - lastFrame, 1.0f / 30.0f);
        lastFrame = now;

        // 吸引点沿李萨如曲线移动
        glm::vec3 attractor(6.0f * std::sin(now * 0.7f), 3.0f * std::sin(now * 1.1f), 6.0f * std::cos(now * 0.5f));

        // 1. 模拟
        computeShader.use();
        computeShader.setFloat("dt", dt);
        computeShader.setVec3("attractor", attractor);
        computeShader.setUInt("particleCount", PARTICLE_COUNT);
        glDispatchCompute((PARTICLE_COUNT + LOCAL_SIZE - 1) / LOCAL_SIZE, 1, 1);

        // 2. 屏障：之后 VS 通过 SSBO 读取，所以是 SHADER_STORAGE；
        // 若把该 buffer 当 VBO 读（glVertexAttribPointer 那套），则应是 VERTEX_ATTRIB_ARRAY
        glMemoryBarrier(GL_SHADER_STORAGE_BARRIER_BIT);

        // 3. 绘制：相机绕原点缓慢旋转
        glm::vec3 eye(30.0f * std::sin(now * 0.1f), 12.0f, 30.0f * std::cos(now * 0.1f));
        glm::mat4 view = glm::lookAt(eye, glm::vec3(0.0f), glm::vec3(0.0f, 1.0f, 0.0f));

        glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT);
        renderShader.use();
        renderShader.setMat4("viewProj", projection * view);
        glBindVertexArray(emptyVAO);
        glDrawArrays(GL_POINTS, 0, PARTICLE_COUNT);

        glfwSwapBuffers(window);
        glfwPollEvents();

        ++frameCount;
        if (now - lastTitleTime >= 0.5)
        {
            std::string title = "compute_particles  " + std::to_string(PARTICLE_COUNT) + " particles  "
                              + std::to_string(1000.0 * (now - lastTitleTime) / frameCount) + " ms";
            glfwSetWindowTitle(window, title.c_str());
            lastTitleTime = now;
            frameCount = 0;
        }
    }

    glDeleteBuffers(1, &particleBuffer);
    glDeleteVertexArrays(1, &emptyVAO);
    glfwTerminate();
    return 0;
}
