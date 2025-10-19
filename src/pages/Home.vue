<script setup lang="ts">
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { openUrl } from '@tauri-apps/plugin-opener';
import { exit } from '@tauri-apps/plugin-process';
import {
    onBeforeUnmount,
    onMounted,
    ref,
    unref,
    watch,
    computed,
    toRaw,
} from 'vue';
import KeySelector from '@/components/KeySelector.vue';
import { type Snippet, useConfig } from '@/composables/useConfig';
import { useAutoStart } from '@/composables/useAutoStart';
import { useClipboard } from '@/composables/useClipboard';
import { useWorkflowDiagnostics, type WorkflowPhaseReport } from '@/composables/useWorkflowDiagnostics';
import QlementineIconsWindowsMinimize16 from '~icons/qlementine-icons/windows-minimize-16';
import QlementineIconsWindowsClose16 from '~icons/qlementine-icons/windows-close-16';
import SolarRefreshLineDuotone from '~icons/solar/refresh-line-duotone';
import SolarCheckCircleLineDuotone from '~icons/solar/check-circle-line-duotone';
import SolarDownloadMinimalisticBoldDuotone from '~icons/solar/download-minimalistic-bold-duotone';
import SolarRestartCircleLineDuotone from '~icons/solar/restart-circle-line-duotone';
import SolarSadCircleLineDuotone from '~icons/solar/sad-circle-line-duotone';
import { AppInfo } from '@/AppInfo';
import ClipAIIcon from '@/assets/clipai_color.png';
import { useUpdater } from '@/composables/useUpdater';
import { asString, convertDatetime, debounce } from '@/libs/utils';
import { marked } from 'marked';
import HijackedATag from '@/components/HijackedATag.vue';
import MdiPlus from '~icons/mdi/plus';
import MdiPencil from '~icons/mdi/pencil';
import MdiDelete from '~icons/mdi/delete';
import MdiCheck from '~icons/mdi/check';
import MdiFileDocumentEditOutline from '~icons/mdi/file-document-edit-outline';
import MdiKeyboardBackspace from '~icons/mdi/keyboard-backspace';
import Toast from '@/components/Toast.vue';

const { config, loadConfig, saveConfig } = useConfig();
const { autoStart, toggleAutoStart, refreshAutoStart } = useAutoStart();
const { stats: clipboardStats, refresh: refreshClipboard } = useClipboard();
const { updateState, checkUpdate } = useUpdater();
const mainview = getCurrentWebviewWindow();

const closeConfirm = ref(false);
const toast = ref();

const snippetPage = ref<'list' | 'edit'>('list');
const currentSnippet = ref<Snippet & { isNew: boolean }>({
    id: '',
    name: '',
    prompt: '',
    system: '',
    markdown: true,
    isNew: true,
    advanced: false,
});

const debouncedSaveConfig = debounce(saveConfig, 500);

watch(
    () => config.value,
    () => {
        debouncedSaveConfig();
    },
    { deep: true }
);

const snippetTotal = computed(() => config.value.snippets?.length ?? 0);

const toggleSummary = computed(() => {
    const toggles = [
        { label: '直接粘贴', value: config.value.common?.enablePaste ?? false },
        { label: '统计', value: config.value.common?.enableCalc ?? false },
        { label: '编辑', value: config.value.common?.enableEdit ?? false },
        { label: '转纯文本', value: config.value.common?.enableToText ?? false },
        { label: '识别', value: config.value.detect?.enabled ?? false },
        { label: '识别链接', value: config.value.detect?.detectUrl ?? false },
    ];
    return {
        enabled: toggles.filter(item => item.value).length,
        total: toggles.length,
        enabledLabels: toggles.filter(item => item.value).map(item => item.label),
    };
});

const featureProgress = computed(() => {
    const total = toggleSummary.value.total;
    return total === 0
        ? 0
        : Math.round((toggleSummary.value.enabled / total) * 100);
});

const aiStatusTag = computed(() =>
    config.value.ai?.enabled ? 'success' : 'warning'
);

const aiStatusLabel = computed(() =>
    config.value.ai?.enabled ? 'AI 功能已启用' : 'AI 功能未启用'
);

const aiProviderLabel = computed(() => {
    const endpoint = config.value.ai?.endpoint?.trim();
    if (!endpoint) return '默认 OpenAI 兼容端点';
    try {
        const url = new URL(endpoint);
        return url.hostname;
    } catch (error) {
        console.debug('无法解析 AI 端点', error);
        return endpoint;
    }
});

const aiModelLabel = computed(
    () => config.value.ai?.model?.trim() || '未设置模型'
);

const snippetMeta = computed(() => {
    if (!config.value.ai?.enableAISnipets) {
        return '前往“AI 设置”启用快速片段';
    }
    if (snippetTotal.value === 0) {
        return '点击右上角即可创建第一个片段';
    }
    return '常用提示词已准备就绪';
});

const toggleMeta = computed(() => {
    const labels = toggleSummary.value.enabledLabels;
    return labels.length > 0
        ? `已启用：${labels.join('、')}`
        : '还未启用增强功能';
});

const autoStartTagType = computed(() => (autoStart.value ? 'success' : 'warning'));

const autoStartLabel = computed(() =>
    autoStart.value ? '自动启动已打开' : '自动启动未开启'
);

const overviewCards = computed(() => {
    const update = updateState.value;
    const updateMeta = update.haveUpdate
        ? update.latestVersion
            ? `发现版本 ${update.latestVersion}`
            : '发现新版本'
        : '暂无可用更新';
    return [
        {
            title: 'AI 服务',
            value: config.value.ai?.enabled ? aiModelLabel.value : '未启用',
            meta: aiProviderLabel.value,
            tone: config.value.ai?.enabled ? 'positive' : 'warning',
        },
        {
            title: '快速片段',
            value: snippetTotal.value.toString(),
            meta: snippetMeta.value,
        },
        {
            title: '功能开关',
            value: `${toggleSummary.value.enabled}/${toggleSummary.value.total}`,
            meta: toggleMeta.value,
            progress: featureProgress.value,
        },
        {
            title: '版本状态',
            value: update.haveUpdate ? '可更新' : '最新',
            meta: updateMeta,
            tone: update.haveUpdate ? 'warning' : 'success',
        },
    ];
});

