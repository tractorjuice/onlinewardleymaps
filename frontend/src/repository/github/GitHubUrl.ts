export interface GitHubSource {
    owner: string;
    repo: string;
    branch: string;
    path: string;
}

// Parses https://github.com/{owner}/{repo}/blob/{branch}/{path...}
export const parseGitHubUrl = (url: string): GitHubSource | null => {
    const match = url.trim().match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
    if (!match) return null;
    const [, owner, repo, branch, path] = match;
    return {owner, repo, branch, path};
};

// id form used by the persistence layer: owner/repo/branch/path...
export const sourceToId = (s: GitHubSource): string => `${s.owner}/${s.repo}/${s.branch}/${s.path}`;

export const idToSource = (id: string): GitHubSource => {
    const [owner, repo, branch, ...rest] = id.split('/');
    return {owner, repo, branch, path: rest.join('/')};
};
