<script setup lang="ts">
import { webviewWindow } from '@tauri-apps/api';
import { window as appWindow } from '@tauri-apps/api';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { writeText, readText } from '@tauri-apps/plugin-clipboard-manager';
import SolarTextFieldFocusLineDuotone from '~icons/solar/text-field-focus-line-duotone';
import SolarTextBoldDuotone from '~icons/solar/text-bold-duotone';
import SolarCodeLineDuotone from '~icons/solar/code-line-duotone';
import SolarLightbulbBoltLineDuotone from '~icons/solar/lightbulb-bolt-line-duotone';
import SolarPen2LineDuotone from '~icons/solar/pen-2-line-duotone';
import SolarCalculatorLineDuotone from '~icons/solar/calculator-line-duotone';
import SolarAltArrowLeftLineDuotone from '~icons/solar/alt-arrow-left-line-duotone';
import SolarCheckSquareLineDuotone from '~icons/solar/check-square-line-duotone';
import LineMdLoadingTwotoneLoop from '~icons/line-md/loading-twotone-loop';
import { Store } from '@tauri-apps/plugin-store';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'; // Ensure OPENAI_API_KEY environment variable is set
import { streamText } from 'ai';

const form = ref({
    globalShortcut: 'CommandOrControl+Shift+C',
    ai: {
        enabled: false,
        apiKey: '',
        endpoint: 'https://api.openai.com/v1',
        model: 'gpt-4o',
    },
});

const loadConfig = async () => {
    const store = await Store.load('store.bin');
    if (await store.has('globalShortcut')) {
        form.value.globalShortcut =
            (await store.get('globalShortcut')) || 'CommandOrControl+Shift+C';
    } else {
        form.value.globalShortcut = 'CommandOrControl+Shift+C';
    }
    if (await store.has('ai.enabled')) {
        form.value.ai.enabled = !!(await store.get('ai.enabled'));
    } else {
        form.value.ai.enabled = true;
    }
    if (await store.has('ai.apiKey')) {
        form.value.ai.apiKey = (await store.get('ai.apiKey')) || '';
    } else {
        form.value.ai.apiKey = '';
    }
    if (await store.has('ai.endpoint')) {
        form.value.ai.endpoint =
            (await store.get('ai.endpoint')) || 'https://api.openai.com/v1';
    } else {
        form.value.ai.endpoint = 'https://api.openai.com/v1';
    }
    if (await store.has('ai.model')) {
        form.value.ai.model = (await store.get('ai.model')) || 'gpt-4o';
    } else {
        form.value.ai.model = 'gpt-4o';
    }
    await store.close();
};

const webview = new webviewWindow.WebviewWindow('context', {
    url: '/panel',
    width: 400,
    height: 400,
});

const showPreview = ref(true);
const copiedContent = ref<string>('');
const copiedContentPreview = computed(() => {
    return copiedContent.value.length > 2000
        ? copiedContent.value.slice(0, 2000) + '...(超过2000字符已截断)'
        : copiedContent.value;
});
const aigeneratedContent = ref<string>('');
const aigenerating = ref(false);
const aiuserprompt = ref<string>('');

const mouseInRange = ref(false);

const page = ref<'index' | 'calc' | 'edit' | 'tojson' | 'askai' | 'aicreate'>(
    'index'
);

const menus = computed<
    {
        key: string;
        label: string;
        description: string;
        autoClose?: boolean;
        action: () => void;
        icon?: any;
    }[]
>(() => {
    const list = [
        {
            key: 'calc',
            label: '统计',
            description: `共计 ${copiedContent.value.length} 字符，${
                copiedContent.value.split('\n').length
            } 行，非空字符 ${
                copiedContent.value.replace(/\s/g, '').length
            } 字符， 非空行 ${
                copiedContent.value
                    .split('\n')
                    .filter(line => line.trim() !== '').length
            } 行`,
            action: () => {
                gotoCalc();
            },
            icon: SolarCalculatorLineDuotone,
        },
        {
            key: 'edit',
            label: '编辑',
            description: '直接修改内容',
            action: () => {
                gotoEdit();
            },
            icon: SolarTextFieldFocusLineDuotone,
        },
        {
            key: 'text',
            label: '转为纯文本',
            description: '重新复制为纯文本',
            action: () => {
                writeText(copiedContent.value);
            },
            autoClose: true,
            icon: SolarTextBoldDuotone,
        },
    ];
    if (form.value?.ai.enabled) {
        list.push(
            {
                key: 'json',
                label: '转为JSON',
                description: '使用AI将内容转为JSON',
                action: () => {
                    gotoJson();
                },
                icon: SolarCodeLineDuotone,
            },
            {
                key: 'aimodify',
                label: '询问AI...',
                description: '让AI帮忙处理',
                action: () => {
                    gotoAskAI();
                },
                icon: SolarLightbulbBoltLineDuotone,
            },
            {
                key: 'aicreate',
                label: '使用AI创作...',
                description: '让AI帮忙创作',
                action: () => {
                    gotoAICreate();
                },
                icon: SolarPen2LineDuotone,
            }
        );
    }
    return list;
});

