import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BlockRetrievalOperations } from './block-retrieval.js';
import { Graph } from '@roam-research/roam-api-sdk';

// Mock roam-api-sdk
vi.mock('@roam-research/roam-api-sdk', () => ({
  q: vi.fn(),
  Graph: vi.fn(),
}));

import { q } from '@roam-research/roam-api-sdk';

describe('BlockRetrievalOperations', () => {
  let ops: BlockRetrievalOperations;
  let mockGraph: Graph;
  let qMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGraph = {} as Graph;
    ops = new BlockRetrievalOperations(mockGraph);
    qMock = q as unknown as ReturnType<typeof vi.fn>;
    vi.clearAllMocks();
  });

  it('fetches a block with recursive reference resolution', async () => {
    // ref UIDs must be 9 chars to match REF_PATTERN
    const ref1Uid = 'ref1AAAAA';
    const ref2Uid = 'ref2BBBBB';

    // 1. Root block query: [:find ?string ?order ?heading ...]
    qMock.mockResolvedValueOnce([[`Root Block with Ref ((${ref1Uid}))`, 0, 0]]);

    // 2. Children query: [:find ?parentUid ?childUid ?childString ?childOrder ?childHeading ...]
    qMock.mockResolvedValueOnce([]);

    // 3. resolveBlockRefs query for ref1: [:find ?uid ?string ?heading ...]
    qMock.mockResolvedValueOnce([[ref1Uid, `Ref 1 content with ((${ref2Uid}))`, 0]]);

    // 4. resolveBlockRefs query for ref2 (depth 2)
    qMock.mockResolvedValueOnce([[ref2Uid, 'Ref 2 content', 0]]);

    const result = await ops.fetchBlockWithChildren('root-uid');

    expect(result).toBeDefined();
    expect(result?.uid).toBe('root-uid');
    expect(result?.string).toBe(`Root Block with Ref ((${ref1Uid}))`);

    expect(result?.refs).toBeDefined();
    expect(result?.refs).toHaveLength(1);
    const ref1 = result?.refs?.[0];
    expect(ref1?.uid).toBe(ref1Uid);
    expect(ref1?.string).toBe(`Ref 1 content with ((${ref2Uid}))`);

    expect(ref1?.refs).toBeDefined();
    expect(ref1?.refs).toHaveLength(1);
    const ref2 = ref1?.refs?.[0];
    expect(ref2?.uid).toBe(ref2Uid);
    expect(ref2?.string).toBe('Ref 2 content');

    // ref2 should have empty refs as it has no refs in string
    expect(ref2?.refs).toEqual([]);
  });

  it('handles multiple references in same block', async () => {
    const refAUid = 'refAAAAAA';
    const refBUid = 'refBBBBBB';

    // 1. Root block
    qMock.mockResolvedValueOnce([[`Root ((${refAUid})) and ((${refBUid}))`, 0, 0]]);
    // 2. Children
    qMock.mockResolvedValueOnce([]);

    // 3. resolveBlockRefs query for refA and refB
    qMock.mockResolvedValueOnce([
        [refAUid, 'Content A', 0],
        [refBUid, 'Content B', 0]
    ]);

    // No more queries - Content A and B have no refs

    const result = await ops.fetchBlockWithChildren('root-uid');

    expect(result?.refs).toHaveLength(2);
    const uids = result?.refs?.map(r => r.uid).sort();
    expect(uids).toEqual([refAUid, refBUid].sort());
  });

  it('handles shared references in tree', async () => {
    const sharedUid = 'sharedUID';

    // 1. Root block
    qMock.mockResolvedValueOnce([['Root', 0, 0]]);

    // 2. Children query: Child1 and Child2 both reference 'shared'
    qMock.mockResolvedValueOnce([
        ['root-uid', 'child1uid', `Child 1 ((${sharedUid}))`, 0, 0],
        ['root-uid', 'child2uid', `Child 2 ((${sharedUid}))`, 1, 0]
    ]);

    // 3. Children of Child1 and Child2 (empty - depth limit or no children)
    qMock.mockResolvedValueOnce([]);

    // 4. resolveBlockRefs query for 'shared' - fetched once, attached to both
    qMock.mockResolvedValueOnce([[sharedUid, 'Shared Content', 0]]);

    const result = await ops.fetchBlockWithChildren('root-uid');

    const child1 = result?.children.find(c => c.uid === 'child1uid');
    const child2 = result?.children.find(c => c.uid === 'child2uid');

    expect(child1?.refs).toHaveLength(1);
    expect(child1?.refs![0].uid).toBe(sharedUid);

    expect(child2?.refs).toHaveLength(1);
    expect(child2?.refs![0].uid).toBe(sharedUid);
  });
});
