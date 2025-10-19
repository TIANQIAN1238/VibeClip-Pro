<script setup lang="ts">
import { computed, onMounted, onErrorCaptured, ref, watch } from "vue";
import {
  useSettingsStore,
  type ThemePreset,
  type CustomThemePalette,
  type QuickActionConfig,
  AI_PROVIDER_PRESETS,
} from "@/store/settings";
import { useHistoryStore } from "@/store/history";
import { useMessage } from "naive-ui";
import AppInfo from "@/AppInfo";
import { safeInvoke, isTauriRuntime } from "@/libs/tauri";
import { useLocale } from "@/composables/useLocale";
import { useContextMenu, type ContextMenuItem } from "@/composables/useContextMenu";
import GlobalContextMenu from "@/components/system/GlobalContextMenu.vue";
import WindowTitleBar from "@/components/layout/WindowTitleBar.vue";
import type { AiActionKind } from "@/types/history";
import MdiContentCopy from "~icons/mdi/content-copy";
import MdiDeleteOutline from "~icons/mdi/delete-outline";
import MdiArrowUp from "~icons/mdi/arrow-up";
import MdiArrowDown from "~icons/mdi/arrow-down";
import MdiPlus from "~icons/mdi/plus";
import MdiCheckCircle from "~icons/mdi/check-circle";
import MdiCircleOutline from "~icons/mdi/circle-outline";
import MdiChevronUp from "~icons/mdi/chevron-up";
import MdiChevronDown from "~icons/mdi/chevron-down";

const settings = useSettingsStore();
const history = useHistoryStore();
const message = useMessage();
const { t, languageOptions, format } = useLocale();
const contextMenu = useContextMenu();

const pageError = ref<string | null>(null);
const isInitializing = ref(false);
const runtimeSummary = ref<{ appVersion: string; tauriVersion: string; rustcChannel: string } | null>(null);

const booting = computed(() => !settings.hydrated);

const historyLimitValue = computed({
  get: () => settings.historyLimit,
  set: value => {
    const normalized = Number.isFinite(value) ? Number(value) : 200;
    settings.historyLimit = Math.min(Math.max(normalized, 50), 2000);
  },
});

const retentionDaysValue = computed({
  get: () => settings.historyRetentionDays ?? 0,
  set: value => {
    const normalized = Number.isFinite(value) ? Number(value) : 0;
    settings.historyRetentionDays = normalized > 0 ? Math.round(normalized) : null;
  },
});

const themePresetValue = computed<ThemePreset>({
  get: () => settings.themePreset as ThemePreset,
  set: value => {
    settings.setThemePreset(value);
  },
});

const themePresetOptions = computed(() => [
  {
    value: "aurora" as ThemePreset,
    label: t("settings.presetAurora", "极光蓝"),
    preview: "linear-gradient(135deg, #5161ff 0%, #7ad1f5 100%)",
  },
  {
    value: "sunset" as ThemePreset,
    label: t("settings.presetSunset", "暮光橙"),
    preview: "linear-gradient(135deg, #ff7a6a 0%, #ffd86b 100%)",
  },
  {
    value: "midnight" as ThemePreset,
    label: t("settings.presetMidnight", "薄荷夜"),
    preview: "linear-gradient(135deg, #2b5876 0%, #4ecca3 100%)",
  },
  {
    value: "forest" as ThemePreset,
    label: t("settings.presetForest", "森野绿"),
    preview: "linear-gradient(135deg, #4caf50 0%, #8bc34a 100%)",
  },
  {
    value: "nebula" as ThemePreset,
    label: t("settings.presetNebula", "星云紫"),
    preview: "linear-gradient(135deg, #9b6bff 0%, #f7a8ff 100%)",
  },
  {
    value: "ember" as ThemePreset,
    label: t("settings.presetEmber", "炽焰金"),
    preview: "linear-gradient(135deg, #ff9f4d 0%, #ffc76b 100%)",
  },
  {
    value: "custom" as ThemePreset,
    label: t("settings.presetCustom", "自定义"),
    preview: "linear-gradient(135deg, var(--vibe-accent) 0%, rgba(255, 255, 255, 0.8) 100%)",
  },
]);

const customThemePreview = computed(() => settings.customThemePalette);

function updateCustomTheme<K extends keyof CustomThemePalette>(key: K, value: string) {
  settings.updateCustomTheme({ [key]: value } as Pick<CustomThemePalette, K>);
}

const handleCustomColorChange = (key: keyof CustomThemePalette) => (value: string) => {
  updateCustomTheme(key, value);
};

const ignoredSourcesText = computed({
  get: () => settings.ignoredSources.join("\n"),
  set: value => {
    settings.ignoredSources = value
      .split(/\r?\n/)
      .map(entry => entry.trim())
      .filter(entry => entry.length > 0);
  },
});

const historyCountLabel = computed(() =>
  format("settings.historyCount", "剪贴板条目 {count}", { count: history.items.length })
);

const quickActionKindOptions = computed(() => [
  { value: "translate" as AiActionKind, label: t("ai.actions.translate", "翻译") },
  { value: "summarize" as AiActionKind, label: t("ai.actions.summarize", "摘要") },
  { value: "polish" as AiActionKind, label: t("ai.actions.polish", "润色") },
  { value: "jsonify" as AiActionKind, label: t("ai.actions.jsonify", "结构化") },
  { value: "custom" as AiActionKind, label: t("ai.actions.custom", "自定义") },
]);

const quickActionLanguageOptions = computed(() => [
  { value: "", label: t("settings.quickActionsLanguageAuto", "跟随首选语言") },
  { value: "zh-CN", label: t("ai.languages.zh", "中文") },
  { value: "en", label: t("ai.languages.en", "English") },
  { value: "ja", label: t("ai.languages.ja", "日本語") },
  { value: "ko", label: t("ai.languages.ko", "한국어") },
  { value: "fr", label: t("ai.languages.fr", "Français") },
]);

