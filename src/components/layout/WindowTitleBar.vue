<script setup lang="ts">
import { computed } from "vue";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useRouter } from "vue-router";
import MdiMinus from "~icons/mdi/minus";
import MdiClose from "~icons/mdi/close";
import MdiArrowLeft from "~icons/mdi/arrow-left";

defineProps<{
  title: string;
  showMinimize?: boolean;
  showBack?: boolean;
}>();

const currentWindow = getCurrentWebviewWindow();
const router = useRouter();

// 检测是否在主窗口中
const isMainWindow = computed(() => {
  return currentWindow.label === "main";
});

async function minimizeWindow() {
  await currentWindow.minimize();
}

async function handleClose() {
  // 如果在主窗口中，执行返回操作而不是关闭窗口
  if (isMainWindow.value) {
    router.back();
  } else {
    await currentWindow.close();
  }
}

function goBack() {
  router.back();
}
</script>

<template>
  <div class="window-title-bar" data-tauri-drag-region>
    <div class="title-bar-content">
      <button
        v-if="showBack !== false"
        class="title-bar-button back"
        @click="goBack"
        title="返回"
        data-tauri-drag-region="false"
      >
        <n-icon :component="MdiArrowLeft" :size="18" />
      </button>
      <span class="title-text">{{ title }}</span>
    </div>
    <div class="title-bar-controls" data-tauri-drag-region="false">
      <button
        v-if="showMinimize !== false"
        class="title-bar-button minimize"
        @click="minimizeWindow"
        title="最小化"
      >
        <n-icon :component="MdiMinus" :size="16" />
      </button>
      <button
        class="title-bar-button close"
        @click="handleClose"
        :title="isMainWindow ? '返回' : '关闭'"
      >
        <n-icon :component="MdiClose" :size="16" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.window-title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  background: var(--vibe-bg-surface);
  border-bottom: 1px solid var(--vibe-panel-border);
  padding: 0 12px;
  user-select: none;
  flex-shrink: 0;
}

.title-bar-content {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--vibe-text-primary);
}

.title-bar-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.title-bar-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--vibe-text-secondary);
}

.title-bar-button:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--vibe-text-primary);
  transform: translateY(-1px);
}

.dark .title-bar-button:hover {
  background: rgba(255, 255, 255, 0.08);
}

.title-bar-button.back {
  color: var(--vibe-text-primary);
}

.title-bar-button.back:hover {
  background: var(--vibe-accent);
  color: white;
}

.title-bar-button.close:hover {
  background: #e81123;
  color: white;
}

.title-bar-button:active {
  transform: scale(0.95);
}
</style>

