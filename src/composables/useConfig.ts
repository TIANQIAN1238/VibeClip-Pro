import { ref } from 'vue';
import { Store } from '@tauri-apps/plugin-store';
import { tryParse } from '@/libs/utils';

export interface AIConfig {
    enabled: boolean;
    apiKey: string;
    endpoint: string;
    model: string;
}

export interface Snippet {
    id: string;
    name: string;
    system: string;
    prompt: string;
}

export interface Config {
    globalShortcut: string;
    ai: AIConfig;
    snippets: Snippet[];
}

export function useConfig() {
    const noSave = ref(false);
    const config = ref<Config>({
        globalShortcut: 'CommandOrControl+Shift+C',
        ai: {
            enabled: false,
            apiKey: '',
            endpoint: 'https://api.openai.com/v1',
            model: 'gpt-4o',
        },
        snippets: []
    });

    const loadConfig = async () => {
        noSave.value = true;
        try {
            const store = await Store.load('store.bin');
            config.value.globalShortcut =
                (await store.get('globalShortcut')) || 'CommandOrControl+Shift+C';
            config.value.ai = {
                enabled: !!(await store.get('ai.enabled')),
                apiKey: (await store.get('ai.apiKey')) || '',
                endpoint: (await store.get('ai.endpoint')) || 'https://api.openai.com/v1',
                model: (await store.get('ai.model')) || 'gpt-4o',
            };
            config.value.snippets = tryParse(await store.get('snippets') || "[]", [
                {
                    id: 'intro',
                    name: '翻译成中文',
                    system: '请辅助用户完成任务，不要输出任何其他多余内容',
                    prompt: '请将内容翻译成中文',
                }]);
            await store.close();
        } finally {
            noSave.value = false;
        }
    };

    const saveConfig = async () => {
        if (noSave.value) return;
        const store = await Store.load('store.bin');
        await store.set('globalShortcut', config.value.globalShortcut);
        await store.set('ai.enabled', config.value.ai.enabled);
        await store.set('ai.apiKey', config.value.ai.apiKey);
        await store.set('ai.endpoint', config.value.ai.endpoint);
        await store.set('ai.model', config.value.ai.model);
        await store.set('snippets', JSON.stringify(Array.isArray(config.value.snippets) ? config.value.snippets : []));
        await store.save();
        await store.close();
    };

    return {
        config,
        noSave,
        loadConfig,
        saveConfig,
    };
}
