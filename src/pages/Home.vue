<script setup lang="ts">
import { webviewWindow } from '@tauri-apps/api';
import { window as appWindow } from '@tauri-apps/api';
import { openUrl } from '@tauri-apps/plugin-opener';
import { exit } from '@tauri-apps/plugin-process';
import { getMousePosition } from '../libs/bridges';
import { onBeforeUnmount, onMounted, ref, unref, watch } from 'vue';
import KeySelector from '@/components/KeySelector.vue';
import { useConfig } from '@/composables/useConfig';
import { useAutoStart } from '@/composables/useAutoStart';
import { useShortcut } from '@/composables/useShortcut';
import { PhysicalPosition } from '@tauri-apps/api/dpi';
import QlementineIconsWindowsMinimize16 from '~icons/qlementine-icons/windows-minimize-16';
import QlementineIconsWindowsClose16 from '~icons/qlementine-icons/windows-close-16';
import SolarRefreshLineDuotone from '~icons/solar/refresh-line-duotone';
import SolarCheckCircleLineDuotone from '~icons/solar/check-circle-line-duotone';
import SolarDownloadMinimalisticBoldDuotone from '~icons/solar/download-minimalistic-bold-duotone';
import SolarRestartCircleLineDuotone from '~icons/solar/restart-circle-line-duotone';
import SolarSadCircleLineDuotone from '~icons/solar/sad-circle-line-duotone';
import { AppInfo } from '@/AppInfo';
import ClipAIIcon from '@/assets/clipai_color.png';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { bytesToSize } from '@/libs/utils';

const { config, loadConfig, saveConfig } = useConfig();
const { autoStart, toggleAutoStart, refreshAutoStart } = useAutoStart();
const { mountShortcut, unregisterAll } = useShortcut();

const modalShortcutSetter = ref(false);
const panelview = new webviewWindow.WebviewWindow('context', {
    url: '/panel',
});
const mainview = new webviewWindow.WebviewWindow('main', {
    url: '/',
});

const closeConfirm = ref(false);

const open = async () => {
    try {
        const position = await getMousePosition();
        if (position.length === 2) {
            await panelview.setPosition(
                new PhysicalPosition(position[0], position[1])
            );
        } else {
            await panelview.center();
        }
    } catch {
        await panelview.center();
    }

    await panelview.show();
    await panelview.setAlwaysOnTop(true);
    await panelview.setFocus();
};

watch(
    () => config.value,
    () => {
        console.log('save', unref(config));
        saveConfig();
        mountShortcut(config.value.globalShortcut, open);
    },
    { deep: true }
);

// 收集所有需要清理的事件监听器
const cleanupFns: Array<() => Promise<void> | void> = [];

onMounted(async () => {
    const mainWindow = appWindow.getCurrentWindow();
    cleanupFns.push(
        await mainWindow.listen('tauri://resize', async () => {
            if (await mainWindow.isMinimized()) {
                await mainWindow.hide();
            }
        })
    );

    await loadConfig();
    await refreshAutoStart();
});

onBeforeUnmount(async () => {
    await saveConfig();
    await unregisterAll();
    // 清理所有事件监听器
    await Promise.all(cleanupFns.map(fn => fn()));
});

// UI 相关的处理函数
function handleShortcutChange(shortcut: string) {
    config.value.globalShortcut = shortcut;
}

function openShortcutSetter() {
    modalShortcutSetter.value = true;
}

function closeShortcutSetter() {
    modalShortcutSetter.value = false;
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
    failed: SolarSadCircleLineDuotone
}

const updateInfo = ref<{
    btn: string;
    stage: 'check' | 'download' | 'install';
    haveUpdate: boolean;
    latestVersion: string;
    latestNote: string;
    latestDate: string;
    working: boolean;
    goto: string;
    event: Update | null;
    total: number;
    downloaded: number;
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    icon: any;
    type: 'default' | 'info' | 'success' | 'error';
}>({
    btn: '检查更新',
    stage: 'check',
    haveUpdate: false,
    latestVersion: '',
    latestNote: '',
    latestDate: '',
    working: false,
    goto: '',
    event: null,
    total: 0,
    downloaded: 0,
    icon: UpdateIcons.check,
    type: 'default',
});

