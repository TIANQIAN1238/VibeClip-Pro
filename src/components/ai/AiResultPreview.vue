<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useMessage } from "naive-ui";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useHistoryStore } from "@/store/history";
import { ClipKind } from "@/types/history";
import { useLocale } from "@/composables/useLocale";

interface Props {
  show: boolean;
  result: string;
  loading?: boolean;
}

interface Emits {
  (e: "update:show", value: boolean): void;
  (e: "regenerate"): void;
  (e: "copy"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const history = useHistoryStore();
const message = useMessage();
const { t } = useLocale();

const editedResult = ref("");
const copying = ref(false);

watch(() => props.result, (newResult) => {
  editedResult.value = newResult;
}, { immediate: true });

const charCount = computed(() => editedResult.value.length);
const wordCount = computed(() => editedResult.value.split(/\s+/).filter(w => w.length > 0).length);

function close() {
  emit("update:show", false);
}

function handleRegenerate() {
  emit("regenerate");
}

async function handleCopy() {
  if (!editedResult.value.trim()) {
    message.warning(t("aiResultPreview.empty", "内容为空"));
    return;
  }

  copying.value = true;
  try {
    await history.markSelfCapture({
      kind: ClipKind.Text,
      content: editedResult.value,
    });
    await writeText(editedResult.value);
    message.success(t("aiResultPreview.copied", "已复制到剪贴板"));
    emit("copy");
    close();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "复制失败";
    message.error(errorMsg);
  } finally {
    copying.value = false;
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    close();
  } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    handleCopy();
  }
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    :title="t('aiResultPreview.title', 'AI 结果预览')"
    class="ai-result-preview-modal"
    :style="{ maxWidth: '680px', width: '90%' }"
    @update:show="emit('update:show', $event)"
    @keydown="handleKeydown"
  >
    <template #header-extra>
      <div class="result-stats">
        <span class="stat-item">{{ charCount }} {{ t("aiResultPreview.chars", "字符") }}</span>
        <span class="stat-item">{{ wordCount }} {{ t("aiResultPreview.words", "词") }}</span>
      </div>
    </template>

    <div v-if="loading" class="preview-loading">
      <n-spin size="large" />
      <p>{{ t("aiResultPreview.generating", "AI 正在生成结果...") }}</p>
    </div>

    <div v-else class="preview-content">
      <n-input
        v-model:value="editedResult"
        type="textarea"
        :autosize="{ minRows: 8, maxRows: 20 }"
        :placeholder="t('aiResultPreview.placeholder', '在此编辑 AI 结果...')"
        class="result-textarea"
      />
      
      <p class="hint">
        {{ t("aiResultPreview.hint", "可以编辑结果后再复制到剪贴板") }}
      </p>
    </div>

    <template #footer>
      <div class="modal-footer">
        <n-button size="small" @click="close">
          {{ t("aiResultPreview.cancel", "取消") }}
        </n-button>
        <n-button 
          size="small" 
          secondary 
          :loading="props.loading"
          @click="handleRegenerate"
        >
          {{ t("aiResultPreview.regenerate", "重新生成") }}
        </n-button>
        <n-button 
          size="small" 
          type="primary" 
          :loading="copying"
          :disabled="!editedResult.trim()"
          @click="handleCopy"
        >
          {{ t("aiResultPreview.copyToClipboard", "复制到剪贴板") }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped>
.ai-result-preview-modal :deep(.n-card) {
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(18, 37, 68, 0.32);
}

.result-stats {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--vibe-text-muted);
}

.stat-item {
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--vibe-control-bg);
}

.preview-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 48px 24px;
}

.preview-loading p {
  margin: 0;
  color: var(--vibe-text-muted);
  font-size: 14px;
}

.preview-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.result-textarea :deep(textarea) {
  font-family: inherit;
  line-height: 1.6;
}

.hint {
  margin: 0;
  font-size: 12px;
  color: var(--vibe-text-muted);
  text-align: center;
}

.modal-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

@media (prefers-reduced-motion: reduce) {
  .ai-result-preview-modal :deep(.n-card) {
    transition-duration: 0.01ms !important;
  }
}
</style>

