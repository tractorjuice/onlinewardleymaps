import {isOwmOnlyLine} from './owmOnlyKeywords';

// Converts a Mermaid wardley-beta diagram body into OWM DSL. The body is
// already valid OWM apart from the `wardley-beta` header and the
// auto-injected `size` line; `%%` comments holding OWM-only keywords
// (written by exportToMermaid) are un-commented.
export const importFromMermaid = (mermaidText: string): string => {
    const out: string[] = [];
    for (const line of mermaidText.split('\n')) {
        const trimmed = line.trim();

        if (/^wardley-beta\s*$/i.test(trimmed)) continue;
        if (/^size\s*\[/i.test(trimmed)) continue;

        const commentMatch = trimmed.match(/^%%\s?(.*)$/);
        if (commentMatch) {
            const body = commentMatch[1];
            if (isOwmOnlyLine(body.trim())) out.push(body);
            continue;
        }

        out.push(line);
    }
    return out.join('\n');
};
