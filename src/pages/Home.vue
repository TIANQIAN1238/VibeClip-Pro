<script setup lang="ts">
import { webviewWindow } from '@tauri-apps/api';
import { window as appWindow } from '@tauri-apps/api';
import { getMousePosition } from '../libs/bridges';
import { onBeforeUnmount, onMounted, ref, unref, watch } from 'vue';
import KeySelector from '@/components/KeySelector.vue';
import { useConfig } from '@/composables/useConfig';
import { useAutoStart } from '@/composables/useAutoStart';
import { useShortcut } from '@/composables/useShortcut';
import { PhysicalPosition } from '@tauri-apps/api/dpi';

const { config, loadConfig, saveConfig } = useConfig();
const { autoStart, toggleAutoStart, refreshAutoStart } = useAutoStart();
const { mountShortcut, unregisterAll } = useShortcut();

const modalShortcutSetter = ref(false);
const webview = new webviewWindow.WebviewWindow('context', {
    url: '/panel',
});

const open = async () => {
    try {
        const position = await getMousePosition();
        if (position.length === 2) {
            await webview.setPosition(
                new PhysicalPosition(position[0], position[1])
            );
        } else {
            await webview.center();
        }
    } catch {
        await webview.center();
    }

    await webview.show();
    await webview.setAlwaysOnTop(true);
    await webview.setFocus();
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
</script>

<template>
    <div class="text-white p-5 align-left">
        <div class="text-3xl">Paste Me!</div>
        <div class="text-gray-400">一个简易的剪贴板增强工具</div>
        <div
            class="w-full h-[490px] mt-3 flex flex-col gap-2 overflow-y-scroll thin-scrollbar"
        >
            <n-card title="全局配置">
                <n-list>
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
                                config.globalShortcut || '未设置'
                            }}</n-button>
                        </template>
                        <n-thing
                            title="全局快捷键"
                            description="按下哪个键触发窗口"
                        />
                    </n-list-item>
                </n-list>
            </n-card>
            <n-card title="AI 配置">
                <n-list>
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
                        <n-thing title="AI 模型" description="使用的 AI 模型" />
                    </n-list-item>
                </n-list>
            </n-card>
            <n-card title="关于">
                <n-list>
                    <n-list-item>
                        <n-thing title="版本" description="0.1.0" />
                    </n-list-item>
                    <n-list-item>
                        <n-thing title="作者" description="CKylinMC" />
                    </n-list-item>
                    <n-list-item>
                        <n-thing title="源代码" description="GitHub" />
                    </n-list-item>
                </n-list>
            </n-card>
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
    </div>
</template>
