/**
 * Parser for Roam Query Block syntax
 *
 * Parses queries like:
 *   {{[[query]]: {and: [[tag1]] [[tag2]]}}}
 *   {{[[query]]: {or: [[a]] {not: [[b]]}}}}
 *   {{[[query]]: {and: {between: [[January 1st, 2026]] [[January 31st, 2026]]} [[Project]]}}}
 */

import type {
  QueryNode, AndNode, OrNode, NotNode, BetweenNode, TagNode,
  BlockRefNode, SearchNode, DailyNotesNode, ByNode, CreatedByNode, EditedByNode
} from './types.js';

export class QueryParseError extends Error {
  constructor(message: string, public position?: number) {
    super(message);
    this.name = 'QueryParseError';
  }
}

export interface ParseResult {
  name?: string;
  query: QueryNode;
}

export class QueryParser {
  private input: string;
  private pos: number;

  constructor(input: string) {
    this.input = input;
    this.pos = 0;
  }

  /**
   * Parse a Roam query block string into an AST
   * Accepts either the full block syntax or just the query expression
   */
  static parse(input: string): QueryNode {
    const result = QueryParser.parseWithName(input);
    return result.query;
  }

  /**
   * Parse a Roam query block string into an AST with optional name
   * Returns both the name (if present) and the query AST
   */
  static parseWithName(input: string): ParseResult {
    const parser = new QueryParser(input);
    return parser.parseQueryWithName();
  }

  /**
   * Extract query expression from a full query block
   * {{[[query]]: expression}} -> expression
   * {{[[query]]: "name" expression}} -> expression (name extracted separately)
   */
  private extractQueryExpression(): string {
    const trimmed = this.input.trim();

    // Full query block format
    const fullMatch = trimmed.match(/^\{\{\[\[query\]\]:\s*(.+)\}\}$/s);
    if (fullMatch) {
      return fullMatch[1].trim();
    }

    // Already just the expression
    return trimmed;
  }

  parseQueryWithName(): ParseResult {
    this.input = this.extractQueryExpression();
    this.pos = 0;

    this.skipWhitespace();

    // Check for optional name prefix (quoted string)
    let name: string | undefined;
    if (this.peek() === '"') {
      name = this.parseQuotedString();
      this.skipWhitespace();
    }

    const query = this.parseExpression();
    this.skipWhitespace();

    if (this.pos < this.input.length) {
      throw new QueryParseError(
        `Unexpected content after query: "${this.input.slice(this.pos)}"`,
        this.pos
      );
    }

    return { name, query };
  }

  parseQuery(): QueryNode {
    return this.parseQueryWithName().query;
  }

  private parseQuotedString(): string {
    this.expect('"');
    let value = '';

    while (this.pos < this.input.length && this.peek() !== '"') {
      if (this.peek() === '\\' && this.input[this.pos + 1] === '"') {
        value += '"';
        this.pos += 2;
      } else {
        value += this.input[this.pos];
        this.pos++;
      }
    }

    if (this.peek() === '"') {
      this.pos++; // Skip closing quote
    } else {
      throw new QueryParseError('Unclosed quoted string', this.pos);
    }

    return value;
  }

  private parseExpression(): QueryNode {
    this.skipWhitespace();

    if (this.peek() === '{') {
      return this.parseOperator();
    } else if (this.input.slice(this.pos, this.pos + 2) === '[[') {
      return this.parseTag();
    } else if (this.input.slice(this.pos, this.pos + 2) === '((') {
      return this.parseBlockRef();
    } else {
      throw new QueryParseError(
        `Expected '{', '[[', or '((' at position ${this.pos}, found: "${this.input.slice(this.pos, this.pos + 10)}..."`,
        this.pos
      );
    }
  }

  private parseOperator(): QueryNode {
    this.expect('{');
    this.skipWhitespace();

    const operator = this.parseOperatorName();
    this.skipWhitespace();
    this.expect(':');
    this.skipWhitespace();

    let node: QueryNode;

    switch (operator.toLowerCase()) {
      case 'and':
        node = this.parseAndOr('and');
        break;
      case 'or':
        node = this.parseAndOr('or');
        break;
      case 'not':
        node = this.parseNot();
        break;
      case 'between':
        node = this.parseBetween();
        break;
      case 'search':
        node = this.parseSearch();
        break;
      case 'daily notes':
        node = this.parseDailyNotes();
        break;
      case 'by':
        node = this.parseUserClause('by');
        break;
      case 'created by':
        node = this.parseUserClause('created-by');
        break;
      case 'edited by':
        node = this.parseUserClause('edited-by');
        break;
      default:
        throw new QueryParseError(`Unknown operator: ${operator}`, this.pos);
    }

    this.skipWhitespace();
    this.expect('}');

    return node;
  }

