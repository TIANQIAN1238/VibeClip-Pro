import { ref, Ref } from 'vue';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText } from 'ai';
import type { Config } from './useConfig';

export function useAI(config: Ref<Config>) {
    const generating = ref(false);
    const generatedContent = ref<string>('');
    const userPrompt = ref<string>('');

    const getAIInstance = () => {
        return createOpenAICompatible({
            name: 'OpenAICompatiable',
            apiKey: config.value.ai.apiKey,
            baseURL: config.value.ai.endpoint,
        });
    };

    const generateText = async (system: string, prompt: string) => {
        generating.value = true;
        generatedContent.value = '';
        try {
            const ai = getAIInstance();
            const result = await streamText({
                model: ai.chatModel(config.value.ai.model),
                system,
                prompt,
            });
            for await (const textPart of result.textStream) {
                generatedContent.value += textPart;
            }
        } finally {
            generating.value = false;
        }
    };

    return {
        generating,
        generatedContent,
        userPrompt,
        generateText,
    };
}
