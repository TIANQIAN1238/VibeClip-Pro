<script setup lang="ts">
import { webviewWindow } from '@tauri-apps/api';
import { useRoute } from 'vue-router';
import { getMousePosition } from '../libs/bridges';

const route = useRoute();

const webview = new webviewWindow.WebviewWindow('context', {
    url: '/panel',
    width: 400,
    height: 400,
});

const open = () => {
    getMousePosition()
        .then(position => {
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
const close = () => {
    webview.hide();
};
</script>

<template>
    <div class="text-blue-500">
        home
        {{ route.path }}
        <button @click="open">Panel?</button>
        <button @click="close">Close</button>
    </div>
</template>
