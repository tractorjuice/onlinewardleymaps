import {extractMermaidFence, replaceMermaidFence} from '../../../repository/github/MermaidFence';

const MD = ['# My Map', 'Some prose.', '```mermaid', 'wardley-beta', 'component Foo [0.5, 0.5]', '```', 'More prose.'].join('\n');

describe('extractMermaidFence', () => {
    it('extracts the wardley-beta fence body', () => {
        const r = extractMermaidFence(MD);
        expect(r.hasFence).toBe(true);
        expect(r.body).toBe('wardley-beta\ncomponent Foo [0.5, 0.5]');
    });

    it('treats a file with no fence as the whole body', () => {
        const r = extractMermaidFence('wardley-beta\ncomponent Foo [0.5, 0.5]');
        expect(r.hasFence).toBe(false);
        expect(r.body).toBe('wardley-beta\ncomponent Foo [0.5, 0.5]');
    });
});

describe('replaceMermaidFence', () => {
    it('replaces the fence body and keeps surrounding prose', () => {
        const out = replaceMermaidFence(MD, 'wardley-beta\ncomponent Bar [0.1, 0.2]');
        expect(out).toContain('# My Map');
        expect(out).toContain('More prose.');
        expect(out).toContain('component Bar [0.1, 0.2]');
        expect(out).not.toContain('component Foo');
    });

    it('returns the new body alone when there was no fence', () => {
        const out = replaceMermaidFence('wardley-beta\ncomponent Foo [0.5, 0.5]', 'wardley-beta\nx');
        expect(out).toBe('wardley-beta\nx');
    });
});
