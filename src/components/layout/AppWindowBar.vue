<script setup lang="ts">
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { computed } from "vue";
import { useRouter } from "vue-router";
import MdiMinus from "~icons/mdi/minus";
import MdiClose from "~icons/mdi/close";
import MdiCog from "~icons/mdi/cog";

const router = useRouter();

const current = (() => {
  try {
    return getCurrentWebviewWindow();
  } catch (error) {
    console.warn("Tauri window API unavailable", error);
    return null;
  }
})();

const title = computed(() => "VibeClip Pro");

async function minimize() {
  try {
    await current?.minimize();
  } catch (error) {
    console.error("Failed to minimize window", error);
  }
}

async function close() {
  try {
    await current?.close();
  } catch (error) {
    console.error("Failed to close window", error);
  }
}

function openSettings() {
  router.push("/settings");
}
</script>

<template>
  <header class="window-bar" data-tauri-drag-region>
    <div class="window-title">{{ title }}</div>
    <div class="window-actions" data-tauri-drag-region="false">
      <button 
        class="window-button settings-btn" 
        type="button" 
        @click="openSettings" 
        aria-label="设置"
        title="设置"
      >
        <n-icon :component="MdiCog" size="16" />
      </button>
      <button 
        class="window-button minimize-btn" 
        type="button" 
        @click="minimize" 
        aria-label="最小化"
        title="最小化"
      >
        <n-icon :component="MdiMinus" size="16" />
      </button>
      <button 
        class="window-button close-btn" 
        type="button" 
        @click="close" 
        aria-label="关闭"
        title="关闭"
      >
        <n-icon :component="MdiClose" size="16" />
      </button>
    </div>
  </header>
</template>

<style scoped>
/* 现代化窗口标题栏 */
.window-bar {
  width: 100%;
  height: 48px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--modern-space-md);
  padding: 0 var(--modern-space-md);
  -webkit-app-region: drag;
  background: var(--modern-bg-primary);
  border-bottom: 1px solid var(--modern-border-color);
}

.window-title {
  font-size: var(--modern-text-base);
  font-weight: var(--modern-font-semibold);
  color: var(--modern-text-primary);
}

.window-actions {
  display: flex;
  align-items: center;
  gap: var(--modern-space-sm);
  -webkit-app-region: no-drag;
}

.window-button {
  width: 32px;
  height: 32px;
  border-radius: var(--modern-radius);
  border: none;
  background: transparent;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: all var(--modern-transition-fast);
  -webkit-app-region: no-drag;
  color: var(--modern-text-secondary);
}

.window-button:hover {
  background: var(--modern-bg-secondary);
  color: var(--modern-text-primary);
}

.window-button:active {
  transform: scale(0.95);
}

.window-button.settings-btn:hover {
  background: var(--modern-primary-light);
  color: var(--modern-primary);
}

.window-button.minimize-btn:hover {
  background: rgba(255, 193, 7, 0.1);
  color: #ffc107;
}

.window-button.close-btn:hover {
  background: rgba(255, 59, 48, 0.1);
  color: #ff3b30;
}

.dark .window-button.close-btn:hover {
  background: rgba(255, 69, 58, 0.2);
  color: #ff453a;
}
</style>
