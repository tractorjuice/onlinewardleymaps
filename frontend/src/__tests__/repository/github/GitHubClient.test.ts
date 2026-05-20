import {GitHubClient, GitHubApiError} from '../../../repository/github/GitHubClient';

const SOURCE = {owner: 'a', repo: 'b', branch: 'main', path: 'm.md'};

// base64 of "hello" is "aGVsbG8="
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');

describe('GitHubClient', () => {
    afterEach(() => jest.restoreAllMocks());

    it('readFile decodes content and returns the sha', async () => {
        jest.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({content: b64('hello'), encoding: 'base64', sha: 'sha1'}),
        } as Response);

        const client = new GitHubClient('ghp_token');
        const file = await client.readFile(SOURCE);
        expect(file).toEqual({content: 'hello', sha: 'sha1'});
    });

    it('readFile throws GitHubApiError with the status on failure', async () => {
        jest.spyOn(global, 'fetch').mockResolvedValue({
            ok: false,
            status: 404,
            json: async () => ({message: 'Not Found'}),
        } as Response);

        const client = new GitHubClient('ghp_token');
        await expect(client.readFile(SOURCE)).rejects.toMatchObject({
            name: 'GitHubApiError',
            status: 404,
        });
    });

    it('commitFile sends the sha and returns the new sha', async () => {
        const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({content: {sha: 'sha2'}}),
        } as Response);

        const client = new GitHubClient('ghp_token');
        const result = await client.commitFile(SOURCE, 'new content', 'msg', 'sha1');
        expect(result).toEqual({sha: 'sha2'});

        const [, init] = fetchMock.mock.calls[0];
        const body = JSON.parse((init as RequestInit).body as string);
        expect(body.sha).toBe('sha1');
        expect(body.branch).toBe('main');
        expect(body.message).toBe('msg');
    });
});
