# 基于 LearnOpenGL 教程 + HyperFrames 的教学视频制作想法

## 1. 目标

由 AI 编写流程演示脚本，借助 WebGPU 实时生成可视化画面，用 HyperFrames 渲染成一段段较长的趣味图形学教学视频。

- 不是把仓库现有 demo 录制或移植成视频
- 视频内容为讲解「机制 / 流程」，例：三角形如何变成像素、阴影痤疮成因、Forward+ 光源分块
- 本仓库（LearnOpenGL 学习代码）作为知识来源与对照参考，不作为直接素材

## 2. 分工

| 角色 | 职责 |
|---|---|
| AI | 分镜脚本、每个镜头的 HTML / WGSL / 时间线 |
| HyperFrames | 镜头编排、逐帧渲染、与文字 / 公式 / 代码 / 字幕 / 配音合成 |
| 我 | 选题、技术准确性把关、成片验收 |

## 3. 技术基础

### 3.1 HyperFrames

- HTML 合成 → headless Chrome 逐帧 seek → FFmpeg 编码，确定性输出（同输入同视频）
- 动画通过适配器接入：GSAP / Three.js / Lottie / 自定义等
- 环境要求：Node.js 22+、FFmpeg
- 来源：[heygen-com/hyperframes](https://github.com/heygen-com/hyperframes)

### 3.2 WebGPU 接入约定（typegpu 适配器）

- 适配器不接管渲染管线，只在 seek 时设置 `window.__hfTypegpuTime` 并派发 `hf-seek` 事件
- 画面必须是时间 t 的纯函数：
  - 禁用 `Math.random()` / `requestAnimationFrame` / `performance.now()`，随机用固定种子 PRNG
  - 有状态模拟需可从任意 t 重建（固定步长从 0 重算，或解析式）
- GSAP 时间线须在任何 `await` 之前同步注册
- 每帧提交后 `await device.queue.onSubmittedWorkDone()`，否则可能截到旧帧
- WebGPU 不可用时需自行降级
- 来源：[TypeGPU / WebGPU skill 说明（第三方镜像）](https://tokencalculator.com/skill/heygen-com-hyperframes-typegpu)

### 3.3 WebGPU 能力边界（与本仓库内容相关）

- 有：compute、storage buffer、原子操作、workgroup 共享内存、storage texture、间接绘制 / dispatch、逐目标独立混合、rgba16float 渲染与混合、MSAA 纹理（采样数 1 或 4）
- 无：几何着色器、曲面细分、`CLAMP_TO_BORDER`、持久映射、核心规范的 multi-draw-indirect
- 着色语言为 WGSL（非 GLSL）

## 4. 环境现状

- 本机：Windows，NVIDIA RTX 3050 + AMD 核显
- Chrome 156.0.8078.48（WebGPU 在 Windows 自 113 起默认开启）
- 待确认：HyperFrames 出片使用的 headless 浏览器能否拿到硬件 WebGPU adapter（可能不是本机 Chrome，可能回退 SwiftShader）；Docker / Lambda 渲染路径大概率无 GPU

## 5. 主要难点

1. 教学设计：节奏、类比、可视化抽象程度，决定趣味性
2. 技术准确性：AI 产出易「看起来对、细节错」，需逐集审核
3. 长视频工程组织：多镜头转场、可复用 WebGPU 组件（相机 / 网格 / 常用 shader）、渲染耗时
4. headless 渲染环境的 WebGPU 可用性（见第 4 节）

## 6. 待明确

- [ ] 受众：自用复习 / 公开教程
- [ ] 单集时长
- [ ] 配音：无 / TTS / 本人录制
- [ ] 选题范围：仅本仓库已学的 LearnOpenGL 内容 / 延伸其他图形学主题

## 7. 建议的第一步

先做最小试点，验证整条链路：

```
WebGPU 最小镜头（hf-seek 驱动，纯时间函数）
  → npx hyperframes render 本地出片
  → 检查：无黑帧 / 旧帧、使用硬件 adapter、帧准确
```

链路跑通后，再确定选题与第一集分镜。