const {
    running: diagnosticsRunning,
    report: diagnosticsReport,
    readinessScore,
    readinessTone,
    readinessLabel,
    readinessSummary,
    suggestions: diagnosticSuggestions,
    readinessFactors,
    lastRunAt,
    lastRuntime,
    runDiagnostic,
} = useWorkflowDiagnostics({
    config,
    autoStart,
    updateState,
    clipboardStats,
    refreshClipboard,
});

function formatRelativeTime(date: Date | null) {
    if (!date) return '尚未巡检';
    const diffMs = Date.now() - date.getTime();
    if (diffMs < 60_000) return '刚刚';
    const diffMinutes = Math.round(diffMs / 60_000);
    if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} 小时前`;
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays} 天前`;
}

function formatDurationLabel(duration: number | null | undefined) {
    if (!duration || Number.isNaN(duration)) return '—';
    if (duration < 1000) return `${Math.max(1, Math.round(duration))} ms`;
    return `${(duration / 1000).toFixed(1)} s`;
}

function formatPhaseDuration(duration: number | undefined) {
    if (typeof duration !== 'number') return '';
    return duration < 1000
        ? `${Math.max(1, Math.round(duration))} ms`
        : `${(duration / 1000).toFixed(1)} s`;
}

const diagnosticsPhases = computed<WorkflowPhaseReport[]>(() => {
    if (diagnosticsReport.value) {
        return diagnosticsReport.value.phases;
    }
    return readinessFactors.value.map<WorkflowPhaseReport>(factor => ({
        key: factor.key,
        label: factor.label,
        status: factor.ready ? 'success' : 'warning',
        hint: factor.hint,
        duration: undefined,
    }));
});

const lastRunLabel = computed(() => formatRelativeTime(lastRunAt.value));
const lastRuntimeLabel = computed(() => formatDurationLabel(lastRuntime.value));

const tabPaneStyle = computed(() => ({
    padding: '0',
    height: '100%',
}));

const cleanupFns: Array<() => Promise<void> | void> = [];

onMounted(async () => {
    const mainWindow = getCurrentWebviewWindow();
    cleanupFns.push(
        await mainWindow.listen('tauri://resize', async () => {
            if (await mainWindow.isMinimized()) {
                await mainWindow.hide();
            }
        })
    );

    await loadConfig();
    await refreshAutoStart();
    await refreshClipboard();
    void runDiagnostic();
});

onBeforeUnmount(async () => {
    await saveConfig();
    await Promise.all(cleanupFns.map(fn => fn()));
});

function handleShortcutChange(shortcut: string) {
    config.value.globalShortcut = shortcut;
}

function closeApp() {
    exit(0);
}

function minimizeApp() {
    mainview.hide();
}

const UpdateIcons = {
    check: SolarRefreshLineDuotone,
    latest: SolarCheckCircleLineDuotone,
    download: SolarDownloadMinimalisticBoldDuotone,
    install: SolarRestartCircleLineDuotone,
    failed: SolarSadCircleLineDuotone,
};

const currentIcon = computed(() => {
    if (updateState.value.type === 'error') return UpdateIcons.failed;
    if (updateState.value.type === 'success') return UpdateIcons.latest;
    switch (updateState.value.stage) {
        case 'check':
            return UpdateIcons.check;
        case 'download':
            return UpdateIcons.download;
        case 'install':
            return UpdateIcons.install;
        default:
            return UpdateIcons.check;
    }
});

function openProjectPage() {
    return openUrl('https://github.com/CKylinMC/PasteMe');
}

function openFeedbackPage() {
    return openUrl('https://github.com/CKylinMC/PasteMe/issues/new/choose');
}
function openCloseConfirm() {
    closeConfirm.value = true;
}

const updateSuffix =
    '\n\n------\n\n若下载失败请前往<a href="https://github.com/ckylinmc/pasteme/releases">发布页面</a>手动下载更新';

function createSnippet() {
    currentSnippet.value = {
        id: `n-${Math.random()}`,
        name: `AI片段 #${Math.round(Math.random() * 100)}`,
        prompt: '剪贴板内容:\n{{clipboard}}\n\n用户指令:\n请把内容...',
        system: '你的任务是分析用户的剪贴板数据。使用用户的指令和剪贴板内容回答问题。如果没有明确要求，不需要重复收到的剪贴板内容，直接进行回答。',
        markdown: true,
        advanced: true,
        isNew: true,
    };
    snippetPage.value = 'edit';
}

function editSnippet(snippet: Snippet) {
    currentSnippet.value = {
        ...snippet,
        isNew: false,
        markdown: snippet.markdown ?? true,
        advanced: snippet.advanced ?? false,
    };
    snippetPage.value = 'edit';
}

function saveSnippet() {
    if (
        currentSnippet.value.system === '' ||
        currentSnippet.value.prompt === '' ||
        currentSnippet.value.name === ''
    ) {
        toast.value.sendToast('请填写完整信息');
        return;
    }
    if (currentSnippet.value.isNew) {
        const rawclone = JSON.parse(
            JSON.stringify(toRaw(unref(currentSnippet.value)))
        );
        rawclone.isNew = undefined;
        config.value.snippets.push(rawclone);
        toast.value.sendToast('创建片段成功');
    } else {
        const index = config.value.snippets.findIndex(
            s => s.id === currentSnippet.value.id
        );
        if (index >= 0) {
            config.value.snippets[index] = currentSnippet.value;
        }
        toast.value.sendToast('片段修改已保存');
    }
    currentSnippet.value.isNew = false;
}

function deleteSnippet(snippet: Snippet) {
    config.value.snippets = config.value.snippets.filter(
        s => s.id !== snippet.id
    );
    snippetPage.value = 'list';
    toast.value.sendToast('片段已删除');
}

function backToSnippetList() {
    snippetPage.value = 'list';
}

function upgradeSnippet() {
    currentSnippet.value.advanced = true;
    saveSnippet();
}
</script>

