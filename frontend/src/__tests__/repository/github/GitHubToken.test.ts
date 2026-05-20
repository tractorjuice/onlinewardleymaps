import {getGitHubToken, setGitHubToken, clearGitHubToken} from '../../../repository/github/GitHubToken';

describe('GitHubToken', () => {
    afterEach(() => clearGitHubToken());

    it('returns null when no token is stored', () => {
        expect(getGitHubToken()).toBeNull();
    });

    it('stores and retrieves a token', () => {
        setGitHubToken('ghp_example');
        expect(getGitHubToken()).toBe('ghp_example');
    });

    it('clears a token', () => {
        setGitHubToken('ghp_example');
        clearGitHubToken();
        expect(getGitHubToken()).toBeNull();
    });
});