function checkUpdate() {
    if (updateInfo.value.working) return;
    updateInfo.value.working = true;
    updateInfo.value.type = 'default';
    try {
        switch (updateInfo.value.stage) {
            case 'check': {
                updateInfo.value.btn = '正在检查更新';
                return check()
                    .then(update => {
                        if (update) {
                            updateInfo.value.event = update;
                            if (update.available) {
                                updateInfo.value.haveUpdate = true;
                                updateInfo.value.latestVersion = update.version;
                                updateInfo.value.latestNote =
                                    update.body || '无描述';
                                updateInfo.value.latestDate =
                                    update.date || '未知';
                                updateInfo.value.btn = `更新到 ${update.version}`;
                                updateInfo.value.stage = 'download';
                                updateInfo.value.type = 'info';
                                updateInfo.value.icon = UpdateIcons.download;
                            } else {
                                updateInfo.value.btn = '已是最新版本';
                                updateInfo.value.type = 'success';
                                updateInfo.value.icon = UpdateIcons.latest;
                            }
                        } else {
                            updateInfo.value.btn = '已是最新版本';
                            updateInfo.value.type = 'success';
                            updateInfo.value.icon = UpdateIcons.latest;
                        }
                    })
                    .catch(e => {
                        console.error('Updater:', e);
                        updateInfo.value.btn = '检查更新失败';
                        updateInfo.value.type = 'error';
                        updateInfo.value.icon = UpdateIcons.failed;
                    })
                    .finally(() => {
                        updateInfo.value.working = false;
                    });
            }
            case 'download': {
                updateInfo.value.btn = '正在下载更新';
                return updateInfo.value.event
                    ?.download(event => {
                        switch (event.event) {
                            case 'Started':
                                updateInfo.value.total =
                                    event.data.contentLength || 0;
                                    updateInfo.value.type = 'info';
                                break;
                            case 'Progress':
                                updateInfo.value.downloaded +=
                                    event.data.chunkLength || 0;
                                if (updateInfo.value.total > 0) {
                                    updateInfo.value.btn = `正在下载更新 ${Math.floor(
                                        (updateInfo.value.downloaded /
                                            updateInfo.value.total) *
                                            100
                                    )}%`;
                                } else {
                                    updateInfo.value.btn = `正在下载更新 ${bytesToSize(
                                        updateInfo.value.downloaded
                                    )}`;
                                }
                                break;
                            case 'Finished':
                                updateInfo.value.stage = 'install';
                                updateInfo.value.btn = '重启以安装更新';
                                updateInfo.value.type = 'success';
                                updateInfo.value.icon = UpdateIcons.install;
                                break;
                        }
                    })
                    .catch(e => {
                        console.error('Updater:', e);
                        updateInfo.value.btn = '下载更新失败';
                        updateInfo.value.type = 'error';
                        updateInfo.value.icon = UpdateIcons.failed;
                    })
                    .finally(() => {
                        updateInfo.value.working = false;
                    });
            }
            case 'install': {
                updateInfo.value.btn = '正在安装更新';
                updateInfo.value.type = 'info';
                return updateInfo.value.event?.install();
            }
        }
    } catch (e) {
        console.error('Updater:', e);
        updateInfo.value.btn = '重试检查更新';
        updateInfo.value.stage = 'check';
        updateInfo.value.type = 'error';
        updateInfo.value.icon = UpdateIcons.failed;
        updateInfo.value.working = false;
    }
}

function openProjectPage() {
    return openUrl('https://github.com/CKylinMC/PasteMe');
}

function openFeedbackPage() {
    return openUrl('https://github.com/CKylinMC/PasteMe/issues/new');
}
function openCloseConfirm() {
    closeConfirm.value = true;
}
</script>

