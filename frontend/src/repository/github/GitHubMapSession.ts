import {GitHubSource} from './GitHubUrl';

export interface GitHubMapSession {
    source: GitHubSource;
    sha: string;
    rawFileContent: string;
}

// Module-level singleton: the GitHub map is bound for the browser session
// only. Reloading the page clears it (a known limitation — see the spec).
let current: GitHubMapSession | null = null;

export const setSession = (session: GitHubMapSession): void => {
    current = session;
};

export const getSession = (): GitHubMapSession | null => current;

export const clearSession = (): void => {
    current = null;
};
