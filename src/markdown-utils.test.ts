import { describe, it, expect } from 'vitest';
import { parseMarkdown, convertToRoamActions } from './markdown-utils.js';

describe('markdown-utils', () => {
  describe('parseMarkdown - numbered lists', () => {
    it('should detect numbered list items and strip prefixes', () => {
      const markdown = `1. First item
2. Second item
3. Third item`;

      const nodes = parseMarkdown(markdown);

      expect(nodes).toHaveLength(3);
      expect(nodes[0].content).toBe('First item');
      expect(nodes[1].content).toBe('Second item');
      expect(nodes[2].content).toBe('Third item');
      // Root-level numbered items don't get children_view_type (no parent)
      expect(nodes[0].children_view_type).toBeUndefined();
    });

    it('should set children_view_type: numbered on parent of numbered items', () => {
      const markdown = `Parent block
  1. First numbered
  2. Second numbered`;

      const nodes = parseMarkdown(markdown);

      expect(nodes).toHaveLength(1);
      expect(nodes[0].content).toBe('Parent block');
      expect(nodes[0].children_view_type).toBe('numbered');
      expect(nodes[0].children).toHaveLength(2);
      expect(nodes[0].children[0].content).toBe('First numbered');
      expect(nodes[0].children[1].content).toBe('Second numbered');
    });

    it('should handle nested numbered lists', () => {
      const markdown = `- Parent
  1. First
  2. Second
    1. Nested first
    2. Nested second`;

      const nodes = parseMarkdown(markdown);

      expect(nodes).toHaveLength(1);
      expect(nodes[0].content).toBe('Parent');
      expect(nodes[0].children_view_type).toBe('numbered');
      expect(nodes[0].children).toHaveLength(2);
      expect(nodes[0].children[1].children_view_type).toBe('numbered');
      expect(nodes[0].children[1].children).toHaveLength(2);
    });

    it('should handle mixed bullet and numbered lists', () => {
      const markdown = `- Bullet item
1. Numbered item
- Another bullet`;

      const nodes = parseMarkdown(markdown);

      expect(nodes).toHaveLength(3);
      expect(nodes[0].content).toBe('Bullet item');
      expect(nodes[1].content).toBe('Numbered item');
      expect(nodes[2].content).toBe('Another bullet');
    });

    it('should handle double-digit numbers', () => {
      const markdown = `10. Tenth item
11. Eleventh item
99. Ninety-ninth item`;

      const nodes = parseMarkdown(markdown);

      expect(nodes).toHaveLength(3);
      expect(nodes[0].content).toBe('Tenth item');
      expect(nodes[1].content).toBe('Eleventh item');
      expect(nodes[2].content).toBe('Ninety-ninth item');
    });
  });

  describe('parseMarkdown - horizontal rules', () => {
    it('should convert --- to Roam HR', () => {
      const markdown = `Before
---
After`;

      const nodes = parseMarkdown(markdown);

      expect(nodes).toHaveLength(3);
      expect(nodes[0].content).toBe('Before');
      expect(nodes[1].content).toBe('---');
      expect(nodes[1].is_hr).toBe(true);
      expect(nodes[2].content).toBe('After');
    });

    it('should convert *** to Roam HR', () => {
      const markdown = `Before
***
After`;

      const nodes = parseMarkdown(markdown);

      expect(nodes).toHaveLength(3);
      expect(nodes[1].content).toBe('---');
      expect(nodes[1].is_hr).toBe(true);
    });

    it('should convert ___ to Roam HR', () => {
      const markdown = `Before
___
After`;

      const nodes = parseMarkdown(markdown);

      expect(nodes).toHaveLength(3);
      expect(nodes[1].content).toBe('---');
      expect(nodes[1].is_hr).toBe(true);
    });

    it('should handle longer HR variants', () => {
      const markdown = `-----
*****
_______`;

      const nodes = parseMarkdown(markdown);

      expect(nodes).toHaveLength(3);
      expect(nodes[0].content).toBe('---');
      expect(nodes[1].content).toBe('---');
      expect(nodes[2].content).toBe('---');
    });

    it('should not convert inline dashes', () => {
      const markdown = `This has -- some dashes
And this--too`;

      const nodes = parseMarkdown(markdown);

      expect(nodes).toHaveLength(2);
      expect(nodes[0].is_hr).toBeUndefined();
      expect(nodes[1].is_hr).toBeUndefined();
    });
  });

  describe('convertToRoamActions - numbered lists', () => {
    it('should include children-view-type in block action', () => {
      const markdown = `Parent
  1. First
  2. Second`;

      const nodes = parseMarkdown(markdown);
      const actions = convertToRoamActions(nodes, 'test-page-uid');

      // First action is the parent block
      const parentAction = actions[0] as any;
      expect(parentAction.block['children-view-type']).toBe('numbered');
    });
  });
});
