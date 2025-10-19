import { onMounted, onUnmounted } from "vue";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useHistoryStore } from "@/store/history";

/**
 * 监听窗口间同步事件
 * 当其他窗口修改了剪贴板历史时，自动刷新当前窗口的数据
 */
export function useWindowSync() {
    const history = useHistoryStore();
    let unlisteners: UnlistenFn[] = [];

    onMounted(async () => {
        // 监听剪贴板项插入事件
        const unlistenInsert = await listen("clip-inserted", async (event) => {
            console.log("[WindowSync] Received clip-inserted event:", event.payload);
            // 刷新历史记录
            await history.refresh();
        });

        // 监听剪贴板项更新事件
        const unlistenUpdate = await listen("clip-updated", async (event) => {
            console.log("[WindowSync] Received clip-updated event:", event.payload);
            // 刷新历史记录
            await history.refresh();
        });

        // 监听剪贴板项删除事件
        const unlistenRemove = await listen("clip-removed", async (event) => {
            console.log("[WindowSync] Received clip-removed event:", event.payload);
            // 刷新历史记录
            await history.refresh();
        });

        unlisteners = [unlistenInsert, unlistenUpdate, unlistenRemove];
    });

    onUnmounted(() => {
        // 清理事件监听器
        unlisteners.forEach((unlisten) => unlisten());
    });
}

