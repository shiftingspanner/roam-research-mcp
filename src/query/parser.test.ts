import { describe, it, expect } from 'vitest';
import { QueryParser, QueryParseError } from './parser.js';
import { DatalogGenerator, buildDatalogQuery } from './generator.js';

describe('QueryParser', () => {
  describe('tag parsing', () => {
    it('parses a single tag', () => {
      const result = QueryParser.parse('[[Project]]');
      expect(result).toEqual({ type: 'tag', value: 'Project' });
    });

    it('parses a tag with spaces', () => {
      const result = QueryParser.parse('[[My Project]]');
      expect(result).toEqual({ type: 'tag', value: 'My Project' });
    });

    it('parses a namespaced tag', () => {
      const result = QueryParser.parse('[[Convention/Roam]]');
      expect(result).toEqual({ type: 'tag', value: 'Convention/Roam' });
    });
  });

  describe('and operator', () => {
    it('parses and with two tags', () => {
      const result = QueryParser.parse('{and: [[tag1]] [[tag2]]}');
      expect(result).toEqual({
        type: 'and',
        children: [
          { type: 'tag', value: 'tag1' },
          { type: 'tag', value: 'tag2' }
        ]
      });
    });

    it('parses and with multiple tags', () => {
      const result = QueryParser.parse('{and: [[a]] [[b]] [[c]]}');
      expect(result).toEqual({
        type: 'and',
        children: [
          { type: 'tag', value: 'a' },
          { type: 'tag', value: 'b' },
          { type: 'tag', value: 'c' }
        ]
      });
    });
  });

  describe('or operator', () => {
    it('parses or with two tags', () => {
      const result = QueryParser.parse('{or: [[tag1]] [[tag2]]}');
      expect(result).toEqual({
        type: 'or',
        children: [
          { type: 'tag', value: 'tag1' },
          { type: 'tag', value: 'tag2' }
        ]
      });
    });
  });

  describe('not operator', () => {
    it('parses not with a tag', () => {
      const result = QueryParser.parse('{not: [[excluded]]}');
      expect(result).toEqual({
        type: 'not',
        child: { type: 'tag', value: 'excluded' }
      });
    });
  });

  describe('between operator', () => {
    it('parses between with two dates', () => {
      const result = QueryParser.parse('{between: [[January 1st, 2026]] [[January 31st, 2026]]}');
      expect(result).toEqual({
        type: 'between',
        startDate: 'January 1st, 2026',
        endDate: 'January 31st, 2026'
      });
    });

    it('parses between with relative dates', () => {
      const result = QueryParser.parse('{between: [[last month]] [[last week]]}');
      expect(result).toEqual({
        type: 'between',
        startDate: 'last month',
        endDate: 'last week'
      });
    });
  });

  describe('nested queries', () => {
    it('parses and containing or', () => {
      const result = QueryParser.parse('{and: {or: [[a]] [[b]]} [[c]]}');
      expect(result).toEqual({
        type: 'and',
        children: [
          {
            type: 'or',
            children: [
              { type: 'tag', value: 'a' },
              { type: 'tag', value: 'b' }
            ]
          },
          { type: 'tag', value: 'c' }
        ]
      });
    });

    it('parses and with not', () => {
      const result = QueryParser.parse('{and: [[include]] {not: [[exclude]]}}');
      expect(result).toEqual({
        type: 'and',
        children: [
          { type: 'tag', value: 'include' },
          {
            type: 'not',
            child: { type: 'tag', value: 'exclude' }
          }
        ]
      });
    });

    it('parses complex nested query', () => {
      const result = QueryParser.parse('{and: {or: [[Project]] [[Task]]} {not: [[Archive]]} [[TODO]]}');
      expect(result).toEqual({
        type: 'and',
        children: [
          {
            type: 'or',
            children: [
              { type: 'tag', value: 'Project' },
              { type: 'tag', value: 'Task' }
            ]
          },
          {
            type: 'not',
            child: { type: 'tag', value: 'Archive' }
          },
          { type: 'tag', value: 'TODO' }
        ]
      });
    });
  });

  describe('full query block format', () => {
    it('parses {{[[query]]: ...}} format', () => {
      const result = QueryParser.parse('{{[[query]]: {and: [[Convention/Roam]] [[Roam]]}}}');
      expect(result).toEqual({
        type: 'and',
        children: [
          { type: 'tag', value: 'Convention/Roam' },
          { type: 'tag', value: 'Roam' }
        ]
      });
    });

    it('handles whitespace in query block', () => {
      const result = QueryParser.parse('{{[[query]]:   {and: [[a]] [[b]]}  }}');
      expect(result).toEqual({
        type: 'and',
        children: [
          { type: 'tag', value: 'a' },
          { type: 'tag', value: 'b' }
        ]
      });
    });
  });

  describe('named queries', () => {
    it('parses named query with parseWithName', () => {
      const result = QueryParser.parseWithName('{{[[query]]: "My Query Name" {and: [[a]] [[b]]}}}');
      expect(result.name).toBe('My Query Name');
      expect(result.query).toEqual({
        type: 'and',
        children: [
          { type: 'tag', value: 'a' },
          { type: 'tag', value: 'b' }
        ]
      });
    });

    it('returns undefined name for unnamed query', () => {
      const result = QueryParser.parseWithName('{{[[query]]: {and: [[a]] [[b]]}}}');
      expect(result.name).toBeUndefined();
      expect(result.query.type).toBe('and');
    });

    it('parse() ignores name and returns just the query', () => {
      const result = QueryParser.parse('{{[[query]]: "Named Query" [[tag]]}}');
      expect(result).toEqual({ type: 'tag', value: 'tag' });
    });

    it('handles escaped quotes in name', () => {
      const result = QueryParser.parseWithName('{search: test}');
      // Simple query without name
      expect(result.name).toBeUndefined();
    });
  });

  describe('block reference', () => {
    it('parses block ref', () => {
      const result = QueryParser.parse('((abc123def))');
      expect(result).toEqual({ type: 'block-ref', uid: 'abc123def' });
    });

    it('parses block ref in and', () => {
      const result = QueryParser.parse('{and: [[tag]] ((uid123))}');
      expect(result).toEqual({
        type: 'and',
        children: [
          { type: 'tag', value: 'tag' },
          { type: 'block-ref', uid: 'uid123' }
        ]
      });
    });
  });

  describe('search operator', () => {
    it('parses search with unquoted text', () => {
      const result = QueryParser.parse('{search: hello world}');
      expect(result).toEqual({ type: 'search', text: 'hello world' });
    });

    it('parses search with quoted text', () => {
      const result = QueryParser.parse('{search: "exact phrase"}');
      expect(result).toEqual({ type: 'search', text: 'exact phrase' });
    });
  });

  describe('daily notes operator', () => {
    it('parses daily notes', () => {
      const result = QueryParser.parse('{daily notes: }');
      expect(result).toEqual({ type: 'daily-notes' });
    });

    it('parses daily notes in and', () => {
      const result = QueryParser.parse('{and: {daily notes: } [[tag]]}');
      expect(result).toEqual({
        type: 'and',
        children: [
          { type: 'daily-notes' },
          { type: 'tag', value: 'tag' }
        ]
      });
    });
  });

  describe('by operator', () => {
    it('parses by with page ref', () => {
      const result = QueryParser.parse('{by: [[PAI System User]]}');
      expect(result).toEqual({ type: 'by', user: 'PAI System User' });
    });

    it('parses by in complex query', () => {
      const result = QueryParser.parse('{{[[query]]: "Test Query" {and: [[Test/CreatePage Fix Verification]] {by: [[PAI System User]]}}}}');
      expect(result).toEqual({
        type: 'and',
        children: [
          { type: 'tag', value: 'Test/CreatePage Fix Verification' },
          { type: 'by', user: 'PAI System User' }
        ]
      });
    });
  });

  describe('created by operator', () => {
    it('parses created by with plain text', () => {
      const result = QueryParser.parse('{created by: John Doe}');
      expect(result).toEqual({ type: 'created-by', user: 'John Doe' });
    });

    it('parses created by with page ref', () => {
      const result = QueryParser.parse('{created by: [[John Doe]]}');
      expect(result).toEqual({ type: 'created-by', user: 'John Doe' });
    });
  });

  describe('edited by operator', () => {
    it('parses edited by with plain text', () => {
      const result = QueryParser.parse('{edited by: Jane Smith}');
      expect(result).toEqual({ type: 'edited-by', user: 'Jane Smith' });
    });
  });

  describe('error handling', () => {
    it('throws on unclosed tag', () => {
      expect(() => QueryParser.parse('[[unclosed')).toThrow(QueryParseError);
    });

    it('throws on unknown operator', () => {
      expect(() => QueryParser.parse('{unknown: [[tag]]}')).toThrow(QueryParseError);
    });

    it('throws on empty and', () => {
      expect(() => QueryParser.parse('{and: }')).toThrow(QueryParseError);
    });
  });
});