function reportError(label: string, error: unknown) {
  console.error(label, error);
  const detail = error instanceof Error ? error.message : String(error ?? "");
  message.error(`${label}${detail ? `：${detail}` : ""}`);
}

async function handleAutoLaunchChange(value: boolean) {
  try {
    await settings.toggleAutoLaunch(value);
    message.success(value ? "已开启开机自启" : "已关闭开机自启");
  } catch (error) {
    reportError("更新开机自启失败", error);
  }
}

async function clearHistory() {
  try {
    await history.clearHistory();
    message.success("缓存已清理");
  } catch (error) {
    reportError("清理缓存失败", error);
  }
}

const showAddProviderDialog = ref(false);
const selectedPreset = ref<'openai' | 'gemini' | 'claude' | 'deepseek' | 'openrouter' | 'local' | 'custom'>('openai');

const presetOptions = [
  { value: 'openai' as const, label: AI_PROVIDER_PRESETS.openai.name },
  { value: 'gemini' as const, label: AI_PROVIDER_PRESETS.gemini.name },
  { value: 'claude' as const, label: AI_PROVIDER_PRESETS.claude.name },
  { value: 'deepseek' as const, label: AI_PROVIDER_PRESETS.deepseek.name },
  { value: 'openrouter' as const, label: AI_PROVIDER_PRESETS.openrouter.name },
  { value: 'local' as const, label: AI_PROVIDER_PRESETS.local.name },
  { value: 'custom' as const, label: '自定义服务商' },
];

function openAddProviderDialog() {
  selectedPreset.value = 'openai';
  showAddProviderDialog.value = true;
}

function handleAddProvider() {
  const newProvider = settings.addAIProvider(selectedPreset.value);
  showAddProviderDialog.value = false;
  message.success(`已添加 ${newProvider.name}`);
}

function handleRemoveProvider(id: string) {
  const provider = settings.aiProviders.find(p => p.id === id);
  if (!provider) return;
  if (settings.aiProviders.length === 1) {
    message.error("至少需要保留一个服务商");
    return;
  }
  settings.removeAIProvider(id);
  message.success(`已删除 ${provider.name}`);
}

function handleToggleProvider(id: string) {
  const provider = settings.aiProviders.find(p => p.id === id);
  if (!provider) return;
  settings.updateAIProvider(id, { enabled: !provider.enabled });
  message.success(provider.enabled ? `已禁用 ${provider.name}` : `已启用 ${provider.name}`);
}

function handleSetActiveProvider(id: string) {
  settings.setActiveProvider(id);
  const provider = settings.aiProviders.find(p => p.id === id);
  if (provider) {
    message.success(`已切换到 ${provider.name}`);
  }
}

const testingProvider = ref<string | null>(null);
const expandedProviders = ref<Set<string>>(new Set());

function toggleProviderExpand(providerId: string) {
  if (expandedProviders.value.has(providerId)) {
    expandedProviders.value.delete(providerId);
  } else {
    expandedProviders.value.add(providerId);
  }
}

function isProviderExpanded(providerId: string): boolean {
  // Active provider is always expanded
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
    // 使用ai-sdk测试连接
    const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible');
    
    const ai = createOpenAICompatible({
      name: provider.name,
      apiKey: provider.apiKey,
      baseURL: provider.baseUrl,
    });
    
    // 简单的连接测试 - 尝试创建模型实例
    const model = ai.chatModel(provider.model);
    if (!model) {
      throw new Error('无法创建模型实例');
    }
    
    settings.updateAIProvider(provider.id, { status: 'connected' });
    message.success(`${provider.name} 连接成功!`);
  } catch (error) {
    settings.updateAIProvider(provider.id, { status: 'error' });
    const errorMsg = error instanceof Error ? error.message : '未知错误';
    message.error(`连接失败: ${errorMsg}`);
    console.error('Provider test failed:', error);
  } finally {
    testingProvider.value = null;
  }
}

function updateQuickAction(id: string, patch: Partial<QuickActionConfig>) {
  const current = settings.quickActions.find(action => action.id === id);
  if (!current) return;
  settings.upsertQuickAction({ ...current, ...patch });
}

function setQuickActionEnabled(action: QuickActionConfig, value: boolean) {
  updateQuickAction(action.id, { enabled: value });
}

function setQuickActionLabel(action: QuickActionConfig, value: string) {
  updateQuickAction(action.id, { label: value });
}

function setQuickActionLanguage(action: QuickActionConfig, value: string | null) {
  const normalized = value && value.trim().length ? value : null;
  updateQuickAction(action.id, { language: normalized });
}

function setQuickActionPrompt(action: QuickActionConfig, value: string) {
  updateQuickAction(action.id, { promptTemplate: value });
}

function setQuickActionDescription(action: QuickActionConfig, value: string) {
  updateQuickAction(action.id, { description: value });
}

function handleQuickActionLanguageChange(action: QuickActionConfig, value: unknown) {
  if (typeof value === "string") {
    setQuickActionLanguage(action, value);
    return;
  }
  setQuickActionLanguage(action, null);
}

function setQuickActionAllowPrompt(action: QuickActionConfig, value: boolean) {
  updateQuickAction(action.id, { allowCustomPrompt: value });
}

function handleQuickActionKindChange(action: QuickActionConfig, value: unknown) {
  const kind = (typeof value === "string" ? value : action.kind) as AiActionKind;
  const patch: Partial<QuickActionConfig> = { kind };
  if (kind !== "custom") {
    patch.promptTemplate = null;
    patch.allowCustomPrompt = false;
  } else if (!action.promptTemplate) {
    patch.promptTemplate = "";
    patch.allowCustomPrompt = true;
  }
  updateQuickAction(action.id, patch);
}

