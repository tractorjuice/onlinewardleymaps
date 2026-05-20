import {GitHubSource} from './GitHubUrl';

export interface GitHubFile {
    content: string;
    sha: string;
}

export class GitHubApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.name = 'GitHubApiError';
        this.status = status;
    }
}

const API = 'https://api.github.com';

const decodeBase64 = (b64: string): string => {
    const bytes = Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
};

const encodeBase64 = (text: string): string => {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach(b => (binary += String.fromCharCode(b)));
    return btoa(binary);
};

export class GitHubClient {
    private token: string;

    constructor(token: string) {
        this.token = token;
    }

    private headers(): Record<string, string> {
        return {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        };
    }

    private contentsUrl(s: GitHubSource): string {
        return `${API}/repos/${s.owner}/${s.repo}/contents/${s.path}`;
    }

    async readFile(source: GitHubSource): Promise<GitHubFile> {
        const url = `${this.contentsUrl(source)}?ref=${encodeURIComponent(source.branch)}`;
        const response = await fetch(url, {headers: this.headers()});
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new GitHubApiError(response.status, data.message || 'GitHub read failed');
        }
        return {content: decodeBase64(data.content), sha: data.sha};
    }

    async commitFile(source: GitHubSource, content: string, message: string, sha: string): Promise<{sha: string}> {
        const response = await fetch(this.contentsUrl(source), {
            method: 'PUT',
            headers: {...this.headers(), 'Content-Type': 'application/json'},
            body: JSON.stringify({
                message,
                content: encodeBase64(content),
                sha,
                branch: source.branch,
            }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new GitHubApiError(response.status, data.message || 'GitHub commit failed');
        }
        return {sha: data.content.sha};
    }
}
