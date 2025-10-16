<script setup lang="ts">
import { RouterView } from "vue-router";
import { computed, onMounted } from "vue";
import { darkTheme, dateZhCN, zhCN, lightTheme } from "naive-ui";
import { useSettingsStore } from "./store/settings";

const settings = useSettingsStore();

onMounted(() => {
  settings.bootstrap();
});

const theme = computed(() => {
  if (settings.themeMode === "system") {
    return settings.isDarkPreferred ? darkTheme : null;
  }
  return settings.themeMode === "dark" ? darkTheme : null;
});

const themeOverrides = computed(() => settings.naiveThemeOverrides);
</script>

<template>
  <n-config-provider
    :locale="zhCN"
    :date-locale="dateZhCN"
    :theme="theme"
    :theme-overrides="themeOverrides"
  >
    <n-loading-bar-provider>
      <n-dialog-provider>
        <n-message-provider placement="bottom-right" :duration="2500">
          <div class="app-shell" :class="settings.themeClass">
            <RouterView v-slot="{ Component }">
              <Transition name="fade" mode="out-in">
                <component :is="Component" />
              </Transition>
            </RouterView>
          </div>
        </n-message-provider>
      </n-dialog-provider>
    </n-loading-bar-provider>
  </n-config-provider>
</template>
