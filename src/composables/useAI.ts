import { ref, type Ref } from 'vue';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { CoreMessage, streamText } from 'ai';
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

export function useAIChat(config: Ref<Config>) {
    const generating = ref(false);
    const messages = ref<CoreMessage[]>([]);
    const stopToken = new StopToken;

    const stop = () => {
        stopToken.stop();
    }

    const getAIInstance = () => {
        return createOpenAICompatible({
            name: 'OpenAICompatiable',
            apiKey: config.value.ai.apiKey,
            baseURL: config.value.ai.endpoint,
        });
    };

    const appendToMessages = (message: string, role:'user'|'assistant'|'system'='user') => {
        messages.value.push({
            role: role,
            content: message,
        });
    }

    const fetchAIResponse = async (onChunk?: (textPart:string) => void,stopToken?:StopToken) => {
        generating.value = true;
        if (stopToken) {
            stopToken._stop = false;
            stopToken._fns = [];
        }
        try {
            const ai = getAIInstance();
            const result = await streamText({
                model: ai.chatModel(config.value.ai.model),
                messages: messages.value,
            });
            let stop = false;
            stopToken?.onStop(()=>{
                stop = true;
                result.consumeStream();
            });
            messages.value.push({
                role: 'assistant',
                content: '',
            })
            for await (const textPart of result.textStream) {
                messages.value[messages.value.length - 1].content += textPart;
                onChunk?.(textPart);
                if(stopToken?.isStopped() || stop){
                    break;
                }
            }
        } finally {
            generating.value = false;
        }
    }

    return {
        generating,
        messages,
        appendToMessages,
        fetchAIResponse,
        stop,
    };
}
