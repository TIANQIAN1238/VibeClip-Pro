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

async function refreshClipboard(retryCount = 0) {
  loading.value = true;
  try {
    // 尝试读取文本
    const text = await readText().catch((err) => {
      console.warn("读取剪贴板文本失败:", err);
      return "";
    });
    
    const normalized = text.replace(/\0/g, "").trim();
    if (normalized) {
      clipboardText.value = normalized;
      clipboardKind.value = "text";
      loading.value = false;
      return;
    }
    
    // 如果没有文本,尝试读取图片
    const image = await readImage().catch((err) => {
      console.warn("读取剪贴板图片失败:", err);
      return null;
    });
    
    if (image) {
      clipboardKind.value = "image";
      clipboardText.value = "[图片]";
    } else {
      // 如果都失败了且重试次数未达到上限,进行重试
      if (retryCount < 2) {
        console.log(`重试读取剪贴板 (${retryCount + 1}/2)...`);
        await new Promise(resolve => setTimeout(resolve, 200));
        return refreshClipboard(retryCount + 1);
      }
      clipboardKind.value = "empty";
      clipboardText.value = "";
    }
  } catch (error) {
    console.error("读取剪贴板时发生错误:", error);
    // 重试机制
    if (retryCount < 2) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return refreshClipboard(retryCount + 1);
    }
    clipboardKind.value = "empty";
    clipboardText.value = "";
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
  <div class="quick-panel" :class="{ 'panel-loading': loading }">
    <!-- 渐变背景 -->
    <div class="quick-panel__background" aria-hidden="true"></div>

    <!-- 自定义标题栏 - 唯一的控制栏 -->
    <header class="quick-panel__titlebar" data-tauri-drag-region>
      <div class="titlebar__brand">
        <span class="brand-indicator" aria-hidden="true"></span>
        <span class="brand-text">VIBECLIP 快捷面板</span>
      </div>
      <div class="titlebar__controls">
        <button class="control-btn" type="button" @click="() => refreshClipboard()" aria-label="刷新" title="刷新剪贴板">
          <n-icon :component="MdiRefresh" :size="15" />
        </button>
        <button class="control-btn" type="button" @click="minimizePanel" aria-label="最小化" title="最小化">
          <n-icon :component="MdiMinus" :size="15" />
        </button>
        <button class="control-btn close" type="button" @click="closePanel" aria-label="关闭" title="关闭">
          <n-icon :component="MdiClose" :size="15" />
        </button>
      </div>
    </header>

    <main class="quick-panel__body modern-scrollbar">
      <!-- 当前剪贴板卡片 -->
      <section class="panel-card panel-card--clipboard">
        <header class="panel-card__header">
          <div class="header-content">
            <h2>当前剪贴板</h2>
            <p>自动同步最新内容，可直接触发 AI 操作或保存历史</p>
          </div>
          <span class="badge" :class="`badge--${clipboardKind}`">
            {{ clipboardKind === 'empty' ? '无内容' : clipboardKind === 'text' ? '文本' : '图片' }}
          </span>
        </header>
        <div class="panel-card__content clipboard-preview" @dblclick="() => refreshClipboard()">
          <!-- 加载状态 -->
          <div v-if="loading" class="preview-loading">
            <n-spin size="small" />
            <span>读取剪贴板中…</span>
          </div>
          <!-- 空状态 -->
          <div v-else-if="clipboardKind === 'empty'" class="preview-empty">
            <div class="empty-icon">📋</div>
            <p>暂无可用内容</p>
            <span>复制文本或图片后自动刷新</span>
          </div>
          <!-- 内容预览 -->
          <div v-else class="preview-text">
            {{ clipboardText.slice(0, 180) }}{{ clipboardText.length > 180 ? '…' : '' }}
          </div>
        </div>
        <footer class="panel-card__footer">
          <div class="footer-meta">
            <span class="meta-item">
              <span class="meta-icon">📊</span>
              {{ history.items.length ? `已同步 ${history.items.length} 条历史` : '正在加载历史' }}
            </span>
            <button class="text-link" type="button" @click="() => refreshClipboard()">
              <n-icon :component="MdiRefresh" :size="13" />
              手动刷新
            </button>
          </div>
        </footer>
      </section>

      <!-- AI 快捷操作卡片 -->
      <section class="panel-card panel-card--actions">
        <header class="panel-card__header">
          <div class="header-content">
            <h2>AI 快捷操作</h2>
            <p>选择常用动作，立即对剪贴板文本进行处理</p>
          </div>
          <span v-if="history.aiBusy" class="badge badge--processing">处理中...</span>
        </header>

        <!-- 未配置API Key提示 -->
        <div v-if="!hasApiKey" class="status-banner status-banner--warning" role="alert">
          <div class="banner-content">
            <span class="banner-icon">⚠️</span>
            <span>未检测到 AI 密钥</span>
          </div>
          <button type="button" class="banner-action" @click="openSettings">前往设置</button>
        </div>

        <!-- AI操作按钮网格 -->
        <div v-else-if="clipboardKind === 'text'" class="action-grid">
          <button
            v-for="(action, index) in quickActions"
            :key="action.id"
            class="action-tile"
            type="button"
            :disabled="history.aiBusy"
            :class="{ 'tile-busy': history.aiBusy }"
            @click="handleQuickAction(action)"
          >
            <span class="tile-badge">{{ index + 1 }}</span>
            <div class="tile-content">
              <span class="tile-label">{{ action.label }}</span>
              <span class="tile-hint">{{ action.description || '按 ' + (index + 1) + ' 键快速执行' }}</span>
            </div>
            <div class="tile-arrow">→</div>
          </button>
        </div>

        <!-- 空状态提示 -->
        <div v-else class="empty-state">
          <div class="empty-icon">✨</div>
          <p>复制文本内容以解锁快捷操作</p>
        </div>
      </section>

      <!-- 最近历史 -->
      <section v-if="recentItems.length" class="panel-card panel-card--history">
        <header class="panel-card__header">
          <div class="header-content">
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
              <n-icon :component="MdiContentCopy" :size="14" />
            </span>
            <span class="history-text">{{ (item.preview || '').slice(0, 50) }}{{ (item.preview || '').length > 50 ? '…' : '' }}</span>
            <span class="history-action">
              <n-icon :component="MdiContentCopy" :size="12" />
            </span>
          </button>
        </div>
      </section>

      <!-- 快捷键提示 -->
      <section class="panel-card panel-card--shortcuts">
        <header class="panel-card__header">
          <div class="header-content">
            <h2>快捷键提示</h2>
            <p>用指尖完成常用操作，减少鼠标切换</p>
          </div>
        </header>
        <ul class="shortcut-list">
          <li v-for="item in keyboardShortcuts" :key="item.key" class="shortcut-item">
            <kbd class="shortcut-key">{{ item.key }}</kbd>
            <span class="shortcut-label">{{ item.label }}</span>
          </li>
        </ul>
      </section>
    </main>

    <footer class="quick-panel__footer">
      <button class="footer-action" type="button" @click="openHistory" title="查看全部历史记录">
        <n-icon :component="MdiHistory" :size="16" />
        <span>全部历史</span>
      </button>
      <button class="footer-action" type="button" @click="openSettings" title="打开设置页面">
        <n-icon :component="MdiCog" :size="16" />
        <span>设置</span>
      </button>
    </footer>
  </div>
</template>

<style scoped>
/* 主容器 - 参考Clash Verge的现代风格 */
.quick-panel {
  position: relative;
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--vibe-bg-app);
  overflow: hidden;
  user-select: none;
}

