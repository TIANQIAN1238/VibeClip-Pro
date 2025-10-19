# 阿里云百炼 API 配置指南

## 问题描述

如果您在使用阿里云百炼平台的 DeepSeek 模型时遇到 "Authentication Fails" 错误，即使测试连接成功，这通常是因为 Base URL 配置不正确导致的。

## 解决方案

### 1. 正确的配置参数

在 VibeClip Pro 的 **API 配置页面**，请使用以下配置：

#### Base URL
```
https://dashscope.aliyuncs.com/compatible-mode/v1
```

**重要提示**：
- ✅ 使用 `https://dashscope.aliyuncs.com/compatible-mode/v1`
- ❌ 不要使用 `https://api.deepseek.com/v1`（这是 DeepSeek 官方 API）
- ❌ 不要在末尾添加 `/v1/chat/completions`（代码会自动添加）

#### 模型名称

根据您在阿里云百炼购买的模型，选择对应的模型名称：

- `deepseek-r1` - DeepSeek R1 推理模型（推荐）
- `deepseek-chat` - DeepSeek 对话模型
- `deepseek-reasoner` - DeepSeek 推理增强版

#### API Key

使用您从阿里云百炼控制台生成的完整 API Key。

格式通常为：`sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

#### 温度（Temperature）

建议值：`0.3`（可根据需要调整 0.0 - 1.0）

### 2. 完整配置示例

```
服务商名称: 阿里云百炼-DeepSeek
Base URL: https://dashscope.aliyuncs.com/compatible-mode/v1
API Key: sk-your-actual-api-key-here
模型: deepseek-r1
温度: 0.3
```

### 3. 配置步骤

1. **打开 VibeClip Pro**
2. **进入 API 配置页面**
3. **添加新服务商**：
   - 点击"添加服务商"按钮
   - 选择"阿里云百炼"预设
4. **填写配置信息**：
   - 粘贴您的完整 API Key
   - 确认 Base URL 为 `https://dashscope.aliyuncs.com/compatible-mode/v1`
   - 选择正确的模型名称（如 `deepseek-r1`）
5. **测试连接**：
   - 点击"测试连接"按钮
   - 应该显示"连接成功"
6. **设置为活跃服务商**：
   - 确保该服务商被设置为"当前使用"

### 4. 获取阿里云百炼 API Key

1. 访问 [阿里云百炼控制台](https://bailian.console.aliyun.com/)
2. 登录您的阿里云账号
3. 进入"API Key 管理"页面
4. 创建或复制现有的 API Key
5. 确保您的账户已开通 DeepSeek 模型的使用权限

### 5. 常见问题排查

#### Q: 测试连接成功，但使用 AI 功能时仍然失败？

**A**: 这是因为测试连接只验证 API Key 格式，实际调用时需要正确的 Base URL。请确保：
- Base URL 完全匹配：`https://dashscope.aliyuncs.com/compatible-mode/v1`
- 模型名称与您购买的模型一致
- API Key 已激活且有足够的额度

#### Q: 提示"API Key 无效"？

**A**: 检查以下几点：
- API Key 是否完整复制（没有多余的空格或字符）
- API Key 是否已在阿里云控制台激活
- 是否为正确的业务空间生成的 API Key
- 账户余额是否充足

#### Q: 请求频率限制？

**A**: 阿里云百炼对 API 有调用限制：
- QPM（每分钟请求数）
- TPM（每分钟 Token 数）

请在阿里云控制台查看您的具体限制。

#### Q: 支持哪些 DeepSeek 模型？

**A**: 阿里云百炼支持的 DeepSeek 模型包括：
- `deepseek-r1` - 最新的推理模型
- `deepseek-chat` - 对话模型
- 其他模型请参考阿里云百炼文档

### 6. 技术说明

本次修复包含以下改进：

1. **智能 URL 处理**：自动检测 Base URL 是否已包含 `/v1` 路径，避免重复
2. **阿里云百炼预设**：添加了专门的配置预设，方便快速设置
3. **兼容性增强**：支持多种 OpenAI 兼容的 API 端点

### 7. 相关链接

- [阿里云百炼控制台](https://bailian.console.aliyun.com/)
- [阿里云百炼文档](https://help.aliyun.com/zh/model-studio/)
- [DeepSeek 模型介绍](https://www.deepseek.com/)

## 更新日志

- **2025-01-19**: 添加阿里云百炼支持
- 修复 Base URL 重复 `/v1` 路径的问题
- 添加阿里云百炼预设配置

---

如果您仍然遇到问题，请：
1. 检查完整的错误信息
2. 确认网络连接正常
3. 联系阿里云百炼技术支持

