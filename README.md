# SpriteForge

SpriteForge 是一个面向 2D 游戏开发的素材生成工具。当前版本已经迁移为 **C++ 核心 + Python FastAPI + React/TypeScript/Vite/Tailwind/Zustand/Konva** 的分层架构。

用户可以输入文本描述或简单参数，生成结构化 Prompt、透明 PNG、Sprite Sheet 和 JSON 元数据。当前 AI 生成部分使用 Mock Generator，后续可以替换为 ComfyUI、Stable Diffusion 或 Flux。

## 技术栈

- 前端：React + TypeScript + Vite + Tailwind CSS
- 状态管理：Zustand
- 预览编辑：Konva / Canvas
- 后端：Python FastAPI
- 图像处理：Pillow
- 数据库：SQLite
- 核心生成：C++ CLI
- 导出格式：PNG + Sprite Sheet + JSON 元数据

## 架构

```text
frontend/
  React UI -> FastAPI

backend/
  FastAPI -> C++ CLI -> generation plan
          -> Pillow -> PNG / Sprite Sheet
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