.quick-panel::before {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--vibe-bg-app);
  opacity: 0.95;
  pointer-events: none;
  z-index: 0;
}

.panel-loading {
  cursor: wait;
}

.dark .quick-panel {
  background: var(--vibe-bg-app);
}

/* 渐变背景层 */
.quick-panel__background {
  position: absolute;
  inset: -25% -20%;
  background: 
    radial-gradient(circle at 25% 15%, var(--vibe-accent-light, rgba(122, 209, 245, 0.25)), transparent 55%),
    radial-gradient(circle at 75% 25%, var(--vibe-accent, rgba(81, 97, 255, 0.22)), transparent 60%);
  filter: blur(60px);
  opacity: 0.6;
  pointer-events: none;
  z-index: 0;
  animation: background-shift 20s ease-in-out infinite;
}

@keyframes background-shift {
  0%, 100% {
    transform: translate(0, 0) scale(1);
    opacity: 0.6;
  }
  50% {
    transform: translate(3%, 4%) scale(1.05);
    opacity: 0.7;
  }
}

.dark .quick-panel__background {
  opacity: 0.4;
  mix-blend-mode: lighten;
}

@media (prefers-reduced-motion: reduce) {
  .quick-panel__background {
    animation: none;
  }
}

/* 标题栏 - Clash Verge风格 */
.quick-panel__titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--vibe-panel-surface);
  border-bottom: 1px solid var(--vibe-panel-border);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  position: relative;
  z-index: 10;
  flex-shrink: 0;
}

