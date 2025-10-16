<script setup lang="ts">
import { computed } from "vue";
import type { ClipItem } from "@/types/history";
import { ClipKind } from "@/types/history";
import MdiPinOutline from "~icons/mdi/pin-outline";
import MdiPin from "~icons/mdi/pin";
import MdiStarOutline from "~icons/mdi/star-outline";
import MdiStar from "~icons/mdi/star";
import MdiTrashCan from "~icons/mdi/trash-can-outline";
import MdiContentCopy from "~icons/mdi/content-copy";

const props = defineProps<{
  item: ClipItem;
}>();

const emits = defineEmits<{
  (e: "copy", item: ClipItem): void;
  (e: "pin", item: ClipItem): void;
  (e: "favorite", item: ClipItem): void;
  (e: "remove", item: ClipItem): void;
}>();

const kindLabel = computed(() => {
  switch (props.item.kind) {
    case ClipKind.Image:
      return "图像";
    case ClipKind.File:
      return "文件";
    default:
      return "文本";
  }
});

const previewText = computed(() => {
  if (props.item.kind === ClipKind.Image) {
    return props.item.preview ?? "粘贴的图像";
  }
  if (props.item.kind === ClipKind.File) {
    return props.item.preview ?? props.item.content;
  }
  const text = props.item.content;
  if (text.length <= 200) return text;
  return `${text.slice(0, 200)}…`;
});

function handleCopy() {
  emits("copy", props.item);
}

function handlePin() {
  emits("pin", props.item);
}

function handleFavorite() {
  emits("favorite", props.item);
}

function handleRemove() {
  emits("remove", props.item);
}
</script>

<template>
  <div class="history-item" :class="{ pinned: item.isPinned, favorite: item.isFavorite }">
    <div class="item-head">
      <div class="item-meta">
        <span class="kind-chip">{{ kindLabel }}</span>
        <span class="timestamp">{{ new Date(item.updatedAt).toLocaleString() }}</span>
      </div>
      <div class="item-actions">
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button quaternary size="tiny" circle @click.stop="handlePin">
              <n-icon :component="item.isPinned ? MdiPin : MdiPinOutline" />
            </n-button>
          </template>
          <span>{{ item.isPinned ? '取消置顶' : '置顶' }}</span>
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button quaternary size="tiny" circle @click.stop="handleFavorite">
              <n-icon :component="item.isFavorite ? MdiStar : MdiStarOutline" />
            </n-button>
          </template>
          <span>{{ item.isFavorite ? '取消收藏' : '收藏' }}</span>
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button quaternary size="tiny" circle @click.stop="handleCopy">
              <n-icon :component="MdiContentCopy" />
            </n-button>
          </template>
          <span>复制</span>
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button quaternary size="tiny" circle @click.stop="handleRemove">
              <n-icon :component="MdiTrashCan" />
            </n-button>
          </template>
          <span>删除</span>
        </n-tooltip>
      </div>
    </div>
    <div class="item-body">
      <div v-if="item.kind === ClipKind.Image" class="image-preview">
        <img
          :src="`data:image/png;base64,${item.content}`"
          alt="Clipboard image preview"
          loading="lazy"
          decoding="async"
        />
      </div>
      <p v-else class="text-preview">{{ previewText }}</p>
    </div>
    <div v-if="item.extra" class="item-extra">{{ item.extra }}</div>
  </div>
</template>

<style scoped>
.history-item {
  background: var(--vibe-bg-surface);
  border-radius: var(--vibe-radius-lg);
  padding: 18px;
  border: 1px solid var(--vibe-border-soft);
  transition: transform var(--vibe-transition), box-shadow var(--vibe-transition);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-item:hover {
  transform: translateY(-2px);
  box-shadow: var(--vibe-shadow-soft);
}

.history-item.pinned {
  border-color: rgba(81, 97, 255, 0.32);
}

.history-item.favorite {
  border-color: rgba(255, 196, 84, 0.42);
}

.item-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--vibe-text-muted);
}

.kind-chip {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(81, 97, 255, 0.12);
  color: rgba(38, 47, 110, 0.8);
  font-weight: 600;
}

.item-actions {
  display: flex;
  gap: 6px;
}

.text-preview {
  margin: 0;
  color: var(--vibe-text-primary);
  line-height: var(--line-height, 1.5);
  white-space: pre-wrap;
  word-break: break-word;
}

.image-preview {
  border-radius: var(--vibe-radius-md);
  overflow: hidden;
  max-height: 200px;
  display: flex;
  justify-content: center;
  background: rgba(0, 0, 0, 0.05);
}

.image-preview img {
  max-width: 100%;
  object-fit: contain;
}

.item-extra {
  font-size: 12px;
  color: var(--vibe-text-muted);
  background: rgba(81, 97, 255, 0.08);
  border-radius: var(--vibe-radius-md);
  padding: 8px 10px;
}
</style>