function executeMenu(key: string) {
    const menu = menus.value.find(menu => menu.key === key);
    if (menu) {
        try {
            menu.action();
        } catch (e) {
            console.error(e);
        }
        if (menu.autoClose) {
            webview.hide();
        }
    } else {
        hideWindow();
    }
}

function getAIInstance() {
    return createOpenAICompatible({
        name: 'OpenAICompatiable',
        apiKey: form.value.ai.apiKey,
        baseURL: form.value.ai.endpoint,
    });
}

async function tryGenerateText(system: string, prompt: string) {
    aigenerating.value = true;
    try {
        const ai = getAIInstance();
        const result = await streamText({
            model: ai.chatModel(form.value.ai.model),
            system,
            prompt,
        });
        for await (const textPart of result.textStream) {
            aigeneratedContent.value += textPart;
        }
    } finally {
        aigenerating.value = false;
    }
}

function listenKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
        webview.hide();
    }

    if (
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' ||
            document.activeElement.tagName === 'TEXTAREA')
    ) {
        return;
    }

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
    if (e.key === 'Enter') {
        if (focusOn.value >= 0) {
            executeMenu(menus.value[focusOn.value].key);
        }
    }
    if (e.key === 'Backspace') {
        if (page.value === 'index') {
            hideWindow();
        } else {
            gotoIndex();
        }
    }
}

function hideWindow() {
    gotoIndex();
    copiedContent.value = '';
    webview.hide();
}

async function refreshCopyContent() {
    copiedContent.value = await readText();
}

function gotoIndex() {
    showPreview.value = true;
    page.value = 'index';
}

function gotoCalc() {
    showPreview.value = false;
    page.value = 'calc';
}

function gotoEdit() {
    showPreview.value = false;
    page.value = 'edit';
}

function gotoJson() {
    showPreview.value = true;
    aiuserprompt.value = '转换为JSON';
    page.value = 'tojson';
}

function gotoAskAI() {
    showPreview.value = true;
    aiuserprompt.value = '';
    page.value = 'askai';
}

function gotoAICreate() {
    showPreview.value = true;
    aiuserprompt.value = '';
    page.value = 'aicreate';
}

function startConvertToJson() {
    aigeneratedContent.value = '';
    tryGenerateText(
        `You are tasked with reformatting user's clipboard data. Use the user's instructions, and the content of their clipboard below to edit their clipboard content as they have requested it.
Do not output anything else besides the reformatted clipboard content. Use raw prettify format without markdown.`,
        `User instructions:
${aiuserprompt.value}

Clipboard Content:
${copiedContent.value}

Output:
`
    );
}

function startAskAI() {
    aigeneratedContent.value = '';
    tryGenerateText(
        `You are tasked with analysing user's clipboard data. Use the user's instructions, and the content of their clipboard below to edit their clipboard content as they have requested it. Answer any questions the user has asked.`,
        `User instructions:
${aiuserprompt.value}

Clipboard Content:
${copiedContent.value}

Output:
`
    );
}

function startAICreate() {
    aigeneratedContent.value = '';
    tryGenerateText(
        `You are tasked with continue creating content based on user's instructions. Use the user's instructions, and the content of their clipboard below to edit their clipboard content as they have requested it. Create content based on the user's instructions.`,
        `User instructions:
${aiuserprompt.value}

Clipboard Content:
${copiedContent.value}

Output:
`
    );
}

function saveEdit() {
    writeText(copiedContent.value);
    gotoIndex();
}

function saveJson() {
    writeText(aigeneratedContent.value);
    gotoIndex();
}

const savable = computed(() => {
    return page.value !== 'index' && page.value !== 'calc';
});

function doSaveAction() {
    switch (page.value) {
        case 'edit':
            saveEdit();
            break;
        case 'tojson':
            saveJson();
            break;
    }
}

const focusOn = ref(-1);

let blurFns: Function[] = [];

onMounted(async () => {
    window.addEventListener('keydown', listenKeydown);
    blurFns.push(
        // await appWindow.getCurrentWindow().listen('tauri://blur', event => {
        //     if (!mouseInRange.value) {
        //         console.log('blur', event);
        //         hideWindow();
        //     }
        // }),
        await appWindow.getCurrentWindow().listen('tauri://focus', async () => {
            await loadConfig();
            copiedContent.value = '正在读取剪贴板...';
            showPreview.value = true;
            page.value = 'index';
            refreshCopyContent();
        })
    );
});

