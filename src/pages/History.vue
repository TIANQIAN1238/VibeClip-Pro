<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useMessage, useDialog } from "naive-ui";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { openUrl } from "@tauri-apps/plugin-opener";
import HistoryItem from "@/components/history/HistoryItem.vue";
import { useHistoryStore } from "@/store/history";
import { useSettingsStore } from "@/store/settings";
import { useLocale } from "@/composables/useLocale";
import { useWindowSync } from "@/composables/useWindowSync";
import type { AiActionKind, ClipItem } from "@/types/history";
import { ClipKind } from "@/types/history";
import { extractFeaturesFromClip } from "@/utils/content-inspector";
import MdiContentCopy from "~icons/mdi/content-copy";
import MdiHeartOutline from "~icons/mdi/heart-outline";
import MdiHeart from "~icons/mdi/heart";
import MdiPinOutline from "~icons/mdi/pin-outline";
import MdiPin from "~icons/mdi/pin";
import MdiTranslate from "~icons/mdi/translate";
import MdiTextBoxSearchOutline from "~icons/mdi/text-box-search-outline";
import MdiFeather from "~icons/mdi/feather";
import MdiShareVariant from "~icons/mdi/share-variant";
import MdiOpenInNew from "~icons/mdi/open-in-new";
import MdiDeleteOutline from "~icons/mdi/delete-outline";
import MdiTextRecognition from "~icons/mdi/text-recognition";

const history = useHistoryStore();
const settings = useSettingsStore();
const message = useMessage();
const dialog = useDialog();
const { t, format } = useLocale();

// 启用窗口间同步
useWindowSync();

const clipboardPreview = ref("");
const capturing = ref(false);
const searchInput = ref("");

const contextMenu = reactive({
  show: false,
  x: 0,
  y: 0,
  renderX: 0,
  renderY: 0,
  item: null as ClipItem | null,
});

const menuRef = ref<HTMLElement | null>(null);

const aiDialog = reactive({
  visible: false,
  loading: false,
  action: null as AiActionKind | null,
  source: null as ClipItem | null,
  result: "",
});

const filterOptions = computed(() => [
  { label: t("history.filterAll", "全部"), value: "all" },
  { label: t("history.filterPinned", "置顶"), value: "pinned" },
  { label: t("history.filterFavorite", "收藏"), value: "favorites" },
  { label: t("history.filterText", "文本"), value: "text" },
  { label: t("history.filterImage", "图片"), value: "images" },
  { label: t("history.filterFile", "文件"), value: "files" },
  { label: t("history.filterLink", "链接"), value: "links" },
  { label: t("history.filterCode", "代码"), value: "code" },
  { label: t("history.filterCommand", "命令"), value: "commands" },
  { label: t("history.filterJson", "JSON"), value: "json" },
]);

const contextOptions = computed(() => {
  const item = contextMenu.item;
  if (!item) return [] as {
    key: string;
    label: string;
    icon: any;
    danger?: boolean;
  }[];
  const features = extractFeaturesFromClip(item);
  const isText = item.kind === ClipKind.Text;
  const isImage = item.kind === ClipKind.Image;
  const items: { key: string; label: string; icon: any; danger?: boolean }[] = [
    { key: "copy", label: t("contextMenu.copy", "复制"), icon: MdiContentCopy },
    {
      key: "favorite",
      label: t("contextMenu.favorite", "收藏"),
      icon: item.isFavorite ? MdiHeart : MdiHeartOutline,
    },
    {
      key: "pin",
      label: t("contextMenu.pin", "置顶"),
      icon: item.isPinned ? MdiPin : MdiPinOutline,
    },
  ];
  if (isText) {
    items.push(
      {
        key: "translate",
        label: t("contextMenu.translate", "AI 翻译"),
        icon: MdiTranslate,
      },
      {
        key: "summarize",
        label: t("contextMenu.summarize", "AI 摘要"),
        icon: MdiTextBoxSearchOutline,
      },
      {
        key: "polish",
        label: t("contextMenu.polish", "AI 润色"),
        icon: MdiFeather,
      },
      {
        key: "share",
        label: t("contextMenu.share", "快速分享"),
        icon: MdiShareVariant,
      },
    );
  }
  if (isImage) {
    items.push({
      key: "ocr",
      label: t("contextMenu.ocr", "AI OCR 提取文字"),
      icon: MdiTextRecognition,
    });
  }
  if (isText && features.has("url")) {
    items.push({ key: "open", label: t("contextMenu.open", "打开链接"), icon: MdiOpenInNew });
  }
  items.push({ key: "delete", label: t("contextMenu.delete", "删除"), icon: MdiDeleteOutline, danger: true });
  return items;
});

