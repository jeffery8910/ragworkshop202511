export async function adminFetch(input: RequestInfo | URL, init?: RequestInit) {
    const res = await fetch(input, init);
    if (typeof window !== 'undefined' && res.status === 401) {
        window.location.href = '/admin/login';
    }
    return res;
}
