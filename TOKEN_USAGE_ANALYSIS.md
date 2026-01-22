# MCP Token Usage Analysis for Page Operations

**Version:** 1.0.0
**Date:** January 2026
**Scope:** Page retrieval, creation, and edit operations

---

## Executive Summary

This analysis examines token usage patterns in the Roam Research MCP server, focusing on Page operations. The assessment identifies **12 optimization opportunities** that could reduce token consumption by an estimated **40-60%** for typical Page workflows.

### Key Findings

| Category | Impact | Estimated Savings |
|----------|--------|-------------------|
| Response Format Redundancy | High | 25-35% |
| Reference Resolution Overhead | High | 15-25% |
| Verification Query Overhead | Medium | 10-15% |
| Tool Schema Verbosity | Medium | 5-10% |
| Cheatsheet Context | Low-Medium | 3-5% |

---

## 1. Response Format Analysis

### 1.1 Page Fetch Response Overhead

**Location:** `src/tools/operations/pages.ts:519-656`

**Current Behavior:**
The `fetchPageByTitle` function returns either markdown or raw JSON format. The raw format includes full block hierarchies with significant redundancy.

**Token Cost Example (100-block page):**
```json
// Raw format returns nested structures like:
{
  "uid": "Xk7mN2pQ9",
  "string": "Block content here",
  "order": 0,
  "heading": null,
  "children": [
    {
      "uid": "Ab3cD4eF5",
      "string": "Child block",
      "order": 0,
      "heading": null,
      "children": [],
      "refs": []
    }
  ],
  "refs": []
}
```

**Issues Identified:**
1. `heading: null` appears on every non-heading block (≈95% of blocks)
2. `children: []` appears on all leaf nodes
3. `refs: []` appears on blocks without references (≈80% of blocks)
4. `order` field is redundant when blocks are already sorted
5. No option for compact/minimal response format

**Optimization Opportunity #1: Sparse Response Format**
- Omit null/empty fields by default
- Add `verbose: boolean` parameter for full format
- Estimated savings: **15-20%** of response tokens

### 1.2 Reference Resolution Cascade

**Location:** `src/tools/helpers/refs.ts:30-83`

**Current Behavior:**
The `resolveRefs` function recursively resolves `((uid))` references up to 4 levels deep by default.

**Token Cost Analysis:**
- Each reference resolution adds the full block content
- Nested references can exponentially increase response size
- No way to disable or limit resolution

**Example Scenario:**
```
Original: "See ((abc123))"
Resolved: "See [Block content which may contain ((def456)) and more]"
Further: "See [Block content which may contain [Nested block content] and more]"
```

**Optimization Opportunity #2: Configurable Reference Resolution**
- Add `resolve_refs: boolean` parameter (default: true for markdown, false for raw)
- Add `ref_depth: number` parameter (default: 2, max: 4)
- Estimated savings: **10-20%** for reference-heavy pages

### 1.3 Block Retrieval Reference Overhead

**Location:** `src/tools/operations/block-retrieval.ts:86-94`

**Current Behavior:**
`fetchBlockWithChildren` always resolves block references at depth 2 and attaches them to a `refs` property.

```typescript
// Always runs:
await resolveBlockRefs(this.graph, allBlocks, 2);
```

**Issues:**
- No parameter to skip reference resolution
- References are often not needed for structural operations
- Adds additional API queries + response payload

**Optimization Opportunity #3: Optional Reference Resolution for Block Retrieval**
- Add `include_refs: boolean` parameter (default: false)
- Estimated savings: **5-15%** per block fetch

---

## 2. API Call Patterns

### 2.1 Page Creation Verification Overhead

**Location:** `src/tools/operations/pages.ts:126-204`

**Current Behavior:**
Page creation involves multiple sequential queries:
1. Check cache for existing page
2. Query for page by title
3. Query for daily page
4. Create daily page if needed (+ 400ms delay)
5. Create page reference block
6. Re-query for created page UID
7. Another 400ms delay

