<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useMessage, type DropdownOption } from "naive-ui";
import AppSidebar from "@/components/layout/AppSidebar.vue";
import HistoryItem from "@/components/history/HistoryItem.vue";
import { useHistoryStore } from "@/store/history";
import type { ClipItem } from "@/types/history";

const history = useHistoryStore();
const message = useMessage();

const modeOptions: DropdownOption[] = [
  { label: "收藏", value: "favorites" },
  { label: "置顶", value: "pinned" },
];
const mode = ref<"favorites" | "pinned">("favorites");
const keyword = ref("");

const items = computed(() => {
  const source = history.items.filter(item =>
    mode.value === "favorites" ? item.isFavorite : item.isPinned,
  );
  if (!keyword.value.trim()) {
    return source;
  }
  const query = keyword.value.trim().toLowerCase();
  return source.filter(item => {
    const preview = item.preview ?? "";
    return (
      item.content.toLowerCase().includes(query) ||
      preview.toLowerCase().includes(query) ||
      (item.extra ?? "").toLowerCase().includes(query)
    );
  });
});

function reportError(label: string, error: unknown) {
  console.error(label, error);
  const detail = error instanceof Error ? error.message : String(error ?? "");
  message.error(`${label}${detail ? `：${detail}` : ""}`);
}

async function handleCopy(item: ClipItem) {
  try {
    await history.copyClip(item);
    message.success("已写入系统剪贴板");
  } catch (error) {
    reportError("复制失败", error);
  }
}

async function handlePin(item: ClipItem) {
  try {
    await history.updateFlags(item.id, { pinned: !item.isPinned });
  } catch (error) {
    reportError("更新置顶状态失败", error);
  }
}

async function handleFavorite(item: ClipItem) {
  try {
    await history.updateFlags(item.id, { favorite: !item.isFavorite });
  } catch (error) {
    reportError("更新收藏状态失败", error);
  }
}

async function handleRemove(item: ClipItem) {
  try {
    await history.removeClip(item.id);
    message.success("已删除");
  } catch (error) {
    reportError("删除失败", error);
  }
}

onMounted(async () => {
  if (!history.items.length) {
    try {
      await history.refresh();
    } catch (error) {
      reportError("加载历史记录失败", error);
    }
  }
});
</script>

<template>
  <div class="favorites-page">
    <AppSidebar />
    <section class="main">
      <header class="page-header">
        <div>
          <h1>收藏与置顶</h1>
          <p>集中管理标记的重要剪贴板内容</p>
        </div>
        <div class="header-actions">
          <n-select v-model:value="mode" :options="modeOptions" size="small" />
          <n-input
            v-model:value="keyword"
            size="small"
            clearable
            placeholder="搜索内容、备注或类型"
            style="width: 220px"
          />
        </div>
      </header>

      <section class="favorites-list">
        <n-empty v-if="!items.length" description="暂无记录">
          <template #extra>
            <n-button size="small" @click="history.refresh()">重新加载</n-button>
          </template>
        </n-empty>
        <n-virtual-list
          v-else
          class="favorites-virtual-list"
          :items="items"
          key-field="id"
          :item-size="176"
        >
          <template #default="{ item }">
            <HistoryItem
              :item="item"
              @copy="handleCopy"
              @pin="handlePin"
              @favorite="handleFavorite"
              @remove="handleRemove"
            />
          </template>
        </n-virtual-list>
      </section>
    </section>
  </div>
</template>

<style scoped>
.favorites-page {
  display: flex;
  height: 100%;
}

.main {
  flex: 1;
  padding: 28px 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow: hidden;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.page-header h1 {
  margin: 0;
  font-size: 26px;
}

.page-header p {
  margin: 6px 0 0;
  color: var(--vibe-text-muted);
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.favorites-list {
  flex: 1;
  background: var(--vibe-bg-surface);
  border-radius: var(--vibe-radius-lg);
  border: 1px solid var(--vibe-border-soft);
  padding: 16px 18px;
  overflow: hidden;
  min-height: 0;
}

.favorites-virtual-list {
  height: 100%;
  padding-right: 6px;
}

.favorites-virtual-list :deep(.history-item) {
  margin-bottom: 12px;
}

.favorites-virtual-list :deep(.history-item:last-child) {
  margin-bottom: 0;
}
</style>
