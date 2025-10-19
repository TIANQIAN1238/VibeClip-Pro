<script setup lang="ts">
import { computed, onMounted, ref, onBeforeUnmount } from "vue";
import { useMessage } from "naive-ui";
import { readText, readImage } from "@tauri-apps/plugin-clipboard-manager";
import { getCurrentWebviewWindow, type WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useHistoryStore } from "@/store/history";
import { useSettingsStore } from "@/store/settings";
import { useWindowSync } from "@/composables/useWindowSync";
import { safeInvoke } from "@/libs/tauri";
import MdiClose from "~icons/mdi/close";
import MdiMinus from "~icons/mdi/minus";
import MdiCog from "~icons/mdi/cog";
import MdiHistory from "~icons/mdi/history";
import MdiContentCopy from "~icons/mdi/content-copy";
import MdiRefresh from "~icons/mdi/refresh";

const history = useHistoryStore();
const settings = useSettingsStore();
const message = useMessage();

// 启用窗口间同步
useWindowSync();

const currentWindow = ref<WebviewWindow | null>(null);
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

const keyboardShortcuts = [
  { key: "1-3", label: "触发对应快捷操作" },
  { key: "Esc", label: "快速关闭面板" },
  { key: "Ctrl+Shift+V", label: "再次呼出快捷面板" },
];

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
  // 打开主窗口，用户可以手动点击设置按钮
  safeInvoke("show_main_window");
  closePanel();
}

async function minimizePanel() {
  const windowInstance = currentWindow.value;
  try {
    if (windowInstance) {
      await windowInstance.minimize();
    } else {
      await safeInvoke("hide_quick_panel");
    }
  } catch (error) {
    console.error("Failed to minimize panel", error);
    try {
      await windowInstance?.hide();
    } catch (hideError) {
      console.error("Failed to hide panel", hideError);
    }
    await safeInvoke("hide_quick_panel");
  }
}

