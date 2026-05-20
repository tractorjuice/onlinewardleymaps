import {exportToMermaid} from '../../../conversion/mermaid/MermaidExporter';

describe('exportToMermaid', () => {
    it('emits a wardley-beta header', () => {
        const result = exportToMermaid('title Test\ncomponent Foo [0.5, 0.5]');
        expect(result.mermaid.split('\n')[0]).toBe('wardley-beta');
    });

    it('passes a component through unchanged', () => {
        const result = exportToMermaid('component Foo [0.5, 0.5]');
        expect(result.mermaid).toContain('component Foo [0.5, 0.5]');
    });
});

describe('exportToMermaid — unsupported keywords', () => {
    it('preserves a market line as a %% comment', () => {
        const result = exportToMermaid('component Foo [0.5, 0.5]\nmarket Buyers [0.9, 0.5]');
        expect(result.mermaid).toContain('%% market Buyers [0.9, 0.5]');
        expect(result.keptAsComments).toContain('market Buyers [0.9, 0.5]');
    });

    it('does not list normal lines in keptAsComments', () => {
        const result = exportToMermaid('component Foo [0.5, 0.5]');
        expect(result.keptAsComments).toEqual([]);
    });
});