.titlebar__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.brand-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--vibe-accent);
  box-shadow: 0 0 0 3px var(--vibe-accent-light, rgba(79, 107, 255, 0.2)),
              0 0 12px var(--vibe-accent);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.1);
  }
}

.brand-text {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.8px;
  color: var(--vibe-text-primary);
  text-transform: uppercase;
}

.titlebar__controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.control-btn {
  width: 28px;
  height: 28px;
  border-radius: var(--vibe-radius-sm);
  border: none;
  background: var(--vibe-control-bg);
  color: var(--vibe-text-secondary);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: all 180ms cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
}

.control-btn:hover {
  background: var(--vibe-control-hover);
  color: var(--vibe-text-primary);
  transform: translateY(-1px);
  box-shadow: var(--vibe-shadow-soft);
}

.control-btn:active {
  transform: translateY(0) scale(0.96);
}

.control-btn.close {
  color: #ff3b30;
}

.control-btn.close:hover {
  background: rgba(255, 59, 48, 0.12);
  color: #ff3b30;
}

.dark .control-btn {
  background: var(--vibe-control-bg);
}

.dark .control-btn:hover {
  background: var(--vibe-control-hover);
}

/* 主体内容区域 */
.quick-panel__body {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  overflow-y: auto;
  overflow-x: hidden;
  z-index: 1;
}

.quick-panel__body::-webkit-scrollbar {
  width: 6px;
}

.quick-panel__body::-webkit-scrollbar-track {
  background: transparent;
}

.quick-panel__body::-webkit-scrollbar-thumb {
  background: var(--vibe-border-soft);
  border-radius: 3px;
}

.quick-panel__body::-webkit-scrollbar-thumb:hover {
  background: var(--vibe-border-strong);
}

/* 卡片容器 - Clash Verge风格 */
.panel-card {
  position: relative;
  padding: 18px 20px;
  border-radius: var(--vibe-radius-lg);
  background: var(--vibe-panel-surface);
  border: 1px solid var(--vibe-panel-border);
  box-shadow: var(--vibe-shadow-soft);
  backdrop-filter: blur(20px) saturate(130%);
  -webkit-backdrop-filter: blur(20px) saturate(130%);
  display: flex;
  flex-direction: column;
  gap: 16px;
  transition: all 220ms cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.panel-card::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.15), transparent 50%);
  opacity: 0;
  transition: opacity 220ms ease;
  pointer-events: none;
}

.panel-card:hover {
  transform: translateY(-1px);
  box-shadow: var(--vibe-shadow-medium);
  border-color: var(--vibe-border-strong);
}

.panel-card:hover::before {
  opacity: 1;
}

.dark .panel-card {
  background: var(--vibe-panel-surface);
  border-color: var(--vibe-panel-border);
  box-shadow: var(--vibe-shadow-soft);
}

/* 卡片头部 */
.panel-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.header-content {
  flex: 1;
}

.panel-card__header h2 {
  margin: 0 0 6px 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--vibe-text-primary);
  letter-spacing: -0.2px;
}