const aiDialogTitle = computed(() => {
  switch (aiDialog.action) {
    case "translate":
      return t("contextMenu.translate", "AI 翻译");
    case "summarize":
      return t("contextMenu.summarize", "AI 摘要");
    case "polish":
      return t("contextMenu.polish", "AI 润色");
    default:
      return "AI";
  }
});

const resultCountLabel = computed(() =>
  format("history.total", "共 {count} 条记录", { count: history.filteredItems.length })
);

// Unused variable - kept for future use
// const clipboardCountLabel = computed(() =>
//   format("history.total", "共 {count} 条记录", { count: history.items.length })
// );

const historySummary = computed(() => {
  const stats = {
    total: history.items.length,
    text: 0,
    images: 0,
    files: 0,
    favorites: 0,
    pinned: 0,
  };
  for (const item of history.items) {
    if (item.kind === ClipKind.Text) stats.text += 1;
    if (item.kind === ClipKind.Image) stats.images += 1;
    if (item.kind === ClipKind.File) stats.files += 1;
    if (item.isFavorite) stats.favorites += 1;
    if (item.isPinned) stats.pinned += 1;
  }
  return [
    { key: "total", label: t("history.summaryTotal", "总计"), value: stats.total },
    { key: "text", label: t("history.summaryText", "文本"), value: stats.text },
    { key: "images", label: t("history.summaryImages", "图片"), value: stats.images },
    { key: "favorites", label: t("history.summaryFavorites", "收藏"), value: stats.favorites },
    { key: "pinned", label: t("history.summaryPinned", "置顶"), value: stats.pinned },
  ];
});

watch(
  () => history.searchTerm,
  value => {
    if (value !== searchInput.value) {
      searchInput.value = value;
    }
  },
  { immediate: true }
);

watch(searchInput, value => {
  history.searchTerm = value;
  history.scheduleFetch();
});

function reportError(label: string, error: unknown) {
  console.error(label, error);
  const detail = error instanceof Error ? error.message : String(error ?? "");
  message.error(`${label}${detail ? `：${detail}` : ""}`);
}

async function syncSystemClipboard() {
  try {
    capturing.value = true;
    const text = await readText();
    clipboardPreview.value = text || "";
  } catch (error) {
    clipboardPreview.value = "";
    console.log("剪贴板当前为空或不包含文本");
  } finally {
    capturing.value = false;
  }
}

// Unused function - kept for future use
// async function handleSavePreview() {
//   if (!clipboardPreview.value.trim()) {
//     message.info(t("clipboard.empty", "暂无文本内容，可使用 Ctrl+C 复制后刷新查看。"));
//     return;
//   }
//   try {
//     await history.captureText(clipboardPreview.value);
//     message.success(t("clipboard.save", "保存到历史"));
//   } catch (error) {
//     reportError(t("clipboard.save", "保存到历史"), error);
//   }
// }

