/**
 * Roam Query Block Parser and Executor
 *
 * Parses Roam query block syntax and executes as Datalog queries
 *
 * Usage:
 *   import { QueryExecutor } from './query/index.js';
 *
 *   const executor = new QueryExecutor(graph);
 *   const results = await executor.execute('{{[[query]]: {and: [[Project]] [[TODO]]}}}');
 */

export { QueryParser, QueryParseError, type ParseResult } from './parser.js';
export { DatalogGenerator, buildDatalogQuery } from './generator.js';
export type {
  QueryNode,
  AndNode,
  OrNode,
  NotNode,
  BetweenNode,
  TagNode,
  DatalogClauses,
  QueryOptions
} from './types.js';

import { q } from '@roam-research/roam-api-sdk';
import type { Graph } from '@roam-research/roam-api-sdk';
import { QueryParser } from './parser.js';
import { DatalogGenerator, buildDatalogQuery } from './generator.js';
import type { QueryOptions } from './types.js';
import { resolveRefs } from '../tools/helpers/refs.js';

export interface QueryResult {
  success: boolean;
  matches: Array<{
    block_uid: string;
    content: string;
    page_title?: string;
  }>;
  message: string;
  total_count?: number;
  query?: string; // The generated Datalog query (for debugging)
}

export class QueryExecutor {
  private generator: DatalogGenerator;

  constructor(private graph: Graph) {
    this.generator = new DatalogGenerator();
  }

  /**
   * Parse and execute a Roam query block
   *
   * @param queryBlock - The query block text, e.g., "{{[[query]]: {and: [[tag1]] [[tag2]]}}}"
   * @param options - Execution options (limit, offset, pageUid)
   * @returns Query results
   */
  async execute(queryBlock: string, options: QueryOptions = {}): Promise<QueryResult> {
    try {
      // Parse the query
      const ast = QueryParser.parse(queryBlock);

      // Generate Datalog clauses
      const clauses = this.generator.generate(ast);

      // Build the full query
      const { query, args } = buildDatalogQuery(clauses, {
        limit: options.limit,
        offset: options.offset,
        pageUid: options.pageUid,
        orderBy: options.orderBy || '?block-uid asc'
      });

      // Execute query
      const rawResults = await q(this.graph, query, args) as [string, string, string][];

      // Resolve block references in content
      const resolvedResults = await Promise.all(
        rawResults.map(async ([uid, content, pageTitle]) => {
          const resolvedContent = await resolveRefs(this.graph, content);
          return {
            block_uid: uid,
            content: resolvedContent,
            page_title: pageTitle
          };
        })
      );

      // Get total count if pagination is used
      let totalCount = resolvedResults.length;
      if (options.limit !== undefined && options.limit !== -1) {
        const countQuery = this.buildCountQuery(clauses, options.pageUid);
        const countResults = await q(this.graph, countQuery.query, countQuery.args) as number[][];
        totalCount = countResults[0]?.[0] ?? 0;
      }

      return {
        success: true,
        matches: resolvedResults,
        message: `Found ${resolvedResults.length} block(s) matching query`,
        total_count: totalCount,
        query // Include for debugging
      };
    } catch (error) {
      return {
        success: false,
        matches: [],
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Parse a query block without executing (for validation/debugging)
   */
  parse(queryBlock: string): { ast: ReturnType<typeof QueryParser.parse>; datalog: ReturnType<typeof buildDatalogQuery> } {
    const ast = QueryParser.parse(queryBlock);
    const clauses = this.generator.generate(ast);
    const datalog = buildDatalogQuery(clauses);
    return { ast, datalog };
  }

  private buildCountQuery(clauses: ReturnType<DatalogGenerator['generate']>, pageUid?: string) {
    let inClause = ':in $';
    if (clauses.inputs.length > 0) {
      inClause += ' ' + clauses.inputs.join(' ');
    }
    if (pageUid) {
      inClause += ' ?target-page-uid';
    }

    const baseClauses = [
      '[?b :block/string ?block-str]',
      '[?b :block/uid ?block-uid]',
      '[?b :block/page ?p]'
    ];

    if (pageUid) {
      baseClauses.push('[?p :block/uid ?target-page-uid]');
    }

    const allWhereClauses = [...baseClauses, ...clauses.where];

    const query = `[:find (count ?b)
                    ${inClause}
                    :where
                    ${allWhereClauses.join('\n                    ')}]`;

    const args: (string | number)[] = [...clauses.inputValues];
    if (pageUid) {
      args.push(pageUid);
    }

    return { query, args };
  }
}

/**
 * Detect if a block string contains a query block
 */
export function isQueryBlock(text: string): boolean {
  return /^\s*\{\{\[\[query\]\]:/i.test(text);
}

/**
 * Extract all query blocks from a string (handles nested braces)
 */
export function extractQueryBlocks(text: string): string[] {
  const matches: string[] = [];
  const prefix = '{{[[query]]:';
  let startIdx = 0;

  while (startIdx < text.length) {
    const foundIdx = text.indexOf(prefix, startIdx);
    if (foundIdx === -1) break;

    // Find matching closing }}
    let depth = 2; // We've seen {{
    let pos = foundIdx + prefix.length;

    while (pos < text.length && depth > 0) {
      if (text[pos] === '{') {
        depth++;
      } else if (text[pos] === '}') {
        depth--;
      }
      pos++;
    }

    if (depth === 0) {
      matches.push(text.slice(foundIdx, pos));
    }

    startIdx = pos;
  }

  return matches;
}
