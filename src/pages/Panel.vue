<script setup lang="ts">
import { onBeforeUnmount, onMounted, computed, ref, unref } from 'vue';
import { useConfig } from '@/composables/useConfig';
import { useAI } from '@/composables/useAI';
import { useClipboard } from '@/composables/useClipboard';
import { PanelPage, usePanelWindow } from '@/composables/usePanelWindow';
import { webviewWindow } from '@tauri-apps/api';
import SolarTextFieldFocusLineDuotone from '~icons/solar/text-field-focus-line-duotone';
import SolarTextBoldDuotone from '~icons/solar/text-bold-duotone';
import SolarCodeLineDuotone from '~icons/solar/code-line-duotone';
import SolarLightbulbBoltLineDuotone from '~icons/solar/lightbulb-bolt-line-duotone';
import SolarPen2LineDuotone from '~icons/solar/pen-2-line-duotone';
import SolarCalculatorLineDuotone from '~icons/solar/calculator-line-duotone';
import SolarAltArrowLeftLineDuotone from '~icons/solar/alt-arrow-left-line-duotone';
import SolarCheckSquareLineDuotone from '~icons/solar/check-square-line-duotone';
import LineMdLoadingTwotoneLoop from '~icons/line-md/loading-twotone-loop';

const { config, loadConfig } = useConfig();
const { generating, generatedContent, userPrompt, generateText } = useAI(config);
const clipboard = useClipboard();
const { content, contentPreview, stats, refresh, update } = clipboard;
const { page, showPreview, mouseInRange, gotoPage, setupWindowListeners } = usePanelWindow(clipboard);

// 菜单焦点
const focusOn = ref(-1);

// 可保存状态
const savable = computed(() => {
    return page.value !== 'index' && page.value !== 'calc';
});

const handlePageChange = (page: PanelPage) => {
    if (page === 'tojson') {
        userPrompt.value = '转换为JSON';
    } else {
        userPrompt.value = '';
    }
};

// 菜单配置
const menus = computed(() => {
    const list = [
        {
            key: 'calc',
            label: '统计',
            description: `共计 ${content.value.length} 字符，${
                content.value.split('\n').length
            } 行，非空字符 ${content.value.replace(/\s/g, '').length} 字符`,
            action: () => gotoPage('calc', handlePageChange),
            icon: SolarCalculatorLineDuotone,
        },
        {
            key: 'edit',
            label: '编辑',
            description: '直接修改内容',
            action: () => gotoPage('edit', handlePageChange),
            icon: SolarTextFieldFocusLineDuotone,
        },
        {
            key: 'text',
            label: '转为纯文本',
            description: '重新复制为纯文本',
            action: () => {
                update(content.value);
                hideWindow();
            },
            autoClose: true,
            icon: SolarTextBoldDuotone,
        },
    ];

    console.log(unref(config.value));

    if (config.value?.ai.enabled) {
        list.push(
            {
                key: 'json',
                label: '转为JSON',
                description: '使用AI将内容转为JSON',
                action: () => gotoPage('tojson', handlePageChange),
                icon: SolarCodeLineDuotone,
            },
            {
                key: 'askai',
                label: '询问AI...',
                description: '让AI帮忙处理',
                action: () => gotoPage('askai', handlePageChange),
                icon: SolarLightbulbBoltLineDuotone,
            },
            {
                key: 'aicreate',
                label: '使用AI创作...',
                description: '让AI帮忙创作',
                action: () => gotoPage('aicreate', handlePageChange),
                icon: SolarPen2LineDuotone,
            }
        );
    }
    return list;
});

// 执行菜单动作
function executeMenu(key: string) {
    const menu = menus.value.find(menu => menu.key === key);
    if (menu) {
        menu.action();
        if (menu.autoClose) {
            hideWindow();
        }
    }
}

function listenKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
        hideWindow();
    }

    if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
    ) {
        return;
    }

    // 上下键导航
    if (e.key === 'ArrowUp') {
        if (focusOn.value < 0) {
            focusOn.value = menus.value.length - 1;
        } else {
            focusOn.value =
                (focusOn.value - 1 + menus.value.length) % menus.value.length;
        }
    }
    if (e.key === 'ArrowDown') {
        if (focusOn.value < 0) {
            focusOn.value = 0;
        } else {
            focusOn.value = (focusOn.value + 1) % menus.value.length;
        }
    }
    if (e.key === 'Enter' && focusOn.value >= 0) {
        executeMenu(menus.value[focusOn.value].key);
    }

    if (e.key === 'Backspace') {
        if (page.value === 'index') {
            hideWindow();
        } else {
            gotoPage('index', handlePageChange);
        }
    }
}