async function handleCopy(item: ClipItem) {
  try {
    await history.copyClip(item);
    message.success(t("contextMenu.copy", "复制"));
  } catch (error) {
    reportError(t("contextMenu.copy", "复制"), error);
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

function handleRemove(item: ClipItem) {
  dialog.warning({
    title: t("contextMenu.delete", "删除"),
    content: t("history.confirmDelete", "确定删除该条记录吗？"),
    positiveText: t("contextMenu.delete", "删除"),
    negativeText: t("common.cancel", "取消"),
    onPositiveClick: async () => {
      try {
        await history.removeClip(item.id);
        message.success(t("contextMenu.delete", "删除"));
      } catch (error) {
        reportError(t("contextMenu.delete", "删除"), error);
      }
    },
  });
}

// Unused function - kept for future use
// async function handleAiRun(payload: {
//   action: AiActionKind;
//   input: string;
//   language: string;
//   customPrompt?: string;
// }) {
//   if (!settings.apiKey) {
//     message.error("请先在 API 页面配置 API Key");
//     return;
//   }
//   try {
//     await history.runAiAction({
//       action: payload.action,
//       input: payload.input,
//       language: payload.language,
//       customPrompt: payload.customPrompt,
//       apiKey: settings.apiKey,
//       baseUrl: settings.apiBaseUrl,
//       model: settings.model,
//       temperature: settings.temperature,
//     });
//     message.success("AI 操作已完成并写入剪贴板");
//   } catch (error) {
//     reportError("AI 操作失败", error);
//   }
// }

function handleFilterChange(value: string) {
  history.filter = value as typeof history.filter;
  history.scheduleFetch();
}

function handleContextMenu(item: ClipItem, event: MouseEvent) {
  event.preventDefault();
  contextMenu.item = item;
  contextMenu.x = event.clientX;
  contextMenu.y = event.clientY;
  contextMenu.show = true;
  nextTick(adjustMenuPosition);
}

function adjustMenuPosition() {
  const menu = menuRef.value;
  if (!menu) return;
  const rect = menu.getBoundingClientRect();
  const { innerWidth, innerHeight } = window;
  let left = contextMenu.x;
  let top = contextMenu.y;
  if (left + rect.width > innerWidth - 8) {
    left = innerWidth - rect.width - 8;
  }
  if (top + rect.height > innerHeight - 8) {
    top = innerHeight - rect.height - 8;
  }
  contextMenu.renderX = Math.max(8, left);
  contextMenu.renderY = Math.max(8, top);
}

function closeContextMenu() {
  contextMenu.show = false;
  contextMenu.item = null;
}

function handleOutside(event: PointerEvent) {
  if (!menuRef.value) return;
  if (!menuRef.value.contains(event.target as Node)) {
    closeContextMenu();
  }
}

watch(
  () => contextMenu.show,
  value => {
    if (value) {
      document.addEventListener("pointerdown", handleOutside, true);
      window.addEventListener("resize", closeContextMenu);
      nextTick(adjustMenuPosition);
    } else {
      document.removeEventListener("pointerdown", handleOutside, true);
      window.removeEventListener("resize", closeContextMenu);
    }
  }
);

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleOutside, true);
  window.removeEventListener("resize", closeContextMenu);
});

async function handleContextSelect(key: string) {
  const target = contextMenu.item;
  if (!target) return;
  closeContextMenu();
  switch (key) {
    case "copy":
      await handleCopy(target);
      break;
    case "favorite":
      await handleFavorite(target);
      break;
    case "pin":
      await handlePin(target);
      break;
    case "translate":
    case "summarize":
    case "polish":
      await openAiDialog(key as AiActionKind, target);
      break;
    case "ocr":
      if (target.kind === ClipKind.Image) {
        await openAiDialog("custom", target);
      }
      break;
    case "share":
      await shareClip(target);
      break;
    case "open":
      try {
        await openUrl(target.content);
        message.success(t("contextMenu.open", "打开链接"));
      } catch (error) {
        reportError(t("contextMenu.open", "打开链接"), error);
      }
      break;
    case "delete":
      await handleRemove(target);
      break;
    default:
      break;
  }
}

