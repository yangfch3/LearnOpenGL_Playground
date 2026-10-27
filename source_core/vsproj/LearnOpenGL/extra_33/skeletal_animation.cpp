// 骨骼动画：Assimp 读取骨骼/权重/关键帧，CPU 插值出骨骼矩阵，VS 里做 GPU 蒙皮
// 数据流：Model(顶点骨骼 ID/权重 + 逆绑定矩阵) -> Animation(层级 + 轨道) -> Animator(每帧蒙皮矩阵) -> uniform
#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>

#include <learnopengl/shader.h>
#include <learnopengl/camera.h>
#include <learnopengl/model_animation.h>
#include <learnopengl/animation.h>
#include <learnopengl/animator.h>

#include <iostream>
#include <string>

void framebuffer_size_callback(GLFWwindow* window, int width, int height);
void mouse_callback(GLFWwindow* window, double xpos, double ypos);
void scroll_callback(GLFWwindow* window, double xoffset, double yoffset);
void processInput(GLFWwindow* window);

const unsigned int SCR_WIDTH = 800;
const unsigned int SCR_HEIGHT = 600;

Camera camera(glm::vec3(0.0f, 0.0f, 3.0f));
float lastX = SCR_WIDTH / 2.0f;
float lastY = SCR_HEIGHT / 2.0f;
bool firstMouse = true;

float deltaTime = 0.0f;
float lastFrame = 0.0f;

int main()
{
    glfwInit();
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

    GLFWwindow* window = glfwCreateWindow(SCR_WIDTH, SCR_HEIGHT, "LearnOpenGL", NULL, NULL);
    if (window == NULL)
    {
        std::cout << "Failed to create GLFW window" << std::endl;
        glfwTerminate();
        return -1;
    }
    glfwMakeContextCurrent(window);
    glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);
    glfwSetCursorPosCallback(window, mouse_callback);
    glfwSetScrollCallback(window, scroll_callback);
    glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);

    if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress))
    {
        std::cout << "Failed to initialize GLAD" << std::endl;
        return -1;
    }

    // 100 个 mat4 = 1600 个分量，GL 3.3 只保证 1024；超限时着色器链接会失败
    GLint maxVertUniforms = 0;
    glGetIntegerv(GL_MAX_VERTEX_UNIFORM_COMPONENTS, &maxVertUniforms);
    std::cout << "GL_MAX_VERTEX_UNIFORM_COMPONENTS = " << maxVertUniforms << std::endl;

    glEnable(GL_DEPTH_TEST);

    Shader shader("shaders/extra.skeletal_animation.vs", "shaders/extra.skeletal_animation.fs");

    // model_animation.h 已开启 aiProcess_FlipUVs，这里不再让 stb_image 翻转
    const std::string modelPath = "resources/objects/vampire/dancing_vampire.dae";
    Model ourModel(modelPath);
    // 动画与模型同文件；也可以从只含动画的文件加载，只要骨骼名一致
    Animation danceAnimation(modelPath, &ourModel);
    Animator animator(&danceAnimation);
    std::cout << "bones: " << ourModel.GetBoneCount() << " (MAX_BONES = " << MAX_BONES << ")" << std::endl;

    const glm::vec3 lightDir = glm::normalize(glm::vec3(0.3f, 1.0f, 0.6f));

    while (!glfwWindowShouldClose(window))
    {
        float currentFrame = static_cast<float>(glfwGetTime());
        deltaTime = currentFrame - lastFrame;
        lastFrame = currentFrame;

        processInput(window);
        // CPU 侧：推进时间、插值关键帧、沿层级累乘出每根骨骼的蒙皮矩阵
        animator.UpdateAnimation(deltaTime);

        glClearColor(0.05f, 0.05f, 0.05f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        shader.use();
        glm::mat4 projection = glm::perspective(glm::radians(camera.Zoom), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
        shader.setMat4("projection", projection);
        shader.setMat4("view", camera.GetViewMatrix());
        shader.setVec3("lightDir", lightDir);

        // 每帧逐个上传 100 个矩阵：拼字符串 + glGetUniformLocation + glUniform 各 100 次，开销不小。
        // 实际项目会缓存 location，或用一次 glUniformMatrix4fv(loc, 100, ...) 整组上传，或放进 UBO
        const std::vector<glm::mat4>& transforms = animator.GetFinalBoneMatrices();
        for (int i = 0; i < (int)transforms.size(); ++i)
            shader.setMat4("finalBonesMatrices[" + std::to_string(i) + "]", transforms[i]);

        glm::mat4 model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(0.0f, -0.4f, 0.0f));
        model = glm::scale(model, glm::vec3(0.5f));
        shader.setMat4("model", model);
        // GPU 侧：VBO 里始终是绑定姿势的顶点，从不改写；变形完全在 VS 中按骨骼矩阵完成
        ourModel.Draw(shader);

        glfwSwapBuffers(window);
        glfwPollEvents();
    }

    glfwTerminate();
    return 0;
}

void processInput(GLFWwindow* window)
{
    if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS)
        glfwSetWindowShouldClose(window, true);

    if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS)
        camera.ProcessKeyboard(FORWARD, deltaTime);
    if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS)
        camera.ProcessKeyboard(BACKWARD, deltaTime);
    if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS)
        camera.ProcessKeyboard(LEFT, deltaTime);
    if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS)
        camera.ProcessKeyboard(RIGHT, deltaTime);
}

void framebuffer_size_callback(GLFWwindow* window, int width, int height)
{
    glViewport(0, 0, width, height);
}

void mouse_callback(GLFWwindow* window, double xposIn, double yposIn)
{
    float xpos = static_cast<float>(xposIn);
    float ypos = static_cast<float>(yposIn);
    if (firstMouse)
    {
        lastX = xpos;
        lastY = ypos;
        firstMouse = false;
    }
    float xoffset = xpos - lastX;
    float yoffset = lastY - ypos;
    lastX = xpos;
    lastY = ypos;
    camera.ProcessMouseMovement(xoffset, yoffset);
}

void scroll_callback(GLFWwindow* window, double xoffset, double yoffset)
{
    camera.ProcessMouseScroll(static_cast<float>(yoffset));
}
