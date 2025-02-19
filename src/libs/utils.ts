// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function tryParse(str: string, fallback: any = null) {
    try {
        return JSON.parse(str);
    } catch (e) {
        return fallback;
    }
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function asString(obj: any): string {
    return obj as unknown as string;
}