async function openAiDialog(action: AiActionKind, item: ClipItem) {
  if (!settings.apiKey) {
    message.error("请先在 API 页面配置 API Key");
    return;
  }
  aiDialog.visible = true;
  aiDialog.loading = true;
  aiDialog.action = action;
  aiDialog.source = item;
  aiDialog.result = "";
  
  // 设置30秒超时保护
  const timeoutId = setTimeout(() => {
    if (aiDialog.loading) {
      aiDialog.loading = false;
      aiDialog.result = "请求超时，请重试";
      message.error("AI 操作超时");
    }
  }, 30000);
  
  try {
    let customPrompt: string | undefined;
    let input = item.content;
    
    // 特殊处理图片OCR
    if (action === "custom" && item.kind === ClipKind.Image) {
      const base64Data = item.content;
      input = `data:image/png;base64,${base64Data}`;
      customPrompt = `You are VibeClip Pro Vision OCR. Extract all text from the following base64 encoded PNG image and respond in ${settings.preferredLanguage}. Return only the extracted text without any additional commentary.`;
    }
    
    // 使用活跃的AI服务商配置
    const activeProvider = settings.activeProvider;
    if (!activeProvider) {
      throw new Error("请在 API 配置页面添加并配置 AI 服务商");
    }
    if (!activeProvider.apiKey) {
      throw new Error("请在 API 配置页面填写 API Key");
    }
    
    const response = await history.runAiAction(
      {
        action,
        input,
        language: settings.preferredLanguage,
        customPrompt,
        apiKey: activeProvider.apiKey,
        baseUrl: activeProvider.baseUrl,
        model: activeProvider.model,
        temperature: activeProvider.temperature,
      },
      { persist: false, copy: false }
    );
    aiDialog.result = response.result;
  } catch (error) {
    reportError("AI 操作失败", error);
    aiDialog.result = "操作失败，请检查网络和API配置";
  } finally {
    clearTimeout(timeoutId);
    aiDialog.loading = false;
  }
}

async function shareClip(item: ClipItem) {
  try {
    const payload = `VibeClip · ${item.extra ?? "Snippet"}\n${item.content}`;
    await history.markSelfCapture({ kind: ClipKind.Text, content: payload });
    await writeText(payload);
    message.success(t("contextMenu.share", "快速分享"));
  } catch (error) {
    reportError(t("contextMenu.share", "快速分享"), error);
  }
}

function handleAiDialogToggle(value: boolean) {
  // 允许用户随时关闭对话框
  aiDialog.visible = value;
  if (!value) {
    // 如果还在加载中,停止加载
    if (aiDialog.loading) {
      aiDialog.loading = false;
    }
    aiDialog.result = "";
    aiDialog.action = null;
    aiDialog.source = null;
  }
}

async function copyAiResult() {
  if (!aiDialog.result) return;
  try {
    await history.markSelfCapture({ kind: ClipKind.Text, content: aiDialog.result });
    await writeText(aiDialog.result);
    message.success(t("history.aiDialogCopy", "复制"));
  } catch (error) {
    reportError(t("history.aiDialogCopy", "复制"), error);
  }
}

async function saveAiResult() {
  if (!aiDialog.result) return;
  try {
    await history.insertClip({
      kind: ClipKind.Text,
      text: aiDialog.result,
      preview: aiDialog.result.slice(0, 120),
      extra: aiDialog.action ? t(`contextMenu.${aiDialog.action}`, aiDialog.action) : undefined,
    });
    message.success(t("history.aiDialogSave", "保存到历史"));
  } catch (error) {
    reportError(t("history.aiDialogSave", "保存到历史"), error);
  }
}

async function loadMore() {
  await history.loadMore();
}

async function handleClearHistory() {
  try {
    await history.clearHistory();
    message.success(t("history.cleared", "历史记录已清空"));
  } catch (error) {
    reportError(t("history.clearAll", "清空历史"), error);
  }
}

// Unused function - kept for future use
// function handleSnapshotContextMenu(event: MouseEvent) {
//   if (!clipboardPreview.value) return;
//   
//   contextMenu.item = {
//     id: 0 as any, // 临时ID用于快照
//     kind: ClipKind.Text,
//     content: clipboardPreview.value,
//     preview: clipboardPreview.value.slice(0, 120),
//     contentHash: '',
//     createdAt: new Date().toISOString(),
//     updatedAt: new Date().toISOString(),
//     isPinned: false,
//     isFavorite: false,
//   } as ClipItem;
//   
//   contextMenu.x = event.clientX;
//   contextMenu.y = event.clientY;
//   contextMenu.show = true;
//   nextTick(adjustMenuPosition);
// }

