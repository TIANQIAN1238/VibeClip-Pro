<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useMessage } from "naive-ui";
import { readText, writeText, readImage } from "@tauri-apps/plugin-clipboard-manager";
import { openUrl } from "@tauri-apps/plugin-opener";
import AiQuickActions from "@/components/ai/AiQuickActions.vue";
import HistoryItem from "@/components/history/HistoryItem.vue";
import GlobalContextMenu from "@/components/system/GlobalContextMenu.vue";
import { useHistoryStore } from "@/store/history";
import { useSettingsStore } from "@/store/settings";
import { useBridgeStore } from "@/store/bridge";
import type { AiActionKind } from "@/types/history";
import { ClipKind } from "@/types/history";
import {
  buildClipboardSuggestions,
  type ClipboardSuggestion,
  isLikelyFilePath as isClipboardFilePath,
} from "@/utils/content-inspector";
import { useLocale } from "@/composables/useLocale";
import { useContextMenu, type ContextMenuItem } from "@/composables/useContextMenu";
import { useWindowSync } from "@/composables/useWindowSync";
import type { Image as TauriImage } from "@tauri-apps/api/image";
import MdiContentCopy from "~icons/mdi/content-copy";
import MdiContentSave from "~icons/mdi/content-save";
import MdiTranslate from "~icons/mdi/translate";
import MdiTextBoxSearchOutline from "~icons/mdi/text-box-search-outline";
import MdiFeather from "~icons/mdi/feather";
import MdiRobotOutline from "~icons/mdi/robot-outline";
import MdiTextRecognition from "~icons/mdi/text-recognition";
import MdiImageSearchOutline from "~icons/mdi/image-search-outline";
import MdiFileDocumentOutline from "~icons/mdi/file-document-outline";

const MAX_IMAGE_DIMENSION = 1280;

interface ClipboardSnapshot {
  kind: "empty" | "text" | "image" | "file";
  text: string;
  filePath: string | null;
  imageDataUrl: string | null;
  imageSize: { width: number; height: number } | null;
}

const router = useRouter();
const history = useHistoryStore();
const settings = useSettingsStore();
const bridge = useBridgeStore();
const message = useMessage();
const { t, format } = useLocale();
const contextMenu = useContextMenu();

// 启用窗口间同步
useWindowSync();

const snapshot = reactive<ClipboardSnapshot>({
  kind: "empty",
  text: "",
  filePath: null,
  imageDataUrl: null,
  imageSize: null,
});

const capturing = ref(false);
const editing = ref(false);
const editingBusy = ref(false);
const editDraft = ref("");

const textSource = computed(() => (snapshot.kind === "text" ? snapshot.text : ""));

const suggestions = computed(() => {
  // 文本建议
  if (snapshot.kind === "text") {
    const source = textSource.value.trim();
    return source ? buildClipboardSuggestions(source) : [];
  }
  
  // 图片建议
  if (snapshot.kind === "image" && snapshot.imageDataUrl) {
    return [
      {
        key: "ocr-image",
        labelKey: "clipboard.ocrImage",
        fallback: "AI OCR 识别文字",
        action: { type: "ai" as const, action: "custom" as AiActionKind },
      },
      {
        key: "describe-image",
        labelKey: "clipboard.describeImage",
        fallback: "AI 描述图片内容",
        action: { type: "ai" as const, action: "summarize" as AiActionKind },
      },
      {
        key: "save-image",
        labelKey: "clipboard.save",
        fallback: "保存到历史",
        action: { type: "copy" as const, payload: "" },
      },
    ] as ClipboardSuggestion[];
  }
  
  return [];
});

const recentItems = computed(() => history.items.slice(0, 5));

const recentCountLabel = computed(() =>
  format("clipboard.total", "共 {count} 条", { count: history.items.length })
);

const snapshotTypeLabel = computed(() => {
  switch (snapshot.kind) {
    case "text":
      return t("clipboard.typeText", "文本内容");
    case "image":
      return t("clipboard.typeImage", "图片");
    case "file":
      return t("clipboard.typeFile", "文件路径");
    default:
      return t("clipboard.typeEmpty", "空剪贴板");
  }
});

const canSave = computed(() => {
  if (snapshot.kind === "text") {
    return snapshot.text.trim().length > 0;
  }
  if (snapshot.kind === "image") {
    return Boolean(snapshot.imageDataUrl);
  }
  if (snapshot.kind === "file") {
    return Boolean(snapshot.filePath);
  }
  return false;
});

const imageMeta = computed(() => {
  if (snapshot.kind !== "image" || !snapshot.imageSize) {
    return null;
  }
  const { width, height } = snapshot.imageSize;
  return `${width}×${height}`;
});

const textStats = computed(() => {
  if (snapshot.kind !== "text" || !snapshot.text) {
    return null;
  }
  const charCount = snapshot.text.length;
  const wordCount = snapshot.text.split(/\s+/).filter(w => w.length > 0).length;
  const lineCount = snapshot.text.split(/\n/).length;
  return { charCount, wordCount, lineCount };
});

const recentPlaceholder = computed(() =>
  t("clipboard.suggestEmpty", "暂无推荐，可尝试复制不同类型的内容。")
);

