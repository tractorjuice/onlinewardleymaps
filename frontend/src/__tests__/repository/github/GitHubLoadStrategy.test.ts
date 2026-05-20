import {GitHubLoadStrategy} from '../../../repository/GitHubLoadStrategy';
import {GitHubClient} from '../../../repository/github/GitHubClient';
import {setGitHubToken, clearGitHubToken} from '../../../repository/github/GitHubToken';
import {getSession, clearSession} from '../../../repository/github/GitHubMapSession';

const FILE = ['# Map', '```mermaid', 'wardley-beta', 'component Foo [0.5, 0.5]', '```'].join('\n');

describe('GitHubLoadStrategy', () => {
    beforeEach(() => setGitHubToken('ghp_token'));
    afterEach(() => {
        clearGitHubToken();
        clearSession();
        jest.restoreAllMocks();
    });

    it('loads a map, imports it to OWM DSL, and stores the session', async () => {
        jest.spyOn(GitHubClient.prototype, 'readFile').mockResolvedValue({content: FILE, sha: 'sha1'});

        const callback = jest.fn();
        const strategy = new GitHubLoadStrategy(callback);
        await strategy.load('acme/maps/main/docs/tea.md');

        const [strategyName, data] = callback.mock.calls[0];
        expect(strategyName).toBe('GitHub');
        expect(data.mapText).toContain('component Foo [0.5, 0.5]');
        expect(data.mapText).not.toContain('wardley-beta');
        expect(getSession()?.sha).toBe('sha1');
    });

    it('throws when no token is stored', async () => {
        clearGitHubToken();
        const strategy = new GitHubLoadStrategy(jest.fn());
        await expect(strategy.load('acme/maps/main/tea.md')).rejects.toThrow(/token/i);
    });
});
