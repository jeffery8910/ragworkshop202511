// Simple in-memory config cache for server routes.
// Used as a fallback when cookies/env are missing (e.g., dev http-only cookies not sent).

type ConfigMap = Record<string, string>;

let store: ConfigMap = {};

export function saveConfig(map: ConfigMap) {
    store = { ...store, ...map };
}

export function getConfigValue(key: string): string | undefined {
    return store[key];
}

export function getConfigMap(): ConfigMap {
    return { ...store };
}