const clipboardContextMenuItems = computed<ContextMenuItem[]>(() => {
  const items: ContextMenuItem[] = [];
  
  if (snapshot.kind === "empty") return [];
  
  if (snapshot.kind === "text") {
    items.push(
      { key: "copy", label: t("contextMenu.copy", "复制"), icon: MdiContentCopy },
      { key: "save", label: t("clipboard.save", "保存到历史"), icon: MdiContentSave },
      { key: "divider-1", label: "", divider: true },
      { key: "translate", label: t("contextMenu.translate", "AI 翻译"), icon: MdiTranslate },
      { key: "summarize", label: t("contextMenu.summarize", "AI 摘要"), icon: MdiTextBoxSearchOutline },
      { key: "polish", label: t("contextMenu.polish", "AI 润色"), icon: MdiFeather },
      { key: "divider-2", label: "", divider: true },
      { key: "assistant", label: t("clipboard.askAssistant", "发送到 AI 助理"), icon: MdiRobotOutline }
    );
  } else if (snapshot.kind === "image") {
    items.push(
      { key: "save", label: t("clipboard.save", "保存到历史"), icon: MdiContentSave },
      { key: "divider-1", label: "", divider: true },
      { key: "ocr", label: t("clipboard.ocrImage", "AI OCR 提取文字"), icon: MdiTextRecognition },
      { key: "describe", label: t("clipboard.describeImage", "AI 识图描述"), icon: MdiImageSearchOutline },
      { key: "divider-2", label: "", divider: true },
      { key: "assistant", label: t("clipboard.askAssistant", "发送到 AI 助理"), icon: MdiRobotOutline }
    );
  } else if (snapshot.kind === "file") {
    items.push(
      { key: "copy", label: t("clipboard.copyPath", "复制文件路径"), icon: MdiContentCopy },
      { key: "save", label: t("clipboard.save", "保存到历史"), icon: MdiContentSave },
      { key: "divider-1", label: "", divider: true },
      { key: "analyze", label: t("clipboard.fileInsight", "AI 洞察文件"), icon: MdiFileDocumentOutline },
      { key: "assistant", label: t("clipboard.askAssistant", "发送到 AI 助理"), icon: MdiRobotOutline }
    );
  }
  
  return items;
});

type WorkflowDefinition = {
  key: string;
  icon: string;
  accent: string;
  title: string;
  description: string;
  highlights: string[];
  prompt: () => string;
};

const curatedWorkflows = computed<WorkflowDefinition[]>(() => {
  const language = settings.preferredLanguage || "zh-CN";
  return [
    {
      key: "meeting-notes",
      icon: "📝",
      accent: "linear-gradient(135deg, rgba(81, 97, 255, 0.22), rgba(134, 65, 255, 0.32))",
      title: t("clipboard.workflowMeetingTitle", "会议纪要一键整理"),
      description: t(
        "clipboard.workflowMeetingDescription",
        "提炼会议重点、列出责任人并生成下一步提醒。"
      ),
      highlights: [
        t("clipboard.workflowMeetingPoint1", "自动提炼决议与风险"),
        t("clipboard.workflowMeetingPoint2", "生成按责任人分类的行动项"),
        t("clipboard.workflowMeetingPoint3", "附带便于分享的总结段落"),
      ],
      prompt: () =>
        `你是 VibeClip Pro。请以 ${language} 输出一份结构化会议纪要：\n1. 用最多三行总结整体背景与目标；\n2. 用要点列出所有决议，格式为【负责人】+行动项+截止时间；\n3. 用列表呈现风险或待确认问题；\n4. 生成一段可直接发送给团队的分享文案。`,
    },
    {
      key: "task-breakdown",
      icon: "🎯",
      accent: "linear-gradient(135deg, rgba(255, 159, 77, 0.24), rgba(255, 118, 92, 0.32))",
      title: t("clipboard.workflowTaskTitle", "快速拆解行动计划"),
      description: t(
        "clipboard.workflowTaskDescription",
        "根据当前文本生成时间线、优先级与执行清单。"
      ),
      highlights: [
        t("clipboard.workflowTaskPoint1", "对关键目标做 SMART 化拆解"),
        t("clipboard.workflowTaskPoint2", "输出按优先级排序的待办列表"),
        t("clipboard.workflowTaskPoint3", "提醒需要协作的角色与资源"),
      ],
      prompt: () =>
        `阅读以下内容，生成 ${language} 的行动计划：\n- 总结需要达成的目标；\n- 输出一张三列表格：优先级 / 任务 / 负责人；\n- 提供 3 条可立即执行的下一步建议；\n- 如果有阻塞或依赖，请额外列出提醒。`,
    },
    {
      key: "shareable-snippet",
      icon: "🚀",
      accent: "linear-gradient(135deg, rgba(63, 195, 161, 0.26), rgba(79, 107, 255, 0.28))",
      title: t("clipboard.workflowShareTitle", "一键生成分享摘要"),
      description: t(
        "clipboard.workflowShareDescription",
        "制作适合社交或团队播报的亮点段落与推荐行动。"
      ),
      highlights: [
        t("clipboard.workflowSharePoint1", "提炼三条亮点用一句话概括"),
        t("clipboard.workflowSharePoint2", "配套一句金句或引导语"),
        t("clipboard.workflowSharePoint3", "附加两项推荐下一步行动"),
      ],
      prompt: () =>
        `请把以下内容整理成 ${language} 的可分享摘要：\n1. 先给出一句引人注目的标题；\n2. 用无序列表列出三条亮点或关键信息；\n3. 给出一个吸引人的引用或金句；\n4. 提供两条下一步建议，适合发送到社群或团队通告。`,
    },
  ];
});

