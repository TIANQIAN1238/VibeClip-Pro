# Changelog

## v1.0.1 · 2025-10-17

### 🐞 修复
- 前端改用 Tauri v2 插件包（Dialog / FS 等）并更新窗口 API，解决依赖缺失与运行时报错。
- Tailwind 引入 `tailwindcss-animated` 官方插件配置，恢复动画类名支持。
- 修复 Rust 端 Store 读写、托盘菜单事件与数据库操作以适配 Tauri v2。

### ⚙️ 调整
- 升级版本号至 1.0.1，更新构建配置与发行文档。

## v1.0.0 · 2025-10-16

### ✨ 全面升级
- 项目更名为 **VibeClip Pro**，全新浅/深色主题与 220 px 渐变侧栏。
- 历史记录改为 SQLite 持久化，支持文本、图像（Base64）、文件路径的搜索、置顶、收藏与 JSON 导入导出。
- 新增 AI 快捷操作卡片（翻译 / 摘要 / 润色 / JSON 化 / 自定义 Prompt），兼容 OpenAI 接口并可一键写回剪贴板。

### 🧰 系统集成
- 默认全局快捷键 `Ctrl+Shift+V`，托盘菜单支持显示/隐藏、暂停监听、离线模式切换、退出。
- 设置页提供 API 配置、主题与行高调整、开机自启（插件封装）及缓存清理。
- Panel 浮窗重写，提供最近条目快速粘贴。

### ⚙️ 工程调整
- 构建体系切换至 `pnpm`，`tauri.conf.json`、脚本与文档同步更新。
- 前端使用 Vue 3 + Pinia + Naive UI 按需加载；Iconify 自动引入。
- Rust 端新增 `db.rs` / `ai_client.rs` / `clipboard.rs`，集中处理 SQLite 操作、AI 请求与状态管理。
