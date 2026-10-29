// P3 原生 OpenGL 离线渲染：Phong 光照球，逐帧 glReadPixels → stdout（直通 alpha 的 RGBA，交给 ffmpeg）
// 用法：p3gl [--from s] [--to s] [--dump t1,t2,...] [--calib x y]
//   --dump：在这些时刻另存预乘 RGBA 原始帧到 dump_<帧号>.rgba（像素对比用）
//   --calib：在 (x, y)（左上原点）画 80×80 gl-orange 色块，右侧 8 个方块编码帧号（白 = 1，黑 = 0，高位在前）
#include <glad/glad.h>
#include <GLFW/glfw3.h>
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fcntl.h>
#include <io.h>
#include <set>
#include <string>
#include <vector>
#include "p3_params.h"

static const char* VS = R"(#version 330 core
layout (location = 0) in vec3 aPos;
uniform mat4 vp, model;
out vec3 FragPos, Normal;
void main() { vec4 w = model * vec4(aPos, 1.0); FragPos = w.xyz; Normal = aPos; gl_Position = vp * w; })";
static const char* FS = R"(#version 330 core
in vec3 FragPos, Normal;
out vec4 FragColor;
uniform vec3 lightPos, viewPos, objectColor, lightColor;
uniform vec4 k;
uniform int unlit;
void main() {
  if (unlit == 1) { FragColor = vec4(lightColor, 1.0); return; }
  vec3 ambient = k.x * lightColor;
  vec3 norm = normalize(Normal);
  vec3 ld = normalize(lightPos - FragPos);
  vec3 diffuse = k.y * max(dot(norm, ld), 0.0) * lightColor;
  vec3 vd = normalize(viewPos - FragPos);
  vec3 rd = reflect(-ld, norm);
  vec3 specular = k.z * pow(max(dot(vd, rd), 0.0), k.w) * lightColor;
  FragColor = vec4((ambient + diffuse + specular) * objectColor, 1.0);
})";

static GLuint compile(GLenum type, const char* src) {
    GLuint s = glCreateShader(type);
    glShaderSource(s, 1, &src, nullptr);
    glCompileShader(s);
    GLint ok;
    glGetShaderiv(s, GL_COMPILE_STATUS, &ok);
    if (!ok) { char log[1024]; glGetShaderInfoLog(s, 1024, nullptr, log); fprintf(stderr, "shader: %s\n", log); exit(1); }
    return s;
}

