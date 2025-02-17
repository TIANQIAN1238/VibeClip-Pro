import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut';

export function useShortcut() {
    const mountShortcut = async (shortcut: string, callback: () => void) => {
        await unregisterAll();
        if (shortcut) {
            return register(shortcut, callback);
        }
    };

    return {
        mountShortcut,
        unregisterAll,
    };
}
