import {importFromMermaid} from '../conversion/mermaid/MermaidImporter';
import * as Defaults from '../constants/defaults';
import {GitHubClient} from './github/GitHubClient';
import {extractMermaidFence} from './github/MermaidFence';
import {setSession} from './github/GitHubMapSession';
import {getGitHubToken} from './github/GitHubToken';
import {idToSource} from './github/GitHubUrl';
import {LoadStrategy} from './LoadStrategy';

export class GitHubLoadStrategy extends LoadStrategy {
    async load(id: string): Promise<void> {
        const token = getGitHubToken();
        if (!token) {
            throw new Error('No GitHub token configured. Add a personal access token first.');
        }

        const source = idToSource(id);
        const client = new GitHubClient(token);
        const file = await client.readFile(source);

        const {body} = extractMermaidFence(file.content);
        const mapText = importFromMermaid(body);

        setSession({source, sha: file.sha, rawFileContent: file.content});

        this.callback(Defaults.MapPersistenceStrategy.GitHub, {
            id,
            mapText,
            mapIterations: [],
        });
    }
}