<template>
    <div class="home-shell">
        <section class="home-hero" data-tauri-drag-region>
            <div class="home-hero__info">
                <div class="home-hero__title">
                    <img class="home-hero__logo" :src="ClipAIIcon" alt="ClipAI 标志" />
                    <div>
                        <h1>Paste Me!</h1>
                        <p>一站式剪贴板历史管理与 AI 快捷操作助手，让复制粘贴更聪明。</p>
                    </div>
                </div>
                <div class="home-hero__meta">
                    <n-tag round size="small" type="primary">v{{ AppInfo.version }}</n-tag>
                    <n-tag round size="small" :type="aiStatusTag">{{ aiStatusLabel }}</n-tag>
                    <n-tag round size="small" :type="autoStartTagType">{{ autoStartLabel }}</n-tag>
                    <span class="home-hero__meta-text">{{ aiProviderLabel }}</span>
                </div>
            </div>
            <div class="home-hero__actions" data-tauri-drag-region="false">
                <n-button tertiary size="small" @click="openProjectPage">项目主页</n-button>
                <n-button tertiary size="small" @click="openFeedbackPage">反馈</n-button>
                <n-button
                    quaternary
                    circle
                    size="small"
                    @click="minimizeApp"
                    aria-label="最小化"
                >
                    <template #icon>
                        <QlementineIconsWindowsMinimize16 />
                    </template>
                </n-button>
                <n-button
                    quaternary
                    circle
                    size="small"
                    @click="openCloseConfirm"
                    aria-label="退出"
                >
                    <template #icon>
                        <QlementineIconsWindowsClose16 />
                    </template>
                </n-button>
                <n-button
                    strong
                    secondary
                    size="small"
                    :type="updateState.type"
                    :loading="updateState.working"
                    :disabled="updateState.working"
                    @click="checkUpdate"
                >
                    <template #icon>
                        <n-icon>
                            <component :is="currentIcon" />
                        </n-icon>
                    </template>
                    {{ updateState.btn }}
                </n-button>
            </div>
        </section>
        <TransitionGroup name="home-card" tag="section" class="home-stats-grid">
            <article
                v-for="(card, index) in overviewCards"
                :key="card.title"
                class="home-stat-card"
                :class="card.tone ? `home-stat-card--${card.tone}` : ''"
                :style="{ '--card-index': index }"
            >
                <div class="home-stat-card__title">{{ card.title }}</div>
                <div class="home-stat-card__value">{{ card.value }}</div>
                <div class="home-stat-card__meta">{{ card.meta }}</div>
                <n-progress
                    v-if="card.progress !== undefined"
                    class="home-stat-card__progress"
                    type="line"
                    :percentage="card.progress"
                    :show-indicator="false"
                    size="small"
                />
            </article>
        </TransitionGroup>

        <section class="home-diagnostics">
            <div class="home-diagnostics__header">
                <div>
                    <h2>工作流体检</h2>
                    <p>{{ readinessSummary }}</p>
                </div>
                <n-button
                    size="small"
                    type="primary"
                    strong
                    :loading="diagnosticsRunning"
                    @click="runDiagnostic"
                >
                    {{ diagnosticsRunning ? '巡检中...' : '立即巡检' }}
                </n-button>
            </div>
            <div class="home-diagnostics__score" :data-tone="readinessTone">
                <span class="home-diagnostics__score-value">{{ readinessScore }}</span>
                <n-tag round size="small" :type="readinessTone">
                    {{ readinessLabel }}
                </n-tag>
                <span class="home-diagnostics__score-meta">
                    上次巡检：{{ lastRunLabel }} · 耗时 {{ lastRuntimeLabel }}
                </span>
            </div>
            <TransitionGroup name="diagnostic-list" tag="ul" class="home-diagnostics__list">
                <li
                    v-for="phase in diagnosticsPhases"
                    :key="phase.key"
                    class="home-diagnostics__item"
                    :class="`home-diagnostics__item--${phase.status}`"
                >
                    <div class="home-diagnostics__item-top">
                        <span>{{ phase.label }}</span>
                        <span
                            v-if="phase.duration"
                            class="home-diagnostics__item-duration"
                        >
                            ≈ {{ formatPhaseDuration(phase.duration) }}
                        </span>
                    </div>
                    <p v-if="phase.hint" class="home-diagnostics__item-hint">
                        {{ phase.hint }}
                    </p>
                </li>
            </TransitionGroup>
            <ul
                v-if="diagnosticSuggestions.length"
                class="home-diagnostics__suggestions"
            >
                <li v-for="hint in diagnosticSuggestions" :key="hint">{{ hint }}</li>
            </ul>
        </section>
        <div class="home-content">
            <div class="home-tabs-card">
                <n-tabs
                    type="line"
                    animated
                    placement="left"
                    class="home-tabs"
                    :pane-style="tabPaneStyle"
                >
                <n-tab-pane name="welcome" tab="欢迎使用">
                    <n-list
                        class="!bg-transparent !px-2 size-full overflow-y-auto thin-scrollbar animate-fade-up animate-once animate-duration-500 animate-ease-out"
                    >
                        <n-list-item>
                            <n-thing title="这是什么？">
                                <div>
                                    <p>
                                        Paste Me!
                                        聚焦 <strong>剪贴板历史管理</strong> 与 <strong>AI 辅助快捷操作</strong>，让复制粘贴流程既有记忆又有智慧。
                                        无论是查找昨天复制的那段文案，还是一键翻译、润色当前文本，都可以在这里完成。
                                    </p>
                                    <p class="text-red-300 font-bold">
                                        目前，软件必须以右键管理员权限运行，否则可能无法正常工作。
                                    </p>
                                </div>
                            </n-thing>
                        </n-list-item>
                        <n-list-item>
                            <n-thing title="怎么使用？">
                                <div>
                                    <p>
                                        按下快捷键
                                        {{
                                            config.globalShortcut?.replace(
                                                'CommandOrControl',
                                                'Ctrl'
                                            ) || '(前往全局设置添加快捷键)'
                                        }}，将会弹出一个窗口。借助这个窗口，你可以：
                                    </p>
                                    <ul>
                                        <li>查看、搜索并粘贴历史剪贴板记录</li>
                                        <li>通过右键菜单快速复制、收藏、置顶，或直接唤起 AI 动作</li>
                                        <li>
                                            将当前文本重新复制为纯文本（清除颜色、格式和链接）
                                        </li>
                                        <li>使用 AI 快捷指令完成翻译、摘要、润色等操作</li>
                                    </ul>
                                    <br />
                                    <p>在窗口中，你可以：</p>
                                    <ul>
                                        <li>按 <u>方向键上、下</u> 选择选项</li>
                                        <li>
                                            按 <u>回车</u> 选择选项或进入子菜单
                                        </li>
                                        <li>按 <u>ESC</u> 返回上一页或退出</li>
                                    </ul>
                                    <br />
                                    <p>
                                        首次使用之前，你可能需要先配置AI服务信息。
                                    </p>
                                </div>
                            </n-thing>
                        </n-list-item>
                    </n-list>
                </n-tab-pane>
                <n-tab-pane name="global" tab="全局设置">
                    <n-list
                        class="!bg-transparent !px-2 size-full overflow-y-auto thin-scrollbar animate-fade-up animate-once animate-duration-500 animate-ease-out"
                    >
                        <n-list-item>
                            <template #suffix>
                                <n-checkbox
                                    :checked="autoStart"
                                    @update:checked="toggleAutoStart"
                                ></n-checkbox>
                            </template>
                            <n-thing
                                title="开机自动启动"
                                description="启动 Windows 时自动启动 Paste Me!"
                            />
                        </n-list-item>
                        <n-list-item>
                            <template #suffix>
                                <div class="w-60 text-right">
                                    <KeySelector
                                        @set="handleShortcutChange"
                                        :shortcut="config.globalShortcut"
                                    />
                                </div>
                            </template>
                            <n-thing
                                title="全局快捷键"
                                description="按下哪个键触发窗口"
                            />
                        </n-list-item>
                        <n-list-item>
                            <template #suffix>
                                <n-checkbox
                                    v-model:checked="config.common.enablePaste"
                                ></n-checkbox>
                            </template>
                            <n-thing
                                title="启用直接粘贴功能"
                                description="与直接 Ctrl+V 粘贴相同"
                            />
                        </n-list-item>
                        <n-list-item>
                            <template #suffix>
                                <n-checkbox
                                    v-model:checked="config.common.enableCalc"
                                ></n-checkbox>
                            </template>
                            <n-thing
                                title="启用统计功能"
                                description="显示复制的文本字符数量"
                            />
                        </n-list-item>
                        <n-list-item>
                            <template #suffix>
                                <n-checkbox
                                    v-model:checked="config.common.enableEdit"
                                ></n-checkbox>
                            </template>
                            <n-thing
                                title="启用编辑功能"
                                description="允许编辑复制的文本"
                            />
                        </n-list-item>
                        <n-list-item>
                            <template #suffix>
                                <n-checkbox
                                    v-model:checked="config.common.enableToText"
                                ></n-checkbox>
                            </template>
                            <n-thing
                                title="启用转为纯文本功能"
                                description="将复制的内容重新复制为无样式文本"
                            />
                        </n-list-item>
                        <n-list-item>
                            <template #suffix>
                                <n-checkbox
                                    v-model:checked="config.detect.enabled"
                                ></n-checkbox>
                            </template>
                            <n-thing
                                title="启用剪贴板识别"
                                description="尝试从剪贴板中提取信息"
                            />
                        </n-list-item>
                        <n-list-item>
                            <template #suffix>
                                <n-checkbox
                                    v-model:checked="config.detect.detectUrl"
                                ></n-checkbox>
                            </template>
                            <n-thing
                                title="启用剪贴板识别: 链接"
                                description="尝试从剪贴板中提取链接"
                            />
                        </n-list-item>
                    </n-list>
                </n-tab-pane>
                <n-tab-pane name="ai" tab="AI 设置">
                    <n-list
                        class="!bg-transparent !px-2 size-full overflow-y-auto thin-scrollbar animate-fade-up animate-once animate-duration-500 animate-ease-out"
                    >
                        <n-list-item>
                            <template #suffix>
                                <n-checkbox
                                    v-model:checked="config.ai.enabled"
                                ></n-checkbox>
                            </template>
                            <n-thing
                                title="启用 AI 功能"
                                description="启用并显示AI相关功能"
                            />
                        </n-list-item>
                        <n-list-item>
                            <template #suffix>
                                <div class="w-72">
                                    <n-input
                                        v-model:value="config.ai.apiKey"
                                        type="password"
                                        placeholder="API Key"
                                        show-password-on="click"
                                    />
                                </div>
                            </template>
                            <n-thing
                                title="AI 服务密钥"
                                description="OpenAI 服务密钥 (明文记录在配置文件中)"
                            />
                        </n-list-item>
                        <n-list-item>
                            <template #suffix>
                                <div class="w-72">
                                    <n-input
                                        v-model:value="config.ai.endpoint"
                                        placeholder="https://api.freekey.site"
                                    />
                                </div>
                            </template>
                            <n-thing
                                title="OpenAI 服务端点"
                                description="使用的代理 AI 服务端点"
                            />
                        </n-list-item>
                        <n-list-item>
                            <template #suffix>
                                <div class="w-72">
                                    <n-input
                                        v-model:value="config.ai.model"
                                        placeholder="gpt-4o"
                                    />
                                </div>
                            </template>
                            <n-thing
                                title="AI 模型"
                                description="使用的 AI 模型"
                            />
                        </n-list-item>
                        <n-list-item>
                            <template #suffix>
                                <n-checkbox
                                    v-model:checked="config.ai.disableTools"
                                ></n-checkbox>
                            </template>
                            <n-thing
                                title="禁用 Tools Calling"
                                description="若模型不支持 Tools Calling，在此处关闭。注意关闭后联网功能无法使用。"
                            />
                        </n-list-item>
                        <n-list-item>
                            <template #suffix>
                                <n-checkbox
                                    v-model:checked="config.ai.corsCompatiable"
                                ></n-checkbox>
                            </template>
                            <n-thing
                                title="兼容性模式"
                                description="对于NIM等具有CORS限制模型服务，可使用兼容性模式。注意，此模式将会减慢回应速度。"
                            />
                        </n-list-item>
                        <n-list-item>
                            <template #suffix>
                                <n-checkbox
                                    v-model:checked="config.ai.enableToJson"
                                ></n-checkbox>
                            </template>
                            <n-thing
                                title="启用使用 AI 提取为JSON格式"
                                description="启用并允许使用AI将剪贴板转为JSON"
                            />
                        </n-list-item>
                        <n-list-item>
                            <template #suffix>
                                <n-checkbox
                                    v-model:checked="config.ai.enableAskAI"
                                ></n-checkbox>
                            </template>
                            <n-thing
                                title="启用修改或提问"
                                description="基于剪贴板要求 AI 修改或提问"
                            />
                        </n-list-item>
                        <n-list-item>
                            <template #suffix>
                                <n-checkbox
                                    v-model:checked="config.ai.enableAISnipets"
                                ></n-checkbox>
                            </template>
                            <n-thing
                                title="启用快速 AI 片段"
                                description="保存和复用自定义AI提示词片段"
                            />
                        </n-list-item>
                        <n-list-item>
                            <template #suffix>
                                <n-checkbox
                                    v-model:checked="config.ai.enableAIChat"
                                ></n-checkbox>
                            </template>
                            <n-thing
                                title="启用 AI 聊天"
                                description="基于剪贴板的对话模式"
                            />
                        </n-list-item>
                        <n-list-item>
                            <template #suffix>
                                <n-checkbox
                                    v-model:checked="
                                        config.ai.persistChatHistory
                                    "
                                ></n-checkbox>
                            </template>
                            <n-thing
                                title="保留聊天历史"
                                description="Chat模式下保留聊天历史。注意，若保留聊天历史，则仅能在开启新会话时读取剪贴板内容"
                            />
                        </n-list-item>
                        <n-list-item>
                            <n-thing
                                title="附加 AI 服务"
                                description="便于在 AI Chat 模式下使用的 AI 服务"
                            />
                            <div class="h-4"></div>
                            <n-collapse>
                                <n-collapse-item
                                    title="Tavily 网络搜索"
                                    name="websearch"
                                >
                                    <n-list class="!bg-transparent">
                                        <n-list-item>
                                            <template #suffix>
                                                <n-checkbox
                                                    v-model:checked="
                                                        config.ai
                                                            .enableWebsearch
                                                    "
                                                ></n-checkbox>
                                            </template>
                                            <n-thing
                                                title="启用 Tavily 网络搜索集成"
                                                description="为支持 Tool Calling 的 AI 提供网络搜索集成"
                                            />
                                        </n-list-item>
                                        <n-list-item>
                                            <template #suffix>
                                                <div class="w-72">
                                                    <n-input
                                                        v-model:value="
                                                            config.ai
                                                                .tavilyApiKey
                                                        "
                                                        type="password"
                                                        show-password-on="click"
                                                        placeholder="Tavily API Key"
                                                    />
                                                </div>
                                            </template>
                                            <n-thing
                                                title="Tavily 服务密钥"
                                                description="Tavily 服务密钥 (明文记录在配置文件中)"
                                            />
                                        </n-list-item>
                                    </n-list>
                                </n-collapse-item>
                                <n-collapse-item
                                    title="Jina 页面爬虫"
                                    name="webcrawl"
                                >
                                    <n-list class="!bg-transparent">
                                        <n-list-item>
                                            <template #suffix>
                                                <n-checkbox
                                                    v-model:checked="
                                                        config.ai.enableWebCrawl
                                                    "
                                                ></n-checkbox>
                                            </template>
                                            <n-thing
                                                title="启用 Jina 页面抓取集成"
                                                description="为支持 Tool Calling 的 AI 提供网页内容抓取集成"
                                            />
                                        </n-list-item>
                                        <n-list-item>
                                            <template #suffix>
                                                <div class="w-72">
                                                    <n-input
                                                        v-model:value="
                                                            config.ai.jinaApiKey
                                                        "
                                                        type="password"
                                                        show-password-on="click"
                                                        placeholder="Jina API Key"
                                                    />
                                                </div>
                                            </template>
                                            <n-thing
                                                title="Jina 服务密钥"
                                                description="Jina 服务密钥 (明文记录在配置文件中)"
                                            />
                                        </n-list-item>
                                    </n-list>
                                </n-collapse-item>
                                <n-collapse-item
                                    v-show="false"
                                    title="图片生成"
                                    name="createimage"
                                >
                                    <n-list class="!bg-transparent">
                                        <n-list-item>
                                            <template #suffix>
                                                <n-checkbox
                                                    v-model:checked="
                                                        config.ai.enableImage
                                                    "
                                                ></n-checkbox>
                                            </template>
                                            <n-thing
                                                title="启用图片生成集成"
                                                description="为支持 Tool Calling 的 AI 提供图片生成集成 (仅对话模式)"
                                            />
                                        </n-list-item>
                                        <n-list-item>
                                            <template #suffix>
                                                <div class="w-72">
                                                    <n-input
                                                        v-model:value="
                                                            config.ai
                                                                .imageApiKey
                                                        "
                                                        type="password"
                                                        show-password-on="click"
                                                        placeholder="API Key"
                                                    />
                                                </div>
                                            </template>
                                            <n-thing
                                                title="AI 图像生成 服务密钥"
                                                description="AI 图像生成 服务密钥 (明文记录在配置文件中)"
                                            />
                                        </n-list-item>
                                        <n-list-item>
                                            <template #suffix>
                                                <div class="w-72">
                                                    <n-input
                                                        v-model:value="
                                                            config.ai
                                                                .imageAIEndpoint
                                                        "
                                                        placeholder="https://api.freekey.site"
                                                    />
                                                </div>
                                            </template>
                                            <n-thing
                                                title="AI 图像生成 服务端点"
                                                description="使用的代理 AI 图像生成 服务端点"
                                            />
                                        </n-list-item>
                                        <n-list-item>
                                            <template #suffix>
                                                <div class="w-72">
                                                    <n-input
                                                        v-model:value="
                                                            config.ai.imageModel
                                                        "
                                                        placeholder="dall-e-3"
                                                    />
                                                </div>
                                            </template>
                                            <n-thing
                                                title="图片创建模型"
                                                description="使用哪个模型创建图像(请确认提供商支持)"
                                            />
                                        </n-list-item>
                                    </n-list>
                                </n-collapse-item>
                            </n-collapse>
                        </n-list-item>
                    </n-list>
                </n-tab-pane>
                <n-tab-pane
                    name="ai-snippets"
                    tab="AI 快速片段"
                    v-if="config.ai.enableAISnipets"
                >
                    <template v-if="snippetPage === 'list'">
                        <n-thing
                            title="快速片段"
                            description="自定义的AI 快速片段"
                            class="animate-fade-up animate-once animate-duration-500 animate-ease-out"
                        >
                            <template #header-extra>
                                <div>
                                    <n-button @click="createSnippet">
                                        <template #icon>
                                            <n-icon>
                                                <MdiPlus />
                                            </n-icon>
                                        </template>
                                        添加
                                    </n-button>
                                </div>
                            </template>
                        </n-thing>
                        <div
                            class="home-pane-scroll animate-fade-up animate-once animate-duration-500 animate-ease-out"
                        >
                            <n-list
                                class="!bg-transparent size-full overflow-y-auto thin-scrollbar"
                            >
                                <template v-for="snippet in config.snippets">
                                    <n-list-item class="group">
                                        <n-thing
                                            :title="snippet.name"
                                            :description="
                                                snippet.prompt.slice(0, 80) +
                                                (snippet.prompt.length > 80
                                                    ? '...'
                                                    : '')
                                            "
                                        >
                                            <template #avatar>
                                                <n-avatar>
                                                    <n-icon>
                                                        <MdiFileDocumentEditOutline />
                                                    </n-icon>
                                                </n-avatar>
                                            </template>
                                            <template #header-extra>
                                                <div
                                                    class="flex flex-row gap-1 opacity-0 group-hover:opacity-100"
                                                >
                                                    <n-button
                                                        size="small"
                                                        @click="
                                                            () =>
                                                                editSnippet(
                                                                    snippet
                                                                )
                                                        "
                                                    >
                                                        <template #icon>
                                                            <n-icon>
                                                                <MdiPencil />
                                                            </n-icon>
                                                        </template>
                                                    </n-button>

                                                    <n-popconfirm
                                                        @positive-click="
                                                            () =>
                                                                deleteSnippet(
                                                                    snippet
                                                                )
                                                        "
                                                    >
                                                        <template #trigger>
                                                            <n-button
                                                                size="small"
                                                                ghost
                                                                type="error"
                                                            >
                                                                <template #icon>
                                                                    <n-icon>
                                                                        <MdiDelete />
                                                                    </n-icon>
                                                                </template>
                                                            </n-button>
                                                        </template>
                                                        确定删除吗？
                                                    </n-popconfirm>
                                                </div>
                                            </template>
                                        </n-thing>
                                    </n-list-item>
                                </template>
                            </n-list>
                        </div>
                    </template>
                    <template v-else-if="snippetPage === 'edit'">
                        <n-thing
                            :title="
                                (currentSnippet.isNew ? '创建' : '修改') +
                                'AI快速片段'
                            "
                            class="animate-fade-up animate-once animate-duration-500 animate-ease-out"
                        >
                            <template #avatar>
                                <n-avatar>
                                    <n-icon>
                                        <MdiFileDocumentEditOutline />
                                    </n-icon>
                                </n-avatar>
                            </template>
                            <template #header-extra>
                                <div class="flex flex-row gap-1">
                                    <n-button
                                        @click="() => backToSnippetList()"
                                    >
                                        <template #icon>
                                            <n-icon>
                                                <MdiKeyboardBackspace />
                                            </n-icon>
                                        </template>
                                        返回
                                    </n-button>
                                    <n-button
                                        v-if="!currentSnippet.isNew"
                                        @click="
                                            () => deleteSnippet(currentSnippet)
                                        "
                                        ghost
                                        type="error"
                                    >
                                        <template #icon>
                                            <n-icon>
                                                <MdiDelete />
                                            </n-icon>
                                        </template>
                                        删除
                                    </n-button>
                                    <n-button @click="() => saveSnippet()">
                                        <template #icon>
                                            <n-icon>
                                                <MdiCheck />
                                            </n-icon>
                                        </template>
                                        保存
                                    </n-button>
                                </div>
                            </template>

                            <div
                                class="home-pane-form thin-scrollbar"
                            >
                                <div>
                                    <span>名称</span>
                                    <n-input
                                        placeholder="片段名称"
                                        v-model:value="currentSnippet.name"
                                    ></n-input>
                                </div>
                                <div>
                                    <span>系统提示词</span>
                                    <n-input
                                        :autosize="{
                                            minRows: 2,
                                            maxRows: 10,
                                        }"
                                        type="textarea"
                                        placeholder="角色为System的提示词，通常用于描述AI角色，可用{{clipboard}}表示剪贴板内容"
                                        v-model:value="currentSnippet.system"
                                    ></n-input>
                                </div>
                                <div>
                                    <span>用户提示词</span>
                                    <n-input
                                        :autosize="{
                                            minRows: 3,
                                            maxRows: 15,
                                        }"
                                        type="textarea"
                                        :placeholder="
                                            '角色为User的提示词，通常用于描述任务' +
                                            (currentSnippet.advanced
                                                ? '，可用{{clipboard}}表示剪贴板内容'
                                                : '')
                                        "
                                        v-model:value="currentSnippet.prompt"
                                    ></n-input>
                                </div>
                                <div v-if="!currentSnippet.advanced">
                                    <div class="flex flex-row justify-between">
                                        <div>使用新版提示词功能</div>
                                        <n-button
                                            size="small"
                                            type="primary"
                                            @click="upgradeSnippet"
                                            >升级</n-button
                                        >
                                    </div>
                                    <span class="opacity-50"
                                        >新版本提示词功能不再内置模板而是完全使用用户定义的内容，并且支持使用<span
                                            class="markdown-align"
                                            ><code v-pre>{{
                                                clipboard
                                            }}</code></span
                                        >作为剪贴板内容占位符。为了避免破坏原有提示词功能，需要手动确认升级。</span
                                    >
                                </div>
                                <div>
                                    <div class="flex flex-row justify-between">
                                        <div>使用 Markdown 输出</div>
                                        <div>
                                            <n-switch
                                                v-model:value="
                                                    currentSnippet.markdown
                                                "
                                            />
                                        </div>
                                    </div>
                                    <span class="opacity-50"
                                        >使用Markdown输出将会导致结果无法直接编辑。</span
                                    >
                                </div>
                            </div>
                        </n-thing>
                    </template>
                </n-tab-pane>
                <n-tab-pane name="about" tab="关于">
                    <n-list
                        class="!bg-transparent !px-2 size-full overflow-y-auto thin-scrollbar animate-fade-up animate-once animate-duration-500 animate-ease-out"
                    >
                        <n-list-item>
                            <n-thing
                                title="版本"
                                :description="AppInfo.version"
                            >
                                <template #action>
                                    <n-button
                                        strong
                                        secondary
                                        :type="updateState.type"
                                        size="small"
                                        @click="checkUpdate"
                                        :loading="updateState.working"
                                        :disabled="updateState.working"
                                    >
                                        <template #icon>
                                            <n-icon>
                                                <component
                                                    :is="currentIcon"
                                                ></component>
                                            </n-icon>
                                        </template>
                                        {{ updateState.btn }}
                                    </n-button>
                                </template>
                            </n-thing>
                            <n-collapse-transition
                                :show="updateState.haveUpdate"
                            >
                                <div class="w-[600px] mt-5">
                                    <div
                                        class="mb-3"
                                        v-if="updateState.latestDate"
                                    >
                                        发布于
                                        {{
                                            convertDatetime(
                                                updateState.latestDate || ''
                                            )
                                        }}
                                    </div>
                                    <HijackedATag as-external-link>
                                        <div
                                            class="markdown-align"
                                            v-html="
                                                marked.parse(
                                                    asString(
                                                        (updateState.latestNote ||
                                                            '*请打开项目页面查看更新信息*') +
                                                            updateSuffix
                                                    )
                                                )
                                            "
                                        ></div>
                                    </HijackedATag>
                                </div>
                            </n-collapse-transition>
                        </n-list-item>
                        <n-list-item>
                            <n-thing title="作者" description="CKylinMC" />
                        </n-list-item>
                        <n-list-item>
                            <n-thing
                                title="源代码"
                                description="https://github.com/CKylinMC/PasteMe"
                            >
                                项目基于 MIT 协议开源
                                <template #action>
                                    <div class="flex flex-row gap-1">
                                        <n-button
                                            size="small"
                                            @click="openProjectPage"
                                        >
                                            项目页面 (Github)
                                        </n-button>
                                        <n-button
                                            size="small"
                                            @click="openFeedbackPage"
                                        >
                                            反馈页面 (Github)
                                        </n-button>
                                    </div>
                                </template>
                            </n-thing>
                        </n-list-item>
                    </n-list>
                </n-tab-pane>
            </n-tabs>
        </div>

        </div>

        <n-modal
            v-model:show="closeConfirm"
            preset="dialog"
            title="确认退出应用吗？"
            content="若只是想要隐藏窗口，请使用最小化按钮"
            positive-text="退出"
            negative-text="返回"
            @positive-click="closeApp"
        />

        <Toast ref="toast" />
    </div>
