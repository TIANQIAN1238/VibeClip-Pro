<script setup lang="ts">
import { computed, ref } from "vue";
import { useSettingsStore, AI_PROVIDER_PRESETS } from "@/store/settings";
import { useMessage } from "naive-ui";
import MdiCheckCircle from "~icons/mdi/check-circle";
import MdiCircleOutline from "~icons/mdi/circle-outline";
import MdiChevronDown from "~icons/mdi/chevron-down";
import MdiChevronUp from "~icons/mdi/chevron-up";
import MdiOpenInNew from "~icons/mdi/open-in-new";

const settings = useSettingsStore();
const message = useMessage();

const testingProvider = ref<string | null>(null);
const expandedProviders = ref<Set<string>>(new Set());

const activeProvider = computed(() => settings.activeProvider);

const providerGuides = [
  {
    name: "OpenAI",
    url: "https://platform.openai.com/api-keys",
    description: "获取 OpenAI API Key",
  },
  {
    name: "Google Gemini",
    url: "https://makersuite.google.com/app/apikey",
    description: "获取 Google AI Studio API Key",
  },
  {
    name: "Anthropic Claude",
    url: "https://console.anthropic.com/settings/keys",
    description: "获取 Claude API Key",
  },
  {
    name: "DeepSeek",
    url: "https://platform.deepseek.com/api_keys",
    description: "获取 DeepSeek API Key",
  },
  {
    name: "阿里云百炼",
    url: "https://bailian.console.aliyun.com/",
    description: "获取阿里云百炼 API Key",
  },
];

function toggleProviderExpand(providerId: string) {
  if (expandedProviders.value.has(providerId)) {
    expandedProviders.value.delete(providerId);
  } else {
    expandedProviders.value.add(providerId);
  }
}

function isProviderExpanded(providerId: string): boolean {
  if (providerId === settings.activeProviderId) return true;
  return expandedProviders.value.has(providerId);
}

async function testProviderConnection(provider: typeof settings.aiProviders[0]) {
  if (!provider.apiKey || !provider.baseUrl || !provider.model) {
    message.warning("请先填写完整的API配置");
    return;
  }

  testingProvider.value = provider.id;
  try {
    const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");

    const ai = createOpenAICompatible({
      name: provider.name,
      apiKey: provider.apiKey,
      baseURL: provider.baseUrl,
    });

    const model = ai.chatModel(provider.model);
    if (!model) {
      throw new Error("无法创建模型实例");
    }

    settings.updateAIProvider(provider.id, { status: "connected" });
    // 测试成功后自动设为活跃服务商
    if (settings.activeProviderId !== provider.id) {
      settings.setActiveProvider(provider.id);
      message.success(`${provider.name} 连接成功！已自动切换为当前使用的服务商`);
    } else {
      message.success(`${provider.name} 连接成功！`);
    }
  } catch (error) {
    settings.updateAIProvider(provider.id, { status: "error" });
    const errorMsg = error instanceof Error ? error.message : "未知错误";
    message.error(`连接失败: ${errorMsg}`);
    console.error("Provider test failed:", error);
  } finally {
    testingProvider.value = null;
  }
}

function handleSetActiveProvider(id: string) {
  settings.setActiveProvider(id);
  const provider = settings.aiProviders.find((p) => p.id === id);
  if (provider) {
    message.success(`已切换到 ${provider.name}`);
  }
}

function handleToggleProvider(id: string) {
  const provider = settings.aiProviders.find((p) => p.id === id);
  if (!provider) return;
  settings.updateAIProvider(id, { enabled: !provider.enabled });
  message.success(provider.enabled ? `已禁用 ${provider.name}` : `已启用 ${provider.name}`);
}

function handleRemoveProvider(id: string) {
  const provider = settings.aiProviders.find((p) => p.id === id);
  if (!provider) return;
  if (settings.aiProviders.length === 1) {
    message.error("至少需要保留一个服务商");
    return;
  }
  settings.removeAIProvider(id);
  message.success(`已删除 ${provider.name}`);
}

