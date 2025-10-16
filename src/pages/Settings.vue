<script setup lang="ts">
import AppSidebar from "@/components/layout/AppSidebar.vue";
import { useSettingsStore } from "@/store/settings";
import { useHistoryStore } from "@/store/history";
import { useMessage } from "naive-ui";
import AppInfo from "@/AppInfo";

const settings = useSettingsStore();
const history = useHistoryStore();
const message = useMessage();

async function handleAutoLaunchChange(value: boolean) {
  await settings.toggleAutoLaunch(value);
  message.success(value ? "已开启开机自启" : "已关闭开机自启");
}

async function clearHistory() {
  await history.clearHistory();
  message.success("缓存已清理");
}

function resetAiSettings() {
  settings.apiKey.value = "";
  settings.apiBaseUrl.value = "https://api.openai.com";
  settings.model.value = "gpt-4o-mini";
  settings.temperature.value = 0.3;
  message.success("AI 配置已重置");
}
</script>

<template>
  <div class="settings-page">
    <AppSidebar />
    <section class="main">
      <header class="page-header">
        <div>
          <h1>设置</h1>
          <p>自定义主题、快捷键与 AI 服务连接</p>
        </div>
      </header>

      <div class="settings-grid">
        <n-card title="主题与显示" size="small" embedded>
          <n-radio-group v-model:value="settings.themeMode" name="theme">
            <div class="radio-grid">
              <n-radio value="light">浅色</n-radio>
              <n-radio value="dark">深色</n-radio>
              <n-radio value="system">跟随系统</n-radio>
            </div>
          </n-radio-group>
          <div class="field-row">
            <label>内容行高</label>
            <n-slider
              v-model:value="settings.lineHeight"
              :step="0.1"
              :min="1.2"
              :max="2"
              style="width: 200px;"
            />
            <span>{{ settings.lineHeight.toFixed(1) }}</span>
          </div>
          <div class="field-row">
            <label>强调颜色</label>
            <n-color-picker v-model:value="settings.accentColor" size="small" />
          </div>
          <div class="field-row">
            <label>全局快捷键</label>
            <n-input v-model:value="settings.globalShortcut" placeholder="例如 CmdOrControl+Shift+V" />
          </div>
        </n-card>

        <n-card title="AI 服务" size="small" embedded>
          <n-form label-placement="top" :model="settings">
            <n-form-item label="Base URL">
              <n-input v-model:value="settings.apiBaseUrl" placeholder="https://api.openai.com" />
            </n-form-item>
            <n-form-item label="API Key">
              <n-input v-model:value="settings.apiKey" type="password" show-password-on="click" placeholder="sk-" />
            </n-form-item>
            <div class="field-row">
              <n-form-item label="模型">
                <n-input v-model:value="settings.model" placeholder="gpt-4o-mini" />
              </n-form-item>
              <n-form-item label="温度">
                <n-slider
                  v-model:value="settings.temperature"
                  :step="0.1"
                  :min="0"
                  :max="1"
                  style="width: 200px;"
                />
              </n-form-item>
            </div>
          </n-form>
          <n-button quaternary size="tiny" @click="resetAiSettings">恢复默认</n-button>
        </n-card>

        <n-card title="系统" size="small" embedded>
          <div class="field-row">
            <label>开机自启</label>
            <n-switch :value="settings.autoLaunch" @update:value="handleAutoLaunchChange" />
          </div>
          <div class="field-row">
            <label>离线模式</label>
            <n-switch v-model:value="settings.offlineMode" />
          </div>
          <n-divider />
          <div class="field-row">
            <div>
              <strong>缓存历史</strong>
              <p class="muted">当前共有 {{ history.items.length }} 条历史记录</p>
            </div>
            <n-button tertiary type="error" size="small" @click="clearHistory">清理</n-button>
          </div>
        </n-card>
      </div>

      <footer class="about">
        <h3>关于 VibeClip Pro</h3>
        <ul>
          <li>版本 {{ AppInfo.version }}</li>
          <li>默认全局快捷键：{{ settings.globalShortcut }}</li>
          <li>数据保存在应用数据目录中的 SQLite 数据库</li>
          <li>导出 JSON 格式可用于备份和跨设备迁移</li>
        </ul>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.settings-page {
  display: flex;
  height: 100%;
}

.main {
  flex: 1;
  padding: 28px 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow-y: auto;
}

.page-header h1 {
  margin: 0;
  font-size: 26px;
}

.page-header p {
  margin: 6px 0 0;
  color: var(--vibe-text-muted);
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 18px;
}

.radio-grid {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.field-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  color: var(--vibe-text-primary);
}

.field-row label {
  min-width: 80px;
  font-weight: 600;
}

.muted {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--vibe-text-muted);
}

.about {
  padding: 18px 24px;
  background: rgba(255, 255, 255, 0.45);
  border-radius: var(--vibe-radius-lg);
  border: 1px solid var(--vibe-border-soft);
}

.about h3 {
  margin: 0 0 8px;
}

.about ul {
  margin: 0;
  padding-left: 18px;
  color: var(--vibe-text-muted);
}
</style>