function reportError(label: string, error: unknown) {
  console.error(label, error);
  const detail = error instanceof Error ? error.message : String(error ?? "");
  message.error(`${label}${detail ? `：${detail}` : ""}`);
}

function startEditing() {
  if (snapshot.kind !== "text") return;
  editDraft.value = snapshot.text;
  editing.value = true;
}

function cancelEditing() {
  editing.value = false;
  editingBusy.value = false;
  editDraft.value = "";
}

async function applyEditing() {
  if (snapshot.kind !== "text") return;
  const text = editDraft.value.trim();
  snapshot.text = text;
  editingBusy.value = true;
  try {
    await history.markSelfCapture({ kind: ClipKind.Text, content: text });
    await writeText(text);
    message.success(t("clipboard.editSaved", "已更新系统剪贴板"));
    editing.value = false;
    editDraft.value = text;
  } catch (error) {
    reportError(t("clipboard.editSaveFailed", "更新剪贴板失败"), error);
  } finally {
    editingBusy.value = false;
  }
}

function resetSnapshot() {
  snapshot.kind = "empty";
  snapshot.text = "";
  snapshot.filePath = null;
  snapshot.imageDataUrl = null;
  snapshot.imageSize = null;
  editing.value = false;
  editingBusy.value = false;
  editDraft.value = "";
}

async function convertImageToDataUrl(image: TauriImage) {
  if (typeof document === "undefined") {
    return null;
  }
  try {
    const size = await image.size();
    const rgba = await image.rgba();
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }
    const pixels = new ImageData(new Uint8ClampedArray(rgba), size.width, size.height);
    context.putImageData(pixels, 0, 0);
    let finalCanvas: HTMLCanvasElement = canvas;
    let finalSize = { width: size.width, height: size.height };
    if (size.width > MAX_IMAGE_DIMENSION || size.height > MAX_IMAGE_DIMENSION) {
      const scale = Math.min(
        MAX_IMAGE_DIMENSION / size.width,
        MAX_IMAGE_DIMENSION / size.height
      );
      const targetWidth = Math.round(size.width * scale);
      const targetHeight = Math.round(size.height * scale);
      const scaledCanvas = document.createElement("canvas");
      scaledCanvas.width = targetWidth;
      scaledCanvas.height = targetHeight;
      const scaledContext = scaledCanvas.getContext("2d");
      if (scaledContext) {
        scaledContext.drawImage(canvas, 0, 0, targetWidth, targetHeight);
        finalCanvas = scaledCanvas;
        finalSize = { width: targetWidth, height: targetHeight };
      }
    }
    const dataUrl = finalCanvas.toDataURL("image/png");
    return { dataUrl, size: finalSize };
  } catch (error) {
    console.error("Failed to transform clipboard image", error);
    return null;
  }
}

async function syncClipboard() {
  capturing.value = true;
  try {
    editing.value = false;
    editingBusy.value = false;
    editDraft.value = "";
    const text = await readText().catch(() => "");
    const normalized = text.replace(/\0/g, "").trim();
    if (normalized) {
      snapshot.text = normalized;
      snapshot.filePath = null;
      snapshot.imageDataUrl = null;
      snapshot.imageSize = null;
      snapshot.kind = isClipboardFilePath(normalized) ? "file" : "text";
      if (snapshot.kind === "file") {
        snapshot.filePath = normalized;
      }
      return;
    }

    const image = await readImage().catch(() => null);
    if (image) {
      const converted = await convertImageToDataUrl(image as TauriImage);
      if (converted) {
        snapshot.kind = "image";
        snapshot.imageDataUrl = converted.dataUrl;
        snapshot.imageSize = converted.size;
        snapshot.text = "";
        snapshot.filePath = null;
        return;
      }
    }

    resetSnapshot();
  } catch (error) {
    reportError(t("clipboard.refresh", "刷新剪贴板"), error);
    resetSnapshot();
  } finally {
    capturing.value = false;
  }
}

async function saveClipboard() {
  try {
    if (snapshot.kind === "text") {
      const content = snapshot.text.trim();
      if (!content) {
        message.info(t("clipboard.empty", "暂无文本内容，可使用 Ctrl+C 复制后刷新查看。"));
        return;
      }
      await history.captureText(content);
      message.success(t("clipboard.save", "保存到历史"));
      editing.value = false;
      editingBusy.value = false;
      editDraft.value = content;
      return;
    }

    if (snapshot.kind === "image") {
      if (!snapshot.imageDataUrl) {
        message.warning(t("clipboard.imageEmpty", "未读取到有效的图片数据"));
        return;
      }
      const base64 = snapshot.imageDataUrl.split(",")[1] ?? "";
      if (!base64) {
        message.warning(t("clipboard.imageEmpty", "未读取到有效的图片数据"));
        return;
      }
      const clip = await history.insertClip({
        kind: ClipKind.Image,
        imageBase64: base64,
        preview: t("clipboard.typeImage", "图片"),
        extra: snapshot.imageSize ? `${snapshot.imageSize.width}×${snapshot.imageSize.height}` : undefined,
      });
      if (clip) {
        await history.markSelfCapture({
          hash: clip.contentHash,
          kind: clip.kind,
          content: clip.content,
        });
      }
      message.success(t("clipboard.saveImage", "图片已保存到历史"));
      return;
    }

    if (snapshot.kind === "file" && snapshot.filePath) {
      const clip = await history.insertClip({
        kind: ClipKind.File,
        filePath: snapshot.filePath,
        preview: snapshot.filePath,
        extra: snapshot.filePath,
      });
      if (clip) {
        await history.markSelfCapture({
          hash: clip.contentHash,
          kind: clip.kind,
          content: clip.content,
        });
      }
      message.success(t("clipboard.saveFile", "文件路径已保存"));
      return;
    }

    message.info(t("clipboard.empty", "暂无文本内容，可使用 Ctrl+C 复制后刷新查看。"));
  } catch (error) {
    reportError(t("clipboard.save", "保存到历史"), error);
  }
}