const showAddProviderDialog = ref(false);
const selectedPreset = ref<"openai" | "gemini" | "claude" | "deepseek" | "aliyun" | "openrouter" | "local" | "custom">("openai");

const presetOptions = [
  { value: "openai" as const, label: AI_PROVIDER_PRESETS.openai.name },
  { value: "gemini" as const, label: AI_PROVIDER_PRESETS.gemini.name },
  { value: "claude" as const, label: AI_PROVIDER_PRESETS.claude.name },
  { value: "deepseek" as const, label: AI_PROVIDER_PRESETS.deepseek.name },
  { value: "aliyun" as const, label: AI_PROVIDER_PRESETS.aliyun.name },
  { value: "openrouter" as const, label: AI_PROVIDER_PRESETS.openrouter.name },
  { value: "local" as const, label: AI_PROVIDER_PRESETS.local.name },
  { value: "custom" as const, label: "自定义服务商" },
];

function openAddProviderDialog() {
  selectedPreset.value = "openai";
  showAddProviderDialog.value = true;
}

function handleAddProvider() {
  const newProvider = settings.addAIProvider(selectedPreset.value);
  showAddProviderDialog.value = false;
  message.success(`已添加 ${newProvider.name}`);
}

function openGuideUrl(url: string) {
  window.open(url, "_blank");
}
</script>

