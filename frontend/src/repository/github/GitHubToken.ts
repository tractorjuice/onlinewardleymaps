const KEY = 'owm.githubPat';

// localStorage is unavailable during SSR; guard every access.
const storage = (): Storage | null => (typeof window === 'undefined' ? null : window.localStorage);

export const getGitHubToken = (): string | null => storage()?.getItem(KEY) ?? null;

export const setGitHubToken = (token: string): void => {
    storage()?.setItem(KEY, token.trim());
};

export const clearGitHubToken = (): void => {
    storage()?.removeItem(KEY);
};
