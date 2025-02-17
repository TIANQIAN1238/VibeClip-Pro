<script setup lang="ts">
// @ts-ignore
import SolarTextLinear from '~icons/solar/text-linear';
</script>

<template>
    <div class="flex flex-col size-full">
        <div class="flex-1 bg-black/20 p-2">
            <div class="text-gray-400">剪贴板</div>
            <div class="relative flex flex-row">
                <SolarTextLinear class="mr-1 mt-1 w-5" />
                <div class="bg-gray-800/30 rounded line-clamp-2 flex-1 p-1">
                    [复制的文字复制的文字复制的文字复制的文字复制的文字复制的文字复制的文字复制的文字复制的文字复制的文字复制的文字复制的文字复制的文字复制的文字复制的文字复制的文字复制的文字复制的文字复制的文字复制的文字复制的文字复制的文字复制的文字复制的文字复制的文字复制的文字复制的文字复制的文字复制的文字复制的文字复制的文字复制的文字]
                </div>
            </div>
        </div>
        <div class="flex-1 p-2 flex flex-col justify-center hover:cursor-pointer hover:bg-gray-500/30">
            <div>编辑</div>
            <div class="text-gray-500">直接修改内容</div>
        </div>
        <div class="flex-1 p-2 flex flex-col justify-center hover:cursor-pointer hover:bg-gray-500/30">
            <div>转为纯文本</div>
            <div class="text-gray-500">重新复制为纯文本</div>
        </div>
        <div class="flex-1 p-2 flex flex-col justify-center hover:cursor-pointer hover:bg-gray-500/30">
            <div>转为JSON</div>
            <div class="text-gray-500">使用AI将内容转为JSON</div>
        </div>
        <div class="flex-1 p-2 flex flex-col justify-center hover:cursor-pointer hover:bg-gray-500/30">
            <div>询问AI...</div>
            <div class="text-gray-500">让AI帮忙处理</div>
        </div>
    </div>
</template>

<style>
html,
body {
    background: transparent !important;
    height: 400px;
    width: 400px;
    overflow: hidden;
}
</style>
