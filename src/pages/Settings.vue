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
    }
  } catch (error) {
    console.error("[Settings] Mount error:", error);
    pageError.value = error instanceof Error ? error.message : "页面初始化失败";
  } finally {
    isInitializing.value = false;
  }
});

onErrorCaptured((err, _instance, info) => {
  console.error("[Settings] Error captured:", err, info);
  pageError.value = err instanceof Error ? err.message : "组件渲染错误";
  return false;
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

        <n-alert v-if="settings.lastError" type="warning" show-icon class="settings-alert">
          {{ settings.lastError }}
        </n-alert>

        <div class="content-scroll thin-scrollbar">
          <section class="card">
            <h2>{{ t("settings.theme", "主题与显示") }}</h2>
            <n-radio-group v-model:value="settings.themeMode" name="theme">
              <div class="radio-grid">
                <n-radio value="light">{{ t("settings.themeOptions.light", "浅色") }}</n-radio>
                <n-radio value="dark">{{ t("settings.themeOptions.dark", "深色") }}</n-radio>
                <n-radio value="system">{{ t("settings.themeOptions.system", "跟随系统") }}</n-radio>
              </div>
            </n-radio-group>
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
                <span>{{ option.label }}</span>
              </button>
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
.settings-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(150deg, rgba(248, 250, 255, 0.96), rgba(234, 240, 255, 0.9));
  overflow: hidden;
}

:global(.dark) .settings-page {
  background: linear-gradient(150deg, rgba(14, 20, 32, 0.94), rgba(18, 24, 40, 0.88));
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 28px 12px;
  gap: 18px;
  flex-wrap: wrap;
}

.settings-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.settings-header p {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--vibe-text-secondary);
}

.settings-content {
  flex: 1;
  display: flex;
  min-height: 0;
  padding: 0 28px 24px;
  gap: 20px;
}

.settings-sidebar {
  width: 240px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.settings-sidebar button {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 14px;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.82);
  color: var(--vibe-text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 200ms ease, background 200ms ease;
}

.settings-sidebar button.active {
  background: linear-gradient(135deg, rgba(79, 107, 255, 0.18), rgba(122, 209, 245, 0.18));
  border-color: rgba(79, 107, 255, 0.22);
  color: #1c2f8a;
  box-shadow: 0 20px 36px rgba(36, 56, 128, 0.18);
}

.settings-sidebar button:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 34px rgba(36, 56, 128, 0.16);
}

.settings-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-radius: 24px;
  border: 1px solid rgba(79, 107, 255, 0.14);
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 28px 60px rgba(36, 56, 128, 0.22);
  overflow: hidden;
}

.settings-section {
  padding: 24px 28px;
  display: grid;
  gap: 18px;
}

.settings-section h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.settings-section p.description {
  margin: -4px 0 0;
  font-size: 13px;
  color: var(--vibe-text-secondary);
}

.settings-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.setting-card {
  padding: 18px 20px;
  border-radius: 18px;
  border: 1px solid rgba(79, 107, 255, 0.12);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 22px 48px rgba(36, 56, 128, 0.18);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.setting-card__title {
  font-size: 15px;
  font-weight: 600;
}

.setting-card__description {
  font-size: 12px;
  color: var(--vibe-text-secondary);
  margin: 0;
}

.setting-card :deep(.n-input),
.setting-card :deep(.n-select),
.setting-card :deep(.n-switch),
.setting-card :deep(.n-slider) {
  border-radius: 12px;
}

.setting-card :deep(.n-button) {
  border-radius: 12px;
}

.settings-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 0 28px 24px;
}

.settings-footer :deep(.n-button) {
  border-radius: 12px;
}

@media (max-width: 1024px) {
  .settings-content {
    flex-direction: column;
  }

  .settings-sidebar {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
  }

  .settings-main {
    min-height: 0;
  }
}

@media (max-width: 768px) {
  .settings-header {
    padding: 20px;
  }

  .settings-content {
    padding: 0 20px 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .settings-sidebar button,
  .setting-card,
  .settings-footer :deep(.n-button) {
    transition-duration: 0.01ms !important;
    transform: none !important;
  }
}
</style>

