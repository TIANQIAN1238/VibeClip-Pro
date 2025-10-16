<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useMessage } from "naive-ui";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import AppSidebar from "@/components/layout/AppSidebar.vue";
import HistoryItem from "@/components/history/HistoryItem.vue";
import AiQuickActions from "@/components/ai/AiQuickActions.vue";
import { useHistoryStore } from "@/store/history";
import { useSettingsStore } from "@/store/settings";
import { ClipKind, type AiActionKind, type HistoryFilter } from "@/types/history";

const history = useHistoryStore();
const settings = useSettingsStore();
const message = useMessage();

const searchValue = computed({
  get: () => history.searchTerm,
  set: value => {
    history.searchTerm = value;
    history.scheduleFetch();
  },
});

const capturing = ref(false);
const clipboardPreview = ref("");

async function syncSystemClipboard() {
  try {
    capturing.value = true;
    clipboardPreview.value = await readText();
  } catch (error) {
    console.warn("Failed to read clipboard", error);
  } finally {
    capturing.value = false;
  }
}

function handlePaste(event: ClipboardEvent) {
  const data = event.clipboardData;
  if (!data) return;
  const text = data.getData("text/plain");
  if (text) {
    history.insertClip({
      kind: ClipKind.Text,
      text,
      preview: text.slice(0, 120),
    });
    return;
  }
  const items = Array.from(data.items ?? []);
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (!file) continue;
      const reader = new FileReader();
      reader.onload = async () => {
        const result = reader.result as string;
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        await history.insertClip({
          kind: ClipKind.Image,
          imageBase64: base64,
          preview: file.name,
        });
      };
      reader.readAsDataURL(file);
      break;
    }
  }
}

async function handleAiRun(payload: {
  action: AiActionKind;
  input: string;
  language: string;
  customPrompt?: string;
}) {
  if (!settings.apiKey) {
    message.error("请先在设置中配置 OpenAI 兼容接口 Key");
    return;
  }
  try {
    await history.runAiAction({
      action: payload.action,
      input: payload.input,
      language: payload.language,
      customPrompt: payload.customPrompt,
      apiKey: settings.apiKey,
      baseUrl: settings.apiBaseUrl,
      model: settings.model,
      temperature: settings.temperature,
    });
    message.success("AI 操作已完成并写入剪贴板");
  } catch (error) {
    message.error((error as Error).message ?? "AI 操作失败");
  }
}

onMounted(async () => {
  await history.syncStatus();
  await history.refresh();
  await syncSystemClipboard();
  window.addEventListener("paste", handlePaste);
});

onBeforeUnmount(() => {
  window.removeEventListener("paste", handlePaste);
});

function handleFilterChange(value: string) {
  history.filter = value as HistoryFilter;
  history.scheduleFetch();
}

async function handleCopy(item: (typeof history.items)[number]) {
  await history.copyClip(item);
  message.success("已写入系统剪贴板");
}

async function handlePin(item: (typeof history.items)[number]) {
  await history.updateFlags(item.id, { pinned: !item.isPinned });
}

async function handleFavorite(item: (typeof history.items)[number]) {
  await history.updateFlags(item.id, { favorite: !item.isFavorite });
}

async function handleRemove(item: (typeof history.items)[number]) {
  await history.removeClip(item.id);
  message.success("已删除");
}

async function handleSavePreview() {
  if (!clipboardPreview.value.trim()) return;
  await history.captureText(clipboardPreview.value);
  message.success("已保存至历史");
}
</script>

<template>
  <div class="history-page">
    <AppSidebar />
    <section class="main">
      <header class="top-bar">
        <n-input
          v-model:value="searchValue"
          placeholder="搜索历史内容或使用 Ctrl+Shift+V 呼出"
          clearable
          size="large"
          @clear="history.refresh()"
        />
        <div class="top-actions">
          <n-button quaternary size="small" @click="history.refresh()">刷新</n-button>
          <n-button quaternary size="small" @click="history.importHistory">导入</n-button>
          <n-button quaternary size="small" @click="history.exportHistory" :loading="history.isExporting">导出</n-button>
          <n-popconfirm @positive-click="history.clearHistory">
            <template #trigger>
              <n-button size="small" tertiary type="error">清空</n-button>
            </template>
            确认清空所有历史记录？
          </n-popconfirm>
        </div>
      </header>

      <div class="top-grid">
        <div class="live-card">
          <div class="card-header">
            <div>
              <h2>系统剪贴板</h2>
              <p>随时同步当前剪贴板内容</p>
            </div>
            <n-button size="tiny" secondary :loading="capturing" @click="syncSystemClipboard">同步</n-button>
          </div>
          <div class="card-body">
            <p v-if="clipboardPreview" class="preview-text">{{ clipboardPreview }}</p>
            <p v-else class="placeholder">剪贴板暂无文本，可在应用中粘贴图片或文件以自动收集。</p>
          </div>
          <div class="card-footer">
            <n-button size="small" type="primary" :disabled="!clipboardPreview" @click="handleSavePreview">
              保存到历史
            </n-button>
          </div>
        </div>
        <AiQuickActions
          :loading="history.aiBusy"
          :source-text="history.latest?.content ?? clipboardPreview"
          :on-run="handleAiRun"
        />
      </div>

      <section class="filters">
        <n-segmented
          :value="history.filter"
          size="small"
          :options="[
            { label: '全部', value: 'all' },
            { label: '置顶', value: 'pinned' },
            { label: '收藏', value: 'favorites' },
            { label: '文本', value: 'text' },
            { label: '图像', value: 'images' },
            { label: '文件', value: 'files' },
          ]"
          @update:value="handleFilterChange"
        />
        <span class="result-count">共 {{ history.filteredItems.length }} 条记录</span>
      </section>

      <section class="history-list" :style="{ '--line-height': settings.lineHeight }">
        <transition-group name="fade" tag="div" class="history-grid">
          <HistoryItem
            v-for="item in history.filteredItems"
            :key="item.id"
            :item="item"
            @copy="handleCopy"
            @pin="handlePin"
            @favorite="handleFavorite"
            @remove="handleRemove"
          />
        </transition-group>
        <n-empty v-if="!history.filteredItems.length && !history.isLoading" description="还没有保存的剪贴板内容">
          <template #extra>
            <n-button size="small" @click="syncSystemClipboard">立即同步</n-button>
          </template>
        </n-empty>
      </section>
    </section>
  </div>
</template>

<style scoped>
.history-page {
  display: flex;
  height: 100%;
  width: 100%;
}

.main {
  flex: 1;
  padding: 28px 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow: hidden;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.top-bar :deep(.n-input) {
  flex: 1;
}

.top-actions {
  display: flex;
  gap: 8px;
}

.top-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.live-card {
  background: var(--vibe-bg-surface);
  border-radius: var(--vibe-radius-lg);
  border: 1px solid var(--vibe-border-soft);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-header h2 {
  margin: 0;
  font-size: 20px;
}

.card-header p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--vibe-text-muted);
}

.card-body {
  min-height: 90px;
}

.preview-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--vibe-text-primary);
  white-space: pre-wrap;
}

.placeholder {
  margin: 0;
  font-size: 13px;
  color: var(--vibe-text-muted);
}

.card-footer {
  display: flex;
  justify-content: flex-end;
}

.filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.result-count {
  font-size: 12px;
  color: var(--vibe-text-muted);
}

.history-list {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.history-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 18px;
  overflow-y: auto;
  padding-right: 4px;
}
</style>