<template>
  <div class="api-config-page">
    <!-- 顶部导航 -->
    <nav class="page-nav">
      <router-link to="/clipboard" class="nav-item" active-class="active">
        <span>剪切板</span>
      </router-link>
      <router-link to="/ai" class="nav-item" active-class="active">
        <span>AI 工具</span>
      </router-link>
      <router-link to="/settings" class="nav-item" active-class="active">
        <span>设置</span>
      </router-link>
    </nav>

    <div class="page-container">
      <header class="page-header">
        <div>
          <h1>API 配置</h1>
          <p>配置 AI 服务商，让 VibeClip 连接到大语言模型</p>
        </div>
        <n-button size="small" type="primary" @click="openAddProviderDialog">
          添加服务商
        </n-button>
      </header>

      <div class="content-area">
        <!-- 配置指南 -->
        <section class="guide-section">
          <div class="guide-header">
            <h2>🚀 快速开始</h2>
            <n-tag type="info" size="small">3分钟完成配置</n-tag>
          </div>
          <div class="guide-steps">
            <div class="guide-step">
              <div class="step-number">1</div>
              <div class="step-content">
                <h3>选择 AI 服务商</h3>
                <p>VibeClip 支持所有 OpenAI 兼容的 API 接口。选择以下任一服务商获取 API Key：</p>
              </div>
            </div>
            <div class="guide-links">
              <button
                v-for="guide in providerGuides"
                :key="guide.name"
                class="guide-link"
                @click="openGuideUrl(guide.url)"
              >
                <span class="link-title">{{ guide.name }}</span>
                <span class="link-desc">{{ guide.description }}</span>
                <n-icon :component="MdiOpenInNew" size="16" />
              </button>
            </div>
            <div class="guide-step">
              <div class="step-number">2</div>
              <div class="step-content">
                <h3>填写 API 配置</h3>
                <p>将获取的 API Key 填入下方的"当前使用"区域，配置 Base URL 和模型名称</p>
              </div>
            </div>
            <div class="guide-step">
              <div class="step-number">3</div>
              <div class="step-content">
                <h3>测试连接</h3>
                <p>点击"测试连接"按钮验证配置是否正确，连接成功后即可使用 AI 功能</p>
              </div>
            </div>
          </div>
        </section>

        <!-- 当前活跃服务商 -->
        <section v-if="activeProvider" class="active-provider-section">
          <div class="section-title">
            <h2>当前使用</h2>
            <n-tag type="success" size="small">活跃</n-tag>
          </div>
          <div class="active-provider-card">
            <div class="provider-name">
              <n-icon :component="MdiCheckCircle" size="20" color="#00c853" />
              <span>{{ activeProvider.name }}</span>
              <n-tag v-if="activeProvider.preset" size="tiny" type="info">
                {{ activeProvider.preset }}
              </n-tag>
              <n-tag v-if="activeProvider.status === 'connected'" size="tiny" type="success">
                已连接
              </n-tag>
              <n-tag v-if="activeProvider.status === 'error'" size="tiny" type="error">
                连接失败
              </n-tag>
              <n-tag v-if="activeProvider.status === 'unconfigured'" size="tiny" type="warning">
                未配置
              </n-tag>
            </div>
            <div class="config-fields">
              <div class="field-row">
                <label>API Base URL</label>
                <n-input
                  :value="activeProvider?.baseUrl"
                  @update:value="(val: string) => activeProvider && settings.updateAIProvider(activeProvider.id, { baseUrl: val })"
                  placeholder="https://api.example.com"
                  size="small"
                />
              </div>
              <div class="field-row">
                <label>API Key</label>
                <n-input
                  :value="activeProvider?.apiKey"
                  @update:value="(val: string) => activeProvider && settings.updateAIProvider(activeProvider.id, { apiKey: val })"
                  type="password"
                  show-password-on="click"
                  placeholder="sk-..."
                  size="small"
                />
              </div>
              <div class="field-row">
                <label>模型名称</label>
                <n-input
                  :value="activeProvider?.model"
                  @update:value="(val: string) => activeProvider && settings.updateAIProvider(activeProvider.id, { model: val })"
                  placeholder="gpt-4"
                  size="small"
                />
              </div>
              <div class="field-row">
                <label>温度 ({{ activeProvider?.temperature.toFixed(1) }})</label>
                <n-slider
                  :value="activeProvider?.temperature"
                  @update:value="(val: number) => activeProvider && settings.updateAIProvider(activeProvider.id, { temperature: val })"
                  :step="0.1"
                  :min="0"
                  :max="1"
                  style="flex: 1"
                />
              </div>
            </div>
            <div class="provider-actions">
              <n-button
                size="small"
                type="primary"
                :loading="testingProvider === activeProvider.id"
                @click="testProviderConnection(activeProvider)"
              >
                测试连接
              </n-button>
            </div>
          </div>
        </section>

        <!-- 所有服务商列表 -->
        <section class="providers-section">
          <h2>所有服务商</h2>
          <div class="providers-list">
            <div
              v-for="provider in settings.aiProviders"
              :key="provider.id"
              class="provider-item"
              :class="{ active: settings.activeProviderId === provider.id, disabled: !provider.enabled }"
            >
              <div class="provider-header" @click="toggleProviderExpand(provider.id)">
                <div class="provider-info">
                  <n-icon
                    :component="settings.activeProviderId === provider.id ? MdiCheckCircle : MdiCircleOutline"
                    size="18"
                    :class="{ 'active-icon': settings.activeProviderId === provider.id }"
                    @click.stop="handleSetActiveProvider(provider.id)"
                    style="cursor: pointer"
                  />
                  <span class="provider-name">{{ provider.name }}</span>
                  <n-tag v-if="provider.preset" size="tiny" type="info">{{ provider.preset }}</n-tag>
                  <n-tag v-if="provider.status === 'connected'" size="tiny" type="success">已连接</n-tag>
                  <n-tag v-if="provider.status === 'error'" size="tiny" type="error">连接失败</n-tag>
                  <n-icon
                    :component="isProviderExpanded(provider.id) ? MdiChevronUp : MdiChevronDown"
                    size="16"
                    class="expand-icon"
                  />
                </div>
                <div class="provider-quick-actions" @click.stop>
                  <n-button
                    size="tiny"
                    quaternary
                    :type="provider.enabled ? 'default' : 'success'"
                    @click="handleToggleProvider(provider.id)"
                  >
                    {{ provider.enabled ? "禁用" : "启用" }}
                  </n-button>
                  <n-button size="tiny" quaternary type="error" @click="handleRemoveProvider(provider.id)">
                    删除
                  </n-button>
                </div>
              </div>

              <transition name="expand">
                <div v-if="isProviderExpanded(provider.id)" class="provider-details">
                  <div class="field-row">
                    <label>API Base URL</label>
                    <n-input
                      :value="provider.baseUrl"
                      @update:value="(val: string) => settings.updateAIProvider(provider.id, { baseUrl: val })"
                      placeholder="https://api.example.com"
                      size="small"
                    />
                  </div>
                  <div class="field-row">
                    <label>API Key</label>
                    <n-input
                      :value="provider.apiKey"
                      @update:value="(val: string) => settings.updateAIProvider(provider.id, { apiKey: val })"
                      type="password"
                      show-password-on="click"
                      size="small"
                    />
                  </div>
                  <div class="field-row">
                    <label>模型名称</label>
                    <n-input
                      :value="provider.model"
                      @update:value="(val: string) => settings.updateAIProvider(provider.id, { model: val })"
                      size="small"
                    />
                  </div>
                  <div class="field-row">
                    <label>温度 ({{ provider.temperature.toFixed(1) }})</label>
                    <n-slider
                      :value="provider.temperature"
                      @update:value="(val: number) => settings.updateAIProvider(provider.id, { temperature: val })"
                      :step="0.1"
                      :min="0"
                      :max="1"
                      style="flex: 1"
                    />
                  </div>
                  <div class="provider-actions">
                    <n-button
                      size="small"
                      secondary
                      :loading="testingProvider === provider.id"
                      @click="testProviderConnection(provider)"
                    >
                      测试连接
                    </n-button>
                  </div>
                </div>
              </transition>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- 添加服务商对话框 -->
    <n-modal v-model:show="showAddProviderDialog" preset="dialog" title="添加 AI 服务商">
      <div class="field-column" style="gap: 16px">
        <div class="field-row">
          <label>选择预设</label>
          <n-select v-model:value="selectedPreset" :options="presetOptions" />
        </div>
      </div>
      <template #action>
        <n-button @click="showAddProviderDialog = false">取消</n-button>
        <n-button type="primary" @click="handleAddProvider">添加</n-button>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.api-config-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  background: linear-gradient(160deg, rgba(248, 249, 255, 0.9), rgba(238, 242, 255, 0.88));
  overflow: hidden;
}

