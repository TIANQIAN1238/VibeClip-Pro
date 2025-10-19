<script setup lang="ts">
import { computed, onMounted, onErrorCaptured, ref, watch } from "vue";
import { useMessage } from "naive-ui";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import AiQuickActions from "@/components/ai/AiQuickActions.vue";
import GlobalContextMenu from "@/components/system/GlobalContextMenu.vue";
import { useHistoryStore } from "@/store/history";
import { useSettingsStore } from "@/store/settings";
import { useBridgeStore } from "@/store/bridge";
import type { ClipboardBridgePayload } from "@/store/bridge";
import { ClipKind, type AiActionKind } from "@/types/history";
import { useLocale } from "@/composables/useLocale";
import { useContextMenu, type ContextMenuItem } from "@/composables/useContextMenu";
import MdiContentCopy from "~icons/mdi/content-copy";
import MdiContentSave from "~icons/mdi/content-save";
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

const resultContextMenuItems = computed<ContextMenuItem[]>(() => [
  { key: "copy", label: t("ai.copy", "复制结果"), icon: MdiContentCopy },
  { key: "save", label: t("ai.save", "保存到历史"), icon: MdiContentSave },
]);

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

function applyBridgeToInput() {
  const payload = clipboardBridge.value;
  if (!payload) return;
  input.value = payload.content;
  message.success(t("ai.bridgeApplied", "已填充到输入区"));
}

function sendBridgeToAssistant() {
  const payload = clipboardBridge.value;
  if (payload) {
    ensureAssistantIntro();
    assistantInput.value =
      payload.kind === ClipKind.Image
        ? `请描述这张图片：${payload.content}`
        : payload.content;
    void sendAssistantMessage();
    clipboardBridge.value = null;
    return;
  }
  if (input.value.trim()) {
    ensureAssistantIntro();
    assistantInput.value = input.value;
    void sendAssistantMessage();
  }
}

function clearBridgeSeed() {
  clipboardBridge.value = null;
}

function reportError(label: string, error: unknown) {
  console.error(label, error);
  const detail = error instanceof Error ? error.message : String(error ?? "");
  message.error(`${label}${detail ? `：${detail}` : ""}`);
}

async function handleAiRun(payload: {
  action: AiActionKind;
  input: string;
  language: string;
  customPrompt?: string;
}) {
  if (!payload.input.trim()) {
    message.warning(t("ai.placeholder", "输入内容"));
    return;
  }
  if (!settings.apiKey) {
    message.warning("请在设置页配置 OpenAI 兼容接口 Key");
    return;
  }
  try {
    const response = await history.runAiAction(
      {
        action: payload.action,
        input: payload.input,
        language: payload.language,
        customPrompt: payload.customPrompt,
        apiKey: settings.apiKey,
        baseUrl: settings.apiBaseUrl,
        model: settings.model,
        temperature: settings.temperature,
      },
      { persist: false, copy: false }
    );
    output.value = response.result;
    message.success("AI 操作完成");
  } catch (error) {
    reportError("AI 操作失败", error);
  }
}

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