const webview = new webviewWindow.WebviewWindow('context', {
    url: '/panel',
    width: 400,
    height: 456,
});

function hideWindow() {
    gotoPage('index');
    content.value = '';
    webview.hide();
}

// AI 相关操作函数
const startConvertToJson = () =>
    generateText(
        '你的任务是重新格式化用户的剪贴板数据。使用用户的指令和剪贴板内容进行编辑。只输出重新格式化的内容，使用原始格式，不要使用markdown。',
        `用户指令:\n${userPrompt.value}\n\n剪贴板内容:\n${content.value}\n\n输出:\n`
    );

const startAskAI = () =>
    generateText(
        '你的任务是分析用户的剪贴板数据。使用用户的指令和剪贴板内容回答问题。',
        `用户指令:\n${userPrompt.value}\n\n剪贴板内容:\n${content.value}\n\n输出:\n`
    );

const startAICreate = () =>
    generateText(
        '你的任务是基于用户的指令继续创作内容。使用用户的指令和剪贴板内容进行创作。',
        `用户指令:\n${userPrompt.value}\n\n剪贴板内容:\n${content.value}\n\n输出:\n`
    );

// 保存操作处理
function doSaveAction() {
    switch (page.value) {
        case 'edit':
            update(content.value);
            gotoPage('index');
            break;
        case 'tojson':
        case 'askai':
        case 'aicreate':
            update(generatedContent.value);
            gotoPage('index');
            break;
    }
}

let unlistenFocus: () => void;

// 生命周期钩子
onMounted(async () => {
    window.addEventListener('keydown', listenKeydown);
    await loadConfig(); // 首次加载配置
    unlistenFocus = await setupWindowListeners(); // 设置焦点监听，包含配置重载
    await refresh(); // 初始化时读取剪贴板内容
});

onBeforeUnmount(() => {
    window.removeEventListener('keydown', listenKeydown);
    unlistenFocus?.();
});
</script>