</template>

<style scoped>
.home-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 28px 30px 32px;
  background: radial-gradient(140% 140% at 10% 0%, rgba(122, 209, 245, 0.16), transparent 60%),
    radial-gradient(120% 120% at 85% 15%, rgba(79, 107, 255, 0.18), transparent 70%),
    rgba(248, 250, 255, 0.94);
  overflow: hidden;
}

:global(.dark) .home-shell {
  background: radial-gradient(160% 160% at 12% -10%, rgba(79, 107, 255, 0.28), transparent 70%),
    radial-gradient(120% 120% at 80% 0%, rgba(18, 115, 181, 0.24), transparent 72%),
    rgba(15, 21, 38, 0.92);
}

.home-hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  gap: 32px;
  padding: 32px 36px;
  border-radius: 26px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(228, 238, 255, 0.82));
  border: 1px solid rgba(79, 107, 255, 0.18);
  box-shadow: 0 32px 68px rgba(36, 56, 128, 0.18);
  overflow: hidden;
}

:global(.dark) .home-hero {
  background: linear-gradient(135deg, rgba(26, 34, 56, 0.9), rgba(16, 24, 46, 0.82));
  border-color: rgba(122, 209, 245, 0.22);
  box-shadow: 0 36px 72px rgba(2, 8, 26, 0.68);
}