function addQuickAction() {
  const id = `custom-${Date.now().toString(36)}`;
  settings.upsertQuickAction({
    id,
    label: t("settings.quickActionsNew", "新的快捷指令"),
    kind: "custom",
    enabled: true,
    description: "",
    language: settings.preferredLanguage,
    promptTemplate: "",
    allowCustomPrompt: true,
  });
}

function removeQuickAction(id: string) {
  settings.removeQuickAction(id);
}

function resetQuickActions() {
  settings.resetQuickActions();
  message.success(t("settings.quickActionsResetSuccess", "已恢复默认快捷指令"));
}

function getQuickActionContextMenuItems(_action: QuickActionConfig, index: number): ContextMenuItem[] {
  const items: ContextMenuItem[] = [
    { key: "copy", label: t("contextMenu.copy", "复制配置"), icon: MdiContentCopy },
  ];
  
  if (index > 0) {
    items.push({ key: "move-up", label: "上移", icon: MdiArrowUp });
  }
  
  if (index < settings.quickActions.length - 1) {
    items.push({ key: "move-down", label: "下移", icon: MdiArrowDown });
  }
  
  items.push(
    { key: "divider-1", label: "", divider: true },
    { 
      key: "delete", 
      label: t("settings.quickActionsRemove", "删除"), 
      icon: MdiDeleteOutline, 
      danger: true,
      disabled: settings.quickActions.length <= 1
    }
  );
  
  return items;
}

function handleQuickActionContextMenu(event: MouseEvent, action: QuickActionConfig, index: number) {
  const items = getQuickActionContextMenuItems(action, index);
  contextMenu.showContextMenu(event, items, {
    type: "quick-action",
    data: { action, index },
    position: { x: event.clientX, y: event.clientY },
  });
}

async function handleContextMenuSelect(key: string) {
  const ctx = contextMenu.state.context;
  contextMenu.closeContextMenu();
  
  if (!ctx || ctx.type !== "quick-action") return;
  
  const { action, index } = ctx.data;
  
  switch (key) {
    case "copy": {
      const copy = {
        ...action,
        id: `custom-${Date.now().toString(36)}`,
        label: `${action.label} (副本)`,
      };
      settings.upsertQuickAction(copy);
      message.success("已复制快捷指令");
      break;
    }
    case "move-up":
      if (index > 0) {
        const actions = [...settings.quickActions];
        [actions[index - 1], actions[index]] = [actions[index], actions[index - 1]];
        settings.quickActions = actions;
      }
      break;
    case "move-down":
      if (index < settings.quickActions.length - 1) {
        const actions = [...settings.quickActions];
        [actions[index], actions[index + 1]] = [actions[index + 1], actions[index]];
        settings.quickActions = actions;
      }
      break;
    case "delete":
      removeQuickAction(action.id);
      break;
  }
}

async function runVacuum() {
  try {
    if (!isTauriRuntime()) {
      message.warning("预览模式下无需整理数据库");
      return;
    }
    await safeInvoke("vacuum_database");
    message.success("数据库已整理");
  } catch (error) {
    reportError("整理数据库失败", error);
  }
}

onMounted(async () => {
  isInitializing.value = true;
  try {
    await new Promise<void>(resolve => {
      if (settings.hydrated) {
        resolve();
      } else {
        const unwatch = watch(
          () => settings.hydrated,
          hydrated => {
            if (hydrated) {
              unwatch();
              resolve();
            }
          }
        );
        setTimeout(() => {
          unwatch();
          resolve();
        }, 3000);
      }
    });

    try {
      if (isTauriRuntime()) {
        runtimeSummary.value = await safeInvoke("get_runtime_summary");
      } else {
        runtimeSummary.value = {
          appVersion: AppInfo.version.value,
          tauriVersion: "preview",
          rustcChannel: "preview",
        };
      }
    } catch (error) {
      console.warn("[Settings] 无法获取运行时信息", error);
      // 设置默认值避免渲染错误
      runtimeSummary.value = {
        appVersion: AppInfo.version.value,
        tauriVersion: "N/A",
        rustcChannel: "N/A",
      };
    }
  } catch (error) {
    console.error("[Settings] Mount error:", error);
    pageError.value = error instanceof Error ? error.message : "页面初始化失败";
    // 确保即使出错也能显示基本内容
    runtimeSummary.value = {
      appVersion: AppInfo.version.value,
      tauriVersion: "N/A",
      rustcChannel: "N/A",
    };
  } finally {
    isInitializing.value = false;
  }
});

onErrorCaptured((err, _instance, info) => {
  console.error("[Settings] Error captured:", err, info);
  pageError.value = err instanceof Error ? err.message : "组件渲染错误";
  // 继续传播错误，但不阻止渲染
  return true;
});
</script>

