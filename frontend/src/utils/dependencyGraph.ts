/**
 * Dependency Graph Utility for Component Link Highlighting
 *
 * This utility builds a dependency graph from links data to enable
 * highlighting of descendant linked components when hovering over a component.
 */

import {ProcessedLinkGroup} from './mapProcessing';

export interface DependencyNode {
    componentName: string;
    descendants: Set<string>;
    linkIds: Set<string>; // Links that connect this component to its descendants
}

export interface ComponentDependencyGraph {
    nodes: Map<string, DependencyNode>;
    getDescendants: (componentName: string) => string[];
    getDescendantLinks: (componentName: string) => string[];
    hasDescendants: (componentName: string) => boolean;
}

/**
 * Creates a dependency graph from processed links
 *
 * @param processedLinks - The processed link groups from the map
 * @returns ComponentDependencyGraph with methods to query dependencies
 */
export function createDependencyGraph(processedLinks: ProcessedLinkGroup[]): ComponentDependencyGraph {
    const nodes = new Map<string, DependencyNode>();

    // Initialize nodes for all components
    const initializeNode = (componentName: string): DependencyNode => {
        if (!nodes.has(componentName)) {
            nodes.set(componentName, {
                componentName,
                descendants: new Set<string>(),
                linkIds: new Set<string>(),
            });
        }
        return nodes.get(componentName)!;
    };

    // Process all links to build direct dependencies
    processedLinks.forEach(linkGroup => {
        linkGroup.links.forEach(processedLink => {
            const startElement = processedLink.startElement;
            const endElement = processedLink.endElement;

            if (startElement && endElement) {
                const startNode = initializeNode(startElement.name);
                initializeNode(endElement.name); // Ensure end node exists

                // Create link ID for this connection
                const linkId = `${startElement.name}->${endElement.name}`;

                // Add direct dependency
                startNode.descendants.add(endElement.name);
                startNode.linkIds.add(linkId);
            }
        });
    });

    // Snapshot direct descendants before we start mutating node.descendants below.
    const directDescendants = new Map<string, string[]>();
    nodes.forEach((node, name) => {
        directDescendants.set(name, Array.from(node.descendants));
    });

    // Build transitive closure to find all descendants.
    // Memoized: each component's transitive set is computed once and reused.
    // The placeholder result Set is inserted into the cache before recursing,
    // so a cycle returns the (still-being-built) set instead of looping.
    const transitiveCache = new Map<string, Set<string>>();
    const findAllDescendants = (componentName: string): Set<string> => {
        const cached = transitiveCache.get(componentName);
        if (cached) return cached;

        const result = new Set<string>();
        transitiveCache.set(componentName, result);

        const direct = directDescendants.get(componentName);
        if (!direct) return result;

        direct.forEach(descendant => {
            result.add(descendant);
            findAllDescendants(descendant).forEach(transitive => result.add(transitive));
        });

        return result;
    };

    // Update all nodes with complete descendant information
    nodes.forEach((node, componentName) => {
        const allDescendants = findAllDescendants(componentName);
        node.descendants = allDescendants;

        // Update linkIds to include all links in the descendant chain
        const allLinkIds = new Set<string>();

        // Add links that originate from this component or any of its descendants
        processedLinks.forEach(linkGroup => {
            linkGroup.links.forEach(processedLink => {
                const startElement = processedLink.startElement;
                const endElement = processedLink.endElement;

                if (startElement && endElement) {
                    const linkId = `${startElement.name}->${endElement.name}`;

                    // Include link if:
                    // 1. This component is the direct start of the link
                    // 2. Any descendant of this component is the start of the link
                    if (startElement.name === componentName || allDescendants.has(startElement.name)) {
                        allLinkIds.add(linkId);
                    }
                }
            });
        });

        node.linkIds = allLinkIds;
    });

    return {
        nodes,
        getDescendants: (componentName: string) => {
            const node = nodes.get(componentName);
            return node ? Array.from(node.descendants) : [];
        },
        getDescendantLinks: (componentName: string) => {
            const node = nodes.get(componentName);
            return node ? Array.from(node.linkIds) : [];
        },
        hasDescendants: (componentName: string) => {
            const node = nodes.get(componentName);
            return node ? node.descendants.size > 0 : false;
        },
    };
}

/**
 * Normalizes component names for consistent matching
 */
export function normalizeComponentName(name: string): string {
    return name.trim().toLowerCase();
}

/**
 * Checks if two component names are equivalent after normalization
 */
export function areComponentNamesEquivalent(name1: string, name2: string): boolean {
    return normalizeComponentName(name1) === normalizeComponentName(name2);
}