.home-hero::after {
  content: "";
  position: absolute;
  inset: -35% 10% 40% -25%;
  background: radial-gradient(70% 70% at 25% 20%, rgba(79, 107, 255, 0.24), transparent 70%);
  pointer-events: none;
}

.home-hero__info {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 18px;
  z-index: 1;
}

.home-hero__title {
  display: flex;
  align-items: center;
  gap: 18px;
}

.home-hero__logo {
  width: 60px;
  height: 60px;
  border-radius: 18px;
  box-shadow: 0 22px 44px rgba(79, 107, 255, 0.26);
}

.home-hero__title h1 {
  margin: 0;
  font-size: 30px;
  font-weight: 700;
  letter-spacing: 0.4px;
  color: var(--vibe-text-primary);
}

.home-hero__title p {
  margin: 6px 0 0;
  font-size: 14px;
  color: var(--vibe-text-secondary);
}

.home-hero__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.home-hero__meta-text {
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(79, 107, 255, 0.14);
  color: #3245d6;
}

.home-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.home-hero__actions :deep(.n-button) {
  border-radius: 14px;
  box-shadow: 0 16px 32px rgba(79, 107, 255, 0.18);
  transition: transform 160ms ease, box-shadow 220ms ease;
}

.home-hero__actions :deep(.n-button:hover) {
  transform: translateY(-2px);
  box-shadow: 0 24px 44px rgba(79, 107, 255, 0.24);
}

