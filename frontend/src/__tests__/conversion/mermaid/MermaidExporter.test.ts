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
