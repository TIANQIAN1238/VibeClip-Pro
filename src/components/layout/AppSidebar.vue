<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useMessage } from "naive-ui";
import { useHistoryStore } from "@/store/history";
import { useSettingsStore } from "@/store/settings";
import AppInfo from "@/AppInfo";
import { useLocale } from "@/composables/useLocale";
import MdiHistory from "~icons/mdi/history";
import MdiCogOutline from "~icons/mdi/cog-outline";
import MdiClipboardTextOutline from "~icons/mdi/clipboard-text-outline";
import MdiRobotOutline from "~icons/mdi/robot-outline";

const router = useRouter();
const route = useRoute();
const history = useHistoryStore();
const settings = useSettingsStore();
const message = useMessage();
const { t, format } = useLocale();

const rawNavItems = [
  {
    key: "clipboard",
    labelKey: "nav.clipboard",
    fallback: "剪贴板",
    icon: MdiClipboardTextOutline,
    path: "/clipboard",
  },
  {
    key: "history",
    labelKey: "nav.history",
    fallback: "历史记录",
    icon: MdiHistory,
    path: "/history",
  },
  {
    key: "ai-tools",
    labelKey: "nav.ai",
    fallback: "AI 工具",
    icon: MdiRobotOutline,
    path: "/ai",
  },
  {
    key: "settings",
    labelKey: "nav.settings",
    fallback: "设置",
    icon: MdiCogOutline,
    path: "/settings",
  },
] as const;

const navItems = computed(() =>
  rawNavItems.map(item => ({
    ...item,
    label: t(item.labelKey, item.fallback),
  }))
);

const activeKey = computed(() => (route.name as string) ?? "clipboard");

function navigate(path: string) {
  if (route.path !== path) {
    router.push(path).catch(error => {
      console.error("导航失败", error);
    });
  }
}

async function updateListening(value: boolean) {
  try {
    await history.setListening(value);
    message.success(
      value
        ? t("nav.recording", "已开启剪贴板监听")
        : t("nav.paused", "已暂停剪贴板监听")
    );
  } catch (error) {
    console.error("更新监听状态失败", error);
    message.error(t("nav.listenError", "无法切换剪贴板监听"));
  }
}

function updateAiConnection(value: boolean) {
  settings.offlineMode = !value;
  message.success(
    value
      ? t("nav.online", "AI 服务已连接")
      : t("nav.offlineEnabled", "AI 服务已断开")
  );
}

const listeningStatusLabel = computed(() =>
  history.listening ? t("nav.recording", "实时监听") : t("nav.paused", "已暂停")
);

const listeningDescription = computed(() =>
  history.listening
    ? t("nav.recordingHint", "自动捕获系统剪贴板内容")
    : t("nav.pausedHint", "暂停后将不会自动保存剪贴板")
);

const aiConnected = computed(() => !settings.offlineMode);

const aiStatusLabel = computed(() =>
  aiConnected.value
    ? t("nav.online", "AI 已连接")
    : t("nav.offlineEnabled", "AI 已断开")
);

const aiStatusDescription = computed(() =>
  aiConnected.value
    ? t("nav.onlineHint", "AI 快捷操作可用")
    : t("nav.offlineHint", "断开后保留本地功能")
);

const versionLabel = computed(() => `${t("settings.version", "版本")} ${AppInfo.version.value}`);

const historyCountLabel = computed(() =>
  format("settings.historyCount", "剪贴板条目 {count}", { count: history.items.length })
);
</script>

<template>
  <aside class="sidebar" data-tauri-drag-region>
    <div class="brand" data-tauri-drag-region>
      <div class="brand-mark">⎋</div>
      <div class="brand-meta">
        <span class="brand-tag">{{ t("nav.tagline", "AI 快捷操作") }}</span>
        <h1>VibeClip Pro</h1>
      </div>
      <span class="version-chip">{{ versionLabel }}</span>
    </div>

    <nav class="nav" data-tauri-drag-region="false">
      <button
        v-for="item in navItems"
        :key="item.key"
        type="button"
        class="nav-item"
        :class="{ active: activeKey === item.key }"
        @click="navigate(item.path)"
      >
        <n-icon size="18" :component="item.icon" />
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <div class="control-panel" data-tauri-drag-region="false">
      <div class="control-card">
        <div class="control-text">
          <div class="control-header">
            <span class="control-name">{{ t("nav.clipboardMonitor", "剪贴板监听") }}</span>
            <span class="control-state" :class="{ active: history.listening }">
              {{ listeningStatusLabel }}
            </span>
          </div>
          <p>{{ listeningDescription }}</p>
        </div>
        <n-switch
          size="small"
          :value="history.listening"
          @update:value="updateListening"
        />
      </div>

      <div class="control-card">
        <div class="control-text">
          <div class="control-header">
            <span class="control-name">{{ t("nav.aiServices", "AI 服务") }}</span>
            <span class="control-state" :class="{ active: aiConnected }">
              {{ aiStatusLabel }}
            </span>
          </div>
          <p>{{ aiStatusDescription }}</p>
        </div>
        <n-switch
          size="small"
          :value="aiConnected"
          @update:value="updateAiConnection"
        />
      </div>
    </div>

    <footer class="footer" data-tauri-drag-region="false">
      <span>{{ historyCountLabel }}</span>
      <span class="muted">{{ t("nav.deviceReady", "准备就绪") }}</span>
    </footer>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border-radius: var(--vibe-radius-xl);
  background: var(--vibe-panel-surface);
  border: 1px solid var(--vibe-panel-border);
  box-shadow: var(--vibe-shadow-soft);
  position: sticky;
  top: 0;
  z-index: 20;
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-app-region: drag;
}

.brand {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.brand-mark {
  width: 44px;
  height: 44px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 22px;
  color: #fff;
  background: linear-gradient(135deg, var(--vibe-accent), var(--vibe-accent-strong));
  -webkit-app-region: no-drag;
}

.brand-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.brand-meta h1 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.brand-tag {
  font-size: 12px;
  color: var(--vibe-text-muted);
}

.version-chip {
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--vibe-control-bg);
  font-size: 12px;
  color: var(--vibe-text-secondary);
  -webkit-app-region: no-drag;
}

.nav {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.nav-item {
  border: none;
  border-radius: var(--vibe-radius-lg);
  padding: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: var(--vibe-control-bg);
  color: var(--vibe-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-app-region: no-drag;
}

.nav-item:hover {
  background: var(--vibe-control-hover);
  transform: translateY(-1px);
}

.nav-item.active {
  background: linear-gradient(135deg, var(--vibe-accent), var(--vibe-accent-strong));
  color: var(--vibe-nav-text-active);
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.12);
}

.nav-item span {
  font-size: 12px;
  font-weight: 600;
}

.control-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.control-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border-radius: var(--vibe-radius-lg);
  background: var(--vibe-panel-surface-strong);
  border: 1px solid var(--vibe-panel-border);
  -webkit-app-region: no-drag;
}

.control-text {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.control-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.control-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--vibe-text-primary);
}

.control-state {
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11px;
  background: var(--vibe-control-bg);
  color: var(--vibe-text-secondary);
}

.control-state.active {
  background: var(--vibe-accent);
  color: var(--vibe-nav-text-active);
}

.control-text p {
  margin: 0;
  font-size: 12px;
  color: var(--vibe-text-muted);
  line-height: 1.4;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--vibe-text-secondary);
}

.muted {
  color: var(--vibe-text-muted);
}

@media (min-width: 460px) {
  .nav {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