.home-hero__illustration {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}

.home-stats-grid {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.home-stat-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 22px 24px;
  border-radius: 20px;
  border: 1px solid rgba(79, 107, 255, 0.16);
  background: linear-gradient(150deg, rgba(255, 255, 255, 0.92), rgba(236, 242, 255, 0.86));
  box-shadow: 0 26px 58px rgba(36, 56, 128, 0.18);
  overflow: hidden;
  transition: transform 200ms ease, box-shadow 240ms ease;
}

.home-stat-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 34px 64px rgba(36, 56, 128, 0.24);
}

.home-stat-card__title {
  font-size: 13px;
  letter-spacing: 0.4px;
  color: var(--vibe-text-muted);
}

.home-stat-card__value {
  font-size: 28px;
  font-weight: 700;
  color: var(--vibe-text-primary);
}

.home-stat-card__meta {
  font-size: 12px;
  color: var(--vibe-text-secondary);
}

.home-stat-card__progress {
  margin-top: auto;
}

.home-stat-card--positive {
  border-color: rgba(63, 195, 161, 0.28);
}

.home-stat-card--warning {
  border-color: rgba(255, 180, 92, 0.34);
}

.home-diagnostics {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 28px 30px;
  border-radius: 24px;
  border: 1px solid rgba(79, 107, 255, 0.16);
  background: linear-gradient(140deg, rgba(255, 255, 255, 0.94), rgba(230, 239, 255, 0.82));
  box-shadow: 0 34px 72px rgba(36, 56, 128, 0.22);
  overflow: hidden;
}

