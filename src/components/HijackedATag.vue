<script setup lang="ts">
import { openUrl } from '@tauri-apps/plugin-opener';

const props = defineProps<{
    asExternalLink?: boolean;
    asTemplate?: boolean;
    noPrevent?: boolean;
    className?: string;
    html?: string|Promise<string>;
}>();
const emit = defineEmits(['click']);

function handleClick(event: MouseEvent) {
    const anchor = (event.target as HTMLElement | null)?.closest('a');
    if (anchor) {
        props.noPrevent || event.preventDefault();
        emit('click', anchor.href, event);
        if (props.asExternalLink) {
            openUrl(anchor.href);
        }
    }
}
</script>

<template>
    <span
        v-if="asTemplate"
        @click="handleClick"
        v-html="html"
        :class="className"
    ></span>
    <span v-else @click="handleClick">
        <slot></slot>
    </span>
</template>
