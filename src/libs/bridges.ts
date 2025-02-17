import { invoke } from "@tauri-apps/api/core";

export async function getMousePosition(){
    return await invoke("get_mouse_position") as number[];
}