async function closePanel() {
  const windowInstance = currentWindow.value;
  try {
    if (windowInstance) {
      await windowInstance.close();
    } else {
      await safeInvoke("hide_quick_panel");
    }
  } catch (error) {
    console.error("Failed to close panel", error);
    try {
      await windowInstance?.hide();
    } catch (hideError) {
      console.error("Failed to hide panel during close", hideError);
    }
    await safeInvoke("hide_quick_panel");
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
  try {
    currentWindow.value = getCurrentWebviewWindow();
  } catch (error) {
    console.warn("Tauri window API unavailable in quick panel", error);
    currentWindow.value = null;
  }
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
  <div class="quick-panel">
    <div class="quick-panel__background" aria-hidden="true"></div>

    <header class="quick-panel__titlebar" data-tauri-drag-region>
      <div class="titlebar__brand">
        <span class="brand-indicator" aria-hidden="true"></span>
        <span class="brand-text">VibeClip 快捷面板</span>
      </div>
      <div class="titlebar__controls" data-tauri-drag-region="false">
        <button class="control-btn" type="button" @click="refreshClipboard" aria-label="刷新">
          <n-icon :component="MdiRefresh" size="14" />
        </button>
        <button class="control-btn" type="button" @click="minimizePanel" aria-label="最小化">
          <n-icon :component="MdiMinus" size="14" />
        </button>
        <button class="control-btn close" type="button" @click="closePanel" aria-label="关闭">
          <n-icon :component="MdiClose" size="14" />
        </button>
      </div>
    </header>

    <main class="quick-panel__body modern-scrollbar">
      <section class="panel-card panel-card--clipboard">
        <header class="panel-card__header">
          <div>
            <h2>当前剪贴板</h2>
            <p>自动同步最新内容，可直接触发 AI 操作或保存历史</p>
          </div>
          <span class="badge badge--kind">{{ clipboardKind === 'empty' ? '无内容' : clipboardKind === 'text' ? '文本' : '图片' }}</span>
        </header>
        <div class="panel-card__content clipboard-preview" @dblclick="refreshClipboard">
          <div v-if="loading" class="preview-loading">
            <n-spin size="small" />
            <span>读取剪贴板中…</span>
          </div>
          <template v-else>
            <div v-if="clipboardKind === 'empty'" class="preview-empty">
              <span>暂无可用内容，复制文本或图片后自动刷新</span>
            </div>
            <div v-else class="preview-text">
              {{ clipboardText.slice(0, 160) }}{{ clipboardText.length > 160 ? '…' : '' }}
            </div>
          </template>
        </div>
        <footer class="panel-card__footer">
          <div class="footer-meta">
            <span class="meta-item">⌛ 最近 {{ history.items.length ? '已同步历史' : '正在加载历史' }}</span>
            <button class="text-link" type="button" @click="refreshClipboard">手动刷新</button>
          </div>
        </footer>
      </section>

      <section class="panel-card panel-card--actions">
        <header class="panel-card__header">
          <div>
            <h2>AI 快捷操作</h2>
            <p>选择常用动作，立即对剪贴板文本进行处理</p>
          </div>
        </header>

        <div v-if="!hasApiKey" class="status-banner" role="alert">
          <span>⚠️ 未检测到 AI 密钥</span>
          <button type="button" class="text-link" @click="openSettings">前往设置</button>
        </div>

        <div v-if="hasApiKey && clipboardKind === 'text'" class="action-grid">
          <button
            v-for="(action, index) in quickActions"
            :key="action.id"
            class="action-tile"
            type="button"
            :disabled="history.aiBusy"
            @click="handleQuickAction(action)"
          >
            <span class="tile-key">{{ index + 1 }}</span>
            <span class="tile-label">{{ action.label }}</span>
            <span class="tile-hint">回车执行</span>
          </button>
        </div>

        <p v-else class="empty-hint">复制文本内容以解锁快捷操作</p>
      </section>

      <section class="panel-card panel-card--history" v-if="recentItems.length">
        <header class="panel-card__header">
          <div>
            <h2>最近历史</h2>
            <p>单击即可复制，保持窗口内闭环处理</p>
          </div>
        </header>
        <div class="history-list">
          <button
            v-for="item in recentItems"
            :key="item.id"
            class="history-item"
            type="button"
            @click="copyHistoryItem(item)"
          >
            <span class="history-icon">
              <n-icon :component="MdiContentCopy" size="12" />
            </span>
            <span class="history-text">{{ (item.preview || '').slice(0, 42) }}{{ (item.preview || '').length > 42 ? '…' : '' }}</span>
            <span class="history-meta">复制</span>
          </button>
        </div>
      </section>

      <section class="panel-card panel-card--shortcuts">
        <header class="panel-card__header">
          <div>
            <h2>快捷键提示</h2>
            <p>用指尖完成常用操作，减少鼠标切换</p>
          </div>
        </header>
        <ul class="shortcut-list">
          <li v-for="item in keyboardShortcuts" :key="item.key">
            <span class="shortcut-key">{{ item.key }}</span>
            <span class="shortcut-label">{{ item.label }}</span>
          </li>
        </ul>
      </section>
    </main>

    <footer class="quick-panel__footer">
      <button class="footer-action" type="button" @click="openHistory">
        <n-icon :component="MdiHistory" size="14" />
        <span>查看全部历史</span>
      </button>
      <button class="footer-action" type="button" @click="openSettings">
        <n-icon :component="MdiCog" size="14" />
        <span>打开设置</span>
      </button>
    </footer>
  </div>
</template>

<style scoped>
.quick-panel {
  position: relative;
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(155deg, rgba(255, 255, 255, 0.92), rgba(237, 242, 255, 0.88));
  overflow: hidden;
}

.dark .quick-panel {
  background: linear-gradient(155deg, rgba(18, 22, 34, 0.95), rgba(16, 26, 46, 0.92));
}

.quick-panel__background {
  position: absolute;
  inset: -20% -15%;
  background: radial-gradient(120% 120% at 20% 10%, rgba(122, 209, 245, 0.3), transparent 60%),
    radial-gradient(110% 110% at 80% 20%, rgba(81, 97, 255, 0.28), transparent 70%);
  filter: blur(0px);
  opacity: 0.85;
  pointer-events: none;
}

.dark .quick-panel__background {
  opacity: 0.55;
  mix-blend-mode: screen;
}

.quick-panel__titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  -webkit-app-region: drag;
  border-bottom: 1px solid rgba(19, 31, 60, 0.08);
  position: relative;
  z-index: 1;
}

.dark .quick-panel__titlebar {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.titlebar__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.28px;
  color: var(--vibe-text-primary);
  text-transform: uppercase;
}

.brand-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: linear-gradient(135deg, #5d8bff, #79e0ff);
  box-shadow: 0 0 0 3px rgba(93, 139, 255, 0.18);
}

.titlebar__controls {
  display: flex;
  align-items: center;
  gap: 6px;
  -webkit-app-region: no-drag;
}

.control-btn {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  border: none;
  background: rgba(255, 255, 255, 0.72);
  color: var(--vibe-text-secondary);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
}

.control-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(79, 107, 255, 0.22);
}

.control-btn.close {
  color: #ff3b30;
}

.control-btn.close:hover {
  background: rgba(255, 80, 70, 0.16);
}

.dark .control-btn {
  background: rgba(33, 45, 68, 0.8);
}

.quick-panel__body {
  position: relative;
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  padding: 18px;
  overflow-y: auto;
  z-index: 1;
}

.panel-card {
  position: relative;
  padding: 18px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(79, 107, 255, 0.12);
  box-shadow: 0 14px 30px rgba(31, 53, 122, 0.12);
  backdrop-filter: blur(18px) saturate(140%);
  display: flex;
  flex-direction: column;
  gap: 14px;
  transition: transform 200ms ease, box-shadow 220ms ease;
}

