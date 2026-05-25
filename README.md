# SpriteForge

SpriteForge 是一个面向 2D 游戏开发的素材生成工具。当前版本已经迁移为 **C++ 核心 + Python FastAPI + React/TypeScript/Vite/Tailwind/Zustand/Konva** 的分层架构。

用户可以输入文本描述或简单参数，生成结构化 Prompt、透明 PNG、Sprite Sheet 和 JSON 元数据。图像生成支持 Mock Generator、ComfyUI API 和火山方舟 API：默认使用 Mock，配置环境变量后可切换到真实生成服务。

## 技术栈

- 前端：React + TypeScript + Vite + Tailwind CSS
- 状态管理：Zustand
- 预览编辑：Konva / Canvas
- 后端：Python FastAPI
- 图像处理：Pillow
- 数据库：SQLite
- 核心生成：C++ CLI
- AI 生成：Mock Generator / ComfyUI API / 火山方舟 API
- 导出格式：PNG + Sprite Sheet + JSON 元数据

## 架构

```text
frontend/
  React UI -> FastAPI

backend/
  FastAPI -> C++ CLI -> generation plan
          -> Mock Generator or ComfyUI API -> PNG / Sprite Sheet
          -> SQLite -> generation records

src_cpp/
  C++ core: prompt, metadata, seed, export JSON
```

## 运行要求

- Windows
- Node.js 18+
- Python 3.11+
- g++ / MinGW

## 安装

```bash
cd frontend
npm install --cache ..\.npm-cache
```

```bash
python -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt pytest
```

## 构建 C++ 核心

```bash
npm run build
```

构建产物：

```text
build/spriteforge_cpp.exe
build/spriteforge_cli.exe
```

## 启动

推荐使用一键开发启动，它会自动避开已占用端口，并把前端 API 地址指向真实后端端口：

```bash
npm run dev
```

命令执行后会打开两个终端窗口，并在终端中提示前端访问地址，例如：

```text
Open http://127.0.0.1:5173
```

也可以手动分别启动。先启动后端：

```bash
npm run start:api
```

再启动前端：

```bash
npm run start:web
```

打开：

```text
http://127.0.0.1:5173
```

如果 `8000` 被占用，手动启动后端时可以指定端口：

```powershell
$env:PORT="8010"; npm run start:api
```

此时前端也要指定同一个 API 地址：

```powershell
$env:VITE_API_BASE="http://127.0.0.1:8010/api"; cd frontend; npm run dev
```

后端接口：

```text
GET  http://127.0.0.1:8000/api/health
POST http://127.0.0.1:8000/api/assets/plan
POST http://127.0.0.1:8000/api/assets/generate
GET  http://127.0.0.1:8000/api/assets/{id}/download/png
GET  http://127.0.0.1:8000/api/assets/{id}/download/sheet
GET  http://127.0.0.1:8000/api/assets/{id}/download/json
```

## 接入 ComfyUI

默认不配置时使用 Mock Generator。要使用 ComfyUI，先启动 ComfyUI 服务并导出 API 格式工作流 JSON，然后设置环境变量：

```powershell
$env:SPRITEFORGE_AI_PROVIDER="comfyui"
$env:COMFYUI_BASE_URL="http://127.0.0.1:8188"
$env:COMFYUI_WORKFLOW_PATH="C:\path\to\workflow_api.json"
```

如果工作流里有多个文本节点，建议明确指定节点 ID：

```powershell
$env:COMFYUI_POSITIVE_NODE_ID="6"
$env:COMFYUI_NEGATIVE_NODE_ID="7"
```

然后启动后端和前端：

```powershell
npm run dev
```

行为说明：

- `SPRITEFORGE_AI_PROVIDER=mock` 或未配置：使用内置 Pillow Mock Generator。
- `SPRITEFORGE_AI_PROVIDER=comfyui`：调用 ComfyUI `/prompt`、`/history/{prompt_id}`、`/view` 接口生成图片。
- `SPRITEFORGE_AI_FALLBACK=mock` 默认开启：ComfyUI 未启动、工作流错误或超时时，会回退到 Mock Generator，保证演示不中断。
- 如果 ComfyUI 输出单张图，会自动缩放成单帧并复制到 Sprite Sheet；如果输出横向多帧图，会按当前帧宽和帧数切分。

## 接入火山方舟

火山方舟走 OpenAI-compatible 图片生成接口。不要把 API Key 写进代码，使用环境变量启动：

```powershell
$env:SPRITEFORGE_AI_PROVIDER="ark"
$env:ARK_API_KEY="你的火山方舟 API Key"
$env:ARK_BASE_URL="https://ark.cn-beijing.volces.com/api/v3"
$env:ARK_IMAGE_MODEL="你的图片生成模型 ID 或推理接入点 ID"
npm run dev
```

说明：

- `ARK_API_KEY`：火山方舟 API Key。
- `ARK_BASE_URL`：默认 `https://ark.cn-beijing.volces.com/api/v3`。
- `ARK_IMAGE_MODEL`：图片生成模型 ID 或推理接入点 ID，不同账号/地区可用模型可能不同，请以火山方舟控制台为准。
- `ARK_ENDPOINT_ID`：等价备用项；如果你拿到的是推理接入点 ID，也可以设置它。
- `ARK_IMAGE_PATH`：默认 `/images/generations`，如果控制台文档给出的路径不同，可以覆盖。
- `SPRITEFORGE_AI_FALLBACK=mock` 默认开启：Key、模型名、网络或额度异常时会回退 Mock，并在元数据里记录 warning。

## 测试

```bash
npm run test:all
```

前端构建：

```bash
npm run build:frontend
```

## 项目结构

```text
.
├── backend
│   ├── app
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── schemas.py
│   │   ├── routers
│   │   └── services
│   ├── requirements.txt
│   └── run.py
├── frontend
│   ├── src
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── store.ts
│   │   └── types.ts
│   ├── package.json
│   └── vite.config.js
├── src_cpp
│   ├── cli.cpp
│   ├── core.cpp
│   ├── core.h
│   ├── json.h
│   └── server.cpp
├── scripts
│   ├── build-cpp.ps1
│   └── start-cpp.ps1
└── tests
```

## 说明

旧的原生 HTML/JS + C++ HTTP 服务入口仍保留，方便回退和对照。新的正式实现位于 `frontend/` 和 `backend/`，C++ 核心通过 `build/spriteforge_cli.exe` 被 FastAPI 调用。
