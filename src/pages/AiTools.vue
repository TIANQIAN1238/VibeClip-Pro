<script setup lang="ts">
import { computed, onMounted, onErrorCaptured, ref, watch } from "vue";
import { useMessage } from "naive-ui";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import GlobalContextMenu from "@/components/system/GlobalContextMenu.vue";
import { useHistoryStore } from "@/store/history";
import { useSettingsStore } from "@/store/settings";
import { useBridgeStore } from "@/store/bridge";
import type { ClipboardBridgePayload } from "@/store/bridge";
import { ClipKind } from "@/types/history";
import { useLocale } from "@/composables/useLocale";
import { useContextMenu, type ContextMenuItem } from "@/composables/useContextMenu";
import MdiContentCopy from "~icons/mdi/content-copy";
import MdiDeleteOutline from "~icons/mdi/delete-outline";

const history = useHistoryStore();
const settings = useSettingsStore();
const bridge = useBridgeStore();
const message = useMessage();
const { t } = useLocale();
const contextMenu = useContextMenu();

const input = ref("");
const output = ref("");
const pageError = ref<string | null>(null);
const isLoading = ref(false);

const assistantMessages = ref<{ role: "user" | "assistant"; content: string }[]>([]);
const assistantInput = ref("");
const assistantLoading = ref(false);
const clipboardBridge = ref<ClipboardBridgePayload | null>(null);

// Unused - kept for future use
// const resultContextMenuItems = computed<ContextMenuItem[]>(() => [
//   { key: "copy", label: t("ai.copy", "复制结果"), icon: MdiContentCopy },
//   { key: "save", label: t("ai.save", "保存到历史"), icon: MdiContentSave },
// ]);

const assistantMessageContextMenuItems = computed<ContextMenuItem[]>(() => [
  { key: "copy", label: t("assistant.copy", "复制回答"), icon: MdiContentCopy },
  { key: "delete", label: t("contextMenu.delete", "删除"), icon: MdiDeleteOutline, danger: true },
]);

function ensureAssistantIntro() {
  if (!assistantMessages.value.length) {
    assistantMessages.value.push({
      role: "assistant",
      content: t("ai.assistantWelcome", "你好！随时向我提问，或输入需要翻译、摘要或润色的文字。"),
    });
  }
}

function applyBridgeSeed(payload: ClipboardBridgePayload) {
  if (!payload.content?.trim()) {
    return;
  }
  if (payload.kind === ClipKind.Image) {
    clipboardBridge.value = { ...payload };
    if (payload.mode === "assistant") {
      ensureAssistantIntro();
      assistantInput.value = `请描述这张图片：${payload.content}`;
    }
    message.success(t("ai.bridgeImageReady", "已载入剪贴板图片"));
    return;
  }

  clipboardBridge.value = null;
  input.value = payload.content;
  if (payload.mode === "assistant") {
    ensureAssistantIntro();
    assistantInput.value = payload.content;
  }
  message.success(t("ai.bridgeLoaded", "已载入剪贴板内容"));
}

watch(
  () => bridge.clipboardSeed,
  payload => {
    if (!payload) return;
    applyBridgeSeed(payload);
    bridge.consumeClipboardSeed();
  },
  { immediate: true }
);

// Unused functions - kept for future use
// function applyBridgeToInput() {
//   const payload = clipboardBridge.value;
//   if (!payload) return;
//   input.value = payload.content;
//   message.success(t("ai.bridgeApplied", "已填充到输入区"));
// }

// function sendBridgeToAssistant() {
//   const payload = clipboardBridge.value;
//   if (payload) {
//     ensureAssistantIntro();
//     assistantInput.value =
//       payload.kind === ClipKind.Image
//         ? `请描述这张图片：${payload.content}`
//         : payload.content;
//     void sendAssistantMessage();
//     clipboardBridge.value = null;
//     return;
//   }
//   if (input.value.trim()) {
//     ensureAssistantIntro();
//     assistantInput.value = input.value;
//     void sendAssistantMessage();
//   }
// }

// function clearBridgeSeed() {
//   clipboardBridge.value = null;
// }

function reportError(label: string, error: unknown) {
  console.error(label, error);
  const detail = error instanceof Error ? error.message : String(error ?? "");
  message.error(`${label}${detail ? `：${detail}` : ""}`);
}

