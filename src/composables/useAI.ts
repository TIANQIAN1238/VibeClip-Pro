import { ref, type Ref } from 'vue';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText } from 'ai';
import type { Config } from './useConfig';

export class StopToken{
    _stop = false;
    _fns: (()=>void)[] = [];
    stop(){
        if(this._stop) return;
        this._stop = true;
        for (const fn of this._fns) {
            fn();
        }
    }
    isStopped(){
        return this._stop;
    }
    onStop(fn: ()=>void){
        this._fns.push(fn);
    }
}

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

    const generateText = async (system: string, prompt: string, stopToken?: StopToken) => {
        generating.value = true;
        generatedContent.value = '';
        try {
            const ai = getAIInstance();
            const result = await streamText({
                model: ai.chatModel(config.value.ai.model),
                system,
                prompt,
            });
            stopToken?.onStop(()=>{
                result.consumeStream();
            });
            for await (const textPart of result.textStream) {
                generatedContent.value += textPart;
                if(stopToken?.isStopped()){
                    break;
                }
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
