<script setup lang="ts">
import { computed, reactive } from "vue";
import { useRouter } from "vue-router";
import type { AiActionKind } from "@/types/history";
import { useSettingsStore } from "@/store/settings";
import MdiSparkle from "~icons/mdi/sparkles";
import MdiLanguage from "~icons/mdi/translate";
import { useLocale } from "@/composables/useLocale";

const props = defineProps<{
  loading: boolean;
  onRun: (payload: { action: AiActionKind; input: string; language: string; customPrompt?: string }) => Promise<void>;
  sourceText: string;
}>();

const settings = useSettingsStore();
const router = useRouter();
const { t } = useLocale();

const state = reactive({
  action: "translate" as AiActionKind,
  language: settings.preferredLanguage,
  customPrompt: "",
  input: "",
});

const settingsReady = computed(() => settings.hydrated);
const needsSetup = computed(() => !settings.apiKey);

const hasClipboardSeed = computed(() => props.sourceText.trim().length > 0);

const languageOptions = computed(() => [
  { label: t("ai.languages.zh", "中文"), value: "zh-CN" },
  { label: t("ai.languages.en", "English"), value: "en" },
  { label: t("ai.languages.ja", "日本語"), value: "ja" },
  { label: t("ai.languages.ko", "한국어"), value: "ko" },
  { label: t("ai.languages.fr", "Français"), value: "fr" },
]);

type LanguageOption = (typeof languageOptions.value)[number];

const renderLanguageLabel = (option: LanguageOption) => option.label;

const actions = computed(
  () =>
    [
      { key: "translate", label: t("ai.actions.translate", "翻译") },
      { key: "summarize", label: t("ai.actions.summarize", "摘要") },
      { key: "polish", label: t("ai.actions.polish", "润色") },
      { key: "jsonify", label: t("ai.actions.jsonify", "结构化") },
      { key: "custom", label: t("ai.actions.custom", "自定义") },
    ] satisfies ReadonlyArray<{ key: AiActionKind; label: string }>
);

const placeholder = computed(() => {
  if (state.action === "translate") return t("ai.placeholders.translate", "输入想要翻译的内容");
  if (state.action === "summarize") return t("ai.placeholders.summarize", "输入需要总结的内容");
  if (state.action === "polish") return t("ai.placeholders.polish", "输入需要润色的段落");
  if (state.action === "jsonify") return t("ai.placeholders.jsonify", "输入需要结构化的内容");
  return t("ai.placeholders.default", "输入内容");
});

const customPromptPlaceholder = computed(() =>
  t("ai.quickActionsCustomPlaceholder", "输入自定义 Prompt，支持 {{clipboard}} 占位符")
);

const executeLabel = computed(() => t("ai.quickActionsRun", "执行"));

const languageHint = computed(() =>
  t("ai.quickActionsLanguageHint", "默认使用上方语言；留空时使用系统首选")
);

async function handleSubmit() {
  const input = state.input.trim() || props.sourceText.trim();
  if (!input) return;
  await props.onRun({
    action: state.action,
    input,
    language: state.language || settings.preferredLanguage,
    customPrompt: state.customPrompt.trim() || undefined,
  });
  state.input = "";
}

function openSettings() {
  router.push("/settings");
}
</script>

