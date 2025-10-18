import { ref } from "vue";
import { getVersion } from "@tauri-apps/api/app";

const fallbackVersion = "v2.2.1";
const resolvedVersion = ref(fallbackVersion);

if (typeof window !== "undefined") {
  getVersion()
    .then(value => {
      if (value) {
        resolvedVersion.value = `v${value}`;
      }
    })
    .catch(error => {
      console.warn("Failed to resolve app version", error);
    });
}

export const AppInfo = {
  version: resolvedVersion,
};

export default AppInfo;
