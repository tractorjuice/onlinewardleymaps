import {GitHubSaveStrategy} from '../../../repository/GitHubSaveStrategy';
import {GitHubClient} from '../../../repository/github/GitHubClient';
import {setSession, getSession, clearSession} from '../../../repository/github/GitHubMapSession';
import {setGitHubToken, clearGitHubToken} from '../../../repository/github/GitHubToken';

const FILE = ['# Map', '```mermaid', 'wardley-beta', 'component Foo [0.5, 0.5]', '```'].join('\n');

const map = (mapText: string) => ({readOnly: false, mapText, imageData: '', mapIterations: []});

describe('GitHubSaveStrategy', () => {
    beforeEach(() => {
        setGitHubToken('ghp_testtoken');
        setSession({
            source: {owner: 'a', repo: 'b', branch: 'main', path: 'm.md'},
            sha: 'sha1',
            rawFileContent: FILE,
        });
        jest.spyOn(window, 'prompt').mockReturnValue('Update map');
    });
    afterEach(() => {
        clearGitHubToken();
        clearSession();
        jest.restoreAllMocks();
    });

    it('commits the regenerated fence and updates the session sha', async () => {
        const commit = jest.spyOn(GitHubClient.prototype, 'commitFile').mockResolvedValue({sha: 'sha2'});

        const callback = jest.fn();
        await new GitHubSaveStrategy(callback).save(map('component Bar [0.1, 0.2]'), 'a/b/main/m.md');

        const committedContent = commit.mock.calls[0][1];
        expect(committedContent).toContain('component Bar [0.1, 0.2]');
        expect(committedContent).toContain('# Map'); // prose preserved
        expect(commit.mock.calls[0][3]).toBe('sha1'); // sha sent
        expect(getSession()?.sha).toBe('sha2'); // sha updated
        expect(callback).toHaveBeenCalled();
    });

    it('aborts when the user cancels the commit-message prompt', async () => {
        jest.spyOn(window, 'prompt').mockReturnValue(null);
        const commit = jest.spyOn(GitHubClient.prototype, 'commitFile');
        await new GitHubSaveStrategy(jest.fn()).save(map('component Bar [0.1, 0.2]'), 'a/b/main/m.md');
        expect(commit).not.toHaveBeenCalled();
    });
});
