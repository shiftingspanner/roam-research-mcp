import { Graph } from '@roam-research/roam-api-sdk';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { getOrCreateTodayPage } from '../helpers/page-resolution.js';
import { executeBatch } from '../helpers/batch-utils.js';

export class TodoOperations {
  constructor(private graph: Graph) {}

  async addTodos(todos: string[]): Promise<{ success: boolean }> {
    if (!Array.isArray(todos) || todos.length === 0) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'todos must be a non-empty array'
      );
    }

    // Get or create today's daily page
    const targetPageUid = await getOrCreateTodayPage(this.graph);

    const todo_tag = "{{[[TODO]]}}";
    const actions = todos.map((todo, index) => ({
      action: 'create-block',
      location: {
        'parent-uid': targetPageUid,
        order: index
      },
      block: {
        string: `${todo_tag} ${todo}`
      }
    }));

    await executeBatch(this.graph, actions, 'create todo blocks');
    return { success: true };
  }
}
