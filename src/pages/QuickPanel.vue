<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useMessage } from "naive-ui";
import { readText, writeText, readImage } from "@tauri-apps/plugin-clipboard-manager";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useHistoryStore } from "@/store/history";
import { useSettingsStore } from "@/store/settings";
import { ClipKind, type AiActionKind } from "@/types/history";
import { useLocale } from "@/composables/useLocale";
import { safeInvoke } from "@/libs/tauri";
import MdiClose from "~icons/mdi/close";
import MdiCog from "~icons/mdi/cog";
import MdiHistory from "~icons/mdi/history";
import MdiContentCopy from "~icons/mdi/content-copy";

const router = useRouter();
const history = useHistoryStore();
const settings = useSettingsStore();
const message = useMessage();
const { t } = useLocale();

const currentWindow = getCurrentWebviewWindow();
const clipboardText = ref("");
const clipboardKind = ref<"text" | "image" | "empty">("empty");
const loading = ref(false);

const recentItems = computed(() => history.items.slice(0, 3));

const quickActions = computed(() => {
  return settings.quickActions
    .filter(action => action.enabled !== false)
    .slice(0, 3);
});

const hasApiKey = computed(() => Boolean(settings.apiKey));

async function refreshClipboard() {
  loading.value = true;
  try {
    const text = await readText().catch(() => "");
    const normalized = text.replace(/\0/g, "").trim();
    if (normalized) {
      clipboardText.value = normalized;
      clipboardKind.value = "text";
    } else {
      const image = await readImage().catch(() => null);
      if (image) {
        clipboardKind.value = "image";
        clipboardText.value = "[图片]";
      } else {
        clipboardKind.value = "empty";
        clipboardText.value = "";
      }
    }
  } catch (error) {
    console.error("Failed to read clipboard", error);
  } finally {
    loading.value = false;
  }
}

async function handleQuickAction(action: typeof quickActions.value[0]) {
  if (!hasApiKey.value) {
    message.warning("请先配置 API Key");
    openSettings();
    return;
  }

  if (clipboardKind.value !== "text" || !clipboardText.value) {
    message.info("暂无文本内容");
    return;
  }

  try {
    await history.runAiAction({
      action: action.kind,
      input: clipboardText.value,
      language: action.language || settings.preferredLanguage,
      customPrompt: action.promptTemplate || undefined,
      apiKey: settings.apiKey,
      baseUrl: settings.apiBaseUrl,
      model: settings.model,
      temperature: settings.temperature,
    });

    if (settings.aiResultMode === "auto") {
      message.success(`${action.label}完成，已复制到剪贴板`);
      if (settings.quickPanelAutoClose !== false) {
        await closePanel();
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "操作失败";
    message.error(errorMsg);
  }
}

async function copyHistoryItem(item: typeof history.items[0]) {
  try {
    await history.copyClip(item);
    message.success("已复制");
    if (settings.quickPanelAutoClose !== false) {
      await closePanel();
    }
  } catch (error) {
    message.error("复制失败");
  }
}

function openHistory() {
  safeInvoke("show_main_window");
  router.push("/history");
}

function openSettings() {
  safeInvoke("open_settings_window");
}

async function closePanel() {
  try {
    await currentWindow.hide();
  } catch (error) {
    console.error("Failed to close panel", error);
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    closePanel();
  } else if (event.key >= "1" && event.key <= "3") {
    const index = parseInt(event.key) - 1;
    if (quickActions.value[index]) {
      handleQuickAction(quickActions.value[index]);
    }
  }
}

onMounted(async () => {
  await refreshClipboard();
  if (!history.items.length) {
    await history.refresh();
  }
  window.addEventListener("keydown", handleKeydown);
});
</script>

<template>
  <div class="quick-panel">
    <header class="panel-header" data-tauri-drag-region>
      <span class="panel-title">VibeClip Pro</span>
      <button class="close-btn" type="button" @click="closePanel" aria-label="关闭">
        <n-icon :component="MdiClose" size="18" />
      </button>
    </header>

    <div class="panel-body">
      <!-- 当前剪贴板 -->
      <section class="clipboard-preview">
        <h3>{{ t("quickPanel.current", "当前剪贴板") }}</h3>
        <div v-if="loading" class="preview-loading">
          <n-spin size="small" />
        </div>
        <div v-else-if="clipboardKind === 'empty'" class="preview-empty">
          <p>{{ t("quickPanel.empty", "暂无内容") }}</p>
        </div>
        <div v-else class="preview-content">
          <p class="preview-text">{{ clipboardText.slice(0, 150) }}{{ clipboardText.length > 150 ? '...' : '' }}</p>
        </div>
      </section>

      <!-- API Key 未配置提示 -->
      <section v-if="!hasApiKey" class="api-key-prompt">
        <p>⚠️ {{ t("quickPanel.noApiKey", "未配置 API Key") }}</p>
        <n-button size="tiny" type="primary" @click="openSettings">
          {{ t("quickPanel.goSettings", "前往设置") }}
        </n-button>
      </section>

      <!-- 快捷操作 -->
      <section v-if="hasApiKey && clipboardKind === 'text'" class="quick-actions">
        <h3>{{ t("quickPanel.quickActions", "快捷操作") }}</h3>
        <div class="action-buttons">
          <n-button
            v-for="(action, index) in quickActions"
            :key="action.id"
            size="small"
            secondary
            :loading="history.aiBusy"
            @click="handleQuickAction(action)"
          >
            <template #icon>
              <span class="action-number">{{ index + 1 }}</span>
            </template>
            {{ action.label }}
          </n-button>
        </div>
      </section>

      <!-- 最近历史 -->
      <section v-if="recentItems.length" class="recent-history">
        <h3>{{ t("quickPanel.recent", "最近") }}</h3>
        <div class="history-list">
          <button
            v-for="item in recentItems"
            :key="item.id"
            type="button"
            class="history-item"
            @click="copyHistoryItem(item)"
          >
            <n-icon :component="MdiContentCopy" size="14" />
            <span class="item-preview">{{ item.preview.slice(0, 40) }}{{ item.preview.length > 40 ? '...' : '' }}</span>
          </button>
        </div>
      </section>
    </div>

    <footer class="panel-footer">
      <n-button size="tiny" quaternary @click="openHistory">
        <template #icon>
          <n-icon :component="MdiHistory" />
        </template>
        {{ t("quickPanel.viewAll", "查看全部") }}
      </n-button>
      <n-button size="tiny" quaternary @click="openSettings">
        <template #icon>
          <n-icon :component="MdiCog" />
        </template>
        {{ t("quickPanel.settings", "设置") }}
      </n-button>
    </footer>
  </div>
</template>

<style scoped>
.quick-panel {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(24px) saturate(150%);
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(18, 37, 68, 0.32), 0 0 0 1px rgba(18, 37, 68, 0.08);
  overflow: hidden;
}

.dark .quick-panel {
  background: rgba(18, 24, 42, 0.95);
  box-shadow: 0 24px 64px rgba(6, 12, 26, 0.7), 0 0 0 1px rgba(122, 209, 245, 0.12);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--vibe-panel-border);
  -webkit-app-region: drag;
  user-select: none;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--vibe-text-primary);
}

