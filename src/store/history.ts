import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
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
import { safeInvoke, isTauriRuntime, TauriUnavailableError, explainTauriFallback } from "@/libs/tauri";
import { clipMatchesFilter } from "@/utils/content-inspector";
import { offlineTranslate, getTranslationQuality } from "@/utils/offline-translator";

const HISTORY_LIMIT = 200;

const PREVIEW_DEMO_ITEMS: ClipItem[] = [
  {
    id: 1001,
    kind: ClipKindEnum.Text,
    content: "欢迎体验 VibeClip Pro！这是一个演示片段，用于展示快速收藏与置顶。",
    contentHash: "demo-1001",
    preview: "欢迎体验 VibeClip Pro！这是一个演示片段...",
    extra: "演示数据",
    isPinned: true,
    isFavorite: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 1002,
    kind: ClipKindEnum.Text,
    content: "使用 AI 快捷操作，可以一键翻译、润色或总结你的剪贴板内容。",
    contentHash: "demo-1002",
    preview: "使用 AI 快捷操作，可以一键翻译...",
    extra: "AI 快捷操作",
    isPinned: false,
    isFavorite: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 1003,
    kind: ClipKindEnum.Text,
    content: "右键任意历史记录即可呼出快捷菜单，快速执行复制、收藏或 AI 动作。",
    contentHash: "demo-1003",
    preview: "右键任意历史记录即可呼出快捷菜单...",
    extra: "快捷操作",
    isPinned: false,
    isFavorite: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 1004,
    kind: ClipKindEnum.Text,
    content: "支持导出历史记录备份，并能在桌面端保持剪贴板与历史同步。",
    contentHash: "demo-1004",
    preview: "支持导出历史记录备份，并能...",
    extra: "工作流程",
    isPinned: false,
    isFavorite: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function normalizeClip(raw: any): ClipItem {
  const kindNumber = Number(raw.kind ?? ClipKindEnum.Text) as ClipKind;
  return {
    id: raw.id,
    kind: kindNumber,
    content: String(raw.content ?? ""),
    contentHash: raw.content_hash ?? raw.contentHash ?? "",
    preview: raw.preview ?? raw.extra ?? null,
    extra: raw.extra ?? null,
    isPinned: Boolean(raw.is_pinned ?? raw.isPinned),
    isFavorite: Boolean(raw.is_favorite ?? raw.isFavorite),
    createdAt: raw.created_at ?? raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updated_at ?? raw.updatedAt ?? new Date().toISOString(),
  };

}
function buildAiPrompts(request: AiActionRequest): { system: string; user: string } {
  const language = request.language?.trim() || "zh-CN";
  switch (request.action) {
    case "translate":
      return {
        system: `You are VibeClip Pro, a precise multilingual translator. Respond in ${language} with a natural translation.`,
        user: request.input.trim(),
      };
    case "summarize":
      return {
        system: `You are VibeClip Pro, an expert summarizer. Summaries must be concise bullet points in ${language}.`,
        user: `Summarize the following content:\n${request.input.trim()}`,
      };
    case "polish":
      return {
        system: `You are VibeClip Pro, a writing assistant who enhances clarity. Keep the meaning but improve fluency in ${language}.`,
        user: `Improve the following content:\n${request.input.trim()}`,
      };
    case "jsonify":
      return {
        system: "You are VibeClip Pro, a data formatter returning strict JSON.",
        user: `Convert the following content into valid JSON. Use lowercase keys.\n${request.input.trim()}`,
      };
    case "custom":
    default:
      return {
        system:
          request.customPrompt?.trim() ||
          "You are VibeClip Pro, a helpful assistant.",
        user: request.input.trim(),
      };
  }
}


function serializeClip(item: ClipItem) {
  return {
    id: item.id,
    kind: item.kind,
    content: item.content,
    content_hash: item.contentHash,
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
  const hasMore = ref(false);
  const nextOffset = ref(0);
  let fetchTimer: number | null = null;
  let clipboardUnlisten: UnlistenFn | null = null;

  const settings = useSettingsStore();

  if (typeof window !== "undefined") {
    void ensureClipboardListener();
  }

  function raise(message: string, error: unknown): never {
    const reason =
      error instanceof Error ? error : new Error(String(error ?? message));
    console.error(message, reason);
    if (reason instanceof TauriUnavailableError) {
      lastError.value = explainTauriFallback();
    } else {
      lastError.value = `${message}: ${reason.message}`;
    }
    throw reason;
  }

  const filteredItems = computed(() => {
    const base = items.value.filter(item => clipMatchesFilter(item, filter.value));
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
      nextOffset.value = 0;
      void refresh().catch(() => undefined);
    }, 280);
  }

  const effectiveLimit = computed(() => {
    const configured = settings.historyLimit || HISTORY_LIMIT;
    return Math.max(50, Math.min(configured, 500));
  });

  async function fetchPage(options: { append: boolean }) {
    isLoading.value = true;
    try {
      if (!isTauriRuntime()) {
        if (!options.append) {
          items.value = PREVIEW_DEMO_ITEMS.map(item => ({ ...item }));
          latest.value = items.value[0] ?? null;
          nextOffset.value = items.value.length;
          hasMore.value = false;
          lastError.value = explainTauriFallback();
        }
        return;
      }
      const payload = await safeInvoke<ClipItem[]>("fetch_clips", {
        query: searchTerm.value.trim() || null,
        favoritesFirst: filter.value === "favorites" || filter.value === "pinned",
        limit: effectiveLimit.value,
        offset: options.append ? nextOffset.value : 0,
      });
      const batch = (payload || []).map(normalizeClip);
      if (options.append && items.value.length) {
        const existingIds = new Set(items.value.map(item => item.id));
        const merged = batch.filter(item => !existingIds.has(item.id));
        items.value = [...items.value, ...merged];
      } else {
        items.value = batch;
        nextOffset.value = 0;
      }
      if (items.value.length > 0) {
        latest.value = items.value[0];
      }
      hasMore.value = batch.length >= effectiveLimit.value;
      nextOffset.value = items.value.length;
    } catch (error) {
      raise("无法加载剪贴板历史", error);
    } finally {
      isLoading.value = false;
      initialized.value = true;
    }
  }

  async function refresh() {
    nextOffset.value = 0;
    await fetchPage({ append: false });
  }

  async function loadMore() {
    if (!hasMore.value || isLoading.value) {
      return;
    }
    await fetchPage({ append: true });
  }

  watch(
    () => settings.historyLimit,
    () => {
      nextOffset.value = 0;
      if (initialized.value) {
        void refresh();
      }
    }
  );

  async function ensureClipboardListener() {
    if (clipboardUnlisten) {
      return;
    }
    if (!isTauriRuntime()) {
      return;
    }
    try {
      clipboardUnlisten = await listen<ClipItem>("clipboard://captured", event => {
        const clip = normalizeClip(event.payload);
        const limit = settings.historyLimit || HISTORY_LIMIT;
        items.value = [
          clip,
          ...items.value.filter(entry => entry.id !== clip.id),
        ].slice(0, limit);
        latest.value = clip;
      });
    } catch (error) {
      console.error("无法订阅剪贴板事件", error);
    }
  }

  async function syncStatus() {
    if (!isTauriRuntime()) {
      listening.value = true;
      settings.setOfflineLocal(false);
      lastError.value = explainTauriFallback();
      return;
    }
    try {
      const status = await safeInvoke<{ listening: boolean; offline: boolean }>(
        "get_app_status"
      );
      listening.value = status.listening;
      settings.setOfflineLocal(status.offline);
    } catch (error) {
      raise("无法同步应用状态", error);
    }
  }

  async function setListening(value: boolean) {
    if (!isTauriRuntime()) {
      listening.value = value;
      return;
    }
    try {
      await safeInvoke("set_listening", { listening: value });
      listening.value = value;
    } catch (error) {
      raise("无法更新监听状态", error);
    }
  }

  async function insertClip(draft: ClipboardDraftPayload) {
    if (!listening.value) {
      return null;
    }
    try {
      if (!isTauriRuntime()) {
        const now = Date.now();
        const baseContent =
          draft.text ?? draft.preview ?? draft.extra ?? "";
        const clip: ClipItem = {
          id: now,
          kind: draft.kind,
          content: baseContent,
          contentHash: `preview-${now}`,
          preview:
            draft.preview ??
            (baseContent ? baseContent.slice(0, 120) : draft.extra ?? null),
          extra: draft.extra ?? null,
          isPinned: Boolean(draft.isPinned),
          isFavorite: Boolean(draft.isFavorite),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const limit = settings.historyLimit || HISTORY_LIMIT;
        items.value = [clip, ...items.value].slice(0, limit);
        nextOffset.value = items.value.length;
        latest.value = clip;
        return clip;
      }
      const payload = await safeInvoke<ClipItem>("insert_clip", { draft });
      const clip = normalizeClip(payload);
      const limit = settings.historyLimit || HISTORY_LIMIT;
      items.value = [clip, ...items.value].slice(0, limit);
      nextOffset.value = items.value.length;
      latest.value = clip;
      return clip;
    } catch (error) {
      raise("保存剪贴板内容失败", error);
    }
    return null;
  }

  async function updateFlags(id: number, data: { pinned?: boolean; favorite?: boolean }) {
    try {
      console.log('[History Store] Updating flags for id:', id, 'data:', data);
      if (!isTauriRuntime()) {
        items.value = items.value.map(item =>
          item.id === id
            ? {
              ...item,
              isPinned: data.pinned ?? item.isPinned,
              isFavorite: data.favorite ?? item.isFavorite,
              updatedAt: new Date().toISOString(),
            }
            : item,
        );
        return;
      }

      await safeInvoke("update_clip_flags", {
        id,
        pinned: data.pinned ?? null,
        favorite: data.favorite ?? null,
      });

      console.log('[History Store] Flags updated successfully, updating local state');

      items.value = items.value.map(item =>
        item.id === id
          ? {
            ...item,
            isPinned: data.pinned ?? item.isPinned,
            isFavorite: data.favorite ?? item.isFavorite,
          }
          : item
      );

      console.log('[History Store] Local state updated');
    } catch (error) {
      console.error('[History Store] Update flags error:', error);
      raise("更新剪贴板标记失败", error);
    }
  }

  async function removeClip(id: number) {
    try {
      if (!isTauriRuntime()) {
        items.value = items.value.filter(item => item.id !== id);
        nextOffset.value = items.value.length;
        if (items.value.length < effectiveLimit.value) {
          hasMore.value = false;
        }
        return;
      }
      await safeInvoke("remove_clip", { id });
      items.value = items.value.filter(item => item.id !== id);
      nextOffset.value = items.value.length;
      if (items.value.length < effectiveLimit.value) {
        hasMore.value = false;
      }
    } catch (error) {
      raise("删除剪贴板记录失败", error);
    }
  }

  async function clearHistory() {
    try {
      if (!isTauriRuntime()) {
        items.value = [];
        latest.value = null;
        hasMore.value = false;
        nextOffset.value = 0;
        return;
      }
      await safeInvoke("clear_history");
      items.value = [];
      latest.value = null;
      hasMore.value = false;
      nextOffset.value = 0;
    } catch (error) {
      raise("清空历史记录失败", error);
    }
  }

  async function exportHistory() {
    try {
      isExporting.value = true;
      if (!isTauriRuntime()) {
        const payload: HistoryExportPayload = {
          exported_at: Date.now(),
          items: items.value,
        };
        if (typeof document !== "undefined") {
          const blob = new Blob([JSON.stringify(payload, null, 2)], {
            type: "application/json",
          });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `vibeclip-pro-history-preview-${new Date()
            .toISOString()
            .replace(/[:.]/g, "-")}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
        }
        return;
      }
      const payload = await safeInvoke<HistoryExportPayload>("export_history");
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
      if (!isTauriRuntime()) {
        if (typeof document === "undefined") return;
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json";
        const file = await new Promise<File | null>(resolve => {
          input.onchange = () => {
            const selected = input.files?.[0] ?? null;
            resolve(selected);
          };
          input.click();
        });
        if (!file) return;
        const content = await file.text();
        const payload = JSON.parse(content) as HistoryExportPayload;
        const normalized = payload.items.map(normalizeClip);
        items.value = normalized;
        latest.value = items.value[0] ?? null;
        nextOffset.value = items.value.length;
        hasMore.value = false;
        lastError.value = explainTauriFallback();
        return;
      }
      const file = await open({
        title: "导入剪贴板历史",
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!file) return;
      const content = await readTextFile(file as string);
      const payload = JSON.parse(content) as HistoryExportPayload;
      const normalized = payload.items.map(serializeClip);
      await safeInvoke("import_history", { items: normalized });
      await refresh();
    } catch (error) {
      raise("导入历史记录失败", error);
    }
  }

  async function runOfflineTranslation(request: AiActionRequest, options?: { persist?: boolean; copy?: boolean }): Promise<AiActionResponse> {
    aiBusy.value = true;
    try {
      // 确定目标语言
      let targetLang: 'zh' | 'en' | undefined = undefined;
      const language = request.language?.toLowerCase();
      if (language?.includes('zh') || language?.includes('中文')) {
        targetLang = 'zh';
      } else if (language?.includes('en') || language?.includes('english')) {
        targetLang = 'en';
      }

      // 执行离线翻译
      const translatedText = offlineTranslate(request.input, targetLang);
      
      // 获取翻译质量评估
      const quality = getTranslationQuality(request.input, translatedText);
      
      // 构建响应
      const response: AiActionResponse = {
        result: translatedText,
        used_prompt: `[离线翻译] ${request.input}`,
        finished_at: new Date().toISOString(),
      };

      // 处理持久化和复制
      const persist = options?.persist ?? true;
      const copy = options?.copy ?? true;
      let persisted: ClipItem | null = null;

      if (persist) {
        const resultWithNote = `${translatedText}\n\n---\n💡 ${quality.message}`;
        persisted = await insertClip({
          kind: ClipKindEnum.Text,
          text: resultWithNote,
          preview: translatedText.slice(0, 96),
          extra: `离线翻译 (质量: ${quality.quality}, 覆盖率: ${quality.coverage}%)`,
        });
      }

      if (copy) {
        if (isTauriRuntime()) {
          if (persisted) {
            await markSelfCapture({
              hash: persisted.contentHash,
              kind: persisted.kind,
              content: persisted.content,
            });
          } else {
            await markSelfCapture({
              kind: ClipKindEnum.Text,
              content: translatedText,
            });
          }
          await writeText(translatedText);
        } else if (typeof navigator !== "undefined" && navigator.clipboard) {
          await navigator.clipboard.writeText(translatedText);
        }
      }

      return response;
    } catch (error) {
      raise("离线翻译失败", error);
    } finally {
      aiBusy.value = false;
    }
  }

  async function runAiAction(request: AiActionRequest, options?: { persist?: boolean; copy?: boolean }) {
    // 离线模式下仅支持翻译功能
    if (settings.offlineMode) {
      if (request.action === 'translate') {
        return await runOfflineTranslation(request, options);
      } else {
        throw new Error("离线模式下仅支持翻译功能，其他AI功能需要联网使用");
      }
    }
    aiBusy.value = true;

    // 设置30秒超时保护
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("AI 请求超时(30秒),请检查网络或稍后重试")), 30000);
    });

    try {
      let response: AiActionResponse;
      if (isTauriRuntime()) {
        response = await Promise.race([
          safeInvoke<AiActionResponse>("perform_ai_action", { request }),
          timeoutPromise
        ]);
      } else {
        const apiKey = request.apiKey.trim();
        if (!apiKey) {
          throw new Error("请先配置 AI 服务的 API Key");
        }
        const baseUrl = request.baseUrl.trim().replace(/\/$/, "");
        if (!baseUrl) {
          throw new Error("请先配置 AI 服务接口地址");
        }
        const model = (request.model?.trim() || "gemini-2.5-flash").trim();
        const { system, user } = buildAiPrompts(request);
        const payload = {
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: request.temperature ?? 0.3,
        };
        const previewResponse = await Promise.race([
          fetch(`${baseUrl}/v1/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          }),
          timeoutPromise
        ]);
        if (!previewResponse.ok) {
          const text = await previewResponse.text();
          throw new Error(`AI 接口返回 ${previewResponse.status}: ${text}`);
        }
        const body = await previewResponse.json();
        const message = body?.choices?.[0]?.message?.content;
        if (!message) {
          throw new Error("AI 响应为空");
        }
        response = {
          result: String(message).trim(),
          used_prompt: user,
          finished_at: new Date().toISOString(),
        };
      }
      const persist = options?.persist ?? true;
      const copy = options?.copy ?? true;
      let persisted: ClipItem | null = null;
      if (persist) {
        persisted = await insertClip({
          kind: ClipKindEnum.Text,
          text: response.result,
          preview: response.result.slice(0, 96),
          extra: response.used_prompt,
        });
      }
      if (copy) {
        if (isTauriRuntime()) {
          if (persisted) {
            await markSelfCapture({
              hash: persisted.contentHash,
              kind: persisted.kind,
              content: persisted.content,
            });
          } else {
            await markSelfCapture({
              kind: ClipKindEnum.Text,
              content: response.result,
            });
          }
          await writeText(response.result);
        } else if (typeof navigator !== "undefined" && navigator.clipboard) {
          await navigator.clipboard.writeText(response.result);
        }
      }
      return response;
    } catch (error) {
      raise("AI 操作失败", error);
    } finally {
      aiBusy.value = false;
    }
  }

  async function copyClip(item: ClipItem) {
    try {
      if (isTauriRuntime()) {
        if (item.kind === ClipKindEnum.Text || item.kind === ClipKindEnum.File) {
          await markSelfCapture({
            hash: item.contentHash,
            kind: item.kind,
            content: item.content,
          });
          await writeText(item.content);
        } else if (item.kind === ClipKindEnum.Image) {
          const placeholder = "[Image copied]";
          await markSelfCapture({
            kind: ClipKindEnum.Text,
            content: placeholder,
          });
          await writeText(placeholder);
        }
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        const text =
          item.kind === ClipKindEnum.Image
            ? "[Image copied]"
            : item.content;
        await navigator.clipboard.writeText(text);
      }
    } catch (error) {
      raise("复制到系统剪贴板失败", error);
    }
  }

  async function captureText(text: string, options?: Partial<ClipboardDraftPayload>) {
    try {
      const clip = await insertClip({
        kind: ClipKindEnum.Text,
        text,
        preview: text.slice(0, 120),
        ...options,
      });
      if (isTauriRuntime()) {
        await markSelfCapture({
          hash: clip?.contentHash ?? null,
          kind: ClipKindEnum.Text,
          content: text,
        });
        await writeText(text);
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
    } catch (error) {
      raise("保存文本失败", error);
    }
  }

  async function markSelfCapture(options: {
    hash?: string | null;
    kind?: ClipKind;
    content?: string | null;
  }) {
    try {
      if (!isTauriRuntime()) {
        return;
      }
      await safeInvoke("ignore_next_clipboard_capture", {
        hash: options.hash ?? null,
        kind:
          typeof options.kind === "number"
            ? (options.kind as number)
            : options.kind !== undefined
              ? Number(options.kind)
              : null,
        content: options.content ?? null,
      });
    } catch (error) {
      console.warn("无法标记应用复制来源", error);
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
    hasMore,
    refresh,
    loadMore,
    scheduleFetch,
    ensureClipboardListener,
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
    markSelfCapture,
  };
});