function clearWorkspace() {
  input.value = "";
  output.value = "";
}

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
  if (!settings.apiKey) {
    message.warning("请在设置页配置 OpenAI 兼容接口 Key");
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
        apiKey: settings.apiKey,
        baseUrl: settings.apiBaseUrl,
        model: settings.model,
        temperature: settings.temperature,
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

function handleResultContextMenu(event: MouseEvent) {
  if (!output.value) return;
  contextMenu.showContextMenu(event, resultContextMenuItems.value, {
    type: "ai-result",
    data: { content: output.value },
    position: { x: event.clientX, y: event.clientY },
  });
}

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
  ensureAssistantIntro();
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
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : "页面初始化失败";
  } finally {
    isLoading.value = false;
  }
});

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
        <span>剪贴板</span>
      </router-link>
      <router-link to="/history" class="modern-nav-item" active-class="active">
        <span>历史</span>
      </router-link>
      <router-link to="/ai" class="modern-nav-item" active-class="active">
        <span>AI 工具</span>
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
      <header class="page-header">
        <div>
          <h1>{{ t("ai.title", "AI 工具集") }}</h1>
          <p>{{ t("ai.subtitle", "选择合适的动作处理文本，结果可复制或保存到历史") }}</p>
        </div>
        <div class="header-actions">
          <n-button size="tiny" secondary @click="pasteFromClipboard">
            {{ t("ai.paste", "粘贴剪贴板") }}
          </n-button>
          <n-button size="tiny" quaternary @click="clearWorkspace">
            {{ t("ai.clear", "清空") }}
          </n-button>
        </div>
      </header>

      <div class="ai-tools-layout">
        <!-- 中间主工作区 -->
        <div class="main-workspace">
          <section v-if="clipboardBridge" class="card bridge-card enhanced-bridge-card">
            <header class="bridge-header">
              <div>
                <h2>{{ clipboardBridge.title ?? t("ai.bridgeTitle", "来自剪贴板") }}</h2>
                <p>{{ t("ai.bridgeSubtitle", "快速继续处理或发送给 AI 助理") }}</p>
              </div>
            </header>
            <div class="bridge-body">
              <img
                v-if="clipboardBridge.kind === ClipKind.Image"
                :src="clipboardBridge.content"
                alt="clipboard preview"
                class="bridge-image"
              />
              <p v-else class="bridge-text">{{ clipboardBridge.content }}</p>
            </div>
            <footer class="bridge-actions">
              <n-button size="tiny" tertiary @click="applyBridgeToInput">
                {{ t("ai.bridgeApply", "填充到输入区") }}
              </n-button>
              <n-button size="tiny" type="primary" @click="sendBridgeToAssistant">
                {{ t("ai.bridgeSend", "发送给助手") }}
              </n-button>
              <n-button size="tiny" quaternary @click="clearBridgeSeed">
                {{ t("ai.bridgeClear", "清除") }}
              </n-button>
            </footer>
          </section>

          <section class="card input-card">
            <h2>{{ t("ai.input", "输入内容") }}</h2>
            <n-input
              v-model:value="input"
              type="textarea"
              :autosize="{ minRows: 6, maxRows: 10 }"
              :placeholder="t('ai.placeholder', '在此输入需要处理的文本，或点击上方按钮同步系统剪贴板')"
            />
          </section>

          <AiQuickActions
            class="card ai-card"
            :loading="history.aiBusy"
            :source-text="input"
            :on-run="handleAiRun"
          />

          <section class="card result-card">
            <div class="result-header">
              <h2>{{ t("ai.output", "AI 输出") }}</h2>
              <div class="result-actions">
                <n-button size="tiny" secondary :disabled="!output" @click="copyResult">
                  {{ t("ai.copy", "复制结果") }}
                </n-button>
                <n-button size="tiny" type="primary" :disabled="!output" @click="saveResult">
                  {{ t("ai.save", "保存到历史") }}
                </n-button>
              </div>
            </div>
            <div class="result-body" @contextmenu="handleResultContextMenu">
              <pre v-if="output">{{ output }}</pre>
              <p v-else class="placeholder">{{ t("ai.placeholder", "在此输入需要处理的文本，或点击上方按钮同步系统剪贴板") }}</p>
            </div>
          </section>
        </div>

        <!-- 右侧AI助理 -->
        <aside class="ai-assistant-sidebar">
          <section class="card assistant-card">
            <header class="assistant-header">
              <div>
                <h2>{{ t("ai.assistantTitle", "AI 助理") }}</h2>
                <p>{{ t("ai.assistantSubtitle", "自由提问或让 AI 帮助翻译、摘要与润色") }}</p>
              </div>
              <n-button size="tiny" secondary @click="pasteFromClipboard">
                {{ t("ai.pasteClipboard", "读取剪贴板") }}
              </n-button>
            </header>
            <div class="assistant-messages thin-scrollbar">
              <template v-if="assistantMessages.length">
                <div
                  v-for="(message, index) in assistantMessages"
                  :key="index"
                  :class="['assistant-message', message.role]"
                  @dblclick="copyAssistantResponse(message)"
                  @contextmenu="handleAssistantMessageContextMenu($event, message, index)"
                >
                  <p>{{ message.content }}</p>
                </div>
              </template>
              <p v-else class="placeholder">{{ t("assistant.empty", "还没有对话，开始输入吧。") }}</p>
            </div>
            <div class="assistant-input">
              <n-input
                v-model:value="assistantInput"
                type="textarea"
                :autosize="{ minRows: 2, maxRows: 4 }"
                :placeholder="t('ai.assistantPlaceholder', '输入想要询问或处理的内容')"
                @keyup.enter.exact.prevent="sendAssistantMessage"
              />
              <n-button type="primary" size="tiny" :loading="assistantLoading" @click="sendAssistantMessage">
                {{ t("ai.assistantSend", "发送") }}
              </n-button>
            </div>
          </section>
        </aside>
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
.ai-tools-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(155deg, rgba(244, 247, 255, 0.96), rgba(230, 239, 255, 0.9));
  overflow: hidden;
}