async function handleCopy(item: (typeof history.items)[number]) {
  try {
    await history.copyClip(item);
    message.success(t("contextMenu.copy", "复制"));
  } catch (error) {
    reportError(t("contextMenu.copy", "复制"), error);
  }
}

async function handlePin(item: (typeof history.items)[number]) {
  try {
    await history.updateFlags(item.id, { pinned: !item.isPinned });
  } catch (error) {
    reportError("更新置顶状态失败", error);
  }
}

async function handleFavorite(item: (typeof history.items)[number]) {
  try {
    await history.updateFlags(item.id, { favorite: !item.isFavorite });
  } catch (error) {
    reportError("更新收藏状态失败", error);
  }
}

async function handleRemove(item: (typeof history.items)[number]) {
  try {
    await history.removeClip(item.id);
    message.success("已删除");
  } catch (error) {
    reportError("删除失败", error);
  }
}

async function handleAiRun(payload: {
  action: AiActionKind;
  input: string;
  language: string;
  customPrompt?: string;
}) {
  if (!settings.apiKey) {
    message.error("请先在设置中配置 OpenAI 兼容接口 Key");
    return;
  }
  try {
    await history.runAiAction({
      action: payload.action,
      input: payload.input,
      language: payload.language,
      customPrompt: payload.customPrompt,
      apiKey: settings.apiKey,
      baseUrl: settings.apiBaseUrl,
      model: settings.model,
      temperature: settings.temperature,
    });
    message.success("AI 操作已完成并写入剪贴板");
  } catch (error) {
    reportError("AI 操作失败", error);
  }
}

async function runTextAction(action: AiActionKind) {
  const input = textSource.value.trim();
  if (!input) {
    message.info(t("clipboard.empty", "暂无文本内容，可使用 Ctrl+C 复制后刷新查看。"));
    return;
  }
  await handleAiRun({
    action,
    input,
    language: settings.preferredLanguage,
  });
}

async function runTextPlan() {
  const input = textSource.value.trim();
  if (!input) {
    message.info(t("clipboard.empty", "暂无文本内容，可使用 Ctrl+C 复制后刷新查看。"));
    return;
  }
  await handleAiRun({
    action: "custom",
    input,
    language: settings.preferredLanguage,
    customPrompt: `You are VibeClip Pro, a productivity coach. Summarize the key tasks from the provided content and output actionable bullet items in ${settings.preferredLanguage}.`,
  });
}

async function runImagePrompt(mode: "describe" | "ocr") {
  if (snapshot.kind !== "image" || !snapshot.imageDataUrl) {
    message.info(t("clipboard.imageEmpty", "未读取到有效的图片数据"));
    return;
  }
  const instruction =
    mode === "describe"
      ? `You are VibeClip Pro Vision. Describe the following base64 encoded PNG image in ${settings.preferredLanguage} with concise bullet points.`
      : `You are VibeClip Pro Vision OCR. Extract the text from the following base64 encoded PNG image and respond in ${settings.preferredLanguage}.`;
  await handleAiRun({
    action: "custom",
    input: snapshot.imageDataUrl,
    language: settings.preferredLanguage,
    customPrompt: instruction,
  });
}

async function runFileAnalysis() {
  if (!snapshot.filePath) {
    message.info(t("clipboard.copyPath", "复制文件路径"));
    return;
  }
  await handleAiRun({
    action: "custom",
    input: snapshot.filePath,
    language: settings.preferredLanguage,
    customPrompt: `You are VibeClip Pro. Explain what this file path might represent and suggest follow-up actions in ${settings.preferredLanguage}.`,
  });
}

async function copyFilePath() {
  if (!snapshot.filePath) return;
  try {
    await history.markSelfCapture({
      kind: ClipKind.File,
      content: snapshot.filePath,
    });
    await writeText(snapshot.filePath);
    message.success(t("clipboard.copyPath", "复制文件路径"));
  } catch (error) {
    reportError(t("clipboard.copyPath", "复制文件路径"), error);
  }
}

function sendToAssistant() {
  if (snapshot.kind === "empty") {
    message.info(t("clipboard.empty", "暂无文本内容，可使用 Ctrl+C 复制后刷新查看。"));
    return;
  }
  let content = "";
  let kind = ClipKind.Text;
  let extra: string | null = null;
  if (snapshot.kind === "text") {
    content = snapshot.text;
    kind = ClipKind.Text;
  } else if (snapshot.kind === "image" && snapshot.imageDataUrl) {
    content = snapshot.imageDataUrl;
    kind = ClipKind.Image;
    extra = imageMeta.value;
  } else if (snapshot.kind === "file" && snapshot.filePath) {
    content = snapshot.filePath;
    kind = ClipKind.File;
  }
  if (!content.trim()) {
    message.info(t("clipboard.empty", "暂无文本内容，可使用 Ctrl+C 复制后刷新查看。"));
    return;
  }
  bridge.stageClipboardSeed({
    kind,
    content,
    extra,
    title: t("clipboard.bridgeTitle", "来自剪贴板"),
    mode: "assistant",
  });
  router.push("/ai");
}