.panel-card__header p {
  margin: 0;
  font-size: 11px;
  color: var(--vibe-text-secondary);
  line-height: 1.5;
}

/* 徽章 */
.badge {
  flex-shrink: 0;
  padding: 5px 11px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  background: var(--vibe-accent);
  color: white;
  box-shadow: 0 2px 8px var(--vibe-accent-light, rgba(79, 107, 255, 0.25));
}

.badge--empty {
  background: var(--vibe-text-muted);
  box-shadow: none;
}

.badge--text {
  background: linear-gradient(135deg, var(--vibe-accent), var(--vibe-accent-strong));
}

.badge--image {
  background: linear-gradient(135deg, #ff9f4d, #ff7b2a);
}

.badge--processing {
  background: linear-gradient(135deg, #ffa726, #ff6f00);
  animation: badge-pulse 1.5s ease-in-out infinite;
}

@keyframes badge-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* 卡片内容区 */
.panel-card__content {
  position: relative;
  min-height: 100px;
  border-radius: var(--vibe-radius-md);
  background: var(--vibe-control-bg);
  border: 1px solid var(--vibe-border-soft);
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  overflow: hidden;
  cursor: text;
  transition: all 200ms ease;
}

.panel-card__content:hover {
  border-color: var(--vibe-border-strong);
  background: var(--vibe-control-hover);
}

.clipboard-preview {
  cursor: pointer;
}

.preview-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--vibe-text-secondary);
}

.preview-text {
  width: 100%;
  font-size: 13px;
  line-height: 1.6;
  color: var(--vibe-text-primary);
  word-break: break-word;
  white-space: pre-wrap;
  text-align: left;
}

.preview-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.preview-empty .empty-icon {
  font-size: 32px;
  opacity: 0.5;
}

.preview-empty p {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--vibe-text-primary);
}

.preview-empty span {
  font-size: 11px;
  color: var(--vibe-text-muted);
}

/* 卡片底部 */
.panel-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 4px;
  font-size: 11px;
  color: var(--vibe-text-muted);
}

.footer-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.meta-icon {
  font-size: 13px;
}

.text-link {
  display: flex;
  align-items: center;
  gap: 5px;
  border: none;
  background: none;
  color: var(--vibe-accent);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 160ms ease;
}

.text-link:hover {
  background: var(--vibe-accent-light, rgba(79, 107, 255, 0.12));
}

.text-link:active {
  transform: scale(0.96);
}

/* 状态横幅 */
.status-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-radius: var(--vibe-radius-md);
  background: rgba(255, 171, 64, 0.1);
  border: 1px solid rgba(255, 171, 64, 0.25);
  font-size: 12px;
}

.status-banner--warning {
  background: rgba(255, 152, 0, 0.1);
  border-color: rgba(255, 152, 0, 0.25);
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--vibe-text-primary);
}

.banner-icon {
  font-size: 18px;
}

.banner-action {
  padding: 6px 14px;
  border-radius: 8px;
  border: none;
  background: var(--vibe-accent);
  color: white;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 160ms ease;
}

.banner-action:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--vibe-accent-light, rgba(79, 107, 255, 0.3));
}

/* AI操作网格 */
.action-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.action-tile {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--vibe-radius-md);
  border: 1px solid var(--vibe-border-soft);
  background: var(--vibe-control-bg);
  color: var(--vibe-text-primary);
  cursor: pointer;
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.action-tile::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--vibe-accent-light, rgba(79, 107, 255, 0.08)), transparent 60%);
  opacity: 0;
  transition: opacity 200ms ease;
}

.action-tile:hover:not(:disabled) {
  transform: translateY(-1px) translateX(2px);
  border-color: var(--vibe-accent);
  box-shadow: var(--vibe-shadow-soft);
  background: var(--vibe-control-hover);
}

.action-tile:hover:not(:disabled)::before {
  opacity: 1;
}

.action-tile:active:not(:disabled) {
  transform: translateY(0) translateX(0) scale(0.98);
}

