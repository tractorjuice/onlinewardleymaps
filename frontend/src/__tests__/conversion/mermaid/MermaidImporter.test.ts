import {importFromMermaid} from '../../../conversion/mermaid/MermaidImporter';

describe('importFromMermaid', () => {
    it('strips the wardley-beta header line', () => {
        const owm = importFromMermaid('wardley-beta\ncomponent Foo [0.5, 0.5]');
        expect(owm).not.toContain('wardley-beta');
        expect(owm).toContain('component Foo [0.5, 0.5]');
    });

    it('strips the auto-injected size line', () => {
        const owm = importFromMermaid('wardley-beta\ntitle T\nsize [1100, 800]\ncomponent Foo [0.5, 0.5]');
        expect(owm).not.toContain('size [1100, 800]');
    });

    it('restores OWM-only keywords from %% comments', () => {
        const owm = importFromMermaid('wardley-beta\n%% market Buyers [0.9, 0.5]\ncomponent Foo [0.5, 0.5]');
        expect(owm).toContain('market Buyers [0.9, 0.5]');
    });

    it('drops %% comments that are not OWM keywords', () => {
        const owm = importFromMermaid('wardley-beta\n%% just a note\ncomponent Foo [0.5, 0.5]');
        expect(owm).not.toContain('just a note');
    });
});
