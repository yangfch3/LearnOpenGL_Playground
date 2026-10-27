# 基于 LearnOpenGL 的图形学教学视频制作想法

## 1. 目标

由 AI 编写流程演示脚本，结合 GPU 实时可视化，制作一段段较长的、画面与音效配合的趣味图形学教学视频。

- 形式：**无旁白**，所有文字在画面中艺术化呈现；背景音乐只做垫底，音画配合靠短音效
- 不是把仓库现有 demo 录制或移植成视频
- 视频内容为讲解「机制 / 流程」，例：三角形如何变成像素、阴影痤疮成因、Forward+ 光源分块
- 本仓库（LearnOpenGL 学习代码）作为知识来源与对照参考，不作为直接素材
- 工具选型暂不定，启动前选一个场景做试点后系统决定（见第 9 节）

## 2. 分工

| 角色 | 职责 |
|---|---|
| AI | 知识点清单、分镜、各镜头代码（画面 / 着色器 / 文字动效 / 时间线 / 音效） |
| 渲染与合成工具 | 镜头编排、逐帧渲染、画面文字 / 公式 / 代码 / 音效 / 背景音乐合成 |
| 我 | 选题、技术准确性把关（分镜阶段）、成片验收 |

## 3. 工具候选

### 3.1 分层思路

教学视频画面大部分是示意图（管线框图、像素网格、buffer 布局、tile 划分、向量矩阵），只有少数「展示真实效果」的镜头需要 GPU 实时渲染。按层选型：

| 层 | 内容 | 候选 |
|---|---|---|
| 示意图与文字层 | 框图、网格、公式、动态文字排版 | HyperFrames（HTML·SVG·GSAP）/ Manim / Motion Canvas |
| 真实效果层 | 阴影、PBR、compute 等真实 GPU 画面 | WebGPU（嵌入合成工具）/ 原生 C++ OpenGL 离线渲染导出片段 |
| 合成层 | 镜头编排、转场、音效、背景音乐 | HyperFrames / Remotion / Motion Canvas |

无旁白下动态文字排版（kinetic typography）是核心能力：HTML + GSAP + SVG 最强；Manim 排版艺术性偏弱，宜作公式 / 示意图专用层；Motion Canvas「对齐配音」的优势用不上。

### 3.2 候选工具一览

| 工具 | 擅长 | 弱点 |
|---|---|---|
| HyperFrames（HTML，Apache 2.0） | AI 友好（官方 agent skills）；确定性输出；HTML 版式与 WebGPU 可同处一个合成；组件库含 kinetic type | 较新；需遵守 seek 约定，违反会静默出错；长篇多镜头工程化待验证 |
| Remotion（React/TS，自有许可） | 成熟，资料与生产案例多；帧号纯函数模型简单 | 需 React；个人及 ≤3 人公司免费，超出付费 |
| Manim（Python，MIT） | 数学 / 机制讲解事实标准；原生 LaTeX；AI 熟悉 | 写实渲染与自定义 GPU 效果弱；排版艺术性弱；渲染慢 |
| Motion Canvas / Revideo（TS，MIT） | 为讲解视频设计；Revideo 支持 headless 批量渲染 | 以 Canvas2D 为主，自定义 shader 支持程度未核实 |
| 原生 C++ OpenGL 离线渲染 | 直接复用 GLSL / compute 与本仓库代码；确定性易实现（固定步长 + 脚本相机 + `glReadPixels` → ffmpeg）；不依赖 headless | 文字排版、缓动、转场需自造，需配合合成层 |
| Blender（bpy） | 电影感 3D | 重，不适合讲 GPU 内部机制；仅片头 / 氛围镜头 |
| Godot（Movie Maker） | 自带时间轴、shader、compute、确定性录制 | 场景文件 AI 不易编辑；不作主力 |

注：除 HyperFrames / Remotion 外，其余工具现状未逐一联网核实。

### 3.3 HyperFrames 要点

