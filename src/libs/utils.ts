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

export function bytesToSize(bytes: number) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Number.parseFloat((bytes / 1024 ** i).toFixed(2))} ${sizes[i]}`;
}

export function fetchUrls(str: string) {
    if (!str || str.length > 1000 || str.length < 3) return [];

    const urlPattern = /https?:\/\/[^\s/$.?#].[^\s]*/gi;
    const commonSuffixes = [
        '.com', '.org', '.net', '.int', '.edu', '.gov', '.cn', '.uk', '.co',
        '.de', '.jp', '.fr', '.au', '.us', '.ru', '.it', '.nl', '.se', '.kr',
        '.no', '.es', '.ca', '.site', '.me', '.tech', '.io', '.info', '.top',
        '.ai', '.online', '.club', '.xyz', '.cc', '.tv', '.mobi', '.asia', '.gl',
        '.cat', '.vip', '.ms', '.pw', '.pro', '.sh', '.tw', '.hk', '.sg', '.in'
    ];

    // biome-ignore lint/suspicious/noControlCharactersInRegex: <explanation>
    const nonAsciiPattern = /[^\x00-\x7F]/;
    const nonChinesePattern = /[^\u4e00-\u9fa5]/;

    const isValidUrl = (url: string) => {
        return !nonAsciiPattern.test(url) || !nonChinesePattern.test(url);
    };
    const potentialUrls = str.split(/[\s\n]+/).filter(word => (urlPattern.test(word) || commonSuffixes.some(suffix => word.includes(suffix))) && isValidUrl(word));
    return potentialUrls.sort((a, b) => str.indexOf(a) - str.indexOf(b));
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function debounce<T extends (...args: any[]) => any>(fn: T, delay = 300) {
    let timer: number;
    return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    } as T;
}