async function handleSuggestionSelect(suggestion: ClipboardSuggestion) {
  try {
    // 处理图片相关建议
    if (snapshot.kind === "image") {
      if (suggestion.key === "save-image") {
        await saveClipboard();
        return;
      }
      if (suggestion.key === "ocr-image" || suggestion.key === "describe-image") {
        const imageData = snapshot.imageDataUrl;
        if (!imageData) {
          message.warning("图片数据不可用");
          return;
        }
        // 发送图片到AI工具页面
        bridge.stageClipboardSeed({
          kind: ClipKind.Image,
          content: imageData,
          extra: suggestion.key === "ocr-image" ? "OCR识别" : "图片描述",
          title: suggestion.fallback,
          mode: "assistant",
        });
        router.push("/ai");
        message.success("已发送到 AI 工具");
        return;
      }
    }
    
    // 处理文本相关建议
    const input = textSource.value.trim();
    if (!input) {
      message.info(t("clipboard.empty", "暂无文本内容，可使用 Ctrl+C 复制后刷新查看。"));
      return;
    }
    
    if (suggestion.action.type === "open-url") {
      await openUrl(suggestion.action.url);
      message.success(t("clipboard.openLink", "打开链接"));
    } else if (suggestion.action.type === "ai") {
      await handleAiRun({
        action: suggestion.action.action,
        input,
        language: suggestion.action.language ?? settings.preferredLanguage,
      });
    } else if (suggestion.action.type === "copy") {
      await history.markSelfCapture({ kind: ClipKind.Text, content: suggestion.action.payload });
      await writeText(suggestion.action.payload);
      message.success(t(suggestion.labelKey, suggestion.fallback));
    } else if (suggestion.action.type === "share") {
      const payload = `VibeClip · ${t("clipboard.shareSnippet", "复制分享片段")}\n${suggestion.action.payload}`;
      await history.markSelfCapture({ kind: ClipKind.Text, content: payload });
      await writeText(payload);
      message.success(t("clipboard.shareSnippet", "复制分享片段"));
    }
  } catch (error) {
    reportError(t(suggestion.labelKey, suggestion.fallback), error);
  }
}

async function handleWorkflowStart(key: string) {
  const input = textSource.value.trim();
  if (!input) {
    message.info(t("clipboard.empty", "暂无文本内容，可使用 Ctrl+C 复制后刷新查看。"));
    return;
  }
  const workflow = curatedWorkflows.value.find(item => item.key === key);
  if (!workflow) {
    return;
  }
  try {
    await handleAiRun({
      action: "custom",
      input,
      language: settings.preferredLanguage,
      customPrompt: workflow.prompt(),
    });
    message.success(t("clipboard.workflowSuccess", "已触发效率场景，等待 AI 输出"));
  } catch (error) {
    reportError(workflow.title, error);
  }
}

function handleClipboardContextMenu(event: MouseEvent) {
  if (snapshot.kind === "empty") return;
  contextMenu.showContextMenu(event, clipboardContextMenuItems.value, {
    type: "clipboard",
    data: snapshot,
    position: { x: event.clientX, y: event.clientY },
  });
}

async function handleContextMenuSelect(key: string) {
  contextMenu.closeContextMenu();
  
  switch (key) {
    case "copy":
      if (snapshot.kind === "text") {
        try {
          await history.markSelfCapture({ kind: ClipKind.Text, content: snapshot.text });
          await writeText(snapshot.text);
          message.success(t("contextMenu.copy", "复制"));
        } catch (error) {
          reportError(t("contextMenu.copy", "复制"), error);
        }
      } else if (snapshot.kind === "file" && snapshot.filePath) {
        await copyFilePath();
      }
      break;
    case "save":
      await saveClipboard();
      break;
    case "translate":
      await runTextAction("translate");
      break;
    case "summarize":
      await runTextAction("summarize");
      break;
    case "polish":
      await runTextAction("polish");
      break;
    case "ocr":
      await runImagePrompt("ocr");
      break;
    case "describe":
      await runImagePrompt("describe");
      break;
    case "analyze":
      await runFileAnalysis();
      break;
    case "assistant":
      sendToAssistant();
      break;
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
  await syncClipboard();
});
</script>

