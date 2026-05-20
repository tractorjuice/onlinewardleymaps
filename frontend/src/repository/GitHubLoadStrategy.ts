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

        const {body, hasFence} = extractMermaidFence(file.content);
        if (!hasFence) {
            const proceed = window.confirm('No Mermaid wardley-beta diagram was found in this file. Open the whole file as a map anyway?');
            if (!proceed) {
                const cancelled = new Error('GitHub load cancelled by user.');
                cancelled.name = 'GitHubLoadCancelled';
                throw cancelled;
            }
        }
        const mapText = importFromMermaid(body);

        setSession({source, sha: file.sha, rawFileContent: file.content});

        this.callback(Defaults.MapPersistenceStrategy.GitHub, {
            id,
            mapText,
            mapIterations: [],
        });
    }
}
