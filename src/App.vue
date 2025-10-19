<script setup lang="ts">
import { RouterView } from "vue-router";
import { computed, onMounted } from "vue";
import { darkTheme, dateZhCN, zhCN, enUS, dateEnUS } from "naive-ui";
import { useSettingsStore } from "./store/settings";
import AppEventBridge from "@/components/system/AppEventBridge.vue";
import AppWindowBar from "@/components/layout/AppWindowBar.vue";
import AppOnboarding from "@/components/onboarding/AppOnboarding.vue";
import { scheduleWarmRoutes } from "@/utils/routePrefetch";

const settings = useSettingsStore();

onMounted(() => {
  void settings.bootstrap();
  void scheduleWarmRoutes();
});

const theme = computed(() => {
  if (settings.themeMode === "system") {
    return settings.isDarkPreferred ? darkTheme : null;
  }
  return settings.themeMode === "dark" ? darkTheme : null;
});

const themeOverrides = computed(() => settings.naiveThemeOverrides);

const naiveLocale = computed(() =>
  settings.uiLanguage === "en-US" ? enUS : zhCN
);

const naiveDateLocale = computed(() =>
  settings.uiLanguage === "en-US" ? dateEnUS : dateZhCN
);
</script>

<template>
  <n-config-provider
    :locale="naiveLocale"
    :date-locale="naiveDateLocale"
    :theme="theme"
    :theme-overrides="themeOverrides"
  >
    <n-loading-bar-provider>
      <n-dialog-provider>
        <n-message-provider placement="bottom-right" :duration="2500">
          <AppEventBridge>
            <div
              class="modern-app-container"
              :class="[settings.themeClass, settings.themePresetClass]"
            >
              <AppWindowBar class="modern-titlebar" />
              <div class="modern-app-content">
                <RouterView v-slot="{ Component }">
                  <Transition name="modern-fade" mode="out-in">
                    <component :is="Component" class="modern-route-view" />
                  </Transition>
                </RouterView>
              </div>
              <AppOnboarding
                :visible="settings.onboardingVisible"
                @complete="settings.completeOnboarding()"
                @skip="settings.skipOnboarding()"
                @remind="settings.remindOnboardingLater()"
              />
            </div>
          </AppEventBridge>
        </n-message-provider>
      </n-dialog-provider>
    </n-loading-bar-provider>
  </n-config-provider>
</template>
