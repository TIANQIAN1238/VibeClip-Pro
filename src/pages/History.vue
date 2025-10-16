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
const initializing = computed(() => !history.initialized);

const filterOptions = [
  { label: "全部", value: "all" },
  { label: "置顶", value: "pinned" },
  { label: "收藏", value: "favorites" },
  { label: "文本", value: "text" },
  { label: "图像", value: "images" },
  { label: "文件", value: "files" },
] as const;

function reportError(label: string, error: unknown) {
  console.error(label, error);
  const reason = error instanceof Error ? error.message : String(error ?? "");
  message.error(`${label}${reason ? `：${reason}` : ""}`);
}

async function syncSystemClipboard() {
  try {
    capturing.value = true;
    clipboardPreview.value = await readText();
  } catch (error) {
    reportError("同步系统剪贴板失败", error);
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
    reportError("AI 操作失败", error);
  }
}

onMounted(() => {
  void (async () => {
    try {
      await history.syncStatus();
    } catch (error) {
      reportError("同步应用状态失败", error);
    }
    try {
      await history.refresh();
    } catch (error) {
      reportError("加载历史记录失败", error);
    }
    await syncSystemClipboard();
  })();
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
  try {
    await history.copyClip(item);
    message.success("已写入系统剪贴板");
  } catch (error) {
    reportError("复制失败", error);
  }
}

async function handlePin(item: (typeof history.items)[number]) {
  try {
    await history.updateFlags(item.id, { pinned: !item.isPinned });
  } catch (error) {
    reportError("更新置顶状态失败", error);
  }
}

async function handleFavorite(item: (typeof history.items)[number]) {
  try {
    await history.updateFlags(item.id, { favorite: !item.isFavorite });
  } catch (error) {
    reportError("更新收藏状态失败", error);
  }
}

async function handleRemove(item: (typeof history.items)[number]) {
  try {
    await history.removeClip(item.id);
    message.success("已删除");
  } catch (error) {
    reportError("删除失败", error);
  }
}

async function handleSavePreview() {
  if (!clipboardPreview.value.trim()) return;
  try {
    await history.captureText(clipboardPreview.value);
    message.success("已保存至历史");
  } catch (error) {
    reportError("保存失败", error);
  }
}

async function handleRefresh() {
  try {
    await history.refresh();
  } catch (error) {
    reportError("刷新历史失败", error);
  }
}

async function handleImport() {
  try {
    await history.importHistory();
    message.success("已导入历史记录");
  } catch (error) {
    reportError("导入失败", error);
  }
}

async function handleExport() {
  try {
    await history.exportHistory();
    message.success("历史记录已导出");
  } catch (error) {
    reportError("导出失败", error);
  }
}

async function handleClear() {
  try {
    await history.clearHistory();
    message.success("历史记录已清空");
  } catch (error) {
    reportError("清空失败", error);
  }
}
</script>

<template>
  <div class="history-page">
    <AppSidebar />
    <section class="main">
      <div v-if="initializing" class="boot-skeleton">
        <n-skeleton height="48px" :sharp="false" class="skeleton-line" />
        <div class="skeleton-grid">
          <n-skeleton v-for="i in 2" :key="`card-${i}`" height="180px" :sharp="false" class="skeleton-card" />
        </div>
        <n-skeleton height="36px" :sharp="false" class="skeleton-line" />
        <div class="skeleton-list">
          <n-skeleton v-for="i in 4" :key="`row-${i}`" height="96px" :sharp="false" />
        </div>
      </div>
      <template v-else>
        <header class="top-bar">
          <n-input
            v-model:value="searchValue"
            placeholder="搜索历史内容或使用 Ctrl+Shift+V 呼出"
            clearable
            size="large"
            @clear="handleRefresh"
          />
          <div class="top-actions">
            <n-button quaternary size="small" @click="handleRefresh">刷新</n-button>
            <n-button quaternary size="small" @click="handleImport">导入</n-button>
            <n-button quaternary size="small" @click="handleExport" :loading="history.isExporting">导出</n-button>
            <n-popconfirm @positive-click="handleClear">
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
          <n-radio-group
            :value="history.filter"
            size="small"
            class="filter-group"
            @update:value="handleFilterChange"
          >
            <n-radio-button v-for="option in filterOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </n-radio-button>
          </n-radio-group>
          <span class="result-count">共 {{ history.filteredItems.length }} 条记录</span>
        </section>

        <n-alert v-if="history.lastError" type="warning" class="history-alert" show-icon>
          {{ history.lastError }}
        </n-alert>

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
      </template>
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

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-group :deep(.n-radio-button__content) {
  padding: 0 12px;
  min-width: 64px;
  text-align: center;
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

.history-alert {
  margin-bottom: 12px;
}

.boot-skeleton {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding-top: 8px;
}

.skeleton-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.skeleton-card,
.skeleton-line,
.skeleton-list :deep(.n-skeleton)
{
  border-radius: var(--vibe-radius-lg);
}

.skeleton-line {
  border-radius: var(--vibe-radius-md);
}

.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
</style>