onMounted(async () => {
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
  void syncSystemClipboard();
});
</script>

<template>
  <div class="modern-history-page">
    <!-- 顶部导航 -->
    <nav class="modern-page-nav">
      <router-link to="/clipboard" class="modern-nav-item" active-class="active">
        <span>剪切板</span>
      </router-link>
      <router-link to="/ai" class="modern-nav-item" active-class="active">
        <span>AI 工具</span>
      </router-link>
      <router-link to="/settings" class="modern-nav-item" active-class="active">
        <span>设置</span>
      </router-link>
    </nav>
    
    <div class="modern-main">
      <header class="page-header">
        <div>
          <h1>{{ t("history.title", "历史记录") }}</h1>
          <p>{{ t("history.subtitle", "按标签筛选历史记录，并在右键菜单中快速操作") }}</p>
        </div>
        <div class="header-actions">
          <n-popconfirm
            :positive-text="t('common.confirm', '确定')"
            :negative-text="t('common.cancel', '取消')"
            @positive-click="handleClearHistory"
          >
            <template #trigger>
              <n-button size="tiny" tertiary type="error">
                {{ t("history.clearAll", "清空历史") }}
              </n-button>
            </template>
            {{ t("history.confirmClearAll", "确认清空所有历史记录？此操作不可撤销。") }}
          </n-popconfirm>
          <n-button size="tiny" secondary @click="history.exportHistory" :loading="history.isExporting">
            {{ t("settings.export", "导出历史") }}
          </n-button>
        </div>
      </header>

      <div class="content-scroll thin-scrollbar">
        <!-- 统计摘要 - 单行显示 -->
        <div class="history-summary">
          <div v-for="stat in historySummary" :key="stat.key" class="summary-chip">
            <span class="summary-value">{{ stat.value }}</span>
            <span class="summary-label">{{ stat.label }}</span>
          </div>
        </div>

        <!-- 筛选和搜索栏 -->
        <section class="filters-section">
          <div class="filter-tabs">
            <button
              v-for="option in filterOptions"
              :key="option.value"
              type="button"
              class="filter-tab"
              :class="{ active: history.filter === option.value }"
              @click="handleFilterChange(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
          <div class="filter-search">
            <n-input
              v-model:value="searchInput"
              size="small"
              clearable
              :placeholder="t('history.searchPlaceholder', '搜索历史...')"
            />
            <span class="result-count">{{ resultCountLabel }}</span>
          </div>
        </section>

        <n-alert v-if="history.lastError" type="warning" show-icon class="history-alert">
          {{ history.lastError }}
        </n-alert>

        <!-- 历史记录列表 -->
        <section class="history-list">
          <n-virtual-list
            v-if="history.filteredItems.length"
            class="history-virtual-list"
            :items="history.filteredItems"
            key-field="id"
            :item-size="120"
            :show-scrollbar="false"
          >
            <template #default="{ item }">
              <div class="history-row" @contextmenu.prevent="handleContextMenu(item, $event)">
                <HistoryItem
                  :item="item"
                  @copy="handleCopy"
                  @pin="handlePin"
                  @favorite="handleFavorite"
                  @remove="handleRemove"
                />
              </div>
            </template>
          </n-virtual-list>
          <n-empty v-else :description="t('history.empty', '还没有保存的剪贴板内容')">
            <template #extra>
              <n-button size="tiny" @click="syncSystemClipboard">
                {{ t("history.emptyAction", "立即同步") }}
              </n-button>
            </template>
          </n-empty>
          <div v-if="history.hasMore" class="load-more">
            <n-button tertiary block size="tiny" :loading="history.isLoading" @click="loadMore">
              {{ t("history.loadMore", "加载更多") }}
            </n-button>
          </div>
        </section>
      </div>
    </div>

    <Teleport to="body">
      <transition name="menu-fade">
        <div v-if="contextMenu.show" class="context-container">
          <div class="context-menu" :style="{ left: `${contextMenu.renderX}px`, top: `${contextMenu.renderY}px` }" ref="menuRef">
            <header class="context-header">{{ t("contextMenu.header", "AI 快捷操作") }}</header>
            <ul>
              <li
                v-for="option in contextOptions"
                :key="option.key"
                :class="['context-item', option.danger ? 'danger' : '']"
                @click="handleContextSelect(option.key)"
              >
                <n-icon size="16" :component="option.icon" />
                <span>{{ option.label }}</span>
              </li>
            </ul>
          </div>
        </div>
      </transition>
    </Teleport>

    <n-modal
      v-model:show="aiDialog.visible"
      preset="card"
      :title="aiDialogTitle"
      :mask-closable="true"
      :close-on-esc="true"
      :closable="true"
      @update:show="handleAiDialogToggle"
    >
      <n-spin :show="aiDialog.loading">
        <div v-if="aiDialog.result" class="ai-result-text">
          <pre>{{ aiDialog.result }}</pre>
        </div>
        <div v-else class="ai-result-placeholder">AI 正在生成中，请稍候…</div>
      </n-spin>
      <template #footer>
        <div class="ai-dialog-actions">
          <n-button size="tiny" secondary @click="copyAiResult" :disabled="!aiDialog.result || aiDialog.loading">
            {{ t("history.aiDialogCopy", "复制") }}
          </n-button>
          <n-button size="tiny" type="primary" @click="saveAiResult" :disabled="!aiDialog.result || aiDialog.loading">
            {{ t("history.aiDialogSave", "保存到历史") }}
          </n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.modern-history-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
  min-height: 0;
  width: 100%;
  background: linear-gradient(165deg, rgba(247, 249, 255, 0.96), rgba(235, 242, 255, 0.86));
  overflow: hidden;
}