<template>
    <div
        class="flex flex-col size-full"
        @mouseover="mouseInRange = true"
        @mouseleave="mouseInRange = false"
    >
        <div class="bg-black/90 p-2">
            <div data-tauri-drag-region class="text-gray-400 h-6">
                <SolarAltArrowLeftLineDuotone
                    class="inline hover:bg-gray-500/30"
                    @click="gotoPage('index')"
                    v-if="page !== 'index'"
                />
                <span>剪贴板</span>
                <LineMdLoadingTwotoneLoop
                    class="inline hover:bg-gray-500/90 float-end"
                    v-if="generating"
                />
                <SolarCheckSquareLineDuotone
                    class="inline hover:bg-gray-500/90 float-end"
                    @click="doSaveAction"
                    v-if="savable && !generating"
                />
            </div>
            <div
                v-if="showPreview"
                class="bg-gray-800/60 h-20 rounded flex-1 p-2 overflow-scroll thin-scrollbar"
            >
                <pre>{{ contentPreview }}</pre>
            </div>
        </div>
        <div
            v-if="page === 'index'"
            class="h-[calc(100%-30px)] overflow-y-auto thin-scrollbar"
        >
            <div
                v-for="(menu, index) in menus"
                key="menu.key"
                :class="[
                    'flex flex-col gap-1 justify-center p-2 hover:cursor-pointer hover:bg-gray-500/10',
                    { 'bg-gray-500/10': focusOn === index },
                ]"
                @click="executeMenu(menu.key)"
            >
                <div class="text-gray-200">
                    <component
                        :is="menu.icon"
                        class="w-5 h-5 inline align-sub"
                    />
                    {{ menu.label }}
                </div>
                <div
                    class="text-gray-500 text-xs line-clamp-1 overflow-ellipsis"
                >
                    {{ menu.description }}
                </div>
            </div>
        </div>
        <div
            v-else-if="page === 'calc'"
            class="h-[calc(100%-30px)] overflow-y-auto thin-scrollbar p-3"
        >
            <div class="text-gray-200 text-lg font-bold mb-2">统计</div>
            <div class="text-gray-400 space-y-1 grid grid-cols-2 gap-x-2">
                <div>字符总数:</div>
                <div class="text-gray-300">{{ stats.totalChars }}</div>
                <div>非空字符总数:</div>
                <div class="text-gray-300">{{ stats.nonEmptyChars }}</div>
                <div>行数:</div>
                <div class="text-gray-300">{{ stats.totalLines }}</div>
                <div>非空行数:</div>
                <div class="text-gray-300">{{ stats.nonEmptyLines }}</div>
                <div>英文字母总数:</div>
                <div class="text-gray-300">{{ stats.totalLetters }}</div>
                <div>英语单词总数:</div>
                <div class="text-gray-300">{{ stats.totalWords }}</div>
                <div>非Ascii字符总数:</div>
                <div class="text-gray-300">{{ stats.nonAsciiChars }}</div>
                <div>数字总数:</div>
                <div class="text-gray-300">{{ stats.totalDigits }}</div>
                <div>标点符号总数:</div>
                <div class="text-gray-300">{{ stats.totalPunctuation }}</div>
                <div>空格总数:</div>
                <div class="text-gray-300">{{ stats.totalSpaces }}</div>
                <div>汉字总数:</div>
                <div class="text-gray-300">{{ stats.totalChineseChars }}</div>
                <div>大写字母总数:</div>
                <div class="text-gray-300">{{ stats.totalUppercase }}</div>
                <div>小写字母总数:</div>
                <div class="text-gray-300">{{ stats.totalLowercase }}</div>
                <div>最长行长度:</div>
                <div class="text-gray-300">{{ stats.longestLine }}</div>
            </div>
        </div>
        <div v-else-if="page === 'edit'" class="h-[calc(100%-30px)]">
            <textarea
                v-model="content"
                class="size-full bg-gray-800 text-gray-200 p-2 rounded resize-none thin-scrollbar"
            ></textarea>
        </div>
        <div
            v-else-if="page === 'tojson'"
            class="h-[calc(100%-30px)] flex flex-col"
        >
            <div>
                <n-input
                    :disabled="generating"
                    v-model:value="userPrompt"
                    type="text"
                    placeholder="想要做什么？"
                    class="h-10 block"
                />
            </div>
            <n-button
                :disabled="generating"
                strong
                secondary
                type="info"
                @click="startConvertToJson"
            >
                生成
            </n-button>
            <textarea
                :disabled="generating"
                v-model="generatedContent"
                class="flex-1 bg-gray-800 text-gray-200 p-2 rounded resize-none thin-scrollbar"
            ></textarea>
        </div>
        <div
            v-else-if="page === 'askai'"
            class="h-[calc(100%-30px)] flex flex-col"
        >
            <div>
                <n-input
                    :disabled="generating"
                    v-model:value="userPrompt"
                    type="text"
                    placeholder="想要问什么？"
                    class="h-10 block"
                />
            </div>
            <n-button
                :disabled="generating"
                strong
                secondary
                type="info"
                @click="startAskAI"
            >
                生成
            </n-button>
            <textarea
                :disabled="generating"
                v-model="generatedContent"
                class="flex-1 bg-gray-800 text-gray-200 p-2 rounded resize-none thin-scrollbar"
            ></textarea>
        </div>
        <div
            v-else-if="page === 'aicreate'"
            class="h-[calc(100%-30px)] flex flex-col"
        >
            <div>
                <n-input
                    :disabled="generating"
                    v-model:value="userPrompt"
                    type="text"
                    placeholder="要继续写什么？"
                    class="h-10 block"
                />
            </div>
            <n-button
                :disabled="generating"
                strong
                secondary
                type="info"
                @click="startAICreate"
            >
                生成
            </n-button>
            <textarea
                :disabled="generating"
                v-model="generatedContent"
                class="flex-1 bg-gray-800 text-gray-200 p-2 rounded resize-none thin-scrollbar"
            ></textarea>
        </div>
    </div>
</template>

<style>
html,
body {
    background: transparent !important;
    height: 476px;
    width: 400px;
    overflow: hidden;
}
</style>
