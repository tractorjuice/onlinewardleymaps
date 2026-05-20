import {parseGitHubUrl} from '../../../repository/github/GitHubUrl';

describe('parseGitHubUrl', () => {
    it('parses a blob URL', () => {
        const r = parseGitHubUrl('https://github.com/acme/maps/blob/main/docs/tea.md');
        expect(r).toEqual({owner: 'acme', repo: 'maps', branch: 'main', path: 'docs/tea.md'});
    });

    it('parses a path with nested folders', () => {
        const r = parseGitHubUrl('https://github.com/a/b/blob/dev/x/y/z.md');
        expect(r).toEqual({owner: 'a', repo: 'b', branch: 'dev', path: 'x/y/z.md'});
    });

    it('returns null for a non-blob GitHub URL', () => {
        expect(parseGitHubUrl('https://github.com/acme/maps')).toBeNull();
    });

    it('returns null for a non-GitHub URL', () => {
        expect(parseGitHubUrl('https://example.com/foo')).toBeNull();
    });
});