.panel-card::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  opacity: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.6), transparent 60%);
  transition: opacity 200ms ease;
}

.panel-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 22px 44px rgba(36, 58, 128, 0.18);
}

.panel-card:hover::after {
  opacity: 1;
}

.dark .panel-card {
  background: rgba(28, 36, 58, 0.82);
  border-color: rgba(122, 209, 245, 0.16);
  box-shadow: 0 20px 42px rgba(8, 14, 32, 0.55);
}

.panel-card--clipboard {
  grid-column: 1 / -1;
}

.panel-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.panel-card__header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--vibe-text-primary);
}

.panel-card__header p {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--vibe-text-secondary);
}

.badge {
  align-self: flex-start;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(79, 107, 255, 0.12);
  color: #4f6bff;
}

.dark .badge {
  background: rgba(122, 209, 245, 0.16);
  color: rgba(122, 209, 245, 0.95);
}

.panel-card__content {
  position: relative;
  min-height: 96px;
  border-radius: 14px;
  background: rgba(79, 107, 255, 0.06);
  border: 1px dashed rgba(79, 107, 255, 0.18);
  padding: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: left;
  overflow: hidden;
}

.dark .panel-card__content {
  background: rgba(33, 45, 68, 0.6);
  border-color: rgba(122, 209, 245, 0.22);
}

.preview-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--vibe-text-secondary);
}

.preview-text {
  width: 100%;
  font-size: 13px;
  line-height: 1.5;
  color: var(--vibe-text-primary);
  word-break: break-word;
  white-space: pre-wrap;
}

.preview-empty {
  font-size: 12px;
  color: var(--vibe-text-muted);
}

.panel-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: var(--vibe-text-muted);
}

.footer-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.text-link {
  border: none;
  background: none;
  color: #4f6bff;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}

.text-link:hover {
  opacity: 0.75;
}

.status-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 171, 64, 0.14);
  border: 1px solid rgba(255, 171, 64, 0.3);
  font-size: 12px;
  color: #c77600;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.action-tile {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid rgba(79, 107, 255, 0.14);
  background: linear-gradient(135deg, rgba(79, 107, 255, 0.08), rgba(79, 107, 255, 0.02));
  color: var(--vibe-text-primary);
  cursor: pointer;
  transition: transform 180ms ease, box-shadow 200ms ease;
}

.action-tile:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 18px 30px rgba(79, 107, 255, 0.24);
}

.action-tile:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tile-key {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
}

.tile-label {
  font-size: 14px;
  font-weight: 600;
}

.tile-hint {
  font-size: 11px;
  color: var(--vibe-text-muted);
}

.empty-hint {
  margin: 0;
  font-size: 12px;
  color: var(--vibe-text-muted);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(79, 107, 255, 0.12);
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 200ms ease;
}

.history-item:hover {
  transform: translateX(4px);
  box-shadow: 0 16px 28px rgba(79, 107, 255, 0.18);
}

.dark .history-item {
  background: rgba(28, 36, 58, 0.82);
}

.history-icon {
  width: 22px;
  height: 22px;
  border-radius: 8px;
  background: rgba(79, 107, 255, 0.16);
  display: grid;
  place-items: center;
  color: #4f6bff;
}

.history-text {
  font-size: 12px;
  color: var(--vibe-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-meta {
  font-size: 11px;
  color: var(--vibe-text-muted);
}

.shortcut-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.shortcut-key {
  min-width: 74px;
  padding: 6px 10px;
  border-radius: 10px;
  background: rgba(79, 107, 255, 0.14);
  font-size: 12px;
  font-weight: 600;
  color: #4f6bff;
}

.dark .shortcut-key {
  background: rgba(122, 209, 245, 0.18);
  color: rgba(122, 209, 245, 0.96);
}

.shortcut-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--vibe-text-secondary);
}

.quick-panel__footer {
  display: flex;
  justify-content: space-between;
  padding: 12px 18px 18px;
  gap: 12px;
  position: relative;
  z-index: 1;
}

.footer-action {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  border: none;
  border-radius: 14px;
  background: rgba(79, 107, 255, 0.12);
  color: #2a3d8f;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 200ms ease;
}

.footer-action:hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 28px rgba(79, 107, 255, 0.2);
}

.dark .footer-action {
  background: rgba(122, 209, 245, 0.18);
  color: rgba(255, 255, 255, 0.94);
}

@media (max-width: 540px) {
  .quick-panel__body {
    grid-template-columns: 1fr;
    padding: 14px;
  }

  .panel-card {
    padding: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .panel-card,
  .control-btn,
  .history-item,
  .action-tile,
  .footer-action {
    transition-duration: 0.01ms !important;
    transform: none !important;
  }
}
</style>