<template>
  <div class="settings-page">
    <WindowTitleBar title="设置" />
    <section class="main">
      <n-alert v-if="pageError" type="error" title="页面错误" closable @close="pageError = null">
        {{ pageError }}
      </n-alert>

      <div v-if="booting || isInitializing" class="settings-skeleton">
        <n-skeleton height="36px" :sharp="false" />
        <div class="settings-skeleton-grid">
          <n-skeleton v-for="i in 3" :key="i" height="180px" :sharp="false" />
        </div>
      </div>
      <template v-else>
        <header class="page-header">
          <div>
            <h1>{{ t("settings.title", "设置") }}</h1>
            <p>{{ t("settings.subtitle", "自定义主题、快捷键与 AI 服务连接") }}</p>
          </div>
        </header>

        <Transition name="alert-fade">
          <n-alert v-if="settings.lastError" type="warning" show-icon class="settings-alert" closable @close="settings.lastError = null">
            {{ settings.lastError }}
          </n-alert>
        </Transition>

        <div class="content-scroll thin-scrollbar">
          <section class="card card--theme">
            <div class="card__header">
              <div>
                <h2>{{ t("settings.theme", "主题与显示") }}</h2>
                <p class="card__desc">选择外观模式和主题配色方案</p>
              </div>
            </div>
            
            <!-- 主题模式选择 -->
            <div class="theme-mode-section">
              <label class="section-label">外观模式</label>
              <n-radio-group v-model:value="settings.themeMode" name="theme">
                <div class="radio-grid">
                  <n-radio value="light">
                    <template #default>
                      <span class="radio-label">☀️ {{ t("settings.themeOptions.light", "浅色") }}</span>
                    </template>
                  </n-radio>
                  <n-radio value="dark">
                    <template #default>
                      <span class="radio-label">🌙 {{ t("settings.themeOptions.dark", "深色") }}</span>
                    </template>
                  </n-radio>
                  <n-radio value="system">
                    <template #default>
                      <span class="radio-label">💻 {{ t("settings.themeOptions.system", "跟随系统") }}</span>
                    </template>
                  </n-radio>
                </div>
              </n-radio-group>
            </div>
            
            <!-- 主题预设选择 -->
            <div class="theme-preset-section">
              <label class="section-label">主题配色</label>
              <div class="preset-grid">
                <button
                  v-for="option in themePresetOptions"
                  :key="option.value"
                  type="button"
                  class="preset-chip"
                  :class="{ active: themePresetValue === option.value }"
                  @click="themePresetValue = option.value"
                >
                  <span class="preset-swatch" :style="{ background: option.preview }" />
                  <span class="preset-label">{{ option.label }}</span>
                </button>
              </div>
            </div>
            <div v-if="themePresetValue === 'custom'" class="custom-theme-grid">
              <div class="field-column">
                <label>{{ t("settings.customBackground", "背景色") }}</label>
                <n-color-picker
                  :value="customThemePreview.background"
                  size="small"
                  @update:value="handleCustomColorChange('background')($event)"
                />
              </div>
              <div class="field-column">
                <label>{{ t("settings.customSurface", "面板色") }}</label>
                <n-color-picker
                  :value="customThemePreview.surface"
                  size="small"
                  @update:value="handleCustomColorChange('surface')($event)"
                />
              </div>
              <div class="field-column">
                <label>{{ t("settings.customSurfaceStrong", "高亮面板") }}</label>
                <n-color-picker
                  :value="customThemePreview.surfaceStrong"
                  size="small"
                  @update:value="handleCustomColorChange('surfaceStrong')($event)"
                />
              </div>
              <div class="field-column">
                <label>{{ t("settings.customBorder", "边框色") }}</label>
                <n-color-picker
                  :value="customThemePreview.border"
                  size="small"
                  @update:value="handleCustomColorChange('border')($event)"
                />
              </div>
              <div class="field-column">
                <label>{{ t("settings.customTextPrimary", "主文本") }}</label>
                <n-color-picker
                  :value="customThemePreview.textPrimary"
                  size="small"
                  @update:value="handleCustomColorChange('textPrimary')($event)"
                />
              </div>
              <div class="field-column">
                <label>{{ t("settings.customTextSecondary", "次文本") }}</label>
                <n-color-picker
                  :value="customThemePreview.textSecondary"
                  size="small"
                  @update:value="handleCustomColorChange('textSecondary')($event)"
                />
              </div>
              <div class="field-column">
                <label>{{ t("settings.customTextMuted", "弱文本") }}</label>
                <n-color-picker
                  :value="customThemePreview.textMuted"
                  size="small"
                  @update:value="handleCustomColorChange('textMuted')($event)"
                />
              </div>
            </div>
            <div class="field-row">
              <label>{{ t("settings.lineHeight", "内容行高") }}</label>
              <n-slider v-model:value="settings.lineHeight" :step="0.1" :min="1.2" :max="2" style="flex: 1;" />
              <span class="field-value">{{ settings.lineHeight.toFixed(1) }}</span>
            </div>
            <div class="field-row">
              <label>{{ t("settings.accent", "强调颜色") }}</label>
              <n-color-picker v-model:value="settings.accentColor" size="small" />
            </div>
            <div class="field-row">
              <label>{{ t("settings.uiLanguage", "界面语言") }}</label>
              <n-select v-model:value="settings.uiLanguage" size="small" :options="languageOptions" />
            </div>
            <div class="field-row">
              <label>{{ t("settings.shortcut", "全局快捷键") }}</label>
              <n-input v-model:value="settings.globalShortcut" placeholder="CmdOrControl+Shift+V" />
            </div>
          </section>

          <section class="card onboarding-card">
            <div class="onboarding-callout">
              <div class="callout-text">
                <span class="callout-chip">{{ t("settings.quickstart", "快速上手指南") }}</span>
                <h3>{{ t("settings.quickstartTitle", "动画教学随时重播") }}</h3>
                <p>{{ t("settings.quickstartHint", "如果错过了首次安装提示，可在此重新打开引导。") }}</p>
              </div>
              <n-button type="primary" size="tiny" @click="settings.openOnboarding()">
                {{ t("settings.quickstartAction", "重新打开引导") }}
              </n-button>
            </div>
          </section>

          <section class="card">
            <h2>{{ t("settings.clipboard", "剪贴板与历史") }}</h2>
            <div class="field-row">
              <label>{{ t("settings.historyLimit", "历史条目上限") }}</label>
              <n-input-number v-model:value="historyLimitValue" :min="50" :max="2000" size="small" />
            </div>
            <div class="field-row">
              <label>{{ t("settings.retention", "保留天数 (0 表示无限)") }}</label>
              <n-input-number v-model:value="retentionDaysValue" :min="0" :max="365" size="small" />
            </div>
            <div class="switch-row">
              <span>{{ t("settings.dedupe", "启用去重") }}</span>
              <n-switch v-model:value="settings.dedupeEnabled" size="small" />
            </div>
            <div class="switch-row">
              <span>{{ t("settings.ignoreSelf", "忽略自复制") }}</span>
              <n-switch v-model:value="settings.ignoreSelfCopies" size="small" />
            </div>
            <div class="field-column">
              <label>{{ t("settings.ignoredSources", "忽略的来源关键字") }}</label>
              <n-input
                v-model:value="ignoredSourcesText"
                type="textarea"
                :autosize="{ minRows: 3, maxRows: 6 }"
                placeholder="每行一个关键词"
              />
            </div>
          </section>

          <section class="card">
            <div class="section-header">
              <h2>{{ t("settings.ai", "AI 服务商") }}</h2>
              <n-button size="tiny" type="primary" @click="openAddProviderDialog">
                <template #icon>
                  <n-icon :component="MdiPlus" />
                </template>
                添加服务商
              </n-button>
            </div>

            <div class="providers-list">
              <div
                v-for="provider in settings.aiProviders"
                :key="provider.id"
                class="provider-card"
                :class="{ active: settings.activeProviderId === provider.id, disabled: !provider.enabled }"
              >
                <div class="provider-header" @click="toggleProviderExpand(provider.id)">
                  <div class="provider-info">
                    <n-icon
                      :component="settings.activeProviderId === provider.id ? MdiCheckCircle : MdiCircleOutline"
                      size="20"
                      :class="{ 'active-icon': settings.activeProviderId === provider.id }"
                      @click.stop="handleSetActiveProvider(provider.id)"
                      style="cursor: pointer;"
                    />
                    <span class="provider-name">{{ provider.name }}</span>
                    <n-tag v-if="provider.preset" size="tiny" type="info">{{ provider.preset }}</n-tag>
                    <n-tag v-if="provider.status === 'connected'" size="tiny" type="success">已连接</n-tag>
                    <n-tag v-if="provider.status === 'error'" size="tiny" type="error">连接失败</n-tag>
                    <n-tag v-if="provider.status === 'unconfigured'" size="tiny" type="warning">未配置</n-tag>
                    <n-icon
                      :component="isProviderExpanded(provider.id) ? MdiChevronUp : MdiChevronDown"
                      size="18"
                      class="expand-icon"
                    />
                  </div>
                  <div class="provider-actions" @click.stop>
                    <n-button
                      size="tiny"
                      secondary
                      :loading="testingProvider === provider.id"
                      @click="testProviderConnection(provider)"
                    >
                      测试连接
                    </n-button>
                    <n-button
                      size="tiny"
                      quaternary
                      :type="provider.enabled ? 'default' : 'success'"
                      @click="handleToggleProvider(provider.id)"
                    >
                      {{ provider.enabled ? '禁用' : '启用' }}
                    </n-button>
                    <n-button
                      size="tiny"
                      quaternary
                      type="error"
                      @click="handleRemoveProvider(provider.id)"
                    >
                      删除
                    </n-button>
                  </div>
                </div>

                <transition name="provider-expand">
                  <div v-if="isProviderExpanded(provider.id)" class="provider-fields">
                  <div class="field-row">
                    <label>{{ t("settings.apiBase", "接口地址") }}</label>
                    <n-input
                      :value="provider.baseUrl"
                      @update:value="(val: string) => settings.updateAIProvider(provider.id, { baseUrl: val })"
                      placeholder="https://"
                      size="small"
                    />
                  </div>
                  <div class="field-row">
                    <label>{{ t("settings.apiKey", "API Key") }}</label>
                    <n-input
                      :value="provider.apiKey"
                      @update:value="(val: string) => settings.updateAIProvider(provider.id, { apiKey: val })"
                      type="password"
                      show-password-on="click"
                      size="small"
                    />
                  </div>
                  <div class="field-row">
                    <label>{{ t("settings.model", "模型") }}</label>
                    <n-input
                      :value="provider.model"
                      @update:value="(val: string) => settings.updateAIProvider(provider.id, { model: val })"
                      placeholder="gemini-2.5-flash"
                      size="small"
                    />
                  </div>
                  <div class="field-row">
                    <label>{{ t("settings.temperature", "温度") }}</label>
                    <n-slider
                      :value="provider.temperature"
                      @update:value="(val: number) => settings.updateAIProvider(provider.id, { temperature: val })"
                      :step="0.1"
                      :min="0"
                      :max="1"
                      style="flex: 1;"
                    />
                    <span class="field-value">{{ provider.temperature.toFixed(1) }}</span>
                  </div>
                  <div class="switch-row">
                    <span>{{ t("settings.corsMode", "CORS 兼容模式") }}</span>
                    <n-switch 
                      :value="provider.corsMode ?? false"
                      @update:value="(val: boolean) => settings.updateAIProvider(provider.id, { corsMode: val })"
                      size="small"
                    />
                  </div>
                  </div>
                </transition>
              </div>
            </div>
          </section>

          <n-modal v-model:show="showAddProviderDialog" preset="dialog" title="添加 AI 服务商">
            <div class="field-column" style="gap: 16px;">
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

          <section class="card">
            <h2>{{ t("settings.quickActions", "AI 快捷按钮") }}</h2>
            <p class="muted">{{ t("settings.quickActionsHint", "自定义列表、语言与 Prompt，让浮窗与面板更贴合使用习惯") }}</p>
            <div class="quick-actions-list">
              <article 
                v-for="(action, index) in settings.quickActions" 
                :key="action.id" 
                class="quick-action-item"
                @contextmenu="handleQuickActionContextMenu($event, action, index)"
              >
                <div class="quick-action-header">
                  <n-switch
                    :value="action.enabled !== false"
                    size="small"
                    @update:value="setQuickActionEnabled(action, $event)"
                  />
                  <n-input
                    class="quick-action-name"
                    size="small"
                    :value="action.label"
                    :placeholder="t('settings.quickActionsNamePlaceholder', '快捷指令名称')"
                    @update:value="setQuickActionLabel(action, $event)"
                  />
                  <n-button
                    size="tiny"
                    quaternary
                    @click="removeQuickAction(action.id)"
                    :disabled="settings.quickActions.length <= 1"
                  >
                    {{ t("settings.quickActionsRemove", "删除") }}
                  </n-button>
                </div>
                <div class="quick-action-grid">
                  <n-select
                    class="quick-action-kind"
                    size="small"
                    :value="action.kind"
                    :options="quickActionKindOptions"
                    @update:value="handleQuickActionKindChange(action, $event)"
                  />
                  <n-select
                    class="quick-action-language"
                    size="small"
                    :value="action.language ?? ''"
                    :options="quickActionLanguageOptions"
                    @update:value="handleQuickActionLanguageChange(action, $event)"
                  />
                  <n-switch
                    v-if="action.kind === 'custom'"
                    size="small"
                    :value="action.allowCustomPrompt !== false"
                    @update:value="setQuickActionAllowPrompt(action, $event)"
                  >
                    {{ t("settings.quickActionsAllowEdit", "允许执行时编辑 Prompt") }}
                  </n-switch>
                </div>
                <n-input
                  v-if="action.kind === 'custom'"
                  type="textarea"
                  :value="action.promptTemplate ?? ''"
                  :autosize="{ minRows: 2, maxRows: 4 }"
                  :placeholder="t('settings.quickActionsPromptPlaceholder', '可选：执行时的默认 Prompt，支持 {{clipboard}} 占位符')"
                  @update:value="setQuickActionPrompt(action, $event)"
                />
                <n-input
                  type="textarea"
                  :value="action.description ?? ''"
                  :autosize="{ minRows: 1, maxRows: 2 }"
                  :placeholder="t('settings.quickActionsDescriptionPlaceholder', '可选：用于在面板中显示的说明')"
                  @update:value="setQuickActionDescription(action, $event)"
                />
              </article>
            </div>
            <div class="quick-action-footer">
              <n-button size="tiny" tertiary @click="addQuickAction">
                {{ t("settings.quickActionsAdd", "新增自定义指令") }}
              </n-button>
              <n-button size="tiny" quaternary @click="resetQuickActions">
                {{ t("settings.quickActionsReset", "恢复默认") }}
              </n-button>
            </div>
          </section>

          <section class="card">
            <h2>{{ t("settings.quickPanelSettings", "快捷面板与 AI") }}</h2>
            <div class="switch-row">
              <span>{{ t("settings.quickPanelAutoShow", "复制后自动显示快捷面板") }}</span>
              <n-switch v-model:value="settings.quickPanelAutoShow" size="small" />
            </div>
            <div class="switch-row">
              <span>{{ t("settings.quickPanelAutoClose", "AI 操作后自动关闭快捷面板") }}</span>
              <n-switch v-model:value="settings.quickPanelAutoClose" size="small" />
            </div>
            <div class="field-row">
              <label>{{ t("settings.aiResultMode", "AI 结果模式") }}</label>
              <n-select 
                v-model:value="settings.aiResultMode" 
                size="small" 
                :options="[
                  { value: 'auto', label: t('settings.aiResultModeAuto', '自动写入剪贴板') },
                  { value: 'preview', label: t('settings.aiResultModePreview', '预览后确认') }
                ]" 
              />
            </div>
            <p class="muted" style="margin-top: 8px; font-size: 12px;">
              {{ t("settings.aiResultModeHint", "自动模式：AI 完成后直接写入剪贴板；预览模式：显示结果供编辑后再复制") }}
            </p>
          </section>

          <section class="card">
            <h2>{{ t("settings.historyActions", "历史维护") }}</h2>
            <div class="switch-row">
              <span>{{ t("settings.autoLaunch", "开机自启") }}</span>
              <n-switch :value="settings.autoLaunch" size="small" @update:value="handleAutoLaunchChange" />
            </div>
            <div class="switch-row">
              <span>{{ t("settings.offline", "离线模式") }}</span>
              <n-switch v-model:value="settings.offlineMode" size="small" />
            </div>
            <div class="field-row">
              <label>{{ t("settings.languagePreference", "AI 输出语言") }}</label>
              <n-input v-model:value="settings.preferredLanguage" placeholder="zh-CN" />
            </div>
            <div class="button-grid">
              <n-button size="tiny" secondary @click="history.exportHistory">{{ t("settings.export", "导出历史") }}</n-button>
              <n-button size="tiny" secondary @click="history.importHistory">{{ t("settings.import", "导入历史") }}</n-button>
              <n-button size="tiny" secondary @click="runVacuum">{{ t("settings.vacuum", "整理数据库") }}</n-button>
              <n-button size="tiny" secondary @click="clearHistory">{{ t("settings.clearCache", "清除缓存") }}</n-button>
            </div>
          </section>

          <section class="card">
            <h2>{{ t("settings.version", "版本") }}</h2>
            <ul class="runtime-list">
              <li>{{ t("settings.version", "版本") }}：{{ AppInfo.version.value }}</li>
              <li v-if="runtimeSummary">Tauri：{{ runtimeSummary.tauriVersion }}</li>
              <li v-if="runtimeSummary">Rust：{{ runtimeSummary.rustcChannel }}</li>
              <li>{{ historyCountLabel }}</li>
            </ul>
          </section>
        </div>
      </template>
    </section>

    <GlobalContextMenu
      :show="contextMenu.state.show"
      :x="contextMenu.state.renderX"
      :y="contextMenu.state.renderY"
      :items="contextMenu.state.items"
      :ref="contextMenu.menuRef"
      @select="handleContextMenuSelect"
      @close="contextMenu.closeContextMenu"
    />
  </div>
