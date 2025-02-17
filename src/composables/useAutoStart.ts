import { ref } from 'vue';
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';

export function useAutoStart() {
    const autoStart = ref(false);

    const refreshAutoStart = async () => {
        autoStart.value = await isEnabled();
    };

    const toggleAutoStart = async (checked: boolean) => {
        if (checked) {
            await enable();
        } else {
            await disable();
        }
        await refreshAutoStart();
    };

    return {
        autoStart,
        toggleAutoStart,
        refreshAutoStart,
    };
}