- HTML 合成 → headless Chrome 逐帧 seek → FFmpeg 编码，同输入同视频
- 动画通过适配器接入：GSAP / Web Animations / Lottie / Three.js / 自定义；环境要求 Node.js 22+、FFmpeg
- 来源：[heygen-com/hyperframes](https://github.com/heygen-com/hyperframes)

WebGPU 接入（typegpu 适配器，来源：[skill 说明（第三方镜像）](https://tokencalculator.com/skill/heygen-com-hyperframes-typegpu)）：

- 适配器只在 seek 时设置 `window.__hfTypegpuTime` 并派发 `hf-seek`，不接管渲染管线
- 画面须为时间 t 的纯函数：禁用 `Math.random()` / `requestAnimationFrame` / `performance.now()`；有状态模拟须可从任意 t 重建
- GSAP 时间线须在任何 `await` 前同步注册；每帧提交后 `await device.queue.onSubmittedWorkDone()`

WebGPU 渲染支持条件（官方文档）：

- 组合标记 `data-requires-webgpu`，捕获前须成功**创建 device**（仅有 adapter 不算）
- 检查 10 秒超时，失败即停止捕获并抛 `WebGpuUnavailableError`（不会静默降级）
- 默认要求硬件 adapter；仅显式配置软件 WebGPU 时才用 SwiftShader
- CanvasDrawElement + WebGPU 组合（如 liquid-glass 区块）需经 `PRODUCER_HEADLESS_SHELL_PATH` 指定兼容浏览器（Brave / Chrome Canary），自带 headless shell 不支持

### 3.4 HyperFrames vs Remotion

来源：[官方对比](https://hyperframes.heygen.com/guides/hyperframes-vs-remotion)（HyperFrames 方撰写，非中立）

| | HyperFrames | Remotion |
|---|---|---|
| 编写 | HTML / CSS / JS | React + TypeScript |
| 时间模型 | 渲染器暂停并 seek 动画 | 组件为帧号纯函数 |
| 易错点 | 约定多，违反静默出错 | 无隐含约定 |
| 成熟度 | 较新 | 更成熟，Lambda 渲染完善 |
| 许可 | Apache 2.0 | 个人及 ≤3 人公司免费，超出付费 |
| 官方同题单次测试 | 4 个 HTML / 822 行，零依赖，自配 1 段配乐 + 5 个音效 | 10 个 TS / 1037 行，约 950MB 依赖，无声 |

对本场景：

- WebGPU 镜头本就要写成 t 的纯函数，两者等价；差异在文字 / 版式 / 转场，HTML + GSAP 更轻
- 无 React 背景，Remotion 复用 React 资产的优势用不上；Apache 2.0 免去许可顾虑
- HyperFrames 碰壁时 Remotion 为备选，镜头内 WebGPU 代码基本可迁移

### 3.5 WebGPU 能力边界（与本仓库内容相关）

- 有：compute、storage buffer、原子操作、workgroup 共享内存、storage texture、间接绘制 / dispatch、逐目标独立混合、rgba16float 渲染与混合、MSAA 纹理（采样数 1 或 4）
- 无：几何着色器、曲面细分、`CLAMP_TO_BORDER`、持久映射、核心规范的 multi-draw-indirect
- 着色语言为 WGSL（非 GLSL）

## 4. 环境现状

- 本机：Windows，NVIDIA RTX 3050 + AMD 核显
- Chrome 156.0.8078.48（WebGPU 在 Windows 自 113 起默认开启）
- 待确认：HyperFrames 自带 headless shell 在本机能否通过 `data-requires-webgpu` 检查（创建硬件 device）；Docker / Lambda 渲染路径大概率无 GPU

## 5. 主要难点

1. 无旁白叙事：仅靠视觉隐喻与画面因果讲清机制，最难也最决定品质
2. 技术准确性：AI 产出易「看起来对、细节错」，需在分镜阶段审核
3. 长视频工程组织：多镜头转场、可复用组件、渲染耗时
4. 真实效果层的渲染环境（headless WebGPU 或原生 OpenGL 片段导入）

## 6. 音乐与音效

### 6.1 背景音乐

- 自行提供一段万用曲目，仅防枯燥，不参与叙事、不对齐节拍
- 长度适配：优先选可无缝循环的曲子；短于视频则循环，长于视频则截断；首尾淡入淡出
- 混音：固定 BGM 与音效的电平比例；可选音效响起时 ducking 压低 BGM
- 全系列统一同一曲目或同一风格

### 6.2 短音效（≤ 10s）

画面由脚本生成、事件时间点已知，音效落点直接绑定画面事件（碰撞、文字出现、数据变化），无需「看视频对齐」。

| 方案 | 适用 | 运行条件 | 许可 |
|---|---|---|---|
| 程序化合成（jsfxr / ZzFX / `OfflineAudioContext` / numpy） | UI 提示音、与数据绑定的音效（如迭代次数→音高、tile 灯数→敲击密度） | 无模型、无 GPU | 自有代码 |
| [Stable Audio 3 Small-SFX](https://huggingface.co/stabilityai/stable-audio-3-small-sfx) | 写实质感音效（文本→音频，时长可变，支持 inpainting） | 433M，官方标注 CPU 可跑 | Stability AI Community License，商用需查官方条件 |
| [MMAudio](https://github.com/hkchengrex/MMAudio) | 备选：视频/文本→音频，默认 8s | 157M，轻量 | 代码 MIT，权重 CC-BY-NC 4.0（不可商用） |
| 素材库（Kenney CC0、Freesound 按文件筛 CC0） | 兜底 | — | 逐文件确认 |

- 建议组合：程序化合成为主 + Stable Audio 3 Small-SFX 补写实；生成时固定种子，WAV 存入项目作资产，保证重复出片一致
- 不建议：Stable Audio 3 Medium（需 Flash Attention 2，Windows 安装风险，可能需 WSL2）、HunyuanVideo-Foley（偏重、许可未核实）

## 7. 补充考虑

### 7.1 叙事与内容

- 时间轴由画面驱动：镜头时长 = 分镜节奏 + 文字阅读时长
- 静音可懂：全部信息须能从画面读出，音效只做增强
- 阅读节奏：按字数定最短停留时长（试点校准），一屏文字少
- 前置知识：每集写明默认已掌握内容；系列排依赖图，视觉元素跨集沿用
- 长片分章：章节标题卡 + 平台分段，节奏张弛
- 理解度盲测：未看过分镜的人试看后复述；或先让 AI 仅凭抽帧复述初筛

### 7.2 视觉与文字

- 风格规范：颜色语义（如世界 / 视 / 裁剪空间固定配色）、字体、动效节奏、片头片尾；可评估 frame.md
- 跨集组件：坐标系、像素网格、管线图、buffer 示意、公共 WGSL 模块
- 中文字体许可：艺术字体多需商用授权，优先 OFL 等明确许可
- 公式与代码：KaTeX / LaTeX、代码高亮
- 文字数据与布局分离：出片前导出全部画面文字统一校对（改错需重渲染）；兼顾日后多语言

### 7.3 画质与编码

- 平台二次压缩：避免 1px 细线、密集网格、满屏高频噪点；试点按平台码率重压检验
- 色度抽样与色彩空间：yuv420p 下深色背景彩色细字易糊，注意描边与亮度对比；确认 BT.709 转换不发灰偏色
- 抗锯齿与运动模糊：线条文字用 MSAA 或 2× 超采样；快速运动可用子帧累积模拟运动模糊
- 小屏可读与安全区：最小字号与对比度；避开进度条、弹幕、标题栏遮挡区
- 光敏安全：参考 WCAG 2.3.1，任意 1 秒内闪烁不超过 3 次

### 7.4 生产流程与工程

```
选题 → 知识点清单（附依据）→ 分镜（含画面文字）→ 实现 → 抽帧审核 → 音效 → 混音出片
                              ↑ 技术准确性审核点
```

- 规范沉淀为 AI 可读文件：风格、组件、确定性约定、阅读时长、安全区、闪烁限制写入项目级 steering / skill
- 迭代效率：按镜头独立渲染、镜头缓存、低分辨率草稿
- 资产与版本：Git LFS、渲染输出入 `.gitignore`、视频项目是否独立仓库

### 7.5 发布与其他

- 发布规格：分辨率、帧率、横竖屏、封面
- 平台与授权：AIGC 标注要求、BGM 公开使用授权（依赖「受众」）
- 其他：跨机器渲染确定性（影响像素级回归）、每集成本记录、硬件余量（当前 3050）

## 8. 待明确

- [x] 配音：无（无旁白）
- [ ] 受众：自用复习 / 公开教程（同时决定音效模型与 BGM 许可是否可用）
- [ ] 单集时长（结合分章节考虑）
- [ ] 选题范围：仅本仓库已学的 LearnOpenGL 内容 / 延伸其他图形学主题
- [ ] 发布平台与规格
- [ ] 各层工具选型（第 9 节试点后决定）

## 9. 启动前：试点选型

选一个小场景（如「透视除法」），据此决定各层工具：

```
1. 真实效果层：HyperFrames 自带 headless shell 下 data-requires-webgpu 能否通过
              ↳ 不通过 → 换 PRODUCER_HEADLESS_SHELL_PATH 或原生 OpenGL 片段导入
2. 示意图与文字层：同一段内容分别用 HyperFrames 与 Manim 实现，比较 AI 首次产出质量、返工次数、文字排版表现力
3. 合成层：十几个镜头的长组合是否便于组织；原生 OpenGL 片段导入是否顺畅
4. 出片检查：无黑帧 / 旧帧、帧准确、音效落点准确
5. 观看检查：文字阅读时长校准、平台码率重压后画质、小屏可读、抽帧盲测
```