int main(int argc, char** argv) {
    const int W = (int)P3_width, H = (int)P3_height, FPS = (int)P3_fps;
    float from = 0, to = P3_duration;
    int calibX = -1, calibY = -1;
    std::set<int> dumps;
    for (int i = 1; i < argc; i++) {
        if (!strcmp(argv[i], "--from")) from = (float)atof(argv[++i]);
        else if (!strcmp(argv[i], "--to")) to = (float)atof(argv[++i]);
        else if (!strcmp(argv[i], "--calib")) { calibX = atoi(argv[++i]); calibY = atoi(argv[++i]); }
        else if (!strcmp(argv[i], "--dump")) {
            std::string s = argv[++i];
            for (size_t p = 0; p < s.size();) { size_t q = s.find(',', p); if (q == std::string::npos) q = s.size(); dumps.insert((int)lround(atof(s.substr(p, q - p).c_str()) * FPS)); p = q + 1; }
        }
    }
    _setmode(_fileno(stdout), _O_BINARY);

    glfwInit();
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
    glfwWindowHint(GLFW_VISIBLE, GLFW_FALSE);
    GLFWwindow* win = glfwCreateWindow(64, 64, "p3gl", nullptr, nullptr);
    if (!win) { fprintf(stderr, "no GL context\n"); return 1; }
    glfwMakeContextCurrent(win);
    gladLoadGLLoader((GLADloadproc)glfwGetProcAddress);
    fprintf(stderr, "GL %s | %s\n", glGetString(GL_VERSION), glGetString(GL_RENDERER));

    GLuint prog = glCreateProgram();
    glAttachShader(prog, compile(GL_VERTEX_SHADER, VS));
    glAttachShader(prog, compile(GL_FRAGMENT_SHADER, FS));
    glLinkProgram(prog);

    GLuint vao, vbo, ebo;
    glGenVertexArrays(1, &vao); glGenBuffers(1, &vbo); glGenBuffers(1, &ebo);
    glBindVertexArray(vao);
    glBindBuffer(GL_ARRAY_BUFFER, vbo);
    glBufferData(GL_ARRAY_BUFFER, sizeof(P3_verts), P3_verts, GL_STATIC_DRAW);
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, ebo);
    glBufferData(GL_ELEMENT_ARRAY_BUFFER, sizeof(P3_idx), P3_idx, GL_STATIC_DRAW);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 12, nullptr);
    glEnableVertexAttribArray(0);
    const GLsizei N = (GLsizei)(sizeof(P3_idx) / sizeof(unsigned));

    // 4× MSAA 渲染目标 + 单采样解析目标
    GLuint ms, msColor, msDepth, rs, rsColor;
    glGenFramebuffers(1, &ms); glBindFramebuffer(GL_FRAMEBUFFER, ms);
    glGenRenderbuffers(1, &msColor); glBindRenderbuffer(GL_RENDERBUFFER, msColor);
    glRenderbufferStorageMultisample(GL_RENDERBUFFER, 4, GL_RGBA8, W, H);
    glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_RENDERBUFFER, msColor);
    glGenRenderbuffers(1, &msDepth); glBindRenderbuffer(GL_RENDERBUFFER, msDepth);
    glRenderbufferStorageMultisample(GL_RENDERBUFFER, 4, GL_DEPTH_COMPONENT24, W, H);
    glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_RENDERBUFFER, msDepth);
    glGenFramebuffers(1, &rs); glBindFramebuffer(GL_FRAMEBUFFER, rs);
    glGenRenderbuffers(1, &rsColor); glBindRenderbuffer(GL_RENDERBUFFER, rsColor);
    glRenderbufferStorage(GL_RENDERBUFFER, GL_RGBA8, W, H);
    glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_RENDERBUFFER, rsColor);

    glm::vec3 eye(P3_eye[0], P3_eye[1], P3_eye[2]);
    glm::mat4 vp = glm::perspective(glm::radians(P3_fov), (float)W / H, P3_near, P3_far) * glm::lookAt(eye, glm::vec3(0), glm::vec3(0, 1, 0));
    auto U = [&](const char* n) { return glGetUniformLocation(prog, n); };
    glUseProgram(prog);
    glUniformMatrix4fv(U("vp"), 1, GL_FALSE, glm::value_ptr(vp));
    glUniform3fv(U("viewPos"), 1, P3_eye);
    glUniform3fv(U("objectColor"), 1, P3_objectColor);
    glUniform3fv(U("lightColor"), 1, P3_lightColor);
    glUniform4f(U("k"), P3_ambient, P3_diffuse, P3_specular, P3_shininess);

    std::vector<unsigned char> px(W * H * 4), out(W * H * 4);
    const int f0 = (int)lround(from * FPS), f1 = (int)lround(to * FPS);
    for (int f = f0; f < f1; f++) {
        float t = (float)f / FPS;
        float th = 2.0f * 3.14159265358979f * std::fmin(t, P3_orbitEnd) / P3_orbitEnd;
        glm::vec3 lp(P3_lightR * std::cos(th), P3_lightY, P3_lightR * std::sin(th));
        glBindFramebuffer(GL_FRAMEBUFFER, ms);
        glViewport(0, 0, W, H);
        glEnable(GL_DEPTH_TEST); glEnable(GL_MULTISAMPLE);
        glClearColor(0, 0, 0, 0);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
        glUniform3fv(U("lightPos"), 1, glm::value_ptr(lp));
        glUniform1i(U("unlit"), 0);
        glUniformMatrix4fv(U("model"), 1, GL_FALSE, glm::value_ptr(glm::mat4(1)));
        glDrawElements(GL_TRIANGLES, N, GL_UNSIGNED_INT, nullptr);
        glm::mat4 lm = glm::scale(glm::translate(glm::mat4(1), lp), glm::vec3(P3_lightScale));
        glUniform1i(U("unlit"), 1);
        glUniformMatrix4fv(U("model"), 1, GL_FALSE, glm::value_ptr(lm));
        glDrawElements(GL_TRIANGLES, N, GL_UNSIGNED_INT, nullptr);
        glBindFramebuffer(GL_READ_FRAMEBUFFER, ms);
        glBindFramebuffer(GL_DRAW_FRAMEBUFFER, rs);
        glBlitFramebuffer(0, 0, W, H, 0, 0, W, H, GL_COLOR_BUFFER_BIT, GL_NEAREST);
        if (calibX >= 0) {  // 校验图案：直接按像素清屏写入，不经 MSAA
            glBindFramebuffer(GL_FRAMEBUFFER, rs);
            glEnable(GL_SCISSOR_TEST);
            auto rect = [&](int x, int y, int w, int h, float r, float g, float b) {
                glScissor(x, H - y - h, w, h); glClearColor(r, g, b, 1); glClear(GL_COLOR_BUFFER_BIT);
            };
            rect(calibX, calibY, 80, 80, 1.0f, 128 / 255.0f, 51 / 255.0f);
            for (int bit = 0; bit < 8; bit++) {
                float v = ((f >> (7 - bit)) & 1) ? 1.0f : 0.0f;
                rect(calibX + 100 + bit * 32, calibY + 28, 24, 24, v, v, v);
            }
            glDisable(GL_SCISSOR_TEST);
        }
        glBindFramebuffer(GL_READ_FRAMEBUFFER, rs);
        glReadPixels(0, 0, W, H, GL_RGBA, GL_UNSIGNED_BYTE, px.data());
        for (int y = 0; y < H; y++) {  // 翻转为上原点，预乘 → 直通
            const unsigned char* s = &px[(H - 1 - y) * W * 4];
            unsigned char* d = &out[y * W * 4];
            for (int x = 0; x < W; x++, s += 4, d += 4) {
                int a = s[3];
                for (int c = 0; c < 3; c++) d[c] = a ? (unsigned char)std::min(255, (s[c] * 255 + a / 2) / a) : 0;
                d[3] = (unsigned char)a;
            }
        }
        if (dumps.count(f)) {
            char name[64]; snprintf(name, sizeof name, "dump_%04d.rgba", f);
            FILE* fp = fopen(name, "wb");
            for (int y = 0; y < H; y++) fwrite(&px[(H - 1 - y) * W * 4], 1, W * 4, fp);
            fclose(fp);
        }
        fwrite(out.data(), 1, out.size(), stdout);
    }
    fflush(stdout);
    glfwTerminate();
    return 0;
}