.home-diagnostics::before {
  content: "";
  position: absolute;
  inset: -50% 35% 30% -30%;
  background: radial-gradient(60% 60% at 55% 35%, rgba(79, 107, 255, 0.22), transparent 70%);
  pointer-events: none;
}

.home-diagnostics__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.home-diagnostics__header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.home-diagnostics__header p {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--vibe-text-secondary);
}

.home-diagnostics__score {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 16px 18px;
  border-radius: 18px;
  background: rgba(79, 107, 255, 0.08);
}

.home-diagnostics__score-value {
  font-size: 46px;
  font-weight: 700;
  line-height: 1;
  color: #3a50ff;
}

.home-diagnostics__score[data-tone="warning"] .home-diagnostics__score-value {
  color: #f6a700;
}

.home-diagnostics__score[data-tone="error"] .home-diagnostics__score-value {
  color: #ff5c5c;
}

.home-diagnostics__score-meta {
  font-size: 12px;
  color: var(--vibe-text-muted);
}

.home-diagnostics__list {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.home-diagnostics__item {
  padding: 16px 18px;
  border-radius: 16px;
  border: 1px solid rgba(79, 107, 255, 0.12);
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 20px 42px rgba(36, 56, 128, 0.16);
  transition: transform 200ms ease, box-shadow 220ms ease;
}

.home-diagnostics__item:hover {
  transform: translateY(-4px);
  box-shadow: 0 26px 54px rgba(36, 56, 128, 0.22);
}

.home-diagnostics__item--success {
  border-color: rgba(63, 195, 161, 0.22);
}

.home-diagnostics__item--warning {
  border-color: rgba(255, 180, 92, 0.28);
}

.home-diagnostics__item--error {
  border-color: rgba(255, 92, 92, 0.28);
  background: rgba(255, 240, 240, 0.82);
}

.home-diagnostics__item-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  font-weight: 600;
}

