import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type {
  AiActionRequest,
  AiActionResponse,
  ClipItem,
  ClipKind,
  ClipboardDraftPayload,
  HistoryExportPayload,
  HistoryFilter,
} from "@/types/history";
import { ClipKind as ClipKindEnum } from "@/types/history";
import { useSettingsStore } from "./settings";

const HISTORY_LIMIT = 200;

function normalizeClip(raw: any): ClipItem {
  const kindNumber = Number(raw.kind ?? ClipKindEnum.Text) as ClipKind;
  return {
    id: raw.id,
    kind: kindNumber,
    content: String(raw.content ?? ""),
    preview: raw.preview ?? raw.extra ?? null,
    extra: raw.extra ?? null,
    isPinned: Boolean(raw.is_pinned ?? raw.isPinned),
    isFavorite: Boolean(raw.is_favorite ?? raw.isFavorite),
    createdAt: raw.created_at ?? raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updated_at ?? raw.updatedAt ?? new Date().toISOString(),
  };
}

function serializeClip(item: ClipItem) {
  return {
    id: item.id,
    kind: item.kind,
    content: item.content,
    preview: item.preview ?? null,
    extra: item.extra ?? null,
    is_pinned: item.isPinned,
    is_favorite: item.isFavorite,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

export const useHistoryStore = defineStore("history", () => {
  const items = ref<ClipItem[]>([]);
  const filter = ref<HistoryFilter>("all");
  const searchTerm = ref("");
  const isLoading = ref(false);
  const isExporting = ref(false);
  const listening = ref(true);
  const latest = ref<ClipItem | null>(null);
  const aiBusy = ref(false);
  const initialized = ref(false);
  const lastError = ref<string | null>(null);
  let fetchTimer: number | null = null;

  const settings = useSettingsStore();

  function raise(message: string, error: unknown): never {
    const reason =
      error instanceof Error ? error : new Error(String(error ?? message));
    console.error(message, reason);
    lastError.value = `${message}: ${reason.message}`;
    throw reason;
  }

  const filteredItems = computed(() => {
    const base = items.value.filter(item => {
      switch (filter.value) {
        case "pinned":
          return item.isPinned;
        case "favorites":
          return item.isFavorite;
        case "text":
          return item.kind === ClipKindEnum.Text;
        case "images":
          return item.kind === ClipKindEnum.Image;
        case "files":
          return item.kind === ClipKindEnum.File;
        default:
          return true;
      }
    });
    if (!searchTerm.value.trim()) {
      return base;
    }
    const q = searchTerm.value.trim().toLowerCase();
    return base.filter(item => {
      const preview = item.preview ?? "";
      return (
        item.content.toLowerCase().includes(q) ||
        preview.toLowerCase().includes(q) ||
        (item.extra ?? "").toLowerCase().includes(q)
      );
    });
  });

  function scheduleFetch() {
    if (fetchTimer) {
      window.clearTimeout(fetchTimer);
    }
    fetchTimer = window.setTimeout(() => {
      fetchTimer = null;
      void refresh().catch(() => undefined);
    }, 280);
  }

  async function refresh() {
    isLoading.value = true;
    try {
      const payload = await invoke<ClipItem[]>("fetch_clips", {
        query: searchTerm.value.trim() || null,
        favoritesFirst: filter.value === "favorites" || filter.value === "pinned",
        limit: HISTORY_LIMIT,
      });
      items.value = (payload || []).map(normalizeClip);
      if (items.value.length > 0) {
        latest.value = items.value[0];
      }
    } catch (error) {
      raise("无法加载剪贴板历史", error);
    } finally {
      isLoading.value = false;
      initialized.value = true;
    }
  }

  async function syncStatus() {
    try {
      const status = await invoke<{ listening: boolean; offline: boolean }>(
        "get_app_status"
      );
      listening.value = status.listening;
      settings.setOfflineLocal(status.offline);
    } catch (error) {
      raise("无法同步应用状态", error);
    }
  }

  async function setListening(value: boolean) {
    try {
      await invoke("set_listening", { listening: value });
      listening.value = value;
    } catch (error) {
      raise("无法更新监听状态", error);
    }
  }

  async function insertClip(draft: ClipboardDraftPayload) {
    if (!listening.value) {
      return;
    }
    try {
      const payload = await invoke<ClipItem>("insert_clip", { draft });
      const clip = normalizeClip(payload);
      items.value = [clip, ...items.value].slice(0, HISTORY_LIMIT);
      latest.value = clip;
    } catch (error) {
      raise("保存剪贴板内容失败", error);
    }
  }

  async function updateFlags(id: number, data: { pinned?: boolean; favorite?: boolean }) {
    try {
      await invoke("update_clip_flags", {
        id,
        pinned: data.pinned,
        favorite: data.favorite,
      });
      items.value = items.value.map(item =>
        item.id === id
          ? {
              ...item,
              isPinned: data.pinned ?? item.isPinned,
              isFavorite: data.favorite ?? item.isFavorite,
            }
          : item
      );
    } catch (error) {
      raise("更新剪贴板标记失败", error);
    }
  }

  async function removeClip(id: number) {
    try {
      await invoke("remove_clip", { id });
      items.value = items.value.filter(item => item.id !== id);
    } catch (error) {
      raise("删除剪贴板记录失败", error);
    }
  }

  async function clearHistory() {
    try {
      await invoke("clear_history");
      items.value = [];
      latest.value = null;
    } catch (error) {
      raise("清空历史记录失败", error);
    }
  }

  async function exportHistory() {
    try {
      isExporting.value = true;
      const payload = await invoke<HistoryExportPayload>("export_history");
      const target = await save({
        title: "导出剪贴板历史",
        defaultPath: `vibeclip-pro-history-${new Date()
          .toISOString()
          .replace(/[:.]/g, "-")}.json`,
      });
      if (!target) return;
      await writeTextFile(target, JSON.stringify(payload, null, 2));
    } catch (error) {
      raise("导出历史记录失败", error);
    } finally {
      isExporting.value = false;
    }
  }

  async function importHistory() {
    try {
      const file = await open({
        title: "导入剪贴板历史",
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!file) return;
      const content = await readTextFile(file as string);
      const payload = JSON.parse(content) as HistoryExportPayload;
      const normalized = payload.items.map(serializeClip);
      await invoke("import_history", { items: normalized });
      await refresh();
    } catch (error) {
      raise("导入历史记录失败", error);
    }
  }

  async function runAiAction(request: AiActionRequest) {
    if (settings.offlineMode) {
      throw new Error("离线模式下无法调用 AI 服务");
    }
    aiBusy.value = true;
    try {
      const response = await invoke<AiActionResponse>("perform_ai_action", { request });
      await insertClip({
        kind: ClipKindEnum.Text,
        text: response.result,
        preview: response.result.slice(0, 96),
        extra: response.used_prompt,
      });
      await writeText(response.result);
      return response;
    } catch (error) {
      raise("AI 操作失败", error);
    } finally {
      aiBusy.value = false;
    }
  }

  async function copyClip(item: ClipItem) {
    try {
      if (item.kind === ClipKindEnum.Text || item.kind === ClipKindEnum.File) {
        await writeText(item.content);
      } else if (item.kind === ClipKindEnum.Image) {
        await writeText("[Image copied]");
      }
    } catch (error) {
      raise("复制到系统剪贴板失败", error);
    }
  }

  async function captureText(text: string, options?: Partial<ClipboardDraftPayload>) {
    try {
      await insertClip({
        kind: ClipKindEnum.Text,
        text,
        preview: text.slice(0, 120),
        ...options,
      });
      await writeText(text);
    } catch (error) {
      raise("保存文本失败", error);
    }
  }

  return {
    items,
    filter,
    searchTerm,
    filteredItems,
    isLoading,
    isExporting,
    listening,
    latest,
    aiBusy,
    initialized,
    lastError,
    refresh,
    scheduleFetch,
    setListening,
    syncStatus,
    insertClip,
    updateFlags,
    removeClip,
    clearHistory,
    exportHistory,
    importHistory,
    runAiAction,
    copyClip,
    captureText,
  };
});