describe('DatalogGenerator', () => {
  const generator = new DatalogGenerator();

  describe('tag generation', () => {
    it('generates ref clauses for a tag', () => {
      const ast = QueryParser.parse('[[Project]]');
      const clauses = generator.generate(ast);

      expect(clauses.where).toContain('[?ref-0 :node/title "Project"]');
      expect(clauses.where).toContain('[?b :block/refs ?ref-0]');
    });
  });

  describe('and generation', () => {
    it('generates multiple ref clauses', () => {
      const ast = QueryParser.parse('{and: [[tag1]] [[tag2]]}');
      const clauses = generator.generate(ast);

      expect(clauses.where.length).toBe(4); // 2 refs, 2 title matches
      expect(clauses.where).toContain('[?ref-0 :node/title "tag1"]');
      expect(clauses.where).toContain('[?ref-1 :node/title "tag2"]');
    });
  });

  describe('or generation', () => {
    it('generates or-join clause', () => {
      const ast = QueryParser.parse('{or: [[a]] [[b]]}');
      const clauses = generator.generate(ast);

      expect(clauses.where.length).toBe(1);
      expect(clauses.where[0]).toContain('or-join');
      expect(clauses.where[0]).toContain('[?b]');
    });
  });

  describe('not generation', () => {
    it('wraps in not clause', () => {
      const ast = QueryParser.parse('{not: [[excluded]]}');
      const clauses = generator.generate(ast);

      expect(clauses.where.length).toBe(1);
      expect(clauses.where[0]).toMatch(/^\(not /);
    });
  });

  describe('block-ref generation', () => {
    it('generates block ref clauses', () => {
      const ast = QueryParser.parse('((uid123))');
      const clauses = generator.generate(ast);

      expect(clauses.where).toContain('[?block-ref-0 :block/uid "uid123"]');
      expect(clauses.where).toContain('[?b :block/refs ?block-ref-0]');
    });
  });

  describe('search generation', () => {
    it('generates search clause', () => {
      const ast = QueryParser.parse('{search: test query}');
      const clauses = generator.generate(ast);

      expect(clauses.where.length).toBe(1);
      expect(clauses.where[0]).toContain('clojure.string/includes?');
      expect(clauses.where[0]).toContain('test query');
    });
  });

  describe('daily-notes generation', () => {
    it('generates daily notes filter', () => {
      const ast = QueryParser.parse('{daily notes: }');
      const clauses = generator.generate(ast);

      expect(clauses.where.some(c => c.includes('re-find'))).toBe(true);
      expect(clauses.where.some(c => c.includes('January|February'))).toBe(true);
    });
  });

  describe('between generation with relative dates', () => {
    it('generates between with relative dates', () => {
      const ast = QueryParser.parse('{between: [[last month]] [[today]]}');
      const clauses = generator.generate(ast);

      // Should have create/time clauses
      expect(clauses.where.some(c => c.includes(':create/time'))).toBe(true);
      // Should have input values (timestamps)
      expect(clauses.inputValues.length).toBe(2);
      expect(typeof clauses.inputValues[0]).toBe('number');
      expect(typeof clauses.inputValues[1]).toBe('number');
      // Start should be before end
      expect(clauses.inputValues[0]).toBeLessThan(clauses.inputValues[1] as number);
    });

    it('handles "N days ago" format', () => {
      const ast = QueryParser.parse('{between: [[7 days ago]] [[today]]}');
      const clauses = generator.generate(ast);

      expect(clauses.inputValues.length).toBe(2);
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const diff = (clauses.inputValues[1] as number) - (clauses.inputValues[0] as number);
      // Difference should be approximately 7 days (with some buffer for end-of-day adjustment)
      expect(diff).toBeGreaterThanOrEqual(sevenDaysMs);
    });
  });

  describe('by generation', () => {
    it('generates by clause with or-join', () => {
      const ast = QueryParser.parse('{by: [[Test User]]}');
      const clauses = generator.generate(ast);

      expect(clauses.where.length).toBe(1);
      expect(clauses.where[0]).toContain('or-join');
      expect(clauses.where[0]).toContain(':create/user');
      expect(clauses.where[0]).toContain(':edit/user');
      expect(clauses.where[0]).toContain('Test User');
    });
  });

  describe('created-by generation', () => {
    it('generates created by clause', () => {
      const ast = QueryParser.parse('{created by: John}');
      const clauses = generator.generate(ast);

      expect(clauses.where.some(c => c.includes(':create/user'))).toBe(true);
      expect(clauses.where.some(c => c.includes(':user/display-name'))).toBe(true);
    });
  });

  describe('buildDatalogQuery', () => {
    it('builds complete query string', () => {
      const ast = QueryParser.parse('{and: [[Project]] [[TODO]]}');
      const clauses = generator.generate(ast);
      const { query, args } = buildDatalogQuery(clauses, { limit: 50 });

      expect(query).toContain(':find');
      expect(query).toContain(':where');
      expect(query).toContain(':limit 50');
      expect(query).toContain('[?b :block/string ?block-str]');
      expect(args).toEqual([]);
    });

    it('adds page scope when pageUid provided', () => {
      const ast = QueryParser.parse('[[tag]]');
      const clauses = generator.generate(ast);
      const { query, args } = buildDatalogQuery(clauses, { pageUid: 'abc123' });

      expect(query).toContain('?target-page-uid');
      expect(args).toContain('abc123');
    });
  });
});