</template>

<style scoped>
/* 主容器 */
.settings-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
  min-height: 0;
  background: linear-gradient(150deg, rgba(248, 250, 255, 0.96), rgba(234, 240, 255, 0.9));
  overflow: hidden;
}

:global(.dark) .settings-page {
  background: linear-gradient(150deg, rgba(14, 20, 32, 0.94), rgba(18, 24, 40, 0.88));
}

/* 主内容区 */
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
  min-height: 0;
}

/* 页面头部 */
.page-header {
  padding: 24px 32px 16px;
  border-bottom: 1px solid var(--vibe-panel-border);
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
}

:global(.dark) .page-header {
  background: rgba(20, 24, 32, 0.6);
}

.page-header h1 {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 700;
  color: var(--vibe-text-primary);
}

.page-header p {
  margin: 0;
  font-size: 14px;
  color: var(--vibe-text-secondary);
  line-height: 1.5;
}

/* 内容滚动区 */
.content-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 24px 32px 32px;
}

.thin-scrollbar::-webkit-scrollbar {
  width: 8px;
}

.thin-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.thin-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 4px;
}

.thin-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.25);
}

:global(.dark) .thin-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
}

:global(.dark) .thin-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* 卡片样式 - Clash Verge风格 */
.card {
  background: var(--vibe-panel-surface);
  border-radius: var(--vibe-radius-lg);
  border: 1px solid var(--vibe-panel-border);
  padding: 24px 28px;
  margin-bottom: 20px;
  box-shadow: var(--vibe-shadow-soft);
  backdrop-filter: blur(20px) saturate(130%);
  -webkit-backdrop-filter: blur(20px) saturate(130%);
  transition: all 220ms cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.card::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), transparent 50%);
  opacity: 0;
  transition: opacity 220ms ease;
  pointer-events: none;
}