<template>
  <div class="modern-clipboard-page">
    <!-- 顶部导航 -->
    <nav class="modern-page-nav">
      <router-link to="/clipboard" class="modern-nav-item" active-class="active">
        <span>剪贴板</span>
      </router-link>
      <router-link to="/history" class="modern-nav-item" active-class="active">
        <span>历史</span>
      </router-link>
      <router-link to="/ai" class="modern-nav-item" active-class="active">
        <span>AI 工具</span>
      </router-link>
    </nav>
    
    <header class="modern-page-header">
      <div class="headline">
        <h1>{{ t("clipboard.title", "剪贴板中心") }}</h1>
        <p>{{ t("clipboard.subtitle", "查看系统剪贴板并快速保存或调用历史记录") }}</p>
      </div>
      <div class="header-actions">
        <n-button size="tiny" quaternary :loading="capturing" @click="syncClipboard">
          {{ t("clipboard.refresh", "刷新剪贴板") }}
        </n-button>
        <n-button size="tiny" type="primary" :disabled="!canSave" @click="saveClipboard">
          {{ t("clipboard.save", "保存到历史") }}
        </n-button>
      </div>
    </header>

    <div class="modern-content-area modern-scrollbar">
      <section class="modern-card modern-clipboard-card">
        <header class="card-header">
          <div class="header-content">
            <h2>{{ t("clipboard.current", "当前剪贴板") }}</h2>
            <div class="card-meta">
              <span class="chip chip-type">{{ snapshotTypeLabel }}</span>
              <span v-if="imageMeta" class="chip chip-info">{{ imageMeta }}</span>
              <span v-if="textStats" class="chip chip-info">
                {{ textStats.charCount }} 字符 · {{ textStats.wordCount }} 词 · {{ textStats.lineCount }} 行
              </span>
            </div>
          </div>
        </header>
        <div class="card-body" @contextmenu="handleClipboardContextMenu">
          <template v-if="snapshot.kind === 'text'">
            <div v-if="editing" class="edit-area">
              <n-input
                v-model:value="editDraft"
                type="textarea"
                :autosize="{ minRows: 6, maxRows: 12 }"
                :placeholder="t('clipboard.editPlaceholder', '直接在此调整文本，保存后会同步系统剪贴板')"
              />
            </div>
            <p v-else class="preview-text">{{ snapshot.text }}</p>
          </template>
          <template v-else-if="snapshot.kind === 'image'">
            <img
              v-if="snapshot.imageDataUrl"
              :src="snapshot.imageDataUrl"
              class="preview-image"
              alt="clipboard preview"
            />
            <p v-else class="placeholder">
              {{ t("clipboard.imageEmpty", "未读取到有效的图片数据") }}
            </p>
          </template>
          <template v-else-if="snapshot.kind === 'file'">
            <n-tag size="small" class="path-tag" :bordered="false">{{ snapshot.filePath }}</n-tag>
          </template>
          <template v-else>
            <p class="placeholder">
              {{ t("clipboard.empty", "暂无文本内容，可使用 Ctrl+C 复制后刷新查看。") }}
            </p>
          </template>
        </div>
        <footer class="card-footer">
          <div v-if="snapshot.kind === 'text'" class="quick-actions">
            <template v-if="!editing">
              <n-button size="tiny" quaternary @click="startEditing">
                {{ t("clipboard.editText", "编辑文本") }}
              </n-button>
            </template>
            <template v-else>
              <n-button size="tiny" type="primary" :loading="editingBusy" @click="applyEditing">
                {{ t("clipboard.applyEdit", "保存修改") }}
              </n-button>
              <n-button size="tiny" quaternary :disabled="editingBusy" @click="cancelEditing">
                {{ t("clipboard.cancelEdit", "取消") }}
              </n-button>
            </template>
            <n-button size="tiny" tertiary :loading="history.aiBusy" @click="runTextAction('translate')">
              {{ t("clipboard.translate", "AI 翻译") }}
            </n-button>
            <n-button size="tiny" tertiary :loading="history.aiBusy" @click="runTextAction('summarize')">
              {{ t("clipboard.summarize", "AI 摘要") }}
            </n-button>
            <n-button size="tiny" tertiary :loading="history.aiBusy" @click="runTextAction('polish')">
              {{ t("clipboard.polish", "AI 润色") }}
            </n-button>
            <n-button size="tiny" tertiary :loading="history.aiBusy" @click="runTextPlan">
              {{ t("clipboard.plan", "生成行动项") }}
            </n-button>
            <n-button size="tiny" quaternary @click="sendToAssistant">
              {{ t("clipboard.askAssistant", "发送到 AI 助理") }}
            </n-button>
          </div>
          <div v-else-if="snapshot.kind === 'image'" class="quick-actions">
            <n-button size="tiny" tertiary :loading="history.aiBusy" @click="runImagePrompt('describe')">
              {{ t("clipboard.describeImage", "AI 识图") }}
            </n-button>
            <n-button size="tiny" tertiary :loading="history.aiBusy" @click="runImagePrompt('ocr')">
              {{ t("clipboard.ocrImage", "提取文字") }}
            </n-button>
            <n-button size="tiny" quaternary @click="sendToAssistant">
              {{ t("clipboard.askAssistant", "发送到 AI 助理") }}
            </n-button>
          </div>
          <div v-else-if="snapshot.kind === 'file'" class="quick-actions">
            <n-button size="tiny" tertiary :loading="history.aiBusy" @click="runFileAnalysis">
              {{ t("clipboard.fileInsight", "AI 洞察文件") }}
            </n-button>
            <n-button size="tiny" tertiary @click="copyFilePath">
              {{ t("clipboard.copyPath", "复制文件路径") }}
            </n-button>
            <n-button size="tiny" quaternary @click="sendToAssistant">
              {{ t("clipboard.askAssistant", "发送到 AI 助理") }}
            </n-button>
          </div>
        </footer>
      </section>

      <section class="card suggestion-card" style="--card-index: 1">
        <header class="card-header">
          <div>
            <h2>{{ t("clipboard.suggestions", "智能建议") }}</h2>
            <p>{{ t("nav.tagline", "AI 快捷操作") }}</p>
          </div>
        </header>
        <TransitionGroup v-if="suggestions.length" name="fade-list" tag="div" class="suggestion-list">
          <button
            v-for="item in suggestions"
            :key="item.key"
            type="button"
            class="suggestion-item"
            @click="handleSuggestionSelect(item)"
          >
            <span>{{ t(item.labelKey, item.fallback) }}</span>
            <span class="chevron">›</span>
          </button>
        </TransitionGroup>
        <p v-else class="placeholder">{{ recentPlaceholder }}</p>
      </section>

      <AiQuickActions
        class="card ai-card"
        style="--card-index: 2"
        :loading="history.aiBusy"
        :source-text="textSource"
        :on-run="handleAiRun"
      />

      <section class="card workflow-card" style="--card-index: 3">
        <header class="card-header">
          <div>
            <h2>{{ t("clipboard.workflowTitle", "效率场景") }}</h2>
            <p>{{ t("clipboard.workflowSubtitle", "精选工作流模板，结合 AI 快速搞定日常任务") }}</p>
          </div>
        </header>
        <TransitionGroup name="workflow-fade" tag="div" class="workflow-grid">
          <article v-for="item in curatedWorkflows" :key="item.key" class="workflow-item">
            <div class="workflow-icon" :style="{ background: item.accent }">{{ item.icon }}</div>
            <div class="workflow-text">
              <h3>{{ item.title }}</h3>
              <p>{{ item.description }}</p>
              <ul>
                <li v-for="point in item.highlights" :key="point">{{ point }}</li>
              </ul>
            </div>
            <div class="workflow-actions">
              <n-button
                type="primary"
                size="tiny"
                :loading="history.aiBusy"
                @click="handleWorkflowStart(item.key)"
              >
                {{ t("clipboard.workflowRun", "应用场景") }}
              </n-button>
            </div>
          </article>
        </TransitionGroup>
      </section>

      <section class="card recent-card" style="--card-index: 4">
        <header class="card-header">
          <div>
            <h2>{{ t("clipboard.latestHistory", "最近历史") }}</h2>
            <span class="muted">{{ recentCountLabel }}</span>
          </div>
        </header>
        <n-empty v-if="!recentItems.length" :description="t('history.empty', '还没有保存的剪贴板内容')">
          <template #extra>
            <n-button size="tiny" @click="history.refresh()">
              {{ t("history.emptyAction", "立即同步") }}
            </n-button>
          </template>
        </n-empty>
        <n-scrollbar v-else class="recent-scroll thin-scrollbar">
          <TransitionGroup name="recent-fade" tag="div" class="recent-list">
            <HistoryItem
              v-for="item in recentItems"
              :key="item.id"
              :item="item"
              @copy="handleCopy"
              @pin="handlePin"
              @favorite="handleFavorite"
              @remove="handleRemove"
            />
          </TransitionGroup>
        </n-scrollbar>
      </section>
    </div>

    <GlobalContextMenu
      :show="contextMenu.state.show"
      :x="contextMenu.state.renderX"
      :y="contextMenu.state.renderY"
      :items="contextMenu.state.items"
      :ref="contextMenu.menuRef"
      @select="handleContextMenuSelect"
      @close="contextMenu.closeContextMenu"
    />
  </div>