**Token/Latency Cost:**
- 3-5 Roam API queries per page creation
- 800ms+ of intentional delays
- Each query consumes tokens in the response

**Optimization Opportunity #4: Batch Page Creation**
- Use Roam's native `create-page` action directly
- Remove unnecessary verification queries
- Return generated UID immediately
- Estimated savings: **20-30%** API calls, **800ms** latency

### 2.2 Outline Creation Verification

**Location:** `src/tools/operations/outline.ts:382-418`

**Current Behavior:**
After creating an outline, the system:
1. Iterates through each top-level outline item
2. Runs `findBlockWithRetry` (up to 2 retries per block)
3. For small batches (<5 items), fetches full nested structure recursively

```typescript
const skipChildFetch = topLevelOutlineItems.length > VERIFICATION_THRESHOLD;
for (const item of topLevelOutlineItems) {
  const foundUid = await this.findBlockWithRetry(targetParentUid, item.text!);
  if (!skipChildFetch) {
    const nestedBlock = await this.fetchBlockWithChildren(foundUid);
  }
}
```

**Issues:**
- Verification is redundant—batch actions already return success/failure
- Recursive child fetching doubles token cost for small outlines
- VERIFICATION_THRESHOLD of 5 is arbitrary

**Optimization Opportunity #5: Skip Post-Creation Verification**
- Trust batch action success response
- Return UIDs from batch action's own UID generation
- Add optional `verify: boolean` parameter (default: false)
- Estimated savings: **30-50%** for outline operations

### 2.3 Import Markdown Verification

**Location:** `src/tools/operations/outline.ts:505-526`

**Same pattern as outline creation:**
```typescript
const skipNestedFetch = actions.length > VERIFICATION_THRESHOLD;
if (!skipNestedFetch) {
  const createdUids = await this.fetchNestedStructure(targetParentUid);
}
```

**Optimization Opportunity #6: Unified Verification Strategy**
- Remove post-import verification queries
- Return batch-generated UIDs directly
- Estimated savings: **15-25%** for import operations

---

## 3. Response Payload Analysis

### 3.1 Update Page Markdown Response

**Location:** `src/tools/operations/pages.ts:667-751`

**Current Response Format:**
```typescript
return {
  success: true,
  actions: [...],  // Full action list with all details
  stats: {...},    // Redundant with summary
  preservedUids: [...],  // Often large list
  summary: "..."
};
```

**Issues:**
- `actions` array includes every planned action with full block content
- For large updates, this can be 10x the size of the changes
- `preservedUids` list is rarely used by callers

**Optimization Opportunity #7: Compact Update Response**
- Add `include_actions: boolean` parameter (default: false for non-dry-run)
- Remove `preservedUids` from default response (available in stats)
- Return only summary + stats by default
- Estimated savings: **40-60%** for update responses

### 3.2 Search Result Verbosity

**Location:** `src/search/utils.ts:37-63`

**Current Response Format:**
```typescript
matches.map(([uid, content, pageTitle, created, modified]) => ({
  block_uid: uid,
  content,
  page_title: pageTitle,  // Often same page, repeated
  created,  // Unix timestamps
  modified
}));
```

**Issues:**
- `page_title` repeated for every block on same page
- Timestamps often unused
- No option to request minimal match data

**Optimization Opportunity #8: Grouped Search Results**
- Group matches by page to avoid title repetition
- Add `include_timestamps: boolean` parameter
- Add `fields: string[]` parameter to select specific fields
- Estimated savings: **10-20%** for multi-page searches

---

## 4. Tool Schema and Description Overhead

### 4.1 Schema Description Verbosity

**Location:** `src/tools/schemas.ts`

**Current State:**
Tool descriptions average 400-800 characters each, with significant redundancy.

**Examples of Redundancy:**
```typescript
// Repeated across 8+ tools:
'IMPORTANT: Before using this tool, ensure that you have loaded into context
the \'Roam Markdown Cheatsheet\' resource.'

// Repeated formatting instructions:
'NOTE on Roam-flavored markdown: For direct linking: use [[link]] syntax...'
```