<template>
    <div class="text-white p-5 align-left relative select-none bg-transparent">
        <div
            data-tauri-drag-region
            class="absolute top-0 right-0 h-10 w-full flex flex-row justify-end items-start"
        >
            <div
                class="w-12 h-8 py-2 px-3.5 hover:bg-black/50"
                @click="minimizeApp"
            >
                <QlementineIconsWindowsMinimize16 />
            </div>
            <div
                class="w-12 h-8 py-2 px-3.5 hover:bg-red-500/50"
                @click="openCloseConfirm"
            >
                <QlementineIconsWindowsClose16 />
            </div>
        </div>
        <div class="text-3xl">
            <img class="inline size-12" :src="ClipAIIcon" /> Paste Me!
        </div>
        <div class="text-gray-400">一个简易的剪贴板增强工具</div>
        <div class="w-full h-[490px] mt-3 flex flex-col">
            <n-tabs type="line" animated placement="left" class="size-full">
                <n-tab-pane name="welcome" tab="欢迎使用">
                    <n-list
                        class="!bg-transparent !px-2 size-full overflow-y-auto thin-scrollbar"
                    >
                        <n-list-item>
                            <n-thing title="这是什么？">
                                <div>
                                    <p>
                                        Paste Me!
                                        是一个简易的剪贴板增强工具，可以帮助您更好地管理剪贴板内容。
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
                                        <li>查看、粘贴当前复制的文本</li>
                                        <li>
                                            将当前文本重新复制为纯文本（清除颜色、格式和链接）
                                        </li>
                                        <li>通过AI，将文本转换为其他格式</li>
                                        <li>通过AI解读、搜索文本</li>
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
                        class="!bg-transparent !px-2 size-full overflow-y-auto thin-scrollbar"
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
                                <n-button @click="openShortcutSetter">{{
                                    config.globalShortcut?.replace(
                                        'CommandOrControl',
                                        'Ctrl'
                                    ) || '未设置'
                                }}</n-button>
                            </template>
                            <n-thing
                                title="全局快捷键"
                                description="按下哪个键触发窗口"
                            />
                        </n-list-item>
                    </n-list>
                </n-tab-pane>
                <n-tab-pane name="ai" tab="AI 设置">
                    <n-list
                        class="!bg-transparent !px-2 size-full overflow-y-auto thin-scrollbar"
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
                                        placeholder="https://api.openai.com/v1"
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
                                                        placeholder="https://api.openai.com/v1"
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
                <n-tab-pane name="about" tab="关于">
                    <n-list
                        class="!bg-transparent !px-2 size-full overflow-y-auto thin-scrollbar"
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
                                        :type="updateInfo.type"
                                        size="small"
                                        @click="checkUpdate"
                                        :loading="updateInfo.working"
                                        :disabled="updateInfo.working"
                                        >
                                        <template #icon>
                                            <n-icon>
                                                <component
                                                    :is="updateInfo.icon"
                                                ></component>
                                            </n-icon>
                                          </template>
                                        {{ updateInfo.btn }}
                                        </n-button
                                    >
                                </template>
                            </n-thing>
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

        <n-modal :show="modalShortcutSetter">
            <n-card
                style="width: 400px"
                title="设置全局快捷键"
                :bordered="false"
                size="huge"
                role="dialog"
                aria-modal="true"
            >
                <KeySelector
                    @set="handleShortcutChange"
                    v-model:shortcut="config.globalShortcut"
                />
                <template #footer>
                    <n-button @click="closeShortcutSetter">确定</n-button>
                </template>
            </n-card>
        </n-modal>
        <n-modal
            v-model:show="closeConfirm"
            preset="dialog"
            title="确认退出应用吗？"
            content="若只是想要隐藏窗口，请使用最小化按钮"
            positive-text="退出"
            negative-text="返回"
            @positive-click="closeApp"
        />
    </div>
</template>

<style scoped>
ul {
    list-style-type: disc;
    padding-left: 20px;
}
</style>