</template>

<style scoped>
.modern-clipboard-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: linear-gradient(160deg, rgba(248, 249, 255, 0.9), rgba(238, 242, 255, 0.88));
}

.dark .modern-clipboard-page {
  background: linear-gradient(160deg, rgba(18, 22, 34, 0.92), rgba(16, 26, 46, 0.9));
}

.modern-page-nav {
  display: flex;
  gap: 12px;
  padding: 18px 22px 0;
  flex-shrink: 0;
}

.modern-nav-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 16px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(13, 26, 61, 0.68);
  text-decoration: none;
  background: rgba(255, 255, 255, 0.68);
  box-shadow: 0 10px 18px rgba(46, 65, 133, 0.08);
  transition: transform 180ms ease, box-shadow 220ms ease, color 160ms ease;
}

.modern-nav-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 30px rgba(46, 65, 133, 0.16);
}

.modern-nav-item.active {
  color: #3555ff;
  box-shadow: 0 20px 34px rgba(65, 89, 215, 0.25);
  background: linear-gradient(135deg, rgba(79, 107, 255, 0.18), rgba(122, 209, 245, 0.18));
}

.dark .modern-nav-item {
  background: rgba(33, 45, 68, 0.78);
  color: rgba(226, 234, 255, 0.7);
}

.modern-page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 24px 12px;
  flex-wrap: wrap;
}

.headline h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--vibe-text-primary);
}

.headline p {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--vibe-text-secondary);
  max-width: 520px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-actions :deep(.n-button) {
  border-radius: 14px;
  transition: transform 160ms ease, box-shadow 200ms ease;
}

.header-actions :deep(.n-button:hover) {
  transform: translateY(-2px);
  box-shadow: 0 18px 32px rgba(79, 107, 255, 0.22);
}

.modern-content-area {
  flex: 1;
  overflow-y: auto;
  padding: 0 24px 24px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 20px;
  align-content: start;
}

