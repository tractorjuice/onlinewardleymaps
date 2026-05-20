// OWM keywords that have no Mermaid wardley-beta equivalent. Lines matching
// these are preserved as `%%` comments on export and restored on import.
const OWM_ONLY_PATTERNS: RegExp[] = [
    /^style\s+wardley\s*$/i,
    /^(build|buy|outsource)\s+/i,
    /^[xy]-axis\s+/i,
    // `market <name> [vis, evo]` only — must not match links like
    // `Market segmentation -> Last Mile`.
    /^market\s+[^[\]]+\[\s*[\d.]+\s*,/i,
    /^(ecosystem|submap|url)\s+/i,
    /^(pioneers|settlers|townplanners|explorers|villagers)\s*\[/i,
    /^(accelerator|deaccelerator)\s+/i,
];

export const isOwmOnlyLine = (line: string): boolean => {
    const trimmed = line.trim();
    return OWM_ONLY_PATTERNS.some(re => re.test(trimmed));
};
