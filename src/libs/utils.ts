// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function tryParse(str: string, fallback: any = null) {
    try {
        return JSON.parse(str);
    } catch (e) {
        return fallback;
    }
}