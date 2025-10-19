<script setup lang="ts">
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { computed } from "vue";
import { safeInvoke } from "@/libs/tauri";
import MdiMinus from "~icons/mdi/minus";
import MdiClose from "~icons/mdi/close";
import MdiCog from "~icons/mdi/cog";

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
    // Hide instead of destroy to keep tray shortcuts alive
    await current?.hide();
  } catch (error) {
    console.error("Failed to hide window", error);
  }
}

function openSettings() {
  safeInvoke("open_settings_window");
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
.window-bar {
  width: 100%;
  min-height: 44px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 18px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: var(--vibe-text-primary);
  -webkit-app-region: drag;
  background: color-mix(in srgb, var(--vibe-panel-surface-strong) 90%, rgba(255, 255, 255, 0.18));
  border-radius: calc(var(--vibe-radius-xl) - 4px);
  border: 1px solid color-mix(in srgb, var(--vibe-panel-border) 52%, transparent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.36);
  backdrop-filter: blur(18px) saturate(135%);
}

.dark .window-bar {
  background: color-mix(in srgb, var(--vibe-panel-surface) 88%, rgba(16, 23, 47, 0.4));
  border-color: color-mix(in srgb, var(--vibe-panel-border) 65%, transparent);
  box-shadow: inset 0 1px 0 rgba(10, 18, 36, 0.6);
}

.window-title {
  font-size: 14px;
}

.window-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  -webkit-app-region: no-drag;
}

.window-button {
  width: 32px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: rgba(255, 255, 255, 0.28);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: all 0.2s ease;
  -webkit-app-region: no-drag;
  color: rgba(23, 35, 61, 0.75);
}

.dark .window-button {
  background: rgba(18, 27, 48, 0.58);
  color: rgba(236, 243, 255, 0.8);
}

.window-button:hover {
  background: rgba(255, 255, 255, 0.45);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.dark .window-button:hover {
  background: rgba(18, 27, 48, 0.75);
}

.window-button:active {
  transform: translateY(0);
  box-shadow: none;
}

.window-button.settings-btn:hover {
  background: rgba(81, 97, 255, 0.15);
  color: var(--vibe-accent);
}

.window-button.minimize-btn:hover {
  background: rgba(255, 193, 7, 0.15);
  color: #ffc107;
}

.window-button.close-btn:hover {
  background: rgba(255, 112, 112, 0.68);
  color: #fff;
}

.dark .window-button.close-btn:hover {
  background: rgba(255, 82, 82, 0.85);
}
</style>
