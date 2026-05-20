import {exportToMermaid} from '../../../conversion/mermaid/MermaidExporter';
import {importFromMermaid} from '../../../conversion/mermaid/MermaidImporter';

// Normalise for comparison: drop blank lines and trim each line. The
// exporter intentionally collapses blanks and strips `//` comments.
const normalise = (text: string): string[] =>
    text
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0 && !l.startsWith('//'));

const SAMPLE = [
    'title Tea Shop',
    'anchor Business [0.95, 0.63]',
    'component Cup of Tea [0.79, 0.61]',
    'component Kettle [0.43, 0.35]',
    'Business -> Cup of Tea',
    'Cup of Tea -> Kettle',
    'evolve Kettle 0.62',
    'market Buyers [0.9, 0.5]',
].join('\n');

describe('OWM <-> Mermaid round trip', () => {
    it('preserves every meaningful line', () => {
        const mermaid = exportToMermaid(SAMPLE).mermaid;
        const backToOwm = importFromMermaid(mermaid);
        const original = normalise(SAMPLE);
        const result = normalise(backToOwm);
        for (const line of original) {
            expect(result).toContain(line);
        }
    });

    it('round-trips the OWM-only market keyword', () => {
        const mermaid = exportToMermaid(SAMPLE).mermaid;
        expect(mermaid).toContain('%% market Buyers [0.9, 0.5]');
        expect(normalise(importFromMermaid(mermaid))).toContain('market Buyers [0.9, 0.5]');
    });
});
