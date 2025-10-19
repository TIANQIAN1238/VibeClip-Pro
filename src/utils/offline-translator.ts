/**
 * 离线翻译工具
 * 提供基本的中英文互译功能，用于离线模式
 */

interface TranslationDict {
  [key: string]: string;
}

// 常用词汇翻译字典（中文到英文）
const zhToEnDict: TranslationDict = {
  // 常用词汇
  "你好": "Hello",
  "谢谢": "Thank you",
  "再见": "Goodbye",
  "是": "Yes",
  "不": "No",
  "的": "of",
  "是的": "Yes",
  "不是": "No",
  "请": "Please",
  "对不起": "Sorry",
  "没关系": "It's okay",
  "早上好": "Good morning",
  "晚上好": "Good evening",
  "晚安": "Good night",
  "欢迎": "Welcome",
  "帮助": "Help",
  "问题": "Problem",
  "解决": "Solve",
  "方案": "Solution",
  "系统": "System",
  "文件": "File",
  "文档": "Document",
  "数据": "Data",
  "信息": "Information",
  "用户": "User",
  "密码": "Password",
  "登录": "Login",
  "退出": "Logout",
  "设置": "Settings",
  "选项": "Options",
  "保存": "Save",
  "取消": "Cancel",
  "确认": "Confirm",
  "删除": "Delete",
  "编辑": "Edit",
  "添加": "Add",
  "搜索": "Search",
  "查找": "Find",
  "替换": "Replace",
  "打开": "Open",
  "关闭": "Close",
  "新建": "New",
  "复制": "Copy",
  "粘贴": "Paste",
  "剪切": "Cut",
  "撤销": "Undo",
  "重做": "Redo",
  "刷新": "Refresh",
  "更新": "Update",
  "下载": "Download",
  "上传": "Upload",
  "导入": "Import",
  "导出": "Export",
  "开始": "Start",
  "停止": "Stop",
  "暂停": "Pause",
  "继续": "Continue",
  "完成": "Complete",
  "成功": "Success",
  "失败": "Failed",
  "错误": "Error",
  "警告": "Warning",
  "提示": "Tip",
  "消息": "Message",
  "通知": "Notification",
  "版本": "Version",
  "关于": "About",
  "主页": "Home",
  "页面": "Page",
  "网站": "Website",
  "链接": "Link",
  "图片": "Image",
  "视频": "Video",
  "音频": "Audio",
  "文本": "Text",
  "代码": "Code",
  "语言": "Language",
  "翻译": "Translation",
  "配置": "Configuration",
  "应用": "Application",
  "程序": "Program",
  "工具": "Tool",
  "功能": "Function",
  "模块": "Module",
  "组件": "Component",
  "服务": "Service",
  "接口": "Interface",
  "网络": "Network",
  "连接": "Connection",
  "断开": "Disconnect",
  "在线": "Online",
  "离线": "Offline",
  "历史": "History",
  "记录": "Record",
  "日志": "Log",
  "统计": "Statistics",
  "分析": "Analysis",
  "报告": "Report",
  "结果": "Result",
  "输入": "Input",
  "输出": "Output",
  "处理": "Process",
  "运行": "Run",
  "执行": "Execute",
  "操作": "Operation",
  "任务": "Task",
  "项目": "Project",
  "团队": "Team",
  "成员": "Member",
  "名称": "Name",
  "标题": "Title",
  "描述": "Description",
  "内容": "Content",
  "类型": "Type",
  "状态": "Status",
  "优先级": "Priority",
  "时间": "Time",
  "日期": "Date",
  "年": "Year",
  "月": "Month",
  "日": "Day",
  "小时": "Hour",
  "分钟": "Minute",
  "秒": "Second",
  "今天": "Today",
  "昨天": "Yesterday",
  "明天": "Tomorrow",
  "现在": "Now",
  "之前": "Before",
  "之后": "After",
  "当前": "Current",
  "最新": "Latest",
  "最近": "Recent",
  "全部": "All",
  "部分": "Part",
  "选择": "Select",
  "全选": "Select All",
  "清空": "Clear",
  "重置": "Reset",
  "默认": "Default",
  "自定义": "Custom",
  "高级": "Advanced",
  "基本": "Basic",
  "简单": "Simple",
  "复杂": "Complex",
  "快速": "Quick",
  "慢速": "Slow",
  "自动": "Auto",
  "手动": "Manual",
  "启用": "Enable",
  "禁用": "Disable",
  "显示": "Show",
  "隐藏": "Hide",
  "展开": "Expand",
  "折叠": "Collapse",
  "最大化": "Maximize",
  "最小化": "Minimize",
  "还原": "Restore",
  "全屏": "Fullscreen",
  "窗口": "Window",
  "标签": "Tab",
  "菜单": "Menu",
  "按钮": "Button",
  "列表": "List",
  "表格": "Table",
  "表单": "Form",
  "字段": "Field",
  "输入框": "Input Box",
  "下拉框": "Dropdown",
  "复选框": "Checkbox",
  "单选框": "Radio Button",
  "滑块": "Slider",
  "开关": "Switch",
  "进度条": "Progress Bar",
  "加载": "Loading",
  "等待": "Waiting",
  "请稍候": "Please wait",
  "正在处理": "Processing",
  "正在加载": "Loading",
  "已完成": "Completed",
  "未完成": "Incomplete",
  "可用": "Available",
  "不可用": "Unavailable",
  "有效": "Valid",
  "无效": "Invalid",
  "正确": "Correct",
  "错误的": "Wrong",
  "空": "Empty",
  "满": "Full",
  "新": "New",
  "旧": "Old",
  "大": "Large",
  "小": "Small",
  "长": "Long",
  "短": "Short",
  "高": "High",
  "低": "Low",
  "多": "Many",
  "少": "Few",
  "好": "Good",
  "坏": "Bad",
  "快": "Fast",
  "慢": "Slow",
  "简单的": "Simple",
  "困难": "Difficult",
  "容易": "Easy",
  "重要": "Important",
  "必需": "Required",
  "可选": "Optional",
  "推荐": "Recommended",
  "建议": "Suggest",
  "注意": "Note",
  "提醒": "Reminder",
};