// Unused function - kept for future use
// async function handleAiRun(payload: {
//   action: AiActionKind;
//   input: string;
//   language: string;
//   customPrompt?: string;
// }) {
//   if (!payload.input.trim()) {
//     message.warning(t("ai.placeholder", "输入内容"));
//     return;
//   }
//   if (!settings.apiKey) {
//     message.warning("请在设置页配置 OpenAI 兼容接口 Key");
//     return;
//   }
//   try {
//     const response = await history.runAiAction(
//       {
//         action: payload.action,
//         input: payload.input,
//         language: payload.language,
//         customPrompt: payload.customPrompt,
//         apiKey: settings.apiKey,
//         baseUrl: settings.apiBaseUrl,
//         model: settings.model,
//         temperature: settings.temperature,
//       },
//       { persist: false, copy: false }
//     );
//     output.value = response.result;
//     message.success("AI 操作完成");
//   } catch (error) {
//     reportError("AI 操作失败", error);
//   }
// }

async function pasteFromClipboard() {
  try {
    const text = await readText();
    if (!text) {
      message.warning("剪贴板为空");
      return;
    }
    // 加载到AI助理
    ensureAssistantIntro();
    assistantInput.value = text;
    message.success("已读取剪贴板内容");
  } catch (error) {
    reportError("读取系统剪贴板失败", error);
  }
}

// Unused function - kept for future use
// function clearWorkspace() {
//   input.value = "";
//   output.value = "";
// }

async function copyResult() {
  if (!output.value) return;
  try {
    await history.markSelfCapture({ kind: ClipKind.Text, content: output.value });
    await writeText(output.value);
    message.success(t("ai.copy", "复制结果"));
  } catch (error) {
    reportError(t("ai.copy", "复制结果"), error);
  }
}

async function saveResult() {
  if (!output.value.trim()) return;
  try {
    await history.insertClip({
      kind: ClipKind.Text,
      text: output.value,
      preview: output.value.slice(0, 120),
      extra: "AI 工具生成",
    });
    message.success(t("ai.save", "保存到历史"));
  } catch (error) {
    reportError(t("ai.save", "保存到历史"), error);
  }
}

async function sendAssistantMessage() {
  const question = assistantInput.value.trim();
  if (!question) return;
  
  // 使用活跃的AI服务商配置
  const activeProvider = settings.activeProvider;
  if (!activeProvider) {
    message.warning("请在 API 配置页面添加并配置 AI 服务商");
    return;
  }
  if (!activeProvider.apiKey) {
    message.warning("请在 API 配置页面填写 API Key");
    return;
  }
  
  ensureAssistantIntro();
  assistantMessages.value.push({ role: "user", content: question });
  assistantInput.value = "";
  assistantLoading.value = true;
  try {
    const historySlice = assistantMessages.value
      .slice(-6)
      .map(entry => `${entry.role === "user" ? "User" : "Assistant"}: ${entry.content}`)
      .join("\n");
    const prompt = `${historySlice}\nAssistant:`;
    const response = await history.runAiAction(
      {
        action: "custom",
        input: prompt,
        language: settings.preferredLanguage,
        customPrompt:
          "You are VibeClip Pro, an expert productivity assistant. Reply concisely and keep markdown formatting when appropriate.",
        apiKey: activeProvider.apiKey,
        baseUrl: activeProvider.baseUrl,
        model: activeProvider.model,
        temperature: activeProvider.temperature,
      },
      { persist: false, copy: false }
    );
    assistantMessages.value.push({ role: "assistant", content: response.result });
  } catch (error) {
    reportError("AI 助理失败", error);
  } finally {
    assistantLoading.value = false;
  }
}

