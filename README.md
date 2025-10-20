# VibeClip Pro

> 跨平台 AI 增强型剪贴板管理工具，让「复制 → 处理 → 粘贴」保持顺畅。基于 Tauri 2 + Vue 3 构建，支持 Windows、macOS、Linux 三大平台，提供原生桌面体验。

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Built with Tauri](https://img.shields.io/badge/Desktop-Tauri%202-blue.svg)](https://tauri.app)
[![Vue 3](https://img.shields.io/badge/Web-Vue%203-42b983.svg)](https://vuejs.org)
[![Latest Release](https://img.shields.io/github/v/release/TIANQIAN1238/VibeClip-Pro)](https://github.com/TIANQIAN1238/VibeClip-Pro/releases)

## 📑 目录

- [产品概览](#产品概览)
- [核心特性](#核心特性)
- [快速安装](#快速安装)
- [AI 配置](#ai-配置)
- [开发环境](#开发环境)
- [跨平台构建](#跨平台构建)
- [项目结构](#项目结构)
- [常见问题](#常见问题)
- [更新日志](#更新日志)
- [许可证](#许可证)

## 产品概览

VibeClip Pro 是一款专注于提升剪贴板效率的桌面应用，提供实时捕获、历史管理、AI 快捷操作与全局快捷键等功能。采用现代化的毛玻璃视觉设计，支持深浅色主题切换。

**最新版本**：**v2.9.3**（2025-10-20）

### 支持平台

| 平台 | 安装包格式 | 系统要求 |
|------|-----------|---------|
| 🪟 Windows | `.exe` (NSIS) / `.msi` | Windows 10/11 (64-bit) |
| 🍎 macOS | `.dmg` / `.app` | macOS 13+ (Apple Silicon / Intel) |
| 🐧 Linux | `.deb` / `.rpm` / `.AppImage` | Ubuntu 22.04+ / Fedora 38+ |

## 核心特性

### 🎯 智能剪贴板管理

- **实时捕获**：自动监听系统剪贴板，支持文本、图像（Base64）、文件路径三种类型
- **历史记录**：最多保存 500 条记录，支持收藏、置顶、搜索、批量导入导出
- **内容去重**：自动过滤重复内容，可配置黑名单关键词
- **快捷面板**：`Ctrl+Shift+V` 呼出浮动面板，快速访问最近 5 条记录

### 🤖 AI 快捷操作

内置多种 AI 增强功能，支持自定义 Prompt 模板：

| 功能 | 说明 | 支持类型 |
|------|------|---------|
| 🌐 AI 翻译 | 智能检测语言并翻译为目标语言 | 文本 |
| 📝 AI 摘要 | 提炼关键要点，输出条列式摘要 | 文本 |
| ✨ AI 润色 | 提升文本流畅度与专业性 | 文本 |
| 📊 结构化 JSON | 将非结构化文本转换为 JSON 格式 | 文本 |
| 🔍 OCR 文字识别 | 从图片中提取文字内容 | 图像 |
| 📋 自定义指令 | 手动填写 Prompt 完成任意处理 | 全部 |

### 🎨 多 AI 服务商支持

支持同时配置多个 AI 服务商，一键切换：

- OpenAI Compatible（默认使用 FreeKey API）
- Google Gemini
- Anthropic Claude
- DeepSeek
- 阿里云百炼（DashScope）
- OpenRouter
- 本地模型（Ollama）
- 自定义端点

### 🎨 精美主题系统

- **主题预设**：Aurora、Sunset、Midnight、Forest、Nebula、Ember 六大预设
- **自定义调色板**：背景、表面、边框、文本颜色完全可定制
- **深浅模式**：支持跟随系统或手动切换
- **流畅动画**：毛玻璃效果与平滑过渡

### ⚡ 性能特性

- **轻量级**：后台运行占用 < 50MB 内存
- **节流轮询**：320ms 间隔监听剪贴板，避免资源浪费
- **事件驱动**：快捷面板采用事件通知机制，响应速度快
- **数据库优化**：SQLite WAL 模式 + 6 个复合索引，查询速度 < 10ms

### 🔧 其他功能

- **全局右键菜单**：统一的上下文菜单体验
- **开机自启**：可选择后台启动或显示主窗口
- **托盘驻留**：最小化到系统托盘，不占用任务栏
- **数据管理**：支持历史记录导入导出、清理、压缩
- **离线模式**：禁用所有 AI 功能，纯本地运行

## 快速安装

### Windows 用户

1. 访问 [GitHub Releases](https://github.com/TIANQIAN1238/VibeClip-Pro/releases/latest) 页面
2. 下载 `VibeClip_2.9.3_x64-setup.exe`（NSIS 安装程序，推荐）或 `VibeClip_2.9.3_x64_en-US.msi`
3. 双击安装包，按照向导完成安装
4. 首次启动会在系统托盘显示图标，按 `Ctrl+Shift+V` 呼出快捷面板

> **系统要求**：Windows 10/11 64-bit，需安装 [Microsoft Visual C++ Redistributable](https://aka.ms/vs/17/release/vc_redist.x64.exe)

### macOS 用户

1. 下载 `VibeClip_2.9.3_universal.dmg`（同时支持 Apple Silicon 和 Intel 芯片）
2. 打开 DMG 文件，拖动 VibeClip Pro 到 Applications 文件夹
3. 首次运行需在「系统设置 → 隐私与安全性」中允许运行
4. 授予辅助功能权限以启用快捷键和剪贴板监听

> **系统要求**：macOS 13 Ventura 或更高版本

### Linux 用户

#### Debian/Ubuntu（.deb 包）

```bash
# 下载并安装
wget https://github.com/TIANQIAN1238/VibeClip-Pro/releases/download/v2.9.3/vibeclip-pro_2.9.3_amd64.deb
sudo dpkg -i vibeclip-pro_2.9.3_amd64.deb

# 修复依赖（如果需要）
sudo apt-get install -f
```

#### Fedora/RHEL（.rpm 包）

```bash
# 下载并安装
wget https://github.com/TIANQIAN1238/VibeClip-Pro/releases/download/v2.9.3/vibeclip-pro-2.9.3-1.x86_64.rpm
sudo rpm -i vibeclip-pro-2.9.3-1.x86_64.rpm
```

#### 通用 AppImage

```bash
# 下载并运行
wget https://github.com/TIANQIAN1238/VibeClip-Pro/releases/download/v2.9.3/vibeclip-pro_2.9.3_amd64.AppImage
chmod +x vibeclip-pro_2.9.3_amd64.AppImage
./vibeclip-pro_2.9.3_amd64.AppImage
```

> **系统要求**：Ubuntu 22.04+、Fedora 38+ 或其他主流发行版，需安装 `libwebkit2gtk-4.1`、`libayatana-appindicator3-1` 等依赖

### 首次配置

1. 点击托盘图标或按 `Ctrl+Shift+V` 打开应用
2. 进入 **设置 → AI 服务**，添加并配置 AI 服务商：
   - 填写 **API Key**（可使用默认的 FreeKey API 或自己的密钥）
   - 选择模型（推荐 `gemini-2.5-flash` 或 `gpt-4o-mini`）
   - 测试连接确保配置正确
3. 开启「连续监听剪贴板」，复制任意文本或图像即可自动保存
4. 右键历史记录可执行 AI 操作（翻译、摘要、OCR 等）

## AI 配置

### 使用默认免费 API

VibeClip Pro 默认配置了 FreeKey API（`https://api.freekey.site`），开箱即用：

1. 进入 **设置 → AI 服务**
2. 默认服务商已预配置，只需填写 API Key（可在 [FreeKey](https://freekey.site) 免费注册）
3. 点击「测试连接」验证配置

### 配置自定义 API

支持任何 OpenAI 兼容的 API 端点：

1. 点击「添加服务商」，选择预设或自定义
2. 填写以下信息：
   - **名称**：服务商显示名称
   - **Base URL**：API 端点地址（例如 `https://api.openai.com/v1`）
   - **API Key**：服务商提供的密钥
   - **模型名称**：使用的模型（例如 `gpt-4o-mini`）
   - **Temperature**：生成温度（0-1，建议 0.3）
3. 保存后点击「测试连接」验证

### 支持的服务商示例

| 服务商 | Base URL | 推荐模型 |
|--------|----------|---------|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta` | `gemini-2.0-flash-exp` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| 阿里云百炼 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| Ollama 本地 | `http://localhost:11434/v1` | `llama3.2` |

### 离线模式

如果不需要 AI 功能，可以在托盘菜单或设置中启用「离线模式」，禁用所有云端调用。

## 开发环境

### 环境要求

| 工具 | 最低版本 | 推荐版本 | 说明 |
|------|---------|---------|------|
| Node.js | 18.x LTS | 20.x LTS | JavaScript 运行时 |
| pnpm | 8.x | 9.x | 包管理器（推荐使用 `corepack enable pnpm`） |
| Rust | 1.72+ | 1.75+ | Tauri 后端编译 |
| Tauri CLI | 2.x | 2.2+ | 桌面构建工具 |

**平台特定依赖**：

- **Windows**：Visual Studio 2022 Build Tools + Windows SDK
- **macOS**：Xcode Command Line Tools
- **Linux**：`libwebkit2gtk-4.1-dev`、`build-essential`、`libssl-dev`、`libayatana-appindicator3-dev`

### 快速开始

```bash
# 克隆仓库
git clone https://github.com/TIANQIAN1238/VibeClip-Pro.git
cd VibeClip-Pro

# 安装依赖
pnpm install

# 启动开发服务器（仅 Web 前端）
pnpm dev

# 启动桌面开发环境（推荐）
pnpm tauri dev
```

开发模式下：

- 前端：`http://localhost:1420`（支持热重载）
- 后端：自动编译 Rust 代码并重启
- DevTools：开发环境自动打开浏览器开发者工具

### 常用命令

```bash
# 类型检查
pnpm lint

# 构建前端资源
pnpm build

# 构建桌面安装包
pnpm tauri build

# Rust 代码检查
cd src-tauri
cargo check
cargo fmt
cargo clippy
```

## 跨平台构建

### Windows 构建

在 Windows 系统下运行：

```bash
pnpm tauri build
```

生成的文件位于 `src-tauri/target/release/bundle/`：

- `nsis/*.exe` - NSIS 安装程序（推荐）
- `msi/*.msi` - Windows Installer 包

### macOS 构建

在 macOS 系统下运行：

```bash
pnpm tauri build
```

生成的文件：

- `dmg/*.dmg` - 磁盘映像（推荐分发格式）
- `macos/*.app` - 应用程序包

**代码签名**（可选）：

```bash
# 需要 Apple Developer 证书
export APPLE_CERTIFICATE="..."
export APPLE_CERTIFICATE_PASSWORD="..."
pnpm tauri build
```

### Linux 构建

在 Linux 系统下运行：

```bash
# 安装系统依赖（Ubuntu/Debian）
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev

# 构建
pnpm install
pnpm tauri build
```

生成的文件：

- `deb/*.deb` - Debian/Ubuntu 包
- `rpm/*.rpm` - Fedora/RHEL 包
- `appimage/*.AppImage` - 通用可执行文件

### 使用 WSL2 在 Windows 上构建 Linux 版本

Windows 用户可以通过 WSL2 构建 Linux 版本：

```bash
# 1. 安装 WSL2（如果尚未安装）
wsl --install -d Ubuntu-22.04

# 2. 进入 WSL2
wsl

# 3. 在 WSL2 中按照 Linux 构建步骤操作
```

### CI/CD 自动化构建

项目包含 GitHub Actions 工作流（`.github/workflows/build.yml`），支持自动构建所有平台的安装包：

- 推送标签 `v*.*.*` 时自动触发
- 并行构建 Windows、macOS、Linux 版本
- 自动上传到 GitHub Releases

手动触发构建：

```bash
# 创建并推送标签
git tag -a v2.9.4 -m "Release v2.9.4"
git push origin v2.9.4
```

## 项目结构

```
VibeClip-Pro/
├── src/                          # Vue 3 前端代码
│   ├── pages/                    # 页面组件
│   │   ├── Clipboard.vue         # 实时剪贴板页面
│   │   ├── History.vue           # 历史记录页面
│   │   ├── AiTools.vue           # AI 工具页面
│   │   ├── Settings.vue          # 设置页面
│   │   └── QuickPanel.vue        # 快捷面板
│   ├── components/               # 可复用组件
│   │   ├── ai/                   # AI 相关组件
│   │   ├── history/              # 历史记录组件
│   │   ├── layout/               # 布局组件
│   │   └── system/               # 系统组件
│   ├── composables/              # Vue 组合式 API
│   │   ├── useAI.ts              # AI 功能封装
│   │   ├── useClipboard.ts       # 剪贴板操作
│   │   ├── useConfig.ts          # 配置管理
│   │   └── ...
│   ├── store/                    # Pinia 状态管理
│   │   ├── settings.ts           # 应用设置
│   │   ├── history.ts            # 历史记录
│   │   └── bridge.ts             # Tauri 桥接
│   ├── router/                   # Vue Router 路由
│   ├── styles/                   # 全局样式
│   └── main.ts                   # 入口文件
│
├── src-tauri/                    # Rust 后端代码
│   ├── src/
│   │   ├── main.rs               # 入口
│   │   ├── lib.rs                # Tauri 命令定义
│   │   ├── clipboard_watcher.rs  # 剪贴板监听器
│   │   ├── db.rs                 # SQLite 数据库
│   │   ├── ai_client.rs          # AI API 调用
│   │   ├── tray.rs               # 系统托盘
│   │   ├── state.rs              # 应用状态
│   │   └── ...
│   ├── Cargo.toml                # Rust 依赖配置
│   └── tauri.conf.json           # Tauri 应用配置
│
├── public/                       # 静态资源
├── docs/                         # 项目文档
├── .github/workflows/            # CI/CD 配置
├── package.json                  # 前端依赖
├── vite.config.ts                # Vite 构建配置
├── tailwind.config.ts            # Tailwind CSS 配置
├── tsconfig.json                 # TypeScript 配置
├── CHANGELOG.md                  # 版本更新日志
├── LICENSE                       # MIT 许可证
└── README.md                     # 本文档
```

## 常见问题

### 安装与运行

**Q: Windows 提示"无法验证发布者"或 SmartScreen 警告？**

A: 这是因为应用未购买代码签名证书。点击"更多信息"→"仍要运行"即可。应用是开源的，代码可审查。

**Q: macOS 提示"无法打开，因为它来自身份不明的开发者"？**

A: 右键点击应用 → 选择"打开" → 确认。或在终端运行：

     ```bash
xattr -cr /Applications/VibeClip\ Pro.app
     ```

**Q: Linux 缺少依赖库怎么办？**

A: 安装必要的系统库：

   ```bash
# Debian/Ubuntu
sudo apt-get install libwebkit2gtk-4.1-0 libayatana-appindicator3-1

# Fedora
sudo dnf install webkit2gtk4.1 libappindicator-gtk3
```

### 功能使用

**Q: 快捷键 `Ctrl+Shift+V` 不生效？**

A:

1. 检查是否与其他软件冲突（如 IDE、输入法）
2. 在设置中自定义快捷键
3. macOS 需在「系统设置 → 隐私与安全性 → 辅助功能」授权

**Q: 剪贴板没有自动捕获内容？**

A:

1. 确认「连续监听剪贴板」已开启（托盘菜单或设置页）
2. 检查是否触发了黑名单关键词过滤
3. macOS 需授予剪贴板访问权限

**Q: AI 功能无法使用？**

A:

1. 检查网络连接是否正常
2. 确认 API Key 和 Base URL 配置正确
3. 点击「测试连接」验证配置
4. 检查是否开启了离线模式

**Q: 历史记录过多导致性能下降？**

A: 在设置中：

1. 减少「历史记录上限」（默认 500，可降至 200）
2. 设置「自动清理天数」
3. 手动执行「清空历史」或「数据库压缩」

### 隐私与安全

**Q: VibeClip Pro 是否上传我的剪贴板数据？**

A:

- **本地优先**：所有剪贴板数据仅存储在本地 SQLite 数据库
- **AI 调用**：仅在用户手动触发 AI 操作时，才将当前内容发送到配置的 API 端点
- **无遥测**：不收集任何用户行为数据或分析信息
- **开源透明**：所有代码公开可审查

**Q: API Key 如何存储？**

A: 使用 Tauri Store 插件加密存储在本地，位置：

- Windows: `%APPDATA%\app.vibeclip.pro\store.bin`
- macOS: `~/Library/Application Support/app.vibeclip.pro/store.bin`
- Linux: `~/.config/app.vibeclip.pro/store.bin`

## 更新日志

### v2.9.3（2025-10-20）🎉 当前版本

**核心修复**：

- ✅ 修复快捷面板无法读取最新剪贴板内容的问题
- ✅ 改为事件驱动模式，响应速度提升 1500ms
- ✅ 修复快捷键 Toggle 行为不一致问题
- ✅ 彻底隐藏 Windows 原生标题栏

**AI 配置系统统一**：

- ✅ 统一所有 AI 功能使用 `activeProvider` 配置
- ✅ AI 对话历史持久化到 localStorage
- ✅ 修复多个页面的 AI 配置引用问题

**UI 优化**：

- ✅ 快捷面板窗口尺寸优化（420×560）
- ✅ 历史记录显示增至 5 条
- ✅ 卡片布局更舒适

详细更新内容见 [CHANGELOG.md](CHANGELOG.md)

### v2.9.1（2025-10-19）

- ✨ 新增离线翻译支持
- ✨ 多 AI 服务商配置系统
- ⚡ 剪贴板监听性能优化
- 🎨 主题系统增强

### v2.8.1（2025-10-15）

- ✨ 全局右键菜单
- 🔍 历史记录搜索
- 📊 数据导入导出

更多历史版本见 [完整更新日志](CHANGELOG.md)

## 路线图

### 即将推出（v2.10.x）

- [ ] 云端同步（可选）
- [ ] 插件系统
- [ ] 更多 AI 工具（代码补全、邮件助手等）
- [ ] 自定义 CSS 主题

### 长期规划

- [ ] 移动端应用（iOS/Android）
- [ ] 浏览器扩展
- [ ] 团队协作功能

## 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建功能分支（`git checkout -b feature/AmazingFeature`）
3. 提交更改（`git commit -m 'Add some AmazingFeature'`）
4. 推送到分支（`git push origin feature/AmazingFeature`）
5. 开启 Pull Request

代码规范：

- 前端：使用 ESLint + Prettier
- 后端：使用 `cargo fmt` 和 `cargo clippy`
- 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/)

## 许可证与致谢

### 许可证

本项目采用 [MIT License](LICENSE) 开源许可证。

### 技术栈

- [Tauri 2](https://tauri.app/) - 桌面应用框架
- [Vue 3](https://vuejs.org/) - 渐进式 JavaScript 框架
- [Naive UI](https://www.naiveui.com/) - Vue 3 组件库
- [Tailwind CSS](https://tailwindcss.com/) - 实用优先的 CSS 框架
- [SQLite](https://www.sqlite.org/) - 嵌入式数据库
- [Rust](https://www.rust-lang.org/) - 系统编程语言

### 特别鸣谢

- [ai-sdk](https://sdk.vercel.ai/) - AI 集成
- [Vercel AI SDK](https://sdk.vercel.ai/) - AI 工具调用
- [tauri-plugin-*](https://github.com/tauri-apps/plugins-workspace) - Tauri 官方插件

### 贡献者

感谢所有为本项目做出贡献的开发者！

## 社区与支持

- 📧 Email: <support@vibeclip.app>
- 🐛 Issue: [GitHub Issues](https://github.com/TIANQIAN1238/VibeClip-Pro/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/TIANQIAN1238/VibeClip-Pro/discussions)
- 📖 文档: [Wiki](https://github.com/TIANQIAN1238/VibeClip-Pro/wiki)

### Star History

如果觉得这个项目对你有帮助，请给个 ⭐ Star 支持一下！

[![Star History Chart](https://api.star-history.com/svg?repos=TIANQIAN1238/VibeClip-Pro&type=Date)](https://star-history.com/#TIANQIAN1238/VibeClip-Pro&Date)

---

<div align="center">

**用 ❤️ 构建，为效率而生**

[立即下载](https://github.com/TIANQIAN1238/VibeClip-Pro/releases/latest) · [查看文档](https://github.com/TIANQIAN1238/VibeClip-Pro/wiki) · [反馈问题](https://github.com/TIANQIAN1238/VibeClip-Pro/issues)

</div>