  private parseAndOr(type: 'and' | 'or'): AndNode | OrNode {
    const children: QueryNode[] = [];

    this.skipWhitespace();
    while (this.pos < this.input.length && this.peek() !== '}') {
      children.push(this.parseExpression());
      this.skipWhitespace();
    }

    if (children.length === 0) {
      throw new QueryParseError(`${type} operator requires at least one child`, this.pos);
    }

    return { type, children } as AndNode | OrNode;
  }

  private parseNot(): NotNode {
    this.skipWhitespace();
    const child = this.parseExpression();
    return { type: 'not', child };
  }

  private parseBetween(): BetweenNode {
    this.skipWhitespace();

    // Parse first date
    const startTag = this.parseTag();
    this.skipWhitespace();

    // Parse second date
    const endTag = this.parseTag();

    return {
      type: 'between',
      startDate: startTag.value,
      endDate: endTag.value
    };
  }

  private parseTag(): TagNode {
    this.expect('[');
    this.expect('[');

    let value = '';
    let depth = 1;

    while (this.pos < this.input.length && depth > 0) {
      if (this.input.slice(this.pos, this.pos + 2) === ']]') {
        depth--;
        if (depth === 0) {
          this.pos += 2;
          break;
        }
        value += ']]';
        this.pos += 2;
      } else if (this.input.slice(this.pos, this.pos + 2) === '[[') {
        depth++;
        value += '[[';
        this.pos += 2;
      } else {
        value += this.input[this.pos];
        this.pos++;
      }
    }

    if (depth !== 0) {
      throw new QueryParseError('Unclosed tag reference', this.pos);
    }

    return { type: 'tag', value: value.trim() };
  }

  private parseBlockRef(): BlockRefNode {
    this.expect('(');
    this.expect('(');

    let uid = '';
    while (this.pos < this.input.length) {
      if (this.input.slice(this.pos, this.pos + 2) === '))') {
        this.pos += 2;
        break;
      }
      uid += this.input[this.pos];
      this.pos++;
    }

    if (!uid) {
      throw new QueryParseError('Empty block reference', this.pos);
    }

    return { type: 'block-ref', uid: uid.trim() };
  }

  private parseSearch(): SearchNode {
    // Search text is typically in quotes or just plain text until }
    this.skipWhitespace();

    let text = '';

    // Check if quoted
    if (this.peek() === '"') {
      this.pos++; // Skip opening quote
      while (this.pos < this.input.length && this.peek() !== '"') {
        if (this.peek() === '\\' && this.input[this.pos + 1] === '"') {
          text += '"';
          this.pos += 2;
        } else {
          text += this.input[this.pos];
          this.pos++;
        }
      }
      if (this.peek() === '"') {
        this.pos++; // Skip closing quote
      }
    } else {
      // Unquoted - read until }
      while (this.pos < this.input.length && this.peek() !== '}') {
        text += this.input[this.pos];
        this.pos++;
      }
      text = text.trim();
    }

    return { type: 'search', text };
  }

  private parseDailyNotes(): DailyNotesNode {
    // Daily notes clause has no arguments, just empty or whitespace until }
    return { type: 'daily-notes' };
  }

  private parseUserClause<T extends 'by' | 'created-by' | 'edited-by'>(type: T): { type: T; user: string } {
    this.skipWhitespace();
    const user = this.parseUserIdentifier();
    return { type, user };
  }

  private parseUserIdentifier(): string {
    // User can be in [[display name]] format or plain text
    if (this.input.slice(this.pos, this.pos + 2) === '[[') {
      const tag = this.parseTag();
      return tag.value;
    }

    // Plain text until }
    let user = '';
    while (this.pos < this.input.length && this.peek() !== '}') {
      user += this.input[this.pos];
      this.pos++;
    }
    return user.trim();
  }

  /**
   * Parse operator name, handling multi-word operators like "created by"
   */
  private parseOperatorName(): string {
    const knownMultiWord = ['created by', 'edited by', 'daily notes'];
    const remaining = this.input.slice(this.pos).toLowerCase();

    for (const op of knownMultiWord) {
      if (remaining.startsWith(op)) {
        this.pos += op.length;
        return op;
      }
    }

    // Single word operator
    return this.parseIdentifier();
  }

  private parseIdentifier(): string {
    let id = '';
    while (this.pos < this.input.length && /[a-zA-Z]/.test(this.input[this.pos])) {
      id += this.input[this.pos];
      this.pos++;
    }
    return id;
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
      this.pos++;
    }
  }

  private peek(): string {
    return this.input[this.pos];
  }

  private expect(char: string): void {
    if (this.input[this.pos] !== char) {
      throw new QueryParseError(
        `Expected '${char}' at position ${this.pos}, found '${this.input[this.pos] || 'EOF'}'`,
        this.pos
      );
    }
    this.pos++;
  }
}