.dark .api-config-page {
  background: linear-gradient(160deg, rgba(18, 22, 34, 0.92), rgba(16, 26, 46, 0.9));
}

.page-nav {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  padding: 0;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.7);
  border-bottom: 1px solid rgba(79, 107, 255, 0.1);
  z-index: 10;
}

.nav-item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px 20px;
  border-radius: 0;
  font-size: 14px;
  font-weight: 600;
  color: rgba(19, 31, 60, 0.68);
  text-decoration: none;
  background: rgba(255, 255, 255, 0.5);
  border-right: 1px solid rgba(79, 107, 255, 0.08);
  box-shadow: none;
  transition: all 160ms ease;
}

.nav-item:last-child {
  border-right: none;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.8);
  color: #3a50ff;
}

.nav-item.active {
  color: #3a50ff;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: inset 0 -3px 0 0 #3a50ff;
  font-weight: 700;
}

.dark .nav-item {
  background: rgba(33, 45, 68, 0.5);
  color: rgba(226, 234, 255, 0.7);
  border-right-color: rgba(122, 209, 245, 0.1);
}

.dark .nav-item:hover {
  background: rgba(33, 45, 68, 0.8);
  color: rgba(122, 209, 245, 0.9);
}

.dark .nav-item.active {
  color: #7ad1f5;
  background: rgba(33, 45, 68, 0.95);
  box-shadow: inset 0 -3px 0 0 #7ad1f5;
}

