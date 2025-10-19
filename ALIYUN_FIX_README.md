# 阿里云百炼 API 兼容性修复

## 修复概述

本次修复解决了使用阿里云百炼平台 DeepSeek 模型时出现的 "Authentication Fails" 错误问题。

## 问题原因

1. **Base URL 不正确**：阿里云百炼使用 `https://dashscope.aliyuncs.com/compatible-mode/v1`，而不是标准的 DeepSeek API 地址
2. **URL 路径重复**：原代码会自动添加 `/v1/chat/completions`，导致最终 URL 变成 `...v1/v1/chat/completions`

## 已修复的文件

### 1. `src-tauri/src/ai_client.rs`
**修改内容**：
- 添加智能 URL 处理逻辑
- 自动检测 Base URL 是否已包含 `/v1` 路径
- 避免重复添加 `/v1` 导致的 404 错误

```rust
// 修复前
let url = format!("{}/v1/chat/completions", base_url);

// 修复后
let url = if base_url.ends_with("/v1") {
    format!("{}/chat/completions", base_url)
} else {
    format!("{}/v1/chat/completions", base_url)
};
```

### 2. `src/store/settings.ts`
**修改内容**：
- 添加 `aliyun` 预设配置类型
- 新增阿里云百炼的默认配置参数

```typescript
aliyun: {
  name: '阿里云百炼',
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  model: 'deepseek-r1',
  temperature: 0.3,
}
```

### 3. `src/pages/ApiConfig.vue`
**修改内容**：
- 添加阿里云百炼到服务商列表
- 新增阿里云百炼的快速链接

## 如何使用

### 方法一：使用预设配置（推荐）

1. 打开 VibeClip Pro
2. 进入 **API 配置** 页面
3. 点击 **"添加服务商"**
4. 选择 **"阿里云百炼"** 预设
5. 填入您的 API Key
6. 点击 **"测试连接"** 确认配置正确
7. 设置为当前使用的服务商

### 方法二：手动配置现有服务商

如果您已经有配置的服务商，只需修改：

1. **Base URL**: 改为 `https://dashscope.aliyuncs.com/compatible-mode/v1`
2. **模型**: 改为 `deepseek-r1`（或您购买的其他模型）
3. **API Key**: 保持不变
4. 点击 **"测试连接"** 验证

## 正确的配置参数

```
Base URL: https://dashscope.aliyuncs.com/compatible-mode/v1
API Key: sk-your-api-key-from-aliyun
模型: deepseek-r1
温度: 0.3
```

## 支持的模型

阿里云百炼支持的 DeepSeek 模型：
- `deepseek-r1` - DeepSeek R1 推理模型（推荐）
- `deepseek-chat` - DeepSeek 对话模型
- `deepseek-reasoner` - DeepSeek 推理增强版

请根据您在阿里云百炼购买的模型选择对应的模型名称。

## 重新编译应用

修改了 Rust 代码后，需要重新编译应用：

```bash
cd VibeClip-Pro
pnpm tauri build
```

或者在开发模式下运行：

```bash
cd VibeClip-Pro
pnpm tauri dev
```

## 验证修复

1. 配置好阿里云百炼的 API
2. 点击"测试连接"，应该显示成功
3. 进入 **AI 工具** 页面
4. 输入一些文本并点击"翻译"或"摘要"
5. 应该能正常获得 AI 响应，不再出现认证错误

## 常见问题

### Q: 还是提示认证失败？
**A**: 检查以下几点：
- API Key 是否完整且正确
- Base URL 是否为 `https://dashscope.aliyuncs.com/compatible-mode/v1`
- 模型名称是否与您购买的一致
- 账户余额是否充足
- 是否已重新编译应用

### Q: 测试连接成功但使用时失败？
**A**: 这表明 Base URL 配置不正确。请确保：
- 使用了阿里云百炼的 Base URL
- 没有在末尾添加额外的路径
- 已重新编译了应用

### Q: 其他 API 服务商是否受影响？
**A**: 不会。本次修复向后兼容，不影响：
- OpenAI
- Google Gemini
- Anthropic Claude
- DeepSeek 官方 API
- OpenRouter
- 本地模型（Ollama）

## 技术细节

### 为什么需要特殊处理？

阿里云百炼提供的是 OpenAI 兼容模式接口，但其 Base URL 已经包含了 `/v1` 路径：
- 阿里云百炼：`https://dashscope.aliyuncs.com/compatible-mode/v1`
- 标准 OpenAI：`https://api.openai.com`（代码会添加 `/v1/chat/completions`）

如果不特殊处理，最终 URL 会变成：
```
https://dashscope.aliyuncs.com/compatible-mode/v1/v1/chat/completions
                                                 ^^^ 重复了！
```

### 修复策略

通过检测 Base URL 是否以 `/v1` 结尾，智能决定是否添加 `/v1` 路径：
- 如果包含 `/v1`：只添加 `/chat/completions`
- 如果不包含 `/v1`：添加 `/v1/chat/completions`

这样既兼容阿里云百炼，又不影响其他服务商。

## 相关文档

- [阿里云百炼配置详细指南](./docs/aliyun-bailian-setup.md)
- [阿里云百炼控制台](https://bailian.console.aliyun.com/)
- [VibeClip Pro 用户文档](./README.md)

## 贡献者

- 修复日期：2025-01-19
- 修复内容：阿里云百炼 API 兼容性

---

如有问题，请参考 [详细配置指南](./docs/aliyun-bailian-setup.md) 或提交 Issue。

