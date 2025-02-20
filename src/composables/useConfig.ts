import { ref } from 'vue';
import { Store } from '@tauri-apps/plugin-store';
import { tryParse } from '@/libs/utils';
import type { CoreMessage } from 'ai';

export interface AIConfig {
    enabled: boolean;
    apiKey: string;
    endpoint: string;
    model: string;
    persistChatHistory: boolean;
    enableImage: boolean;
    imageAIEndpoint: string;
    imageApiKey:string;
    imageModel: string;
    enableWebsearch: boolean;
    tavilyApiKey: string;
    enableWebCrawl: boolean;
    jinaApiKey: string;
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
    chatHistory?: CoreMessage[];
    snippets: Snippet[];
}

export function useConfig() {
    const noSave = ref(false);
    const config = ref<Config>({
        globalShortcut: 'CommandOrControl+Shift+V',
        ai: {
            enabled: false,
            apiKey: '',
            endpoint: 'https://api.openai.com/v1',
            model: 'gpt-4o',
            persistChatHistory: false,
            enableImage: false,
            imageAIEndpoint: 'https://api.openai.com/v1',
            imageApiKey: '',
            imageModel: 'dall-e-3',
            enableWebsearch: false,
            tavilyApiKey: '',
            enableWebCrawl: false,
            jinaApiKey: '',
        },
        snippets: [],
        chatHistory: []
    });

    const loadConfig = async () => {
        noSave.value = true;
        try {
            const store = await Store.load('store.bin');
            config.value.globalShortcut =
                (await store.get('globalShortcut')) || 'CommandOrControl+Shift+V';
            config.value.ai = {
                enabled: !!(await store.get('ai.enabled')),
                apiKey: (await store.get('ai.apiKey')) || '',
                endpoint: (await store.get('ai.endpoint')) || 'https://api.openai.com/v1',
                model: (await store.get('ai.model')) || 'gpt-4o',
                persistChatHistory: !!(await store.get('ai.persistChatHistory')),
                enableImage: !!(await store.get('ai.enableImage')),
                imageAIEndpoint: (await store.get('ai.imageAIEndpoint')) || 'https://api.openai.com/v1',
                imageApiKey: (await store.get('ai.imageApiKey')) || '',
                imageModel: (await store.get('ai.imageModel')) || 'dall-e-3',
                enableWebsearch: !!(await store.get('ai.enableWebsearch')),
                tavilyApiKey: (await store.get('ai.tavilyApiKey')) || '',
                enableWebCrawl: !!(await store.get('ai.enableWebCrawl')),
                jinaApiKey: (await store.get('ai.jinaApiKey')) || '',
            };
            config.value.snippets = tryParse(await store.get('snippets') || "[]", [
                {
                    id: 'intro',
                    name: '翻译成中文',
                    system: '请辅助用户完成任务，不要输出任何其他多余内容',
                    prompt: '请将内容翻译成中文',
                }]);
            config.value.chatHistory = tryParse(await store.get('chatHistory') || "[]", []);
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
        await store.set('ai.persistChatHistory', config.value.ai.persistChatHistory);
        await store.set('ai.enableImage', config.value.ai.enableImage);
        await store.set('ai.imageAIEndpoint', config.value.ai.imageAIEndpoint);
        await store.set('ai.imageApiKey', config.value.ai.imageApiKey);
        await store.set('ai.imageModel', config.value.ai.imageModel);
        await store.set('ai.enableWebsearch', config.value.ai.enableWebsearch);
        await store.set('ai.tavilyApiKey', config.value.ai.tavilyApiKey);
        await store.set('ai.enableWebCrawl', config.value.ai.enableWebCrawl);
        await store.set('ai.jinaApiKey', config.value.ai.jinaApiKey);
        await store.set('snippets', JSON.stringify(Array.isArray(config.value.snippets) ? config.value.snippets : []));
        await store.set('chatHistory', JSON.stringify(Array.isArray(config.value.chatHistory) ? config.value.chatHistory : []));
        await store.save();
        await store.close();
    };

    const saveChatHistory = async (message: CoreMessage[]) => {
        if (noSave.value) return;
        const store = await Store.load('store.bin');
        await store.set('chatHistory', JSON.stringify(Array.isArray(message) ? message : []));
        await store.save();
        await store.close();
    }

    const getChatHistory = async () => {
        const store = await Store.load('store.bin');
        const chatHistory = tryParse(await store.get('chatHistory') || "[]", []);
        await store.close();
        return chatHistory;
    }

    return {
        config,
        noSave,
        loadConfig,
        saveConfig,
        saveChatHistory,
        getChatHistory
    };
}
