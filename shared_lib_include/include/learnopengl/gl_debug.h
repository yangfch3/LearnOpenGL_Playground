#ifndef GL_DEBUG_H
#define GL_DEBUG_H

#include <glad/glad.h>
#include <iostream>

// Debug Output（GL 4.3 核心）：驱动主动回调报告错误、未定义行为、性能警告，
// 替代逐条 glGetError 轮询，且消息里会写明具体原因（哪个参数、哪个对象）。
// 前提：创建窗口前 glfwWindowHint(GLFW_OPENGL_DEBUG_CONTEXT, GL_TRUE)
inline void APIENTRY glDebugOutput(GLenum source, GLenum type, GLuint id, GLenum severity,
                                   GLsizei length, const GLchar* message, const void* userParam)
{
    // NOTIFICATION 多为资源信息（如 NVIDIA 131185「buffer 将放在显存」），刷屏且无害
    if (severity == GL_DEBUG_SEVERITY_NOTIFICATION)
        return;

    const char* sev = severity == GL_DEBUG_SEVERITY_HIGH   ? "HIGH"
                    : severity == GL_DEBUG_SEVERITY_MEDIUM ? "MEDIUM" : "LOW";
    const char* typ = type == GL_DEBUG_TYPE_ERROR               ? "ERROR"
                    : type == GL_DEBUG_TYPE_UNDEFINED_BEHAVIOR  ? "UNDEFINED"
                    : type == GL_DEBUG_TYPE_PERFORMANCE         ? "PERFORMANCE"
                    : type == GL_DEBUG_TYPE_DEPRECATED_BEHAVIOR ? "DEPRECATED" : "OTHER";
    std::cout << "[GL " << sev << " " << typ << " " << id << "] " << message << std::endl;
}

// 打印实际使用的显卡与版本，并在 debug 上下文下注册回调
inline void setupGLDebug()
{
    std::cout << "GL_RENDERER: " << glGetString(GL_RENDERER) << "\n"
              << "GL_VERSION:  " << glGetString(GL_VERSION) << std::endl;

    GLint flags = 0;
    glGetIntegerv(GL_CONTEXT_FLAGS, &flags);
    if (!(flags & GL_CONTEXT_FLAG_DEBUG_BIT))
    {
        std::cout << "debug context not available" << std::endl;
        return;
    }
    glEnable(GL_DEBUG_OUTPUT);
    // 同步模式：回调在出错的那条 GL 调用内部触发，在回调里下断点即可看到出错位置的调用栈（有性能损耗，仅调试用）
    glEnable(GL_DEBUG_OUTPUT_SYNCHRONOUS);
    glDebugMessageCallback(glDebugOutput, nullptr);
}

#endif