:global(.dark) .modern-history-page {
  background: linear-gradient(165deg, rgba(16, 22, 38, 0.94), rgba(18, 28, 48, 0.88));
}

.modern-page-nav {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  padding: 0;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.7);
  border-bottom: 1px solid rgba(79, 107, 255, 0.1);
  z-index: 10;
}

.modern-nav-item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px 20px;
  border-radius: 0;
  font-size: 14px;
  font-weight: 600;
  color: rgba(19, 31, 60, 0.68);
  text-decoration: none;
  background: rgba(255, 255, 255, 0.5);
  border-right: 1px solid rgba(79, 107, 255, 0.08);
  box-shadow: none;
  transition: all 160ms ease;
}

.modern-nav-item:last-child {
  border-right: none;
}

.modern-nav-item:hover {
  background: rgba(255, 255, 255, 0.8);
  color: #3a50ff;
}

.modern-nav-item.active {
  color: #3a50ff;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: inset 0 -3px 0 0 #3a50ff;
  font-weight: 700;
}

.dark .modern-nav-item {
  background: rgba(33, 45, 68, 0.5);
  color: rgba(226, 234, 255, 0.7);
  border-right-color: rgba(122, 209, 245, 0.1);
}

.dark .modern-nav-item:hover {
  background: rgba(33, 45, 68, 0.8);
  color: rgba(122, 209, 245, 0.9);
}

.dark .modern-nav-item.active {
  color: #7ad1f5;
  background: rgba(33, 45, 68, 0.95);
  box-shadow: inset 0 -3px 0 0 #7ad1f5;
}

.modern-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px 24px 24px;
  gap: 18px;
  min-height: 0;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  overflow: hidden;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 16px;
  flex-shrink: 0;
}

.page-header h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}

.page-header p {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--vibe-text-secondary);
}

.header-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.header-actions :deep(.n-button) {
  border-radius: 10px;
}

.content-scroll {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  min-height: 0;
}

.history-summary {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  flex-shrink: 0;
  padding-bottom: 4px;
}

.summary-chip {
  flex: 0 0 auto;
  min-width: 100px;
  padding: 12px 14px;
  border-radius: var(--vibe-radius-md);
  border: 1px solid var(--vibe-panel-border);
  background: var(--vibe-panel-surface);
  box-shadow: var(--vibe-shadow-soft);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 5px;
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

.summary-chip:hover {
  transform: translateY(-1px);
  box-shadow: var(--vibe-shadow-medium);
  border-color: var(--vibe-accent);
}

.summary-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--vibe-text-primary);
}

