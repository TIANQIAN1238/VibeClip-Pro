import { invoke } from "@tauri-apps/api/core";

export async function inputText(text: string) {
    return await invoke("input_text", { text });
}

export async function simulatePaste(){
    return await invoke("simulate_paste");
}

export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];
export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;

export function getStoreKey(key: string, fallback: JsonValue): Promise<JsonValue> {
    return invoke("get_key_from_store", { key, fallback });
}

export function setStoreKey(key: string, value: JsonValue): Promise<void> {
    return invoke("set_key_to_store", { key, value });
}