// 常用词汇翻译字典（英文到中文）
const enToZhDict: TranslationDict = Object.fromEntries(
  Object.entries(zhToEnDict).map(([key, value]) => [value.toLowerCase(), key])
);

/**
 * 检测文本主要语言
 */
function detectLanguage(text: string): 'zh' | 'en' | 'other' {
  const chineseCharCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishCharCount = (text.match(/[a-zA-Z]/g) || []).length;
  
  if (chineseCharCount > englishCharCount) {
    return 'zh';
  } else if (englishCharCount > chineseCharCount) {
    return 'en';
  }
  return 'other';
}

/**
 * 基于字典的简单翻译
 */
function dictionaryTranslate(text: string, dict: TranslationDict): string {
  let result = text;
  
  // 按词长度排序，优先匹配长词
  const entries = Object.entries(dict).sort((a, b) => b[0].length - a[0].length);
  
  for (const [key, value] of entries) {
    const regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    result = result.replace(regex, value);
  }
  
  return result;
}

/**
 * 简单的拼音转换（仅用于未知中文字符的音译）
 */
function simplePinyin(char: string): string {
  const code = char.charCodeAt(0);
  // 这是一个非常简化的拼音映射，实际应用中应该使用完整的拼音库
  if (code >= 0x4e00 && code <= 0x9fa5) {
    return `[${char}]`; // 未知字符保持原样并用括号标记
  }
  return char;
}

/**
 * 英文句子首字母大写
 */
function capitalizeFirstLetter(text: string): string {
  return text.replace(/(^|[.!?]\s+)([a-z])/g, (_match, separator, letter) => 
    separator + letter.toUpperCase()
  );
}

/**
 * 离线翻译主函数
 * @param text 要翻译的文本
 * @param targetLang 目标语言，默认根据源语言自动推断
 */
export function offlineTranslate(text: string, targetLang?: 'zh' | 'en'): string {
  if (!text || text.trim().length === 0) {
    return text;
  }

  const sourceLang = detectLanguage(text);
  
  // 确定目标语言
  let finalTargetLang = targetLang;
  if (!finalTargetLang) {
    if (sourceLang === 'zh') {
      finalTargetLang = 'en';
    } else {
      finalTargetLang = 'zh';
    }
  }

  // 如果源语言和目标语言相同，直接返回
  if (sourceLang === finalTargetLang) {
    return text;
  }

  let translated: string;
  
  if (finalTargetLang === 'en') {
    // 中文转英文
    translated = dictionaryTranslate(text, zhToEnDict);
    // 处理未翻译的中文字符
    translated = translated.replace(/[\u4e00-\u9fa5]/g, simplePinyin);
    // 英文句子首字母大写
    translated = capitalizeFirstLetter(translated);
  } else {
    // 英文转中文
    translated = dictionaryTranslate(text, enToZhDict);
  }

  return translated;
}

/**
 * 批量翻译文本数组
 */
export function offlineTranslateBatch(texts: string[], targetLang?: 'zh' | 'en'): string[] {
  return texts.map(text => offlineTranslate(text, targetLang));
}

/**
 * 判断是否需要离线翻译（即是否包含可识别的语言字符）
 */
export function needsTranslation(text: string): boolean {
  const lang = detectLanguage(text);
  return lang === 'zh' || lang === 'en';
}

/**
 * 获取翻译质量评估
 */
export function getTranslationQuality(originalText: string, translatedText: string): {
  quality: 'high' | 'medium' | 'low';
  coverage: number;
  message: string;
} {
  const originalLength = originalText.length;
  const translatedLength = translatedText.length;
  const unchanged = originalText === translatedText;
  
  // 计算翻译覆盖率（简化版）
  const coverage = unchanged ? 0 : Math.min(100, (translatedLength / originalLength) * 100);
  
  if (unchanged) {
    return {
      quality: 'low',
      coverage: 0,
      message: '未能翻译文本，建议使用在线AI翻译获得更好效果'
    };
  } else if (coverage > 80) {
    return {
      quality: 'high',
      coverage: Math.round(coverage),
      message: '离线翻译质量良好'
    };
  } else if (coverage > 40) {
    return {
      quality: 'medium',
      coverage: Math.round(coverage),
      message: '离线翻译为基础翻译，建议使用在线AI翻译获得更好效果'
    };
  } else {
    return {
      quality: 'low',
      coverage: Math.round(coverage),
      message: '离线翻译质量较低，强烈建议使用在线AI翻译'
    };
  }
}