.summary-label {
  font-size: 11px;
  color: var(--vibe-text-muted);
}

.filters-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: var(--vibe-panel-surface);
  border-radius: var(--vibe-radius-lg);
  border: 1px solid var(--vibe-panel-border);
  padding: 16px 18px;
  flex-shrink: 0;
  box-shadow: var(--vibe-shadow-soft);
  backdrop-filter: blur(20px) saturate(130%);
  -webkit-backdrop-filter: blur(20px) saturate(130%);
  transition: all 200ms ease;
}

.filters-section:hover {
  border-color: var(--vibe-border-strong);
  box-shadow: var(--vibe-shadow-medium);
}

.filter-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.filter-tab {
  flex: 0 0 auto;
  border: none;
  border-radius: 999px;
  padding: 8px 14px;
  background: var(--vibe-control-bg);
  color: var(--vibe-text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 180ms cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid transparent;
}

.filter-tab:hover {
  background: var(--vibe-control-hover);
  color: var(--vibe-text-primary);
  transform: translateY(-1px);
}

.filter-tab.active {
  background: var(--vibe-accent);
  color: white;
  border-color: var(--vibe-accent);
  box-shadow: 0 2px 8px var(--vibe-accent-light, rgba(79, 107, 255, 0.3));
  transform: translateY(0);
}

.filter-search {
  display: flex;
  align-items: center;
  gap: 12px;
}

.result-count {
  font-size: 11px;
  color: var(--vibe-text-muted);
  white-space: nowrap;
}

.history-alert {
  margin: 0;
}

.history-list {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 12px;
  border: 1px solid rgba(79, 107, 255, 0.12);
  box-shadow: 0 8px 24px rgba(36, 56, 128, 0.1);
  padding: 12px;
  min-height: 0;
}

.dark .history-list {
  background: rgba(26, 34, 55, 0.86);
  border-color: rgba(122, 209, 245, 0.16);
}

.history-virtual-list {
  flex: 1;
}

.history-row {
  padding: 6px 0;
}

.history-row :deep(.history-item) {
  border-radius: 10px;
  border: 1px solid rgba(79, 107, 255, 0.12);
  box-shadow: 0 2px 8px rgba(36, 56, 128, 0.08);
  transition: all 140ms ease;
}

.history-row :deep(.history-item:hover) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(36, 56, 128, 0.12);
}

.load-more {
  padding-top: 12px;
}

.context-container {
  position: fixed;
  inset: 0;
  z-index: 1000;
  pointer-events: none;
}

.context-menu {
  position: absolute;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(79, 107, 255, 0.14);
  border-radius: 12px;
  box-shadow: 0 16px 40px rgba(36, 56, 128, 0.2);
  backdrop-filter: blur(12px);
  overflow: hidden;
  pointer-events: auto;
  min-width: 180px;
}

.dark .context-menu {
  background: rgba(26, 34, 55, 0.96);
  border-color: rgba(122, 209, 245, 0.16);
}

.context-header {
  padding: 10px 14px;
  font-size: 11px;
  font-weight: 600;
  color: var(--vibe-text-muted);
  border-bottom: 1px solid rgba(79, 107, 255, 0.1);
}

.context-menu ul {
  list-style: none;
  margin: 0;
  padding: 6px;
}

.context-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  color: var(--vibe-text-primary);
  cursor: pointer;
  transition: background 120ms ease;
}

.context-item:hover {
  background: rgba(79, 107, 255, 0.08);
}

.context-item.danger {
  color: #ff3b30;
}

.context-item.danger:hover {
  background: rgba(255, 59, 48, 0.08);
}

.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: opacity 150ms ease;
}

.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .modern-main {
    padding: 16px;
  }

  .filter-search {
    flex-direction: column;
    align-items: stretch;
  }
}

@media (prefers-reduced-motion: reduce) {
  .modern-nav-item,
  .filter-tab,
  .history-row :deep(.history-item) {
    transition-duration: 0.01ms !important;
    transform: none !important;
  }
}
</style>