async function handleQuickAction(action: 'translate' | 'summarize' | 'polish' | 'custom') {
  const content = assistantInput.value.trim();
  if (!content) return;
  
  // 使用活跃的AI服务商配置
  const activeProvider = settings.activeProvider;
  if (!activeProvider) {
    message.warning("请在 API 配置页面添加并配置 AI 服务商");
    return;
  }
  if (!activeProvider.apiKey) {
    message.warning("请在 API 配置页面填写 API Key");
    return;
  }

  let prompt = content;
  if (action === 'translate') {
    prompt = `请将以下内容翻译为${settings.preferredLanguage}：\n\n${content}`;
  } else if (action === 'summarize') {
    prompt = `请总结以下内容的要点：\n\n${content}`;
  } else if (action === 'polish') {
    prompt = `请润色以下内容，使其更专业流畅：\n\n${content}`;
  }

  ensureAssistantIntro();
  assistantMessages.value.push({ role: "user", content: prompt });
  assistantInput.value = "";
  assistantLoading.value = true;

  try {
    const response = await history.runAiAction(
      {
        action,
        input: content,
        language: settings.preferredLanguage,
        apiKey: activeProvider.apiKey,
        baseUrl: activeProvider.baseUrl,
        model: activeProvider.model,
        temperature: activeProvider.temperature,
      },
      { persist: false, copy: false }
    );
    assistantMessages.value.push({ role: "assistant", content: response.result });
  } catch (error) {
    reportError("AI 操作失败", error);
  } finally {
    assistantLoading.value = false;
  }
}

function copyAssistantResponse(entry: { role: "user" | "assistant"; content: string }) {
  if (entry.role !== "assistant") return;
  void (async () => {
    try {
      await history.markSelfCapture({ kind: ClipKind.Text, content: entry.content });
      await writeText(entry.content);
      message.success(t("assistant.copy", "复制回答"));
    } catch (error) {
      reportError(t("assistant.copy", "复制回答"), error);
    }
  })();
}

// Unused function - kept for future use
// function handleResultContextMenu(event: MouseEvent) {
//   if (!output.value) return;
//   contextMenu.showContextMenu(event, resultContextMenuItems.value, {
//     type: "ai-result",
//     data: { content: output.value },
//     position: { x: event.clientX, y: event.clientY },
//   });
// }

function handleAssistantMessageContextMenu(event: MouseEvent, message: { role: "user" | "assistant"; content: string }, index: number) {
  if (message.role !== "assistant") return;
  contextMenu.showContextMenu(event, assistantMessageContextMenuItems.value, {
    type: "ai-message",
    data: { message, index },
    position: { x: event.clientX, y: event.clientY },
  });
}

async function handleContextMenuSelect(key: string) {
  const ctx = contextMenu.state.context;
  contextMenu.closeContextMenu();
  
  if (!ctx) return;
  
  if (ctx.type === "ai-result") {
    switch (key) {
      case "copy":
        await copyResult();
        break;
      case "save":
        await saveResult();
        break;
    }
  } else if (ctx.type === "ai-message") {
    const { message: msg, index } = ctx.data;
    switch (key) {
      case "copy":
        try {
          await history.markSelfCapture({ kind: ClipKind.Text, content: msg.content });
          await writeText(msg.content);
          message.success(t("assistant.copy", "复制回答"));
        } catch (error) {
          reportError(t("assistant.copy", "复制回答"), error);
        }
        break;
      case "delete":
        if (index >= 0 && index < assistantMessages.value.length) {
          assistantMessages.value.splice(index, 1);
        }
        break;
    }
  }
}

onMounted(async () => {
  isLoading.value = true;
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
    
    // 加载保存的对话历史
    const savedMessages = localStorage.getItem('ai-tools-chat-history');
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        if (Array.isArray(parsed) && parsed.length > 0) {
          assistantMessages.value = parsed;
        } else {
          ensureAssistantIntro();
        }
      } catch (e) {
        console.error('Failed to load chat history:', e);
        ensureAssistantIntro();
      }
    } else {
      ensureAssistantIntro();
    }
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : "页面初始化失败";
    ensureAssistantIntro();
  } finally {
    isLoading.value = false;
  }
});

// 监听对话变化并自动保存
watch(
  () => assistantMessages.value,
  (messages) => {
    if (messages.length > 0) {
      try {
        localStorage.setItem('ai-tools-chat-history', JSON.stringify(messages));
      } catch (e) {
        console.error('Failed to save chat history:', e);
      }
    }
  },
  { deep: true }
);

onErrorCaptured((err, _instance, info) => {
  console.error("[AiTools] Error captured:", err, info);
  pageError.value = err instanceof Error ? err.message : "组件渲染错误";
  return false;
});
</script>

