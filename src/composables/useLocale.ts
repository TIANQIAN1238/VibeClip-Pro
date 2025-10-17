import { computed } from "vue";
import { useSettingsStore } from "@/store/settings";

type LocaleKey = "zh-CN" | "en-US";

interface TranslationTree {
  [key: string]: string | TranslationTree;
}

const translations: Record<LocaleKey, TranslationTree> = {
  "zh-CN": {
    common: {
      cancel: "取消",
    },
    nav: {
      clipboard: "剪贴板",
      history: "历史记录",
      ai: "AI 工具",
      settings: "设置",
      assistant: "AI 助理",
      listening: "监听剪贴板",
      offline: "离线模式",
      online: "在线模式",
      paused: "暂停中",
      recording: "实时记录",
      offlineEnabled: "已断开 AI 服务",
      offlineDisabled: "连接服务",
      tagline: "AI 快捷操作",
    },
    clipboard: {
      title: "剪贴板中心",
      subtitle: "查看系统剪贴板并快速保存或调用历史记录",
      current: "当前剪贴板",
      currentHint: "上次同步后捕获的文本内容",
      empty: "暂无文本内容，可使用 Ctrl+C 复制后刷新查看。",
      save: "保存到历史",
      resync: "重新同步",
      refresh: "刷新剪贴板",
      latestHistory: "最近历史",
      total: "共 {count} 条",
      suggestions: "智能建议",
      suggestEmpty: "暂无推荐，可尝试复制不同类型的内容。",
      openLink: "打开链接",
      summarizeLink: "AI 摘要网页",
      polishText: "AI 润色表达",
      translateText: "AI 翻译内容",
      runCommand: "复制命令",
      copyPath: "复制文件路径",
      shareSnippet: "复制分享片段",
      analyzeCode: "AI 代码解释",
    },
    history: {
      title: "历史记录",
      subtitle: "按标签筛选历史记录，并在右键菜单中快速操作",
      filterAll: "全部",
      filterPinned: "置顶",
      filterFavorite: "收藏",
      filterText: "文本",
      filterImage: "图片",
      filterFile: "文件",
      filterLink: "链接",
      filterCode: "代码",
      filterCommand: "命令",
      filterJson: "JSON",
      searchPlaceholder: "搜索历史...",
      syncClipboard: "同步",
      clipboardPreview: "剪贴板快照",
      clipboardPlaceholder: "剪贴板暂无文本，可在应用中粘贴图片或文件以自动收集。",
      aiPanelTitle: "AI 快捷操作",
      loadMore: "加载更多",
      empty: "还没有保存的剪贴板内容",
      emptyAction: "立即同步",
      total: "共 {count} 条记录",
      aiDialogCopy: "复制",
      aiDialogSave: "保存到历史",
      confirmDelete: "确定删除该条记录吗？",
    },
    ai: {
      title: "AI 工具集",
      subtitle: "选择合适的动作处理文本，结果可复制或保存到历史",
      input: "输入内容",
      placeholder: "在此输入需要处理的文本，或点击上方按钮同步系统剪贴板",
      paste: "粘贴剪贴板",
      clear: "清空",
      output: "AI 输出",
      copy: "复制结果",
      save: "保存到历史",
      assistantTitle: "AI 助理",
      assistantSubtitle: "自由提问或让 AI 帮助翻译、摘要与润色",
      assistantPlaceholder: "输入想要询问或处理的内容",
      assistantSend: "发送",
      assistantWelcome: "你好！随时向我提问，或输入需要翻译、摘要或润色的文字。",
    },
    settings: {
      title: "设置",
      subtitle: "自定义主题、快捷键与 AI 服务连接",
      theme: "主题与显示",
      themeOptions: {
        light: "浅色",
        dark: "深色",
        system: "跟随系统",
      },
      lineHeight: "内容行高",
      accent: "强调颜色",
      shortcut: "全局快捷键",
      clipboard: "剪贴板与历史",
      historyLimit: "历史条目上限",
      retention: "保留天数 (0 表示无限)",
      dedupe: "启用去重",
      ignoreSelf: "忽略自复制",
      ignoredSources: "忽略的来源关键字",
      ai: "AI 服务",
      apiBase: "接口地址",
      apiKey: "API Key",
      model: "模型",
      temperature: "温度",
      resetAi: "重置 AI 配置",
      autoLaunch: "开机自启",
      offline: "离线模式",
      uiLanguage: "界面语言",
      uiLanguageOptions: {
        zh: "简体中文",
        en: "English",
      },
      languagePreference: "AI 输出语言",
      historyActions: "历史维护",
      export: "导出历史",
      import: "导入历史",
      vacuum: "整理数据库",
      clearCache: "清除缓存",
      version: "版本",
      historyCount: "剪贴板条目 {count}",
    },
    contextMenu: {
      header: "AI 快捷操作",
      copy: "复制",
      favorite: "收藏",
      pin: "置顶",
      translate: "AI 翻译",
      summarize: "AI 摘要",
      polish: "AI 润色",
      share: "快速分享",
      delete: "删除",
      open: "打开链接",
    },
    assistant: {
      empty: "还没有对话，开始输入吧。",
      copy: "复制回答",
    },
  },
  "en-US": {
    common: {
      cancel: "Cancel",
    },
    nav: {
      clipboard: "Clipboard",
      history: "History",
      ai: "AI Tools",
      settings: "Settings",
      assistant: "AI Assistant",
      listening: "Clipboard monitor",
      offline: "Offline mode",
      online: "Online",
      paused: "Paused",
      recording: "Recording",
      offlineEnabled: "AI service offline",
      offlineDisabled: "Connected",
      tagline: "AI Quick Actions",
    },
    clipboard: {
      title: "Clipboard Hub",
      subtitle: "Review the current clipboard and capture highlights instantly",
      current: "Current clipboard",
      currentHint: "Latest synced text snapshot",
      empty: "Nothing captured yet. Copy something and refresh.",
      save: "Save to history",
      resync: "Sync again",
      refresh: "Refresh",
      latestHistory: "Recent history",
      total: "{count} items",
      suggestions: "Smart suggestions",
      suggestEmpty: "No suggestions yet. Try copying different content types.",
      openLink: "Open link",
      summarizeLink: "Summarize link",
      polishText: "Polish text",
      translateText: "Translate text",
      runCommand: "Copy command",
      copyPath: "Copy path",
      shareSnippet: "Share snippet",
      analyzeCode: "Explain code",
    },
    history: {
      title: "History",
      subtitle: "Filter clips by tags and use the right-click menu for quick actions",
      filterAll: "All",
      filterPinned: "Pinned",
      filterFavorite: "Favorites",
      filterText: "Text",
      filterImage: "Images",
      filterFile: "Files",
      filterLink: "Links",
      filterCode: "Code",
      filterCommand: "Commands",
      filterJson: "JSON",
      searchPlaceholder: "Search history...",
      syncClipboard: "Sync",
      clipboardPreview: "Clipboard snapshot",
      clipboardPlaceholder: "No text yet. Paste images or files in the app to capture automatically.",
      aiPanelTitle: "AI Quick Actions",
      loadMore: "Load more",
      empty: "No clipboard items yet",
      emptyAction: "Sync now",
      total: "{count} records",
      aiDialogCopy: "Copy",
      aiDialogSave: "Save",
      confirmDelete: "Delete this clip?",
    },
    ai: {
      title: "AI Toolkit",
      subtitle: "Pick an action to transform text and keep the results",
      input: "Input",
      placeholder: "Type content here or import the current clipboard",
      paste: "Paste clipboard",
      clear: "Clear",
      output: "AI output",
      copy: "Copy",
      save: "Save",
      assistantTitle: "AI Assistant",
      assistantSubtitle: "Chat freely for translations, summaries or polishing",
      assistantPlaceholder: "Ask a question or paste something to process",
      assistantSend: "Send",
      assistantWelcome: "Hi! Ask me anything or paste text for translation, summarization, or polishing.",
    },
    settings: {
      title: "Settings",
      subtitle: "Customize the theme, shortcuts and AI connections",
      theme: "Theme & display",
      themeOptions: {
        light: "Light",
        dark: "Dark",
        system: "System",
      },
      lineHeight: "Line height",
      accent: "Accent color",
      shortcut: "Global shortcut",
      clipboard: "Clipboard & history",
      historyLimit: "History limit",
      retention: "Retention days (0 = unlimited)",
      dedupe: "Enable dedupe",
      ignoreSelf: "Ignore self copies",
      ignoredSources: "Ignored source keywords",
      ai: "AI service",
      apiBase: "API endpoint",
      apiKey: "API Key",
      model: "Model",
      temperature: "Temperature",
      resetAi: "Reset AI settings",
      autoLaunch: "Launch on startup",
      offline: "Offline mode",
      uiLanguage: "Interface language",
      uiLanguageOptions: {
        zh: "Simplified Chinese",
        en: "English",
      },
      languagePreference: "Preferred AI language",
      historyActions: "History maintenance",
      export: "Export history",
      import: "Import history",
      vacuum: "Vacuum database",
      clearCache: "Clear cache",
      version: "Version",
      historyCount: "{count} clips",
    },
    contextMenu: {
      header: "AI Quick Actions",
      copy: "Copy",
      favorite: "Favorite",
      pin: "Pin",
      translate: "Translate",
      summarize: "Summarize",
      polish: "Polish",
      share: "Quick share",
      delete: "Delete",
      open: "Open link",
    },
    assistant: {
      empty: "No messages yet. Start typing!",
      copy: "Copy response",
    },
  },
};

