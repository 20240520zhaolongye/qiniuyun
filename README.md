# SpriteForge

SpriteForge 是一个面向 2D 游戏开发的素材生成工具。用户可以通过文本描述和参数配置生成结构化 Prompt、预览素材动画、导出单帧 PNG、Sprite Sheet PNG 和 JSON 元数据。

当前版本采用 **C++ 后端 + 浏览器前端**：

- C++：本地 HTTP 服务、参数解析、Prompt 构建、素材计划和导出元数据生成。
- JavaScript：浏览器交互、Canvas 预览、动画播放和文件下载。
- 测试：覆盖前端工具函数、C++ 静态资源服务、`/api/plan` 生成接口和 `/api/health` 健康检查接口。

## 提交内容

- 代码仓库：提交到公开 GitHub 或 Gitee 仓库后，在这里填写链接。
- Demo 视频：上传到可访问的视频平台后，在这里填写链接。
- README 文档：本文档说明作品功能、运行方式、演示流程和评分对照。

## 作品有效性说明

- 作品方向：2D 游戏素材生成工具，符合所选议题方向。
- 原创说明：核心功能、C++ 后端、前端交互和文档均在本仓库中实现。
- 依赖说明：项目不依赖第三方前端框架；C++ 后端使用 Windows socket 和标准库实现本地服务。
- 提交建议：按功能拆分提交，保留清晰 commit 记录；不要在截止前一次性导入全部代码。

## 功能

- 输入文本描述并选择素材类型、风格、尺寸、视角、动画、帧数、FPS 和导出目标。
- 自动生成结构化 Prompt。
- Canvas 实时预览单帧素材。
- 自动排列 Sprite Sheet。
- 支持动画播放预览。
- 支持下载单帧 PNG、Sprite Sheet PNG 和 JSON 元数据。
- 提供 `/api/plan` 生成接口和 `/api/health` 健康检查接口。

## 评分对照

### 作品完整度与创新性 40%

- 支持怪物、角色、道具、UI 图标、Tile 地块、技能特效等素材类型。
- 支持像素风、卡通风、手绘风、黑暗风、Q 版等风格参数。
- 支持尺寸、视角、动画、帧数、FPS、导出目标配置。
- 自动生成结构化 Prompt、Sprite Sheet 和游戏引擎可读取的 JSON 元数据。
- 项目把“素材描述到游戏资源导出”做成完整工作流，而不仅是静态页面。

### 开发过程与质量 40%

- C++ 后端集中处理核心生成逻辑，前端只负责展示和交互，职责清晰。
- 本地 HTTP 服务提供静态文件、`/api/plan` 和 `/api/health`。
- 代码包含输入清洗、JSON 解析、路径限制和 HTTP 方法校验。
- 使用自动化测试验证关键流程。
- 提供 PR 模板，便于按功能拆分开发并描述测试方式。

### 演示与表达 20%

- 打开页面后可直接点击“随机”展示不同素材。
- 点击“播放”展示帧动画效果。
- 可下载 PNG、Sprite Sheet 和 JSON，展示完整素材工作流。
- 页面内置“评分对照与演示要点”，方便答辩说明。
- `docs/DEMO_SCRIPT.md` 提供 Demo 视频讲解稿。

## 运行要求

- Windows
- Node.js 18 或更高版本
- g++，本项目已在 MinGW g++ 7.3 环境下验证

## 启动

```bash
npm start
```

然后打开：

```text
http://127.0.0.1:5173
```

## 构建

```bash
npm run build
```

构建产物：

```text
build/spriteforge_cpp.exe
```

## 测试

```bash
npm test
```

## Demo 视频录制流程

1. 说明项目目标：为 2D 游戏快速生成原型素材。
2. 点击“随机”，展示多种素材类型和风格。
3. 修改文本描述、风格、帧数和 FPS，点击“生成素材”。
4. 点击“播放”，展示动画预览。
5. 展示结构化 Prompt，说明可接入真实 AI 图像生成服务。
6. 下载 PNG、Sprite Sheet、JSON，说明 Unity/Godot/Cocos 工作流。
7. 打开 README 或页面评分区，对照完整度、开发质量、演示表达三项总结。

## 项目结构

```text
.
├── index.html
├── package.json
├── README.md
├── CMakeLists.txt
├── .github
│   └── pull_request_template.md
├── docs
│   ├── DEMO_SCRIPT.md
│   └── SUBMISSION_CHECKLIST.md
├── scripts
│   ├── build-cpp.ps1
│   └── start-cpp.ps1
├── src
│   ├── app.js
│   ├── core.js
│   ├── renderer.js
│   └── styles.css
├── src_cpp
│   ├── core.cpp
│   ├── core.h
│   ├── json.h
│   └── server.cpp
└── tests
    ├── core.test.js
    └── server.test.js
```