<template>
  <div class="modern-ai-tools-page">
    <!-- 顶部导航 -->
    <nav class="modern-page-nav">
      <router-link to="/clipboard" class="modern-nav-item" active-class="active">
        <span>剪切板</span>
      </router-link>
      <router-link to="/ai" class="modern-nav-item" active-class="active">
        <span>AI 工具</span>
      </router-link>
      <router-link to="/settings" class="modern-nav-item" active-class="active">
        <span>设置</span>
      </router-link>
    </nav>
    
    <n-alert v-if="pageError" type="error" title="页面加载失败" closable @close="pageError = null" style="margin: 16px;">
      {{ pageError }}
    </n-alert>

    <div v-if="isLoading" class="loading-skeleton">
      <n-skeleton height="60px" :sharp="false" />
      <n-skeleton height="400px" :sharp="false" style="margin-top: 16px;" />
    </div>

    <template v-else>
      <div class="ai-chat-container">
        <header class="page-header">
          <div>
            <h1>{{ t("ai.title", "AI 工具") }}</h1>
            <p>{{ t("ai.subtitle", "与 AI 对话，快速处理文本内容") }}</p>
          </div>
          <div class="header-actions">
            <n-button size="small" secondary @click="pasteFromClipboard">
              {{ t("ai.paste", "粘贴剪贴板") }}
            </n-button>
            <n-button size="small" quaternary @click="() => { assistantMessages = []; ensureAssistantIntro(); }">
              {{ t("ai.clear", "清空对话") }}
            </n-button>
          </div>
        </header>

        <!-- 快捷操作栏 -->
        <div class="quick-actions-bar">
          <button
            class="quick-action-btn"
            :disabled="!assistantInput.trim() || assistantLoading"
            @click="() => handleQuickAction('translate')"
          >
            翻译
          </button>
          <button
            class="quick-action-btn"
            :disabled="!assistantInput.trim() || assistantLoading"
            @click="() => handleQuickAction('summarize')"
          >
            摘要
          </button>
          <button
            class="quick-action-btn"
            :disabled="!assistantInput.trim() || assistantLoading"
            @click="() => handleQuickAction('polish')"
          >
            润色
          </button>
          <button
            class="quick-action-btn"
            :disabled="!assistantInput.trim() || assistantLoading"
            @click="() => handleQuickAction('custom')"
          >
            自定义
          </button>
        </div>

        <!-- 对话历史区域 -->
        <div class="messages-container thin-scrollbar">
          <div
            v-for="(message, index) in assistantMessages"
            :key="index"
            :class="['message-bubble', message.role]"
            @dblclick="copyAssistantResponse(message)"
            @contextmenu="handleAssistantMessageContextMenu($event, message, index)"
          >
            <div class="message-content">{{ message.content }}</div>
          </div>
          <div v-if="assistantLoading" class="message-bubble assistant loading">
            <div class="message-content">
              <span class="loading-dots">正在思考...</span>
            </div>
          </div>
        </div>

        <!-- 底部输入区 -->
        <div class="input-container">
          <n-input
            v-model:value="assistantInput"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 6 }"
            :placeholder="t('ai.assistantPlaceholder', '请帮我生成一段文字')"
            @keyup.enter.exact.prevent="sendAssistantMessage"
            :disabled="assistantLoading"
          />
          <n-button
            type="primary"
            :loading="assistantLoading"
            :disabled="!assistantInput.trim()"
            @click="sendAssistantMessage"
            @dblclick="sendAssistantMessage"
            class="send-btn"
          >
            {{ t("ai.assistantSend", "发送") }}
          </n-button>
        </div>
      </div>
    </template>

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
.modern-ai-tools-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
  min-height: 0;
  width: 100%;
  background: linear-gradient(155deg, rgba(244, 247, 255, 0.96), rgba(230, 239, 255, 0.9));
  overflow: hidden;
}

:global(.dark) .modern-ai-tools-page {
  background: linear-gradient(155deg, rgba(16, 22, 34, 0.94), rgba(18, 26, 46, 0.88));
}

.modern-page-nav {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  padding: 0;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.7);
  border-bottom: 1px solid rgba(79, 107, 255, 0.1);
  z-index: 10;
}