.card:hover {
  transform: translateY(-1px);
  box-shadow: var(--vibe-shadow-medium);
  border-color: var(--vibe-border-strong);
}

.card:hover::before {
  opacity: 1;
}

.card__header {
  margin-bottom: 24px;
}

.card h2 {
  margin: 0 0 8px 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--vibe-text-primary);
  letter-spacing: -0.3px;
}

.card__desc {
  margin: 0;
  font-size: 12px;
  color: var(--vibe-text-secondary);
  line-height: 1.6;
}

.card p.muted {
  margin: -12px 0 20px;
  font-size: 12px;
  color: var(--vibe-text-secondary);
  line-height: 1.6;
}

.section-label {
  display: block;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vibe-text-primary);
  letter-spacing: -0.2px;
}

/* 分组头部 */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-header h2 {
  margin: 0;
}

/* 字段行 - 模仿手机设置界面 */
.field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-height: 56px;
  padding: 14px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

:global(.dark) .field-row {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.field-row:last-child {
  border-bottom: none;
}

.field-row label {
  flex-shrink: 0;
  min-width: 140px;
  font-size: 14px;
  font-weight: 500;
  color: var(--vibe-text-primary);
}

.field-row :deep(.n-input),
.field-row :deep(.n-select),
.field-row :deep(.n-input-number) {
  flex: 1;
  min-width: 200px;
}

.field-row :deep(.n-slider) {
  flex: 1;
}

.field-value {
  min-width: 50px;
  text-align: right;
  font-size: 13px;
  color: var(--vibe-text-secondary);
  font-weight: 500;
}

/* 列布局 */
.field-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 0;
}

