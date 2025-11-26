import { nanoid } from 'nanoid';

export interface Chunk {
    id: string;
    text: string;
    parentId?: string;
    metadata?: any;
}

export function parentChildSplit(text: string, parentSize = 1000, childSize = 200): Chunk[] {
    const chunks: Chunk[] = [];

    // Simple splitting by length for demonstration. 
    // In production, use recursive character splitting or sentence splitting.
    for (let i = 0; i < text.length; i += parentSize) {
        const parentText = text.substring(i, i + parentSize);
        const parentId = nanoid();

        // Add Parent Chunk (stored in DB but maybe not indexed for vector search directly, or indexed as "large context")
        chunks.push({
            id: parentId,
            text: parentText,
            metadata: { type: 'parent' }
        });

        // Create Child Chunks
        for (let j = 0; j < parentText.length; j += childSize) {
            const childText = parentText.substring(j, j + childSize);
            chunks.push({
                id: nanoid(),
                text: childText,
                parentId: parentId,
                metadata: { type: 'child' }
            });
        }
    }

    return chunks;
}
