export interface FenceResult {
    body: string;
    hasFence: boolean;
}

// Matches a ```mermaid ... ``` fenced block. Group 1 = opening fence line
// (with any info string), group 2 = body, group 3 = closing fence.
const FENCE_RE = /(```mermaid[^\n]*\n)([\s\S]*?)(\n```)/g;

const findWardleyFence = (fileContent: string): RegExpExecArray | null => {
    FENCE_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = FENCE_RE.exec(fileContent)) !== null) {
        if (/^\s*wardley-beta\b/.test(match[2])) return match;
    }
    return null;
};

export const extractMermaidFence = (fileContent: string): FenceResult => {
    const match = findWardleyFence(fileContent);
    if (!match) return {body: fileContent, hasFence: false};
    return {body: match[2].trim(), hasFence: true};
};

export const replaceMermaidFence = (fileContent: string, newBody: string): string => {
    const match = findWardleyFence(fileContent);
    if (!match) return newBody;
    const replacement = `${match[1]}${newBody}${match[3]}`;
    return fileContent.slice(0, match.index) + replacement + fileContent.slice(match.index + match[0].length);
};