.field-column label {
  font-size: 14px;
  font-weight: 500;
  color: var(--vibe-text-primary);
  margin-bottom: 6px;
}

/* 开关行 */
.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-height: 56px;
  padding: 14px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

:global(.dark) .switch-row {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.switch-row:last-child {
  border-bottom: none;
}

.switch-row span {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: var(--vibe-text-primary);
}

/* 单选按钮组 */
.radio-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 12px;
  padding: 12px 0;
}

/* 主题预设网格 - Clash Verge风格 */
.theme-mode-section,
.theme-preset-section {
  margin-bottom: 24px;
}

.theme-mode-section:last-child,
.theme-preset-section:last-child {
  margin-bottom: 0;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(135px, 1fr));
  gap: 12px;
}

.preset-chip {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--vibe-radius-md);
  border: 2px solid var(--vibe-border-soft);
  background: var(--vibe-control-bg);
  cursor: pointer;
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 13px;
  font-weight: 600;
  color: var(--vibe-text-primary);
  position: relative;
  overflow: hidden;
}

.preset-chip::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), transparent 60%);
  opacity: 0;
  transition: opacity 200ms ease;
}

.preset-chip:hover {
  border-color: var(--vibe-accent);
  transform: translateY(-2px) scale(1.02);
  box-shadow: var(--vibe-shadow-soft);
  background: var(--vibe-control-hover);
}

.preset-chip:hover::before {
  opacity: 1;
}

