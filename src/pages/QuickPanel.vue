<script setup lang="ts">
import { computed, onMounted, ref, onBeforeUnmount } from "vue";
import { useMessage } from "naive-ui";
import { readText, readImage } from "@tauri-apps/plugin-clipboard-manager";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useHistoryStore } from "@/store/history";
import { useSettingsStore } from "@/store/settings";
import { useLocale } from "@/composables/useLocale";
import { safeInvoke } from "@/libs/tauri";
import MdiClose from "~icons/mdi/close";
import MdiCog from "~icons/mdi/cog";
import MdiHistory from "~icons/mdi/history";
import MdiContentCopy from "~icons/mdi/content-copy";

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
  closePanel();
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

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <div class="quick-panel-root">
    <!-- 标题栏 -->
    <div class="panel-titlebar" data-tauri-drag-region>
      <span class="panel-title">VibeClip</span>
      <button class="close-btn" type="button" @click="closePanel" aria-label="关闭">
        <n-icon :component="MdiClose" size="14" />
      </button>
    </div>

    <!-- 内容区 -->
    <div class="panel-content">
      <!-- 当前剪贴板预览 -->
      <div class="clipboard-preview">
        <div v-if="loading" class="preview-loading">
          <n-spin size="small" />
        </div>
        <div v-else-if="clipboardKind === 'empty'" class="preview-empty">
          <span>暂无内容</span>
        </div>
        <div v-else class="preview-text">
          {{ clipboardText.slice(0, 80) }}{{ clipboardText.length > 80 ? '...' : '' }}
        </div>
      </div>

      <!-- API Key 未配置提示 -->
      <div v-if="!hasApiKey" class="api-warning">
        <span>⚠️ 未配置 API Key</span>
        <button class="link-btn" @click="openSettings">前往设置</button>
      </div>

      <!-- 快捷操作按钮 -->
      <div v-if="hasApiKey && clipboardKind === 'text'" class="quick-actions">
        <button
          v-for="(action, index) in quickActions"
          :key="action.id"
          class="action-btn"
          :disabled="history.aiBusy"
          @click="handleQuickAction(action)"
        >
          <span class="action-key">{{ index + 1 }}</span>
          <span class="action-label">{{ action.label }}</span>
        </button>
      </div>

      <!-- 最近历史 -->
      <div v-if="recentItems.length" class="recent-section">
        <div class="section-title">最近</div>
        <div class="recent-list">
          <button
            v-for="item in recentItems"
            :key="item.id"
            class="recent-item"
            @click="copyHistoryItem(item)"
          >
            <n-icon :component="MdiContentCopy" size="12" />
            <span>{{ (item.preview || '').slice(0, 30) }}{{ (item.preview || '').length > 30 ? '...' : '' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="panel-footer">
      <button class="footer-btn" @click="openHistory">
        <n-icon :component="MdiHistory" size="14" />
        <span>全部</span>
      </button>
      <button class="footer-btn" @click="openSettings">
        <n-icon :component="MdiCog" size="14" />
        <span>设置</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.quick-panel-root {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(32px) saturate(180%);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.dark .quick-panel-root {
  background: rgba(20, 24, 32, 0.98);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08);
}

/* 标题栏 */
.panel-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  -webkit-app-region: drag;
  user-select: none;
  background: rgba(255, 255, 255, 0.5);
}

.dark .panel-titlebar {
  border-bottom-color: rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
}

.panel-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--vibe-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.close-btn {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: all 0.15s ease;
  -webkit-app-region: no-drag;
  color: var(--vibe-text-muted);
}

.close-btn:hover {
  background: rgba(255, 59, 48, 0.1);
  color: #ff3b30;
}

/* 内容区 */
.panel-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel-content::-webkit-scrollbar {
  width: 4px;
}

.panel-content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 2px;
}

.dark .panel-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
}

/* 剪贴板预览 */
.clipboard-preview {
  padding: 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.02);
  border: 1px solid rgba(0, 0, 0, 0.06);
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dark .clipboard-preview {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.08);
}

.preview-text {
  font-size: 12px;
  line-height: 1.5;
  color: var(--vibe-text-primary);
  white-space: pre-wrap;
  word-break: break-word;
  width: 100%;
}

.preview-empty span {
  font-size: 11px;
  color: var(--vibe-text-muted);
}

/* API 警告 */
.api-warning {
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(255, 149, 0, 0.08);
  border: 1px solid rgba(255, 149, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
}

.api-warning span {
  color: #ff9500;
  font-weight: 500;
}

.link-btn {
  border: none;
  background: none;
  color: #007aff;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}

.link-btn:hover {
  opacity: 0.7;
}

/* 快捷操作 */
.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 12px;
  font-weight: 500;
  color: var(--vibe-text-primary);
}

.dark .action-btn {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
}

.action-btn:hover:not(:disabled) {
  background: rgba(0, 122, 255, 0.08);
  border-color: rgba(0, 122, 255, 0.3);
  transform: translateX(2px);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 3px;
  background: rgba(0, 122, 255, 0.12);
  font-size: 10px;
  font-weight: 600;
  color: #007aff;
}

.action-label {
  flex: 1;
  text-align: left;
}

/* 最近历史 */
.recent-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.section-title {
  font-size: 10px;
  font-weight: 600;
  color: var(--vibe-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0 2px;
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 5px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 11px;
  color: var(--vibe-text-primary);
  text-align: left;
}

.dark .recent-item {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
}

.recent-item:hover {
  background: rgba(0, 122, 255, 0.06);
  border-color: rgba(0, 122, 255, 0.2);
  transform: translateX(2px);
}

.recent-item span {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 底部操作栏 */
.panel-footer {
  display: flex;
  gap: 1px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(0, 0, 0, 0.02);
}

.dark .panel-footer {
  border-top-color: rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
}

.footer-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 11px;
  font-weight: 500;
  color: var(--vibe-text-secondary);
}

.footer-btn:hover {
  background: rgba(0, 122, 255, 0.08);
  color: #007aff;
}

@media (prefers-reduced-motion: reduce) {
  .action-btn,
  .recent-item,
  .footer-btn,
  .close-btn {
    transition-duration: 0.01ms !important;
    transform: none !important;
  }
}
</style>