onBeforeUnmount(() => {
    window.removeEventListener('keydown', listenKeydown);
    blurFns.map(fn => fn());
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
                    @click="gotoIndex"
                    v-if="page !== 'index'"
                />
                <span>剪贴板</span>
                <LineMdLoadingTwotoneLoop
                    class="inline hover:bg-gray-500/90 float-end"
                    v-if="aigenerating"
                />
                <SolarCheckSquareLineDuotone
                    class="inline hover:bg-gray-500/90 float-end"
                    @click="doSaveAction"
                    v-if="savable && !aigenerating"
                />
            </div>
            <div
                v-if="showPreview"
                class="bg-gray-800/60 h-20 rounded flex-1 p-2 overflow-scroll thin-scrollbar"
            >
                <pre>{{ copiedContentPreview }}</pre>
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
                <div class="text-gray-300">{{ copiedContent.length }}</div>
                <div>非空字符总数:</div>
                <div class="text-gray-300">
                    {{ copiedContent.replace(/\s/g, '').length }}
                </div>
                <div>行数:</div>
                <div class="text-gray-300">
                    {{ copiedContent.split('\n').length }}
                </div>
                <div>非空行数:</div>
                <div class="text-gray-300">
                    {{
                        copiedContent
                            .split('\n')
                            .filter(line => line.trim() !== '').length
                    }}
                </div>
                <div>英文字母总数:</div>
                <div class="text-gray-300">
                    {{ (copiedContent.match(/[a-zA-Z]/g) || []).length }}
                </div>
                <div>英语单词总数:</div>
                <div class="text-gray-300">
                    {{ (copiedContent.match(/\b\w+\b/g) || []).length }}
                </div>
                <div>非Ascii字符总数:</div>
                <div class="text-gray-300">
                    {{ (copiedContent.match(/[^\x00-\x7F]/g) || []).length }}
                </div>
                <div>数字总数:</div>
                <div class="text-gray-300">
                    {{ (copiedContent.match(/\d/g) || []).length }}
                </div>
                <div>标点符号总数:</div>
                <div class="text-gray-300">
                    {{
                        (
                            copiedContent.match(
                                /[.,\/#!$%\^&\*;:{}=\-_`~()]/g
                            ) || []
                        ).length
                    }}
                </div>
                <div>空格总数:</div>
                <div class="text-gray-300">
                    {{ (copiedContent.match(/\s/g) || []).length }}
                </div>
                <div>汉字总数:</div>
                <div class="text-gray-300">
                    {{ (copiedContent.match(/[\u4e00-\u9fa5]/g) || []).length }}
                </div>
                <div>大写字母总数:</div>
                <div class="text-gray-300">
                    {{ (copiedContent.match(/[A-Z]/g) || []).length }}
                </div>
                <div>小写字母总数:</div>
                <div class="text-gray-300">
                    {{ (copiedContent.match(/[a-z]/g) || []).length }}
                </div>
                <div>最长行长度:</div>
                <div class="text-gray-300">
                    {{
                        Math.max(
                            ...copiedContent
                                .split('\n')
                                .map(line => line.length)
                        )
                    }}
                </div>
            </div>
        </div>
        <div v-else-if="page === 'edit'" class="h-[calc(100%-30px)]">
            <textarea
                v-model="copiedContent"
                class="size-full bg-gray-800 text-gray-200 p-2 rounded resize-none thin-scrollbar"
            ></textarea>
        </div>
        <div
            v-else-if="page === 'tojson'"
            class="h-[calc(100%-30px)] flex flex-col"
        >
            <div>
                <n-input
                    :disabled="aigenerating"
                    v-model:value="aiuserprompt"
                    type="text"
                    placeholder="想要做什么？"
                    class="h-10 block"
                />
            </div>
            <n-button
                :disabled="aigenerating"
                strong
                secondary
                type="info"
                @click="startConvertToJson"
            >
                生成
            </n-button>
            <textarea
                :disabled="aigenerating"
                v-model="aigeneratedContent"
                class="flex-1 bg-gray-800 text-gray-200 p-2 rounded resize-none thin-scrollbar"
            ></textarea>
        </div>
        <div
            v-else-if="page === 'askai'"
            class="h-[calc(100%-30px)] flex flex-col"
        >
            <div>
                <n-input
                    :disabled="aigenerating"
                    v-model:value="aiuserprompt"
                    type="text"
                    placeholder="想要问什么？"
                    class="h-10 block"
                />
            </div>
            <n-button
                :disabled="aigenerating"
                strong
                secondary
                type="info"
                @click="startAskAI"
            >
                生成
            </n-button>
            <textarea
                :disabled="aigenerating"
                v-model="aigeneratedContent"
                class="flex-1 bg-gray-800 text-gray-200 p-2 rounded resize-none thin-scrollbar"
            ></textarea>
        </div>
        <div
            v-else-if="page === 'aicreate'"
            class="h-[calc(100%-30px)] flex flex-col"
        >
            <div>
                <n-input
                    :disabled="aigenerating"
                    v-model:value="aiuserprompt"
                    type="text"
                    placeholder="要继续写什么？"
                    class="h-10 block"
                />
            </div>
            <n-button
                :disabled="aigenerating"
                strong
                secondary
                type="info"
                @click="startAICreate"
            >
                生成
            </n-button>
            <textarea
                :disabled="aigenerating"
                v-model="aigeneratedContent"
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