.page-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0 24px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 20px 0;
  flex-shrink: 0;
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--vibe-text-primary);
}

.page-header p {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--vibe-text-secondary);
}

.content-area {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-bottom: 24px;
}

.guide-section,
.active-provider-section,
.providers-section {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  border: 1px solid rgba(79, 107, 255, 0.12);
  box-shadow: 0 8px 24px rgba(36, 56, 128, 0.1);
  padding: 20px;
}

.dark .guide-section,
.dark .active-provider-section,
.dark .providers-section {
  background: rgba(26, 34, 55, 0.86);
  border-color: rgba(122, 209, 245, 0.16);
}

.guide-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.guide-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--vibe-text-primary);
}

.guide-steps {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.guide-step {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.step-number {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(79, 107, 255, 0.2), rgba(122, 209, 245, 0.2));
  border: 2px solid rgba(79, 107, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: #3a50ff;
  flex-shrink: 0;
}

.step-content h3 {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--vibe-text-primary);
}

.step-content p {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--vibe-text-secondary);
}

.active-provider-section h2,
.providers-section h2 {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
  color: var(--vibe-text-primary);
}

.guide-links {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-left: 52px;
  margin-bottom: 12px;
}

.guide-link {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(79, 107, 255, 0.14);
  background: rgba(255, 255, 255, 0.88);
  color: var(--vibe-text-primary);
  cursor: pointer;
  transition: all 160ms ease;
  position: relative;
}

.guide-link .n-icon {
  position: absolute;
  top: 12px;
  right: 12px;
  opacity: 0.5;
}

.link-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--vibe-text-primary);
}

.link-desc {
  font-size: 11px;
  color: var(--vibe-text-muted);
}

.guide-link:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(79, 107, 255, 0.18);
  border-color: rgba(79, 107, 255, 0.35);
}

.guide-link:hover .n-icon {
  opacity: 1;
}

.dark .guide-link {
  background: rgba(33, 45, 68, 0.6);
  border-color: rgba(122, 209, 245, 0.2);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.active-provider-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.provider-name {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--vibe-text-primary);
}

.config-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.field-row label {
  min-width: 120px;
  font-size: 12px;
  font-weight: 500;
  color: var(--vibe-text-secondary);
}

.field-column {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.provider-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.providers-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.provider-item {
  border-radius: 12px;
  border: 1px solid rgba(79, 107, 255, 0.12);
  background: rgba(255, 255, 255, 0.6);
  overflow: hidden;
  transition: all 180ms ease;
}

.provider-item.active {
  border-color: rgba(79, 107, 255, 0.3);
  background: rgba(79, 107, 255, 0.05);
}

.provider-item.disabled {
  opacity: 0.6;
}

.dark .provider-item {
  background: rgba(33, 45, 68, 0.5);
  border-color: rgba(122, 209, 245, 0.15);
}

.provider-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 160ms ease;
}

.provider-header:hover {
  background: rgba(79, 107, 255, 0.03);
}

.dark .provider-header:hover {
  background: rgba(122, 209, 245, 0.05);
}

.provider-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.provider-info .provider-name {
  font-size: 13px;
  font-weight: 500;
}

.active-icon {
  color: #00c853;
}

.expand-icon {
  margin-left: auto;
  color: var(--vibe-text-muted);
}

.provider-quick-actions {
  display: flex;
  gap: 8px;
}

.provider-details {
  padding: 0 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.expand-enter-active,
.expand-leave-active {
  transition: all 200ms ease;
  max-height: 500px;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

@media (max-width: 768px) {
  .guide-links {
    grid-template-columns: 1fr;
  }

  .field-row {
    flex-direction: column;
    align-items: stretch;
  }

  .field-row label {
    min-width: auto;
  }
}
</style>

