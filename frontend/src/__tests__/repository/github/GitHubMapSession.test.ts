import {setSession, getSession, clearSession} from '../../../repository/github/GitHubMapSession';

const SAMPLE = {
    source: {owner: 'a', repo: 'b', branch: 'main', path: 'm.md'},
    sha: 'abc123',
    rawFileContent: '# file',
};

describe('GitHubMapSession', () => {
    afterEach(() => clearSession());

    it('returns null when nothing is set', () => {
        expect(getSession()).toBeNull();
    });

    it('stores and retrieves a session', () => {
        setSession(SAMPLE);
        expect(getSession()).toEqual(SAMPLE);
    });

    it('clears a session', () => {
        setSession(SAMPLE);
        clearSession();
        expect(getSession()).toBeNull();
    });
});