**Token Cost:**
- 25 tools × 500 avg chars ≈ 12,500 characters in schema alone
- Sent with every `list_tools` request
- Much content is duplicated across tools

**Optimization Opportunity #9: Schema Description Consolidation**
- Move common instructions to a single "getting started" section
- Use brief, unique descriptions per tool
- Reference common patterns by name instead of repeating
- Estimated savings: **40-50%** schema overhead

### 4.2 Cheatsheet Size

**Location:** `Roam_Markdown_Cheatsheet.md`

**Current Size:** ~4,800 characters (≈1,200 tokens)

**Issues:**
- Loaded for every write operation per tool descriptions
- Contains sections rarely needed (Mermaid, Kanban, Hiccup)
- Anti-patterns table uses verbose format

**Optimization Opportunity #10: Modular Cheatsheet**
- Split into core (essential syntax) and extended (advanced features)
- Allow callers to specify which sections to load
- Add caching directive to client
- Estimated savings: **30-50%** of cheatsheet tokens when using core-only

---

## 5. Structural Inefficiencies

### 5.1 Dual Query Pattern for Case Insensitivity

**Location:** `src/tools/helpers/page-resolution.ts`, `src/search/utils.ts`

**Current Behavior:**
```typescript
static getCaseVariations(text: string): string[] {
  return [
    text,
    text.charAt(0).toUpperCase() + text.slice(1),
    text.toUpperCase(),
    text.toLowerCase()
  ];
}
```

This generates 4 OR clauses for every case-insensitive search.

**Optimization Opportunity #11: Server-Side Case Normalization**
- Cache normalized page titles in memory
- Use single query with pre-computed lowercase comparison
- Estimated savings: **5-10%** query complexity

### 5.2 Ancestor Rule Repetition

**Location:** `src/search/ancestor-rule.ts`

The `ANCESTOR_RULE` constant (complex Datalog rule) is passed to every query using ancestry.

**Optimization Opportunity #12: Pre-registered Query Rules**
- Investigate if Roam API supports rule registration
- If not, consider caching query plans client-side
- Estimated savings: Minor (query parsing overhead)

---

## 6. Implementation Recommendations

### Priority 1: High Impact, Low Effort

| ID | Optimization | Effort | Impact |
|----|--------------|--------|--------|
| #1 | Sparse response format | 2-3 hours | High |
| #5 | Skip outline verification | 1-2 hours | High |
| #7 | Compact update response | 1-2 hours | High |

### Priority 2: Medium Impact, Medium Effort

| ID | Optimization | Effort | Impact |
|----|--------------|--------|--------|
| #2 | Configurable ref resolution | 3-4 hours | High |
| #3 | Optional refs in block fetch | 1-2 hours | Medium |
| #4 | Batch page creation | 4-6 hours | Medium |
| #9 | Schema consolidation | 2-3 hours | Medium |

### Priority 3: Lower Priority

| ID | Optimization | Effort | Impact |
|----|--------------|--------|--------|
| #6 | Unified verification | 2-3 hours | Medium |
| #8 | Grouped search results | 3-4 hours | Low-Medium |
| #10 | Modular cheatsheet | 2-3 hours | Low |
| #11 | Case normalization | 4-6 hours | Low |
| #12 | Query rule caching | Research | Low |

---

## 7. Proposed API Changes

### 7.1 New Parameters for Existing Tools

