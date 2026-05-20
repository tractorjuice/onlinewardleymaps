import * as Defaults from '../constants/defaults';
import {LegacyLoadStrategy} from './LegacyApiLoadStrategy';
import {GitHubLoadStrategy} from './GitHubLoadStrategy';

interface LoadStrategy {
    load(id: string): Promise<void>;
}

export const LoadMap = async (mapPersistenceStrategy: string, followOnActions: any, id: string): Promise<void> => {
    const loadStrategy: Record<string, () => LoadStrategy> = {
        [Defaults.MapPersistenceStrategy.Legacy]: () => new LegacyLoadStrategy(followOnActions),
        [Defaults.MapPersistenceStrategy.GitHub]: () => new GitHubLoadStrategy(followOnActions),
    };

    await loadStrategy[mapPersistenceStrategy]().load(id);
};
