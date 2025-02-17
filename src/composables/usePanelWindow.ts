import { ref } from 'vue';
import { window as appWindow } from '@tauri-apps/api';
import { useConfig } from './useConfig';
import type { useClipboard } from './useClipboard';

export type PanelPage = 'index' | 'calc' | 'edit' | 'tojson' | 'askai' | 'aicreate';

export function usePanelWindow(clipboard: ReturnType<typeof useClipboard>) {
    const page = ref<PanelPage>('index');
    const showPreview = ref(true);
    const mouseInRange = ref(false);

    const gotoPage = (targetPage: PanelPage, onPageChange?: (page: PanelPage) => void) => {
        page.value = targetPage;
        showPreview.value = targetPage === 'index' || 
            ['tojson', 'askai', 'aicreate'].includes(targetPage);
        onPageChange?.(targetPage);
    };

    const setupWindowListeners = async () => {
        const { loadConfig } = useConfig();
        return await appWindow.getCurrentWindow().listen('tauri://focus', async () => {
            showPreview.value = true;
            page.value = 'index';
            await Promise.all([
                loadConfig(),
                clipboard.refresh()
            ]);
        });
    };

    return {
        page,
        showPreview,
        mouseInRange,
        gotoPage,
        setupWindowListeners
    };
}
