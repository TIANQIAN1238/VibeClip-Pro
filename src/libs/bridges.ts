import { invoke } from "@tauri-apps/api/core";

export async function inputText(text: string) {
    return await invoke("input_text", { text });
}

export async function simulatePaste(){
    return await invoke("simulate_paste");
}
