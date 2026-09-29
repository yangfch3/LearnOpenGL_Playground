#ifndef CAMERA_FPS_H
#define CAMERA_FPS_H

#include "camera.h"

// 第一人称摄像机
// 继承自通用 Camera，额外增加：
//   1. 移动时锁定 y 轴高度
//   2. 提供 Reset 方法回到初始 FPS 视角
class CameraFPS : public Camera
{
public:
    // 继承基类构造函数
    using Camera::Camera;

    // 重写键盘处理：在基类行为之后，把 y 锁回固定高度
    void ProcessKeyboard(Camera_Movement direction, float deltaTime) override
    {
        Camera::ProcessKeyboard(direction, deltaTime);
        Position.y = fixedHeight;
    }

    // 重置为初始 FPS 视角
    void Reset()
    {
        Position = glm::vec3(0.0f, fixedHeight, 3.0f);
        Yaw = YAW;
        Pitch = PITCH;
        updateCameraVectors();
    }

    // 可选：设置固定高度
    void SetFixedHeight(float h)
    {
        fixedHeight = h;
        Position.y = h;
    }

private:
    // FPS 模式下摄像机固定的高度
    float fixedHeight = 0.0f;
};

#endif