.action-tile:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tile-busy {
  pointer-events: none;
  opacity: 0.6;
}

.tile-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: var(--vibe-accent);
  color: white;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.tile-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.tile-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--vibe-text-primary);
}

.tile-hint {
  font-size: 10px;
  color: var(--vibe-text-muted);
  line-height: 1.4;
}

.tile-arrow {
  font-size: 16px;
  color: var(--vibe-text-muted);
  opacity: 0;
  transform: translateX(-4px);
  transition: all 200ms ease;
  flex-shrink: 0;
}

.action-tile:hover:not(:disabled) .tile-arrow {
  opacity: 1;
  transform: translateX(0);
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 20px;
  text-align: center;
}

.empty-state .empty-icon {
  font-size: 36px;
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: 12px;
  color: var(--vibe-text-muted);
}

/* 历史记录列表 */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--vibe-radius-md);
  background: var(--vibe-control-bg);
  border: 1px solid var(--vibe-border-soft);
  cursor: pointer;
  transition: all 180ms cubic-bezier(0.4, 0, 0.2, 1);
}

.history-item:hover {
  transform: translateX(2px);
  border-color: var(--vibe-accent);
  background: var(--vibe-control-hover);
  box-shadow: var(--vibe-shadow-soft);
}

.history-item:active {
  transform: scale(0.98);
}

.history-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--vibe-accent);
  display: grid;
  place-items: center;
  color: white;
  flex-shrink: 0;
}

.history-text {
  font-size: 12px;
  color: var(--vibe-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.5;
}

.history-action {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: transparent;
  color: var(--vibe-text-muted);
  opacity: 0;
  transition: all 160ms ease;
  flex-shrink: 0;
}

.history-item:hover .history-action {
  opacity: 1;
  background: var(--vibe-accent-light, rgba(79, 107, 255, 0.12));
  color: var(--vibe-accent);
}

/* 快捷键列表 */
.shortcut-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: var(--vibe-radius-sm);
  background: var(--vibe-control-bg);
  transition: all 160ms ease;
}

.shortcut-item:hover {
  background: var(--vibe-control-hover);
}

.shortcut-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 60px;
  padding: 6px 12px;
  border-radius: 8px;
  background: var(--vibe-accent);
  color: white;
  font-size: 11px;
  font-weight: 700;
  font-family: 'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace;
  box-shadow: 0 2px 6px var(--vibe-accent-light, rgba(79, 107, 255, 0.25));
  flex-shrink: 0;
}

.shortcut-label {
  font-size: 12px;
  color: var(--vibe-text-secondary);
  line-height: 1.5;
}

/* 底部按钮区 */
.quick-panel__footer {
  display: flex;
  justify-content: stretch;
  padding: 12px 16px 16px;
  gap: 10px;
  position: relative;
  z-index: 10;
  border-top: 1px solid var(--vibe-panel-border);
  background: var(--vibe-panel-surface);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.footer-action {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  border: none;
  border-radius: var(--vibe-radius-md);
  background: var(--vibe-control-bg);
  border: 1px solid var(--vibe-border-soft);
  color: var(--vibe-text-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 180ms cubic-bezier(0.4, 0, 0.2, 1);
}

.footer-action:hover {
  transform: translateY(-1px);
  background: var(--vibe-control-hover);
  border-color: var(--vibe-accent);
  box-shadow: var(--vibe-shadow-soft);
  color: var(--vibe-accent);
}

.footer-action:active {
  transform: translateY(0) scale(0.98);
}

/* 响应式 */
@media (max-width: 400px) {
  .quick-panel__body {
    padding: 12px;
    gap: 12px;
  }
  
  .panel-card {
    padding: 14px 16px;
  }
  
  .action-grid {
    gap: 8px;
  }
}

/* 无障碍 */
@media (prefers-reduced-motion: reduce) {
  .quick-panel__background,
  .brand-indicator,
  .badge--processing,
  .action-tile,
  .control-btn,
  .history-item,
  .footer-action {
    animation: none !important;
    transition-duration: 0.01ms !important;
  }
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
