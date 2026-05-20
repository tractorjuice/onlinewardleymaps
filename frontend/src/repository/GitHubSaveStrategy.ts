import {exportToMermaid} from '../conversion/mermaid/MermaidExporter';
import {GitHubClient} from './github/GitHubClient';
import {getGitHubToken} from './github/GitHubToken';
import {getSession, setSession} from './github/GitHubMapSession';
import {replaceMermaidFence} from './github/MermaidFence';
import {OwnApiWardleyMap} from './OwnApiWardleyMap';
import {SaveStrategy} from './SaveStrategy';

export class GitHubSaveStrategy implements SaveStrategy {
    callback: (id: string, data: string) => void;

    constructor(callback: (id: string, data: string) => void) {
        this.callback = callback;
    }

    async save(map: OwnApiWardleyMap, hash: string): Promise<void> {
        const token = getGitHubToken();
        const session = getSession();
        if (!token || !session) {
            throw new Error('No GitHub map is open. Open a map from GitHub before saving.');
        }

        const message = window.prompt('Commit message', 'Update Wardley map via OnlineWardleyMaps');
        if (message === null) return; // user cancelled

        const {mermaid} = exportToMermaid(map.mapText);
        const newFileContent = replaceMermaidFence(session.rawFileContent, mermaid);

        const client = new GitHubClient(token);
        const result = await client.commitFile(session.source, newFileContent, message, session.sha);

        setSession({...session, sha: result.sha, rawFileContent: newFileContent});
        this.callback(hash, JSON.stringify({id: hash}));
    }
}
