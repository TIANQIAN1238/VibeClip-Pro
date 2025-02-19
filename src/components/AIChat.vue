<script setup lang="ts">
import {
    useAIChat,
    useAIImage,
    useAITools,
    useAIWebCrawler,
    useAIWebSearch,
} from '@/composables/useAI';
import type { Config } from '@/composables/useConfig';
import { computed, onMounted, ref } from 'vue';
import SolarPlainLineDuotone from '~icons/solar/plain-line-duotone';
import SolarStopLineDuotone from '~icons/solar/stop-line-duotone';
import SolarUserCircleLineDuotone from '~icons/solar/user-circle-line-duotone';
import SolarBoltCircleLineDuotone from '~icons/solar/bolt-circle-line-duotone';
import LineMdLoadingTwotoneLoop from '~icons/line-md/loading-twotone-loop';
import { marked } from 'marked';
import { asString } from '@/libs/utils';
import type { Tool } from 'ai';

const props = defineProps<{
    content: string;
    config: Config;
}>();

const mutableConfig = computed(() => props.config);

const container = ref<HTMLElement | undefined>();
const input = ref('');

const { messages, stop, generating, fetchAIResponse, appendToMessages } =
    useAIChat(mutableConfig);

const { createImageTool } = useAIImage(mutableConfig);

const { getCurrentDateTime } = useAITools();

const { webSearchTool } = useAIWebSearch(mutableConfig);

const { webCrawlTool } = useAIWebCrawler(mutableConfig);

function handleSubmit() {
    appendToMessages(input.value, 'user');
    input.value = '';
    const tools: { [key: string]: Tool } = {
        dateTime: getCurrentDateTime(),
    };
    if (props.config.ai.enableImage) {
        tools.createImage = createImageTool();
    }
    if (props.config.ai.enableWebsearch) {
        tools.webSearch = webSearchTool();
    }
    if(props.config.ai.enableWebCrawl) {
        tools.webCrawl = webCrawlTool();
    }
    fetchAIResponse(() => {
        container.value?.scrollTo({
            top: container.value.scrollHeight,
            behavior: 'smooth',
        });
    }, tools);
}

onMounted(() => {
    appendToMessages(
        `你的任务是分析用户的剪贴板数据。使用用户的指令和剪贴板内容回答问题。你可以利用Markdown格式进行回复，这样结果可以带有格式地展现在用户面前。\n剪贴板内容:\n${props.content}`,
        'system'
    );
    appendToMessages('你好，针对复制的内容，你有什么想要问的吗？', 'assistant');
});
</script>

<template>
    <div class="size-full flex flex-col">
        <div class="font-bold">基于剪贴板内容对话</div>
        <div
            ref="container"
            class="flex-1 flex flex-col gap-2 overflow-y-scroll thin-scrollbar my-2"
        >
            <template v-for="(message, index) in messages" :key="index">
                <template v-if="message.role === 'assistant'">
                    <div class="flex flex-row gap-1">
                        <div>
                            <SolarBoltCircleLineDuotone class="size-8" />
                        </div>
                        <div class="bg-blue-600 text-white p-2 rounded-lg">
                            <span
                                v-html="marked.parse(asString(message.content))"
                            ></span>
                            <LineMdLoadingTwotoneLoop
                                v-if="
                                    index === messages.length - 1 && generating
                                "
                                class="size-3 inline"
                            />
                        </div>
                    </div>
                </template>
                <template v-else-if="message.role === 'user'">
                    <div class="flex flex-row justify-end gap-1">
                        <div class="bg-blue-200 text-black p-2 rounded-lg">
                            {{ message.content }}
                        </div>
                        <div>
                            <SolarUserCircleLineDuotone class="size-8" />
                        </div>
                    </div>
                </template>
            </template>
        </div>
        <div class="h-10">
            <form class="flex flex-row gap-1" @submit="handleSubmit">
                <n-input
                    v-model:value="input"
                    placeholder="输入你的问题"
                    class="w-full"
                    :disabled="generating"
                />
                <n-button
                    v-if="!generating"
                    type="primary"
                    @click="handleSubmit"
                    :loading="generating"
                    attr-type="submit"
                >
                    <SolarPlainLineDuotone />
                </n-button>
                <n-button v-else-if="generating" type="error" @click="stop">
                    <SolarStopLineDuotone />
                </n-button>
            </form>
        </div>
    </div>
</template>