function resolvePath(dictionary: TranslationTree, path: string[]): string | TranslationTree | undefined {
  return path.reduce<TranslationTree | string | undefined>((acc, segment) => {
    if (acc && typeof acc === "object" && segment in acc) {
      return acc[segment] as TranslationTree | string;
    }
    return undefined;
  }, dictionary);
}

export function useLocale() {
  const settings = useSettingsStore();

  const locale = computed<LocaleKey>(() => settings.uiLanguage ?? "zh-CN");
  const dictionary = computed(() => translations[locale.value] ?? translations["zh-CN"]);

  function t(path: string, fallback: string): string {
    const target = resolvePath(dictionary.value, path.split("."));
    if (typeof target === "string") {
      return target;
    }
    return fallback;
  }

  function format(path: string, fallback: string, replacements: Record<string, string | number>): string {
    const template = t(path, fallback);
    return Object.keys(replacements).reduce(
      (acc, key) => acc.replace(new RegExp(`{${key}}`, "g"), String(replacements[key])),
      template,
    );
  }

  const languageOptions = computed(() => [
    { label: t("settings.uiLanguageOptions.zh", "简体中文"), value: "zh-CN" },
    { label: t("settings.uiLanguageOptions.en", "English"), value: "en-US" },
  ]);

  return {
    locale,
    dictionary,
    t,
    format,
    languageOptions,
  };
}

export type LocaleDictionary = typeof translations;

export function getTranslations() {
  return translations;
}