.home-diagnostics__item-duration {
  font-size: 12px;
  color: var(--vibe-text-muted);
}

.home-diagnostics__item-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--vibe-text-secondary);
  line-height: 1.5;
}

.home-content {
  flex: 1;
  display: flex;
  min-height: 0;
}

.home-tabs-card {
  flex: 1;
  display: flex;
  padding: 16px;
  border-radius: 22px;
  border: 1px solid rgba(79, 107, 255, 0.14);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 28px 60px rgba(36, 56, 128, 0.2);
  overflow: hidden;
}

.home-tabs {
  flex: 1;
  display: flex;
  min-height: 0;
}

.home-tabs :deep(.n-tabs) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.home-tabs :deep(.n-tabs-pane-wrapper) {
  flex: 1;
  min-height: 0;
}

.home-tabs :deep(.n-tab-pane) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.home-tabs :deep(.n-tabs-tab) {
  border-radius: 12px;
  padding: 8px 16px;
}

.home-tabs :deep(.n-tabs-pane-wrapper .n-scrollbar) {
  padding-right: 6px;
}

.home-tabs :deep(.n-card) {
  border-radius: 16px;
  border: 1px solid rgba(79, 107, 255, 0.12);
  box-shadow: none;
}

.home-tabs :deep(.n-card-header) {
  padding: 16px;
}

.home-tabs :deep(.n-card-content) {
  padding: 0 16px 16px;
}

.diagnostic-list-enter-active,
.diagnostic-list-leave-active,
.home-card-enter-active,
.home-card-leave-active {
  transition: opacity 220ms ease, transform 220ms ease;
}

.diagnostic-list-enter-from,
.home-card-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.diagnostic-list-leave-to,
.home-card-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

@media (max-width: 1200px) {
  .home-hero {
    grid-template-columns: 1fr;
  }

  .home-hero__info {
    max-width: 100%;
  }
}

@media (max-width: 768px) {
  .home-shell {
    padding: 22px 20px 26px;
  }

  .home-hero {
    padding: 26px 24px;
  }

  .home-tabs-card {
    padding: 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-stat-card,
  .home-diagnostics__item,
  .home-hero__actions :deep(.n-button) {
    transition-duration: 0.01ms !important;
    transform: none !important;
  }
}
</style>

