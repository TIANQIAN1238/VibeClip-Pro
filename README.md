# VibeClip Pro

> 跨平台的 AI 增强型剪贴板控制台，让「复制 → 处理 → 粘贴」保持顺畅。VibeClip Pro 基于 Tauri 2 + Vue 3 构建，提供桌面端级别的体验，并可在离线/在线模式之间自由切换。

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Built with Tauri](https://img.shields.io/badge/Desktop-Tauri%202-blue.svg)](https://tauri.app)
[![Vue 3](https://img.shields.io/badge/Web-Vue%203-42b983.svg)](https://vuejs.org)

## 📑 目录

- [产品概览](#产品概览)
- [核心特性](#核心特性)
- [快速体验（面向使用者）](#快速体验面向使用者)
- [AI 与云服务配置](#ai-与云服务配置)
- [开发环境搭建](#开发环境搭建)
- [常用命令速查](#常用命令速查)
- [项目结构](#项目结构)
- [发布流程](#发布流程)
- [常见问题](#常见问题)
- [许可证与更多资料](#许可证与更多资料)

## 产品概览

VibeClip Pro 聚焦桌面剪贴板效率，提供实时捕获、历史管理、AI 快捷操作与托盘控制等功能。默认提供 Windows 安装包，并可通过源码构建 macOS/Linux 版本。

最新稳定版：**v2.8.1**（2025-10-19）。

## 核心特性

- **智能剪贴板捕获**：250~400 ms 节流轮询系统剪贴板，自动保存文本、图像（Base64）与文件路径，支持黑名单过滤与内容去重。
- **四大主界面**：首页总览、实时剪贴板、历史记录与 AI 工具，提供统一的毛玻璃视觉与深浅色主题切换。
- **AI 快捷操作**：内置翻译、摘要、润色、JSON 化、OCR 等动作，可自定义 Prompt 并将结果写回系统剪贴板或历史记录。
- **全局右键菜单**（v2.4.0）：剪贴板、历史、AI 工具与设置页面拥有一致的右键体验，自动匹配内容类型。
- **托盘与快捷键**：默认 `Ctrl+Shift+V` 呼出浮动面板，托盘菜单可暂停监听、切换离线模式与清理历史。
- **多平台兼容**：Tauri 2 + Rust 后端封装系统能力，前端使用 Vue 3 + TypeScript，提供跨平台桌面构建能力。

## 快速体验（面向使用者）

### 1. 下载与安装

1. 访问 [GitHub Releases](https://github.com/<owner>/VibeClip/releases) 页面下载最新 `VibeClip_2.8.1_x64-setup.exe` 安装包及 `latest.json`。
2. 双击安装包并按照向导完成安装；首次启动会在系统托盘驻留。
3. macOS / Linux 用户可从源码构建或使用对应的 `.dmg` / `.AppImage`（如有提供）。

> **系统要求**：Windows 10/11、macOS 13+ 或主流桌面 Linux，需安装 Microsoft Visual C++ 运行库（Windows）或满足 Tauri 运行时依赖。

### 2. 首次运行

1. 启动应用后按 `Ctrl+Shift+V` 呼出主界面，或在托盘菜单选择“打开主界面”。
2. 在**设置 → AI 服务**中配置 API Base URL 与 API Key（默认使用 FreeAPI 示例端点）。
3. 开启「连续监听剪贴板」，复制任意文本/图像即可在**剪贴板**页面实时查看并写入历史。
4. 右键历史条目即可执行 AI 翻译、摘要或 OCR，结果支持保存与复制。

### 3. 快速排查

- 未配置 API Key 时，AI 相关功能会提示跳转设置页。
- 离线模式下禁止调用云端接口，可在托盘菜单关闭离线模式。
- 运行日志可在设置页开启并查看 `logs/` 目录输出。

## AI 与云服务配置

1. 打开 **设置 → AI 服务**。
2. 填写兼容 OpenAI 的 `API Base URL`（默认为 `https://api.freekey.site`）与 `API Key`。
3. 为每个快捷操作选择模型（默认 `gemini-2.5-flash`）与语言，或自定义 Prompt 模板，支持使用 `{{clipboard}}` 占位符。
4. 在剪贴板或历史记录右键图片可触发 OCR；文本内容可执行翻译、摘要、润色、JSON 化等操作。

## 开发环境搭建

| 依赖 | 最低版本 | 说明 |
| --- | --- | --- |
| Node.js | 18.x LTS | 建议配合 [corepack](https://nodejs.org/api/corepack.html) 启用 `pnpm` |
| pnpm | 8.x | `corepack enable pnpm` 或手动安装 |
| Rust / Cargo | 1.72+ | 构建 Tauri 后端；macOS/Linux 需安装系统依赖（`libgtk-3`、`webkit2gtk` 等） |
| Tauri CLI | 2.x | `cargo install tauri-cli --version ^2` |

```bash
# 克隆仓库
git clone https://github.com/<owner>/VibeClip.git
cd VibeClip

# 安装依赖
pnpm install

# 启动 Web 端开发服务器（http://localhost:5173）
pnpm dev

# 启动 Tauri 桌面调试（会自动启动 Web 端）
pnpm tauri dev
```

> Windows 用户可使用 `pnpm i && pnpm tauri dev` 一次性安装并启动桌面调试。

## 常用命令速查

| 场景 | 命令 |
| --- | --- |
| 类型检查与 Lint | `pnpm lint` |
| 单独构建前端 | `pnpm build` |
| 构建桌面安装包 | `pnpm tauri build` |
| Rust 端检查 | `cargo check`、`cargo fmt` |

构建产物：

- 前端静态资源输出至 `dist/`，适合 Web 预览或嵌入桌面端。
- 桌面安装包位于 `src-tauri/target/release/bundle/`，包含 `.exe`、`.msi`、`.dmg`、`.AppImage` 等平台文件（视构建目标而定）。

## 跨平台构建

### Windows 构建

在 Windows 系统下直接运行：

```bash
pnpm tauri build
```

将生成以下安装包：

- `src-tauri/target/release/bundle/nsis/*.exe` - NSIS安装程序
- `src-tauri/target/release/bundle/msi/*.msi` - MSI安装包

### Linux 构建

VibeClip Pro 支持 Linux 平台，可生成 `.deb` 和 `.rpm` 安装包。

**在 Linux 环境下构建**：

1. 安装系统依赖（Ubuntu/Debian）：

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

2. 构建项目：

```bash
pnpm install
pnpm tauri build
```

3. 生成的安装包位于：
   - `src-tauri/target/release/bundle/deb/*.deb` - Debian/Ubuntu安装包
   - `src-tauri/target/release/bundle/rpm/*.rpm` - RedHat/Fedora安装包

**Windows 用户构建 Linux 版本**：

由于跨平台编译的复杂性，建议 Windows 用户通过以下方式构建 Linux 版本：

1. **使用 WSL2**（推荐）：
   - 安装 WSL2 和 Ubuntu
   - 在 WSL2 中按照上述 Linux 构建步骤操作
   - 访问 [WSL 安装文档](https://docs.microsoft.com/zh-cn/windows/wsl/install)

2. **使用虚拟机**：
   - 安装 VirtualBox 或 VMware
   - 创建 Ubuntu 虚拟机
   - 在虚拟机中进行构建

3. **使用 CI/CD 服务**：
   - 配置 GitHub Actions 自动化构建（见下文）

### macOS 构建

在 macOS 系统下运行：

```bash
pnpm tauri build
```

将生成 `.dmg` 和 `.app` 文件。

### CI/CD 自动化构建

推荐使用 GitHub Actions 实现多平台自动化构建。在 `.github/workflows/` 目录创建工作流文件，示例配置：

```yaml
name: Build Multi-Platform

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        platform: [ubuntu-latest, windows-latest, macos-latest]
    
    runs-on: ${{ matrix.platform }}
    
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies (Ubuntu)
        if: matrix.platform == 'ubuntu-latest'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev \
            build-essential curl wget file libxdo-dev \
            libssl-dev libayatana-appindicator3-dev librsvg2-dev
      
      - name: Install pnpm dependencies
        run: pnpm install
      
      - name: Build Tauri app
        run: pnpm tauri build
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.platform }}-build
          path: src-tauri/target/release/bundle/
```

## 项目结构

```
VibeClip/
├── src/                # Vue 3 前端代码（页面、组件、stores、composables）
├── src-tauri/          # Rust 后端：剪贴板监听、数据库、AI 调用、托盘等
├── public/             # 静态资源与图标
├── docs/               # 额外文档（如 PasteMe 对标分析）
├── package.json        # 前端依赖与脚本
├── tauri.conf.json     # Tauri 桌面配置
└── README.md           # 当前文档
```

更多资料：

- [PasteMe 对标差异清单](docs/paste-me-gap-analysis.md)：追踪与竞品功能差异。
- `src-tauri/src/`：后端模块，包括数据库访问、AI 客户端、剪贴板桥接等实现。

## 发布流程

以下步骤以 **v2.8.1** 为例：

1. **版本同步**
   - 更新 `package.json`、`tauri.conf.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`、`src/AppInfo.ts` 等版本号。
   - 提交并打上标签：

     ```bash
     git checkout -b release/v2.8.1
     git push -u origin release/v2.8.1
     git tag -a v2.8.1 -m "VibeClip Pro v2.8.1"
     git push origin v2.8.1
     ```

2. **构建产物**

   ```bash
   pnpm build
   pnpm tauri build
   ```

   - `pnpm build`：生成 Web 静态资源到 `dist/`。
   - `pnpm tauri build`：在 `src-tauri/target/release/bundle/` 生成安装包与签名文件。

3. **发布资产**
   - 上传 `latest.json`、Windows 安装包（`.exe`、`.msi` 及 `.sig`）。
   - 若提供 macOS/Linux 版本，请附带 `.dmg`、`.AppImage`、`.deb` 等文件及签名。
   - 在 GitHub Release 页面撰写摘要，突出 OCR、全局右键菜单等亮点。

## 常见问题

- **AI 调用失败**：确认 API Key 正确、未处于离线模式，并检查网络代理配置。
- **剪贴板未捕获内容**：检查系统权限（macOS 需在隐私设置授权），或确认监听未被暂停。
- **构建失败**：确保 Rust 工具链版本满足要求，并安装 Tauri 所需系统依赖。

## 许可证与更多资料

- 代码遵循 [MIT License](LICENSE)。
- 请遵守所集成的第三方服务（如 OpenAI 或兼容接口）的使用条款。
- 隐私与数据处理说明见 [PRIVACY.md](PRIVACY.md)。
