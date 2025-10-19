<script setup lang="ts">
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import MdiMinus from "~icons/mdi/minus";
import MdiClose from "~icons/mdi/close";

const props = defineProps<{
  title: string;
  showMinimize?: boolean;
}>();

const currentWindow = getCurrentWebviewWindow();

async function minimizeWindow() {
  await currentWindow.minimize();
}

async function closeWindow() {
  await currentWindow.close();
}
</script>

<template>
  <div class="window-title-bar" data-tauri-drag-region>
    <div class="title-bar-content">
      <span class="title-text">{{ title }}</span>
    </div>
    <div class="title-bar-controls">
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
        @click="closeWindow"
        title="关闭"
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
  gap: 8px;
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

.title-bar-button.close:hover {
  background: #e81123;
  color: white;
}

.title-bar-button:active {
  transform: scale(0.95);
}
</style>