.modern-nav-item {
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

.modern-nav-item:last-child {
  border-right: none;
}

.modern-nav-item:hover {
  background: rgba(255, 255, 255, 0.8);
  color: #3a50ff;
}

.modern-nav-item.active {
  color: #3a50ff;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: inset 0 -3px 0 0 #3a50ff;
  font-weight: 700;
}

.dark .modern-nav-item {
  background: rgba(33, 45, 68, 0.5);
  color: rgba(226, 234, 255, 0.7);
  border-right-color: rgba(122, 209, 245, 0.1);
}

.dark .modern-nav-item:hover {
  background: rgba(33, 45, 68, 0.8);
  color: rgba(122, 209, 245, 0.9);
}

.dark .modern-nav-item.active {
  color: #7ad1f5;
  background: rgba(33, 45, 68, 0.95);
  box-shadow: inset 0 -3px 0 0 #7ad1f5;
}

.loading-skeleton {
  padding: 24px;
}

.ai-chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px 24px 24px;
  gap: 16px;
  min-height: 0;
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
  overflow: hidden;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.page-header p {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--vibe-text-secondary);
}

.header-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.header-actions :deep(.n-button) {
  border-radius: 10px;
}

.quick-actions-bar {
  display: flex;
  gap: 10px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  border: 1px solid rgba(79, 107, 255, 0.12);
  flex-shrink: 0;
}

.dark .quick-actions-bar {
  background: rgba(26, 34, 55, 0.86);
  border-color: rgba(122, 209, 245, 0.16);
}

.quick-action-btn {
  flex: 1;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid rgba(79, 107, 255, 0.14);
  background: rgba(255, 255, 255, 0.88);
  color: var(--vibe-text-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 140ms ease;
}

.quick-action-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  background: linear-gradient(135deg, rgba(79, 107, 255, 0.12), rgba(122, 209, 245, 0.12));
  box-shadow: 0 4px 12px rgba(79, 107, 255, 0.15);
}

.quick-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dark .quick-action-btn {
  background: rgba(33, 45, 68, 0.6);
  border-color: rgba(122, 209, 245, 0.2);
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 12px;
  min-height: 0;
}

.dark .messages-container {
  background: rgba(26, 34, 55, 0.5);
}

.message-bubble {
  max-width: 80%;
  padding: 12px 16px;
  border-radius: 16px;
  font-size: 13px;
  line-height: 1.6;
  word-wrap: break-word;
  box-shadow: 0 2px 8px rgba(36, 56, 128, 0.08);
  animation: fadeIn 200ms ease;
}

.message-bubble.user {
  align-self: flex-end;
  background: linear-gradient(135deg, rgba(79, 107, 255, 0.18), rgba(122, 209, 245, 0.18));
  border: 1px solid rgba(79, 107, 255, 0.2);
  color: var(--vibe-text-primary);
  border-radius: 16px 16px 4px 16px;
}

.message-bubble.assistant {
  align-self: flex-start;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(79, 107, 255, 0.12);
  color: var(--vibe-text-primary);
  border-radius: 16px 16px 16px 4px;
}

.dark .message-bubble.assistant {
  background: rgba(33, 45, 68, 0.9);
  border-color: rgba(122, 209, 245, 0.16);
}

.message-bubble.loading {
  opacity: 0.7;
}

.message-content {
  margin: 0;
  white-space: pre-wrap;
}

.loading-dots {
  display: inline-block;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.input-container {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  padding: 16px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  border: 1px solid rgba(79, 107, 255, 0.12);
  flex-shrink: 0;
}

.dark .input-container {
  background: rgba(26, 34, 55, 0.86);
  border-color: rgba(122, 209, 245, 0.16);
}

.input-container :deep(.n-input) {
  flex: 1;
}

.send-btn {
  flex-shrink: 0;
  min-width: 80px;
}

@media (max-width: 768px) {
  .ai-chat-container {
    padding: 16px;
  }

  .quick-actions-bar {
    flex-wrap: wrap;
  }

  .quick-action-btn {
    min-width: calc(50% - 5px);
  }

  .message-bubble {
    max-width: 90%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .modern-nav-item,
  .quick-action-btn,
  .message-bubble {
    transition-duration: 0.01ms !important;
    transform: none !important;
    animation: none !important;
  }
}
</style>