.modern-card,
.card {
  position: relative;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 20px;
  border: 1px solid rgba(79, 107, 255, 0.12);
  box-shadow: 0 24px 44px rgba(36, 56, 128, 0.14);
  backdrop-filter: blur(18px) saturate(145%);
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px;
  transition: transform 200ms ease, box-shadow 240ms ease;
  min-height: 0;
}

.modern-card::after,
.card::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.65), transparent 60%);
  opacity: 0;
  pointer-events: none;
  transition: opacity 220ms ease;
}

.modern-card:hover,
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 30px 54px rgba(36, 56, 128, 0.2);
}

.modern-card:hover::after,
.card:hover::after {
  opacity: 1;
}

.dark .modern-card,
.dark .card {
  background: rgba(26, 34, 55, 0.86);
  border-color: rgba(122, 209, 245, 0.16);
  box-shadow: 0 26px 52px rgba(5, 10, 24, 0.62);
}

.modern-clipboard-card {
  grid-column: 1 / -1;
  padding: 22px;
}

.card-header {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--vibe-text-primary);
}

.card-header p {
  margin: 0;
  font-size: 12px;
  color: var(--vibe-text-muted);
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 11px;
  background: rgba(79, 107, 255, 0.14);
  color: #3245d6;
  letter-spacing: 0.3px;
}

.chip-info {
  background: rgba(122, 209, 245, 0.14);
  color: #0b6aa7;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 0;
  min-height: 220px;
  border-radius: 16px;
  background: rgba(79, 107, 255, 0.06);
  border: 1px dashed rgba(79, 107, 255, 0.2);
  padding: 18px;
}

.card-body .preview-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.68;
  color: var(--vibe-text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.card-body .preview-image {
  max-width: 100%;
  border-radius: 14px;
  box-shadow: 0 18px 28px rgba(36, 56, 128, 0.28);
}

.card-body .placeholder {
  font-size: 12px;
  color: var(--vibe-text-muted);
}

.card-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.card-footer :deep(.n-button) {
  border-radius: 12px;
  transition: transform 160ms ease, box-shadow 200ms ease;
}

.card-footer :deep(.n-button:hover) {
  transform: translateY(-2px);
  box-shadow: 0 18px 30px rgba(79, 107, 255, 0.24);
}

.suggestion-card,
.ai-card,
.workflow-card,
.recent-card {
  padding: 22px;
}

.suggestion-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.suggestion-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 16px;
  border: 1px solid rgba(79, 107, 255, 0.14);
  background: rgba(255, 255, 255, 0.88);
  color: var(--vibe-text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: transform 180ms ease, box-shadow 220ms ease;
}

.suggestion-item:hover {
  transform: translateX(6px);
  box-shadow: 0 18px 34px rgba(79, 107, 255, 0.2);
}

.chevron {
  font-size: 16px;
  color: var(--vibe-text-muted);
}

.ai-card :deep(.ai-card) {
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
}

.workflow-grid {
  display: grid;
  gap: 14px;
}

.workflow-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 14px;
  align-items: center;
  padding: 16px 18px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(79, 107, 255, 0.12);
  transition: transform 180ms ease, box-shadow 220ms ease;
}

.workflow-item:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 38px rgba(79, 107, 255, 0.22);
}

.workflow-icon {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  font-size: 22px;
  background: rgba(79, 107, 255, 0.12);
}

.workflow-text h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--vibe-text-primary);
}

.workflow-text p {
  margin: 6px 0 8px;
  font-size: 12px;
  color: var(--vibe-text-secondary);
}

.workflow-text ul {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--vibe-text-secondary);
}

.workflow-actions :deep(.n-button) {
  border-radius: 12px;
}

.recent-scroll {
  max-height: 320px;
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.recent-list :deep(.history-item) {
  border-radius: 16px;
  border: 1px solid rgba(79, 107, 255, 0.12);
  box-shadow: 0 16px 30px rgba(36, 56, 128, 0.18);
  transition: transform 180ms ease, box-shadow 220ms ease;
}

.recent-list :deep(.history-item:hover) {
  transform: translateY(-4px);
  box-shadow: 0 24px 44px rgba(36, 56, 128, 0.24);
}

.muted {
  font-size: 12px;
  color: var(--vibe-text-muted);
}

.path-tag {
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 4px 12px;
  border-radius: 12px;
  background: rgba(79, 107, 255, 0.12);
  color: #3245d6;
}

.fade-list-enter-active,
.fade-list-leave-active,
.workflow-fade-enter-active,
.workflow-fade-leave-active,
.recent-fade-enter-active,
.recent-fade-leave-active {
  transition: opacity 200ms ease, transform 220ms ease;
}

.fade-list-enter-from,
.workflow-fade-enter-from,
.recent-fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-list-leave-to,
.workflow-fade-leave-to,
.recent-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

@media (max-width: 1180px) {
  .modern-content-area {
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }

  .modern-clipboard-card {
    grid-column: 1 / -1;
  }

  .workflow-item {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .modern-page-header {
    flex-direction: column;
  }

  .modern-content-area {
    padding: 0 16px 18px;
  }

  .modern-card,
  .card {
    padding: 18px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .modern-nav-item,
  .modern-card,
  .card,
  .suggestion-item,
  .workflow-item,
  .recent-list :deep(.history-item),
  .header-actions :deep(.n-button) {
    transition-duration: 0.01ms !important;
    transform: none !important;
  }
}
</style>