<template>
  <div class="ai-card">
    <div v-if="!settingsReady" class="ai-skeleton">
      <n-skeleton height="20px" :sharp="false" />
      <n-skeleton height="18px" :sharp="false" />
      <n-skeleton height="120px" :sharp="false" />
    </div>
    <div v-else-if="needsSetup" class="ai-placeholder">
      <n-empty description="AI 功能未配置">
        <template #extra>
          <n-button size="small" type="primary" @click="openSettings">前往设置 API Key</n-button>
        </template>
      </n-empty>
    </div>
    <template v-else>
      <header class="ai-header">
        <div class="title-group">
          <span class="title-chip">{{ t("ai.quickActionsChip", "即时处理") }}</span>
          <div class="title-meta">
            <n-icon :component="MdiSparkle" size="20" />
            <div>
              <h3>{{ t("ai.quickActionsTitle", "AI 快捷操作") }}</h3>
              <p>{{ t("ai.quickActionsSubtitle", "翻译、摘要、润色或快速结构化") }}</p>
            </div>
          </div>
        </div>
        <n-select
          v-model:value="state.language"
          class="language-select"
          size="small"
          :options="languageOptions"
          :render-label="renderLanguageLabel"
        />
      </header>
      <div class="ai-status">
        <span v-if="hasClipboardSeed" class="status-badge">
          {{ t("ai.quickActionsClipboardBadge", "已衔接剪贴板文本") }}
        </span>
        <span class="status-hint">{{ t("ai.quickActionsHint", "留空时会自动引用剪贴板内容") }}</span>
      </div>
    <div class="action-tabs">
      <n-button
        v-for="item in actions"
        :key="item.key"
        size="tiny"
        quaternary
        class="tab-button"
        :type="state.action === item.key ? 'primary' : 'default'"
        @click="state.action = item.key"
      >
        {{ item.label }}
      </n-button>
    </div>
    <n-input
      v-model:value="state.input"
      type="textarea"
      :autosize="{ minRows: 3, maxRows: 6 }"
      :placeholder="placeholder"
      class="action-input"
    />
    <n-input
      v-if="state.action === 'custom'"
      v-model:value="state.customPrompt"
      type="textarea"
      :autosize="{ minRows: 2, maxRows: 4 }"
      :placeholder="customPromptPlaceholder"
      class="action-input"
    />
    <div class="action-footer">
      <div class="helper">
        <n-icon :component="MdiLanguage" size="16" />
        <span>{{ languageHint }}</span>
      </div>
      <n-button type="primary" size="small" :loading="loading" @click="handleSubmit">
        {{ executeLabel }}
      </n-button>
    </div>
    </template>
  </div>
</template>

<style scoped>
.ai-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: 100%;
  overflow: hidden;
}

.ai-card::before {
  content: "";
  position: absolute;
  inset: -20% 40% auto -20%;
  height: 200px;
  border-radius: 50%;
  background: radial-gradient(120% 120% at 20% 20%, rgba(81, 97, 255, 0.32), transparent 70%);
  opacity: 0.6;
  pointer-events: none;
}

.ai-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  z-index: 1;
}

.title-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: var(--vibe-text-primary);
}

.title-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  background: color-mix(in srgb, var(--vibe-accent) 24%, transparent);
  color: var(--vibe-text-secondary);
}

.title-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: var(--vibe-radius-md);
  background: linear-gradient(120deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.78));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
}

.dark .title-meta {
  background: linear-gradient(130deg, rgba(30, 34, 52, 0.94), rgba(24, 28, 44, 0.88));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.title-meta h3 {
  margin: 0;
  font-size: 18px;
}

.title-meta p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--vibe-text-muted);
}

.language-select {
  width: 150px;
  z-index: 1;
}

.ai-status {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--vibe-text-muted);
  z-index: 1;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 999px;
  font-weight: 600;
  background: color-mix(in srgb, var(--vibe-accent) 28%, transparent);
  color: var(--vibe-nav-text-active);
}

.status-hint {
  color: var(--vibe-text-muted);
}

.action-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px;
  border-radius: var(--vibe-radius-md);
  background: color-mix(in srgb, var(--vibe-control-bg) 80%, transparent);
  border: 1px solid color-mix(in srgb, var(--vibe-panel-border) 70%, transparent);
}

.tab-button {
  border-radius: 999px;
  padding: 4px 16px;
  transition: transform 160ms ease, box-shadow 160ms ease;
}

.tab-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(79, 107, 255, 0.18);
}

.action-input {
  width: 100%;
  z-index: 1;
}

.action-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  z-index: 1;
}

.helper {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--vibe-text-muted);
}

.ai-skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 180px;
}

@media (prefers-reduced-motion: reduce) {
  .tab-button,
  .title-meta,
  .ai-card::before {
    transition-duration: 0.01ms !important;
    transform: none !important;
    animation: none !important;
  }
}
</style>