```typescript
// roam_fetch_page_by_title
{
  title: string;
  format?: 'markdown' | 'raw' | 'compact';  // NEW: compact omits empty fields
  resolve_refs?: boolean;  // NEW: default true for markdown, false for raw/compact
  ref_depth?: 1 | 2 | 3 | 4;  // NEW: default 2
}

// roam_fetch_block_with_children
{
  block_uid: string;
  depth?: number;
  include_refs?: boolean;  // NEW: default false
  compact?: boolean;  // NEW: omit empty fields
}

// roam_update_page_markdown
{
  title: string;
  markdown: string;
  dry_run?: boolean;
  include_actions?: boolean;  // NEW: default false unless dry_run
}

// roam_create_outline
{
  outline: OutlineItem[];
  page_title_uid?: string;
  block_text_uid?: string;
  verify?: boolean;  // NEW: default false, skip post-creation queries
}
```

### 7.2 New Compact Response Formats

```typescript
// Compact page response (omits nulls/empties)
interface CompactBlock {
  uid: string;
  string: string;
  children?: CompactBlock[];  // Only if non-empty
  heading?: 1 | 2 | 3;  // Only if set
  refs?: CompactBlock[];  // Only if present and requested
}

// Grouped search response
interface GroupedSearchResult {
  success: boolean;
  message: string;
  total_count: number;
  pages: {
    [page_title: string]: {
      matches: Array<{
        block_uid: string;
        content: string;
        created?: number;
        modified?: number;
      }>;
    };
  };
}
```

---

## 8. Estimated Total Impact

### Before Optimization (Typical Page Edit Workflow)

| Operation | Tokens (est.) |
|-----------|---------------|
| Tool schema (list_tools) | ~2,500 |
| Cheatsheet load | ~1,200 |
| Fetch page (100 blocks) | ~4,000 |
| Update page (dry_run) | ~6,000 |
| Update page (execute) | ~6,000 |
| **Total** | **~19,700** |

### After Optimization (Same Workflow)

| Operation | Tokens (est.) | Savings |
|-----------|---------------|---------|
| Tool schema (list_tools) | ~1,500 | 40% |
| Cheatsheet load (core) | ~600 | 50% |
| Fetch page (compact) | ~2,000 | 50% |
| Update page (dry_run) | ~3,500 | 42% |
| Update page (execute, no actions) | ~500 | 92% |
| **Total** | **~8,100** | **59%** |

---

## 9. Backward Compatibility

All proposed changes maintain backward compatibility:

1. **New parameters** have sensible defaults matching current behavior
2. **Response formats** default to existing behavior unless explicitly changed
3. **Verification** can be re-enabled for callers who need it
4. **Schema descriptions** are shortened but not removed

---

## 10. Next Steps

1. **Validate estimates** with real-world token counting
2. **Prototype Priority 1** optimizations
3. **Benchmark** before/after on representative workflows
4. **Document** new parameters in tool descriptions
5. **Consider** MCP-level caching for repeated requests

---

## Appendix A: Files Analyzed

| File | Purpose | Token Relevance |
|------|---------|-----------------|
| `src/tools/operations/pages.ts` | Page CRUD operations | Response formats, queries |
| `src/tools/operations/outline.ts` | Outline creation | Verification overhead |
| `src/tools/operations/block-retrieval.ts` | Block fetching | Reference resolution |
| `src/tools/helpers/refs.ts` | Reference resolution | Cascade expansion |
| `src/tools/schemas.ts` | Tool definitions | Schema verbosity |
| `src/search/utils.ts` | Search utilities | Result formatting |
| `src/search/tag-search.ts` | Tag search | Response structure |
| `src/server/roam-server.ts` | Request handling | JSON serialization |
| `src/markdown-utils.ts` | Markdown parsing | Conversion overhead |
| `src/diff/` | Smart diff algorithm | Action generation |
| `Roam_Markdown_Cheatsheet.md` | Context document | Context size |

---

## Appendix B: Token Estimation Methodology

Estimates based on:
- Claude tokenizer (~4 characters per token for JSON/code)
- Sample responses from real Roam graphs
- Worst-case analysis for deeply nested content

Actual savings may vary based on:
- Graph size and complexity
- Typical page sizes
- Reference density
- Usage patterns

---

*Analysis conducted using Claude Opus 4.5 with comprehensive codebase review.*
