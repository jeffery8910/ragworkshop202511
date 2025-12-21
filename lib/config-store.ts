// Simple in-memory config cache for server routes.
// Used as a fallback when cookies/env are missing (e.g., dev http-only cookies not sent).

type ConfigMap = Record<string, string | number | null | undefined>;

let store: ConfigMap = {};

export function saveConfig(map: ConfigMap) {
    const next = { ...store };
    for (const [key, value] of Object.entries(map)) {
        if (value === '' || value === undefined || value === null) {
            delete next[key];
        } else {
            next[key] = value;
        }
    }
    store = next;
}

export function getConfigValue(key: string): string | undefined {
    const value = store[key];
    if (value === undefined || value === null) return undefined;
    return typeof value === 'string' ? value : String(value);
}

export function getConfigMap(): ConfigMap {
    return { ...store };
}
