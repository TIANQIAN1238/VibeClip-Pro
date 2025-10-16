import { defineStore } from "pinia";
import { computed, reactive, ref, toRefs, watch } from "vue";
import type { GlobalThemeOverrides } from "naive-ui";
import { invoke } from "@tauri-apps/api/core";
import { disable as disableAutoLaunch, enable as enableAutoLaunch, isEnabled as isAutoLaunchEnabled } from "@tauri-apps/plugin-autostart";

const STORAGE_KEY = "vibeclip.settings";

interface PersistedSettings {
  themeMode: "light" | "dark" | "system";
  accentColor: string;
  lineHeight: number;
  globalShortcut: string;
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  offlineMode: boolean;
  autoLaunch: boolean;
  preferredLanguage: string;
}

const DEFAULT_SETTINGS: PersistedSettings = {
  themeMode: "light",
  accentColor: "#5161ff",
  lineHeight: 1.5,
  globalShortcut: "CmdOrControl+Shift+V",
  apiBaseUrl: "https://api.openai.com",
  apiKey: "",
  model: "gpt-4o-mini",
  temperature: 0.3,
  offlineMode: false,
  autoLaunch: false,
  preferredLanguage: "zh-CN",
};

function blend(color: string, target: string, ratio: number) {
  const hex = color.replace("#", "");
  const targetHex = target.replace("#", "");
  const r = Math.round(
    parseInt(hex.substring(0, 2), 16) * (1 - ratio) +
      parseInt(targetHex.substring(0, 2), 16) * ratio
  );
  const g = Math.round(
    parseInt(hex.substring(2, 4), 16) * (1 - ratio) +
      parseInt(targetHex.substring(2, 4), 16) * ratio
  );
  const b = Math.round(
    parseInt(hex.substring(4, 6), 16) * (1 - ratio) +
      parseInt(targetHex.substring(4, 6), 16) * ratio
  );
  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export const useSettingsStore = defineStore("settings", () => {
  const state = reactive<PersistedSettings>({ ...DEFAULT_SETTINGS });
  const initialized = ref(false);
  const isDarkPreferred = ref(false);
  let persistTimer: number | null = null;
  const stateRefs = toRefs(state);

  const themeClass = computed(() =>
    stateRefs.themeMode.value === "dark" ||
    (stateRefs.themeMode.value === "system" && isDarkPreferred.value)
      ? "dark"
      : ""
  );

  const naiveThemeOverrides = computed<GlobalThemeOverrides>(() => {
    const accent = stateRefs.accentColor.value || DEFAULT_SETTINGS.accentColor;
    const hover = blend(accent, "#ffffff", 0.2);
    const pressed = blend(accent, "#000000", 0.18);
    return {
      common: {
        primaryColor: accent,
        primaryColorHover: hover,
        primaryColorPressed: pressed,
        borderRadius: "14px",
        fontFamily: "var(--vibe-font-sans)",
      },
      Button: {
        borderRadius: "var(--vibe-radius-md)",
        colorHover: hover,
        colorPressed: pressed,
      },
      Card: {
        borderRadius: "var(--vibe-radius-lg)",
        paddingSmall: "18px",
        boxShadow: "var(--vibe-shadow-soft)",
      },
      Input: {
        borderRadius: "var(--vibe-radius-md)",
      },
      Select: {
        borderRadius: "var(--vibe-radius-md)",
      },
      Switch: {
        railBorderRadius: "999px",
      },
    };
  });

  function applyThemeClass() {
    document.documentElement.classList.toggle(
      "dark",
      themeClass.value === "dark"
    );
  }

  function schedulePersist() {
    if (!initialized.value) return;
    if (persistTimer) {
      window.clearTimeout(persistTimer);
    }
    persistTimer = window.setTimeout(async () => {
      persistTimer = null;
      try {
        await invoke("set_value_to_store", {
          key: STORAGE_KEY,
          value: { ...state },
        });
      } catch (error) {
        console.warn("Failed to persist settings", error);
      }
    }, 250);
  }

  async function loadPersisted() {
    try {
      const payload = await invoke<PersistedSettings>(
        "get_value_from_store",
        {
          key: STORAGE_KEY,
          fallback: { ...DEFAULT_SETTINGS },
        }
      );
      Object.assign(state, { ...DEFAULT_SETTINGS, ...payload });
    } catch (error) {
      Object.assign(state, { ...DEFAULT_SETTINGS });
      console.warn("Failed to load settings, falling back to defaults", error);
    }
  }

  function listenSystemTheme() {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      isDarkPreferred.value = media.matches;
      applyThemeClass();
    };
    update();
    media.addEventListener("change", update);
  }

  watch(
    () => [stateRefs.themeMode.value, stateRefs.accentColor.value],
    () => {
      applyThemeClass();
      schedulePersist();
    },
    { deep: true }
  );

  watch(
    () => [
      stateRefs.lineHeight.value,
      stateRefs.globalShortcut.value,
      stateRefs.apiBaseUrl.value,
      stateRefs.apiKey.value,
      stateRefs.model.value,
      stateRefs.temperature.value,
      stateRefs.preferredLanguage.value,
      stateRefs.autoLaunch.value,
    ],
    () => schedulePersist(),
    { deep: true }
  );

  watch(
    () => stateRefs.offlineMode.value,
    async value => {
      schedulePersist();
      try {
        await invoke("set_offline", { offline: value });
      } catch (error) {
        console.warn("Failed to toggle offline mode", error);
      }
    }
  );

  watch(
    () => stateRefs.globalShortcut.value,
    async shortcut => {
      if (!initialized.value) return;
      try {
        await invoke("register_history_shortcut", { shortcut });
      } catch (error) {
        console.warn("Failed to update shortcut", error);
      }
    }
  );

  async function bootstrap() {
    if (initialized.value) return;
    listenSystemTheme();
    await loadPersisted();
    applyThemeClass();
    try {
      const status = await invoke<{ offline: boolean; listening: boolean }>(
        "get_app_status"
      );
      stateRefs.offlineMode.value = status.offline;
    } catch (error) {
      console.warn("Failed to sync app status", error);
    }
    try {
      stateRefs.autoLaunch.value = await isAutoLaunchEnabled();
    } catch (error) {
      console.warn("Auto launch status unavailable", error);
    }
    initialized.value = true;
  }

  function setOfflineLocal(value: boolean) {
    stateRefs.offlineMode.value = value;
  }

  async function toggleAutoLaunch(value: boolean) {
    try {
      if (value) {
        await enableAutoLaunch();
      } else {
        await disableAutoLaunch();
      }
      stateRefs.autoLaunch.value = value;
      schedulePersist();
    } catch (error) {
      console.warn("Unable to toggle auto launch", error);
    }
  }

  return {
    ...stateRefs,
    themeMode: stateRefs.themeMode,
    themeClass,
    naiveThemeOverrides,
    isDarkPreferred,
    bootstrap,
    schedulePersist,
    setOfflineLocal,
    toggleAutoLaunch,
  };
});