:global(.dark) .ai-tools-page {
  background: linear-gradient(155deg, rgba(16, 22, 34, 0.94), rgba(18, 26, 46, 0.88));
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 24px 28px 12px;
  gap: 18px;
  flex-wrap: wrap;
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.page-header p {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--vibe-text-secondary);
  max-width: 560px;
}

.header-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.header-actions :deep(.n-button) {
  border-radius: 14px;
  box-shadow: 0 16px 30px rgba(79, 107, 255, 0.18);
}

.header-actions :deep(.n-button:hover) {
  transform: translateY(-2px);
  box-shadow: 0 22px 40px rgba(79, 107, 255, 0.24);
}

.tools-content {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(300px, 360px) 1fr;
  gap: 22px;
  padding: 0 28px 24px;
  min-height: 0;
}

.tool-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.tool-card {
  padding: 20px;
  border-radius: 20px;
  border: 1px solid rgba(79, 107, 255, 0.14);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 24px 54px rgba(36, 56, 128, 0.18);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tool-card__title {
  font-size: 16px;
  font-weight: 600;
}

.tool-card__description {
  font-size: 13px;
  color: var(--vibe-text-secondary);
  margin: 0;
}

.tool-card :deep(.n-form-item) {
  margin-bottom: 12px;
}

.tool-card :deep(.n-input),
.tool-card :deep(.n-select) {
  border-radius: 14px;
}

.tool-card :deep(.n-input textarea) {
  border-radius: 14px;
}

.tool-card :deep(.n-button) {
  border-radius: 12px;
}

.output-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
}

.output-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-radius: 22px;
  border: 1px solid rgba(79, 107, 255, 0.14);
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 28px 60px rgba(36, 56, 128, 0.2);
  overflow: hidden;
}

.output-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 22px;
  border-bottom: 1px solid rgba(79, 107, 255, 0.1);
}

.output-card__header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.output-card__body {
  flex: 1;
  display: flex;
  min-height: 0;
}

.output-card__body :deep(.n-scrollbar) {
  flex: 1;
}

.output-card__body :deep(.n-scrollbar-content) {
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.output-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 0 22px 18px;
}

.output-card__actions :deep(.n-button) {
  border-radius: 12px;
}

.tool-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.tool-pill {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(79, 107, 255, 0.12);
  background: rgba(255, 255, 255, 0.88);
  font-size: 12px;
  color: var(--vibe-text-secondary);
}

.history-mini {
  border-radius: 16px;
  border: 1px solid rgba(79, 107, 255, 0.12);
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 20px 42px rgba(36, 56, 128, 0.18);
}

.history-mini :deep(.n-scrollbar-content) {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-mini :deep(.history-item) {
  border-radius: 14px;
  border: 1px solid rgba(79, 107, 255, 0.12);
  box-shadow: 0 14px 30px rgba(36, 56, 128, 0.16);
}

@media (max-width: 1100px) {
  .tools-content {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .page-header {
    padding: 20px;
  }

  .tools-content {
    padding: 0 20px 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .header-actions :deep(.n-button),
  .tool-card,
  .output-card {
    transition-duration: 0.01ms !important;
    transform: none !important;
  }
}
</style>