.preset-chip.active {
  border-color: var(--vibe-accent);
  border-width: 2px;
  background: var(--vibe-accent-light, rgba(79, 107, 255, 0.1));
  box-shadow: 0 0 0 3px var(--vibe-accent-light, rgba(79, 107, 255, 0.15)),
              var(--vibe-shadow-medium);
  transform: translateY(-1px) scale(1.02);
}

.preset-chip.active::after {
  content: "✓";
  position: absolute;
  top: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--vibe-accent);
  color: white;
  font-size: 12px;
  font-weight: 700;
  display: grid;
  place-items: center;
}

.preset-swatch {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 2px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: transform 200ms ease;
}

.preset-chip:hover .preset-swatch {
  transform: scale(1.1);
}

.preset-chip.active .preset-swatch {
  border-color: var(--vibe-accent);
  box-shadow: 0 0 0 2px var(--vibe-accent-light, rgba(79, 107, 255, 0.25));
}

.preset-label {
  flex: 1;
  letter-spacing: -0.1px;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
}

/* 自定义主题网格 */
.custom-theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 18px;
  padding: 18px 0;
}

/* 按钮网格 */
.button-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 14px;
  padding: 12px 0;
}

/* 引导卡片 */
.onboarding-card {
  background: linear-gradient(135deg, rgba(79, 107, 255, 0.08), rgba(122, 209, 245, 0.08));
  border-color: rgba(79, 107, 255, 0.2);
}

:global(.dark) .onboarding-card {
  background: linear-gradient(135deg, rgba(79, 107, 255, 0.12), rgba(122, 209, 245, 0.12));
  border-color: rgba(122, 209, 245, 0.2);
}

.onboarding-callout {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.callout-text {
  flex: 1;
}

.callout-chip {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--vibe-accent);
  color: white;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.callout-text h3 {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--vibe-text-primary);
}

.callout-text p {
  margin: 0;
  font-size: 13px;
  color: var(--vibe-text-secondary);
  line-height: 1.5;
}

/* AI服务商列表 */
.providers-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.provider-card {
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.6);
  overflow: hidden;
  transition: all 0.2s ease;
}

:global(.dark) .provider-card {
  background: rgba(40, 44, 52, 0.6);
  border-color: rgba(255, 255, 255, 0.1);
}

.provider-card.active {
  border-color: var(--vibe-accent);
  box-shadow: 0 0 0 2px rgba(79, 107, 255, 0.1);
}

.provider-card.disabled {
  opacity: 0.5;
}

.provider-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.provider-header:hover {
  background: rgba(0, 0, 0, 0.02);
}

:global(.dark) .provider-header:hover {
  background: rgba(255, 255, 255, 0.04);
}

.provider-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.provider-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--vibe-text-primary);
}

.active-icon {
  color: #00c853;
}

.expand-icon {
  color: var(--vibe-text-secondary);
  transition: transform 0.2s ease;
}

.provider-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.provider-fields {
  padding: 0 20px 20px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

:global(.dark) .provider-fields {
  border-top-color: rgba(255, 255, 255, 0.08);
}

.provider-expand-enter-active,
.provider-expand-leave-active {
  transition: all 0.3s ease;
  max-height: 500px;
}

.provider-expand-enter-from,
.provider-expand-leave-to {
  max-height: 0;
  opacity: 0;
}

/* 快捷指令列表 */
.quick-actions-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 12px 0;
}

.quick-action-item {
  padding: 18px 22px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.6);
  transition: all 0.2s ease;
}

:global(.dark) .quick-action-item {
  background: rgba(40, 44, 52, 0.6);
  border-color: rgba(255, 255, 255, 0.1);
}

.quick-action-item:hover {
  border-color: rgba(79, 107, 255, 0.3);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.quick-action-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.quick-action-name {
  flex: 1;
}

.quick-action-grid {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}

.quick-action-kind,
.quick-action-language {
  min-width: 0;
}

.quick-action-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0 0;
}

/* 骨架屏 */
.settings-skeleton {
  padding: 24px 32px;
}

.settings-skeleton-grid {
  display: grid;
  gap: 20px;
  margin-top: 24px;
}

/* 警告提示 */
.settings-alert {
  margin: 0 32px 20px 32px;
}

/* 警告淡入淡出动画 */
.alert-fade-enter-active,
.alert-fade-leave-active {
  transition: all 0.3s ease;
}

.alert-fade-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.alert-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* 运行时信息列表 */
.runtime-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.runtime-list li {
  padding: 8px 0;
  font-size: 13px;
  color: var(--vibe-text-secondary);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

:global(.dark) .runtime-list li {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.runtime-list li:last-child {
  border-bottom: none;
}

/* 通用样式 */
.muted {
  color: var(--vibe-text-secondary);
}

/* 响应式布局 */
@media (max-width: 768px) {
  .page-header {
    padding: 20px 24px 12px;
  }

  .page-header h1 {
    font-size: 24px;
  }

  .content-scroll {
    padding: 20px 24px 24px;
  }

  .card {
    padding: 20px 24px;
  }

  .field-row,
  .switch-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .field-row label {
    min-width: auto;
  }

  .field-row :deep(.n-input),
  .field-row :deep(.n-select),
  .field-row :deep(.n-input-number),
  .field-row :deep(.n-slider) {
    width: 100%;
  }

  .preset-grid {
    grid-template-columns: 1fr;
  }

  .quick-action-grid {
    grid-template-columns: 1fr;
  }

  .onboarding-callout {
    flex-direction: column;
    align-items: flex-start;
  }
}

/* 减少动画 */
@media (prefers-reduced-motion: reduce) {
  .card,
  .preset-chip,
  .provider-card,
  .quick-action-item,
  .provider-header,
  .expand-icon {
    transition-duration: 0.01ms !important;
    transform: none !important;
  }
}
</style>

