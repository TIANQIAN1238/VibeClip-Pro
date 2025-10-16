# Changelog

## v1.3.0 · 2025-10-20

### ✨ 剪贴板增强
- 新增后台轮询监听器，可在 250~400 ms 节流间隔内持续捕获文本、图像与文件三种剪贴板内容，并带时间戳落盘。
- 引入内容哈希去重与 SQLite `upsert` 逻辑，避免重复记录并兼容历史库迁移。
- 历史页增加类型筛选、搜索框、虚拟滚动与图片懒加载，连续复制 5+ 条内容依旧顺畅显示。

### 🤖 AI 与交互
- 历史项新增右键菜单：翻译 / 摘要 / 润色，可复制结果或保存回历史，未配置 API Key 时引导至设置。
- 侧栏扩展为「剪贴板 / 历史记录 / 收藏 / AI 工具 / 设置」，窗口拖拽与托盘行为保持稳定。

### 🎨 体验与文档
- 设置页改为自适应单列布局，减少留白并在窄屏保持可用。
- 应用左下角版本号自动同步 `@tauri-apps/api/app.getVersion()`（v1.3.0）。
- README 与发布指引更新至 v1.3.0，补充全新功能亮点。

## v1.2.1 (2025-10-16)
- Fix: removed deprecated set_transparent API (Tauri v2)
- Fix: clean up build warnings and ensure compatibility
- Improve: verified pnpm tauri dev/build runs successfully

## v1.2.0 · 2025-10-18

### 🛠 可用性修复
- 解决了设置 Store 在应用挂载前同步 `await` Tauri Store 调用导致的白屏问题，改为启动后异步拉取并在 3 秒超时后使用默认值渲染界面。
- 重写主界面框架，引入窗口标题栏拖拽区域、骨架屏与错误提示，确保首次打开 2 秒内可见内容且窗口可拖动。
- 统一跨进程调用的异常上报与通知桥接，防止初始化阶段因未捕获错误静默失败。
- Rust 端在 Debug 环境禁用透明窗口并自动打开 DevTools，便于排查页面渲染问题。

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
