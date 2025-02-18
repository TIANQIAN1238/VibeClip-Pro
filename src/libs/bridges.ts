import { invoke } from "@tauri-apps/api/core";

export async function getMousePosition() {
    return await invoke("get_mouse_position") as number[];
}

export async function inputText(text: string) {
    return await invoke("input_text", { text });
}

export async function simulatePaste(){
    return await invoke("simulate_paste");
}