.close-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 0.2s ease;
  -webkit-app-region: no-drag;
  color: var(--vibe-text-secondary);
}

.close-btn:hover {
  background: rgba(255, 112, 112, 0.15);
  color: #ff7070;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-body::-webkit-scrollbar {
  width: 6px;
}

.panel-body::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.clipboard-preview,
.quick-actions,
.recent-history,
.api-key-prompt {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.clipboard-preview h3,
.quick-actions h3,
.recent-history h3 {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--vibe-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.preview-content,
.preview-empty,
.preview-loading {
  padding: 12px;
  border-radius: 10px;
  background: var(--vibe-panel-surface);
  border: 1px solid var(--vibe-panel-border);
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--vibe-text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.preview-empty p {
  margin: 0;
  font-size: 12px;
  color: var(--vibe-text-muted);
}

.api-key-prompt {
  padding: 12px;
  border-radius: 10px;
  background: rgba(255, 159, 77, 0.1);
  border: 1px solid rgba(255, 159, 77, 0.3);
  align-items: center;
  text-align: center;
}

.api-key-prompt p {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: var(--vibe-text-primary);
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.action-buttons :deep(.n-button) {
  justify-content: flex-start;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.action-buttons :deep(.n-button:hover:not(:disabled)) {
  transform: translateX(2px);
  box-shadow: 0 4px 12px rgba(81, 97, 255, 0.15);
}

.action-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: rgba(81, 97, 255, 0.15);
  font-size: 11px;
  font-weight: 600;
  color: var(--vibe-accent);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history-item {
  width: 100%;
  border: none;
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--vibe-panel-surface);
  border: 1px solid var(--vibe-panel-border);
  cursor: pointer;
  font-size: 12px;
  color: var(--vibe-text-primary);
  transition: all 0.15s ease;
  text-align: left;
}

.history-item:hover {
  background: var(--vibe-control-hover);
  transform: translateX(2px);
  border-color: var(--vibe-accent);
}

.item-preview {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.panel-footer {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--vibe-panel-border);
}

.panel-footer :deep(.n-button) {
  flex: 1;
}

@media (prefers-reduced-motion: reduce) {
  .action-buttons :deep(.n-button),
  .history-item,
  .close-btn {
    transition-duration: 0.01ms !important;
    transform: none !important;
  }
}
</style>

