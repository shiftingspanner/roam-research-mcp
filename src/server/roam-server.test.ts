import { describe, it, expect } from 'vitest';
import { toolSchemas } from '../tools/schemas.js';

/**
 * Tests for MCP server tool discovery and schema validation.
 * These tests verify that tool schemas are well-formed and follow
 * MCP guidance without requiring a live Roam API connection.
 */

const EXPECTED_TOOLS = [
  'roam_add_todo',
  'roam_fetch_page_by_title',
  'roam_create_page',
  'roam_create_outline',
  'roam_import_markdown',
  'roam_search_for_tag',
  'roam_search_by_status',
  'roam_search_block_refs',
  'roam_search_hierarchy',
  'roam_find_pages_modified_today',
  'roam_search_by_text',
  'roam_search_by_date',
  'roam_markdown_cheatsheet',
  'roam_remember',
  'roam_recall',
  'roam_datomic_query',
  'roam_process_batch_actions',
  'roam_fetch_block_with_children',
  'roam_create_table',
  'roam_move_block',
  'roam_update_page_markdown',
  'roam_rename_page',
];

describe('Tool Schemas', () => {
  it('exports all expected tools', () => {
    const toolNames = Object.keys(toolSchemas);
    for (const expected of EXPECTED_TOOLS) {
      expect(toolNames).toContain(expected);
    }
  });

  it('each tool has required schema properties', () => {
    for (const [toolName, schema] of Object.entries(toolSchemas)) {
      // Each tool must have name, description, and inputSchema
      expect(schema.name, `${toolName} missing name`).toBe(toolName);
      expect(schema.description, `${toolName} missing description`).toBeTruthy();
      expect(schema.inputSchema, `${toolName} missing inputSchema`).toBeTruthy();
      expect(schema.inputSchema.type, `${toolName} inputSchema must be object type`).toBe('object');
      expect(schema.inputSchema.properties, `${toolName} missing properties`).toBeTruthy();
    }
  });

  it('all tools include multi-graph parameters', () => {
    for (const [toolName, schema] of Object.entries(toolSchemas)) {
      const props = schema.inputSchema.properties as Record<string, any>;
      expect(props.graph, `${toolName} missing graph parameter`).toBeTruthy();
      expect(props.write_key, `${toolName} missing write_key parameter`).toBeTruthy();
    }
  });

  it('tool descriptions include return type documentation', () => {
    // All tools except roam_markdown_cheatsheet should document what they return
    const toolsWithReturns = Object.entries(toolSchemas).filter(
      ([name]) => name !== 'roam_markdown_cheatsheet'
    );

    for (const [toolName, schema] of toolsWithReturns) {
      expect(
        schema.description.toLowerCase(),
        `${toolName} description should document return type`
      ).toContain('returns');
    }
  });

  it('enum parameters have valid enum arrays', () => {
    for (const [toolName, schema] of Object.entries(toolSchemas)) {
      const props = schema.inputSchema.properties as Record<string, any>;
      for (const [propName, prop] of Object.entries(props)) {
        if (prop && typeof prop === 'object' && 'enum' in prop) {
          expect(
            Array.isArray(prop.enum),
            `${toolName}.${propName} enum must be an array`
          ).toBe(true);
          expect(
            prop.enum.length,
            `${toolName}.${propName} enum must not be empty`
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it('required fields reference existing properties', () => {
    for (const [toolName, schema] of Object.entries(toolSchemas)) {
      const props = schema.inputSchema.properties as Record<string, any>;
      const required = (schema.inputSchema as any).required || [];
      for (const field of required) {
        expect(
          props[field],
          `${toolName} required field "${field}" not found in properties`
        ).toBeTruthy();
      }
    }
  });

  it('numeric parameters with min/max have valid ranges', () => {
    for (const [toolName, schema] of Object.entries(toolSchemas)) {
      const props = schema.inputSchema.properties as Record<string, any>;
      for (const [propName, prop] of Object.entries(props)) {
        if (prop && typeof prop === 'object' && 'minimum' in prop && 'maximum' in prop) {
          expect(
            prop.minimum <= prop.maximum,
            `${toolName}.${propName} minimum (${prop.minimum}) must be <= maximum (${prop.maximum})`
          ).toBe(true);
        }
      }
    }
  });
});
