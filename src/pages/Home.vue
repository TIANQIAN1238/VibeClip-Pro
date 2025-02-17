<script setup lang="ts">
import { webviewWindow } from '@tauri-apps/api';
import { getMousePosition } from '../libs/bridges';
import { enable, isEnabled, disable } from '@tauri-apps/plugin-autostart';
import { onBeforeUnmount, onMounted, ref, unref, watch } from 'vue';
import KeySelector from '@/components/KeySelector.vue';
import { Store } from '@tauri-apps/plugin-store';
import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut';

const modalShortcutSetter = ref(false);

const webview = new webviewWindow.WebviewWindow('context', {
    url: '/panel',
    width: 400,
    height: 456,
});

const open = () => {
    console.log('open');
    getMousePosition()
        .then(position => {
            console.log('position', position);
            if (position.length === 2) {
                webview.setPosition({
                    x: position[0],
                    y: position[1],
                    type: 'Physical',
                    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
                } as any);
            } else {
                webview.center();
            }
        })
        .catch(() => {
            webview.center();
        })
        .finally(() => {
            webview.show();
            webview.setAlwaysOnTop(true);
            webview.setFocus();
        });
};

const toggleAutoStart = (checked: boolean) => {
    console.log('autostart ', checked);
    if (checked) {
        enable().then(() => {
            refreshAutoStart();
        });
    } else {
        disable().then(() => {
            refreshAutoStart();
        });
    }
};

const autoStart = ref(false);

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
    noSave.value = true;
    try {
        const store = await Store.load('store.bin');
        if (await store.has('globalShortcut')) {
            form.value.globalShortcut =
                (await store.get('globalShortcut')) ||
                'CommandOrControl+Shift+C';
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
        if(await store.has('ai.model')) {
            form.value.ai.model = (await store.get('ai.model')) || 'gpt-4o';
        } else {
            form.value.ai.model = 'gpt-4o';
        }
        await store.close();
    } finally {
        noSave.value = false;
    }
};

const noSave = ref(false);

const saveConfig = async () => {
    if (noSave.value) return;
    await new Promise(resolve => setTimeout(resolve, 0));
    const store = await Store.load('store.bin');
    await store.set('globalShortcut', form.value.globalShortcut);
    await store.set('ai.enabled', form.value.ai.enabled);
    await store.set('ai.apiKey', form.value.ai.apiKey);
    await store.set('ai.endpoint', form.value.ai.endpoint);
    await store.set('ai.model', form.value.ai.model);
    await store.save();
    await store.close();
};

function handleShortcutChange(shortcut: string) {
    form.value.globalShortcut = shortcut;
}

watch(
    form,
    () => {
        if (noSave.value) return;
        // console.log('triggered', unref(form.value));
        saveConfig();
        mountKeys();
    },
    { deep: true }
);

function openShortcutSetter() {
    modalShortcutSetter.value = true;
}

function closeShortcutSetter() {
    modalShortcutSetter.value = false;
}

const refreshAutoStart = () => {
    isEnabled().then(enabled => {
        autoStart.value = enabled;
    });
};

async function mountKeys() {
    console.log('unregister');
    await unregisterAll();
    console.log('load');

    if (form.value.globalShortcut) {
        console.log('register', form.value.globalShortcut);
        return register(form.value.globalShortcut, open);
    } else {
        console.log('no register');
    }
}

onMounted(() => {
    loadConfig();
    refreshAutoStart();
});

onBeforeUnmount(() => {
    saveConfig();
    unregisterAll();
});
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
                                form.globalShortcut || '未设置'
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
                                v-model:checked="form.ai.enabled"
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
                                    v-model:value="form.ai.apiKey"
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
                                    v-model:value="form.ai.endpoint"
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
                                    v-model:value="form.ai.model"
                                    placeholder="gpt-4o"
                                />
                            </div>
                        </template>
                        <n-thing
                            title="AI 模型"
                            description="使用的 AI 模型"
                        />
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
                    v-model:shortcut="form.globalShortcut"
                />
                <template #footer>
                    <n-button @click="closeShortcutSetter">确定</n-button>
                </template>
            </n-card>
        </n-modal>
    </div>
</template>
