![Roam Research MCP + CLI](./roam-research-mcp-header.png)

# Roam Research MCP + CLI

[![npm version](https://badge.fury.io/js/roam-research-mcp.svg)](https://badge.fury.io/js/roam-research-mcp)
[![Project Status: Active](https://www.repostatus.org/badges/latest/active.svg)](https://www.repostatus.org/#active)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub](https://img.shields.io/github/license/2b3pro/roam-research-mcp)](https://github.com/2b3pro/roam-research-mcp/blob/main/LICENSE)

<a href="https://glama.ai/mcp/servers/fzfznyaflu"><img width="380" height="200" src="https://glama.ai/mcp/servers/fzfznyaflu/badge" alt="Roam Research MCP server" /></a>
<a href="https://mseep.ai/app/2b3pro-roam-research-mcp"><img width="380" height="200" src="https://mseep.net/pr/2b3pro-roam-research-mcp-badge.png" alt="MseeP.ai Security Assessment Badge" /></a>

## Introduction

I created this project to solve a personal problem: I wanted to manage my Roam Research graph directly from **Claude Code** (and other LLMs). As I built the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server to give AI agents access to my notes, I realized the underlying tools were powerful enough to stand on their own.

What started as an backend for AI agents evolved into a full-featured **Standalone CLI**. Now, you can use the same powerful API capabilities directly from your terminal—piping content into Roam, searching your graph, and managing tasks—without needing an LLM at all.

Whether you want to give Claude superpowers over your knowledge base or just want a robust CLI for your own scripts, this project has you covered.

## Features

- **24 MCP tools** for reading, writing, searching, and organizing your Roam graph
- **Dual transport**: Stdio (local) + Streamable HTTP (remote) for maximum flexibility
- **Multi-graph support**: Connect to multiple Roam graphs from a single server instance
- **Write protection**: Safeguard sensitive graphs with write key confirmation
- **Smart diff updates**: Update pages while preserving block UIDs and references
- **Batch operations**: Combine multiple create/update/delete actions in a single API call
- **AI memory management**: Dedicated `remember`/`recall` tools for persistent AI memories
- **Standalone CLI**: Full-featured `roam` command for terminal automation
- **Query block parser**: Convert Roam `{{[[query]]: ...}}` syntax into Datalog
- **Docker support**: Ready-to-use containerized deployment

## Quick Start

### 1. Install

```bash
npm install -g roam-research-mcp
```

### 2. Configure

Copy `.env.example` to `.env` and add your Roam API credentials:

```bash
cp .env.example .env
# Edit .env with your ROAM_API_TOKEN and ROAM_GRAPH_NAME
```

### 3. Run

```bash
# Start the MCP server (stdio mode for Claude Desktop / Claude Code)
npx roam-research-mcp

# Or use the CLI directly
roam get "My Page Title"
```

---

## Standalone CLI: `roam`

The `roam` CLI lets you interact with your graph directly from the terminal. It supports **standard input (stdin) piping** for all content creation and retrieval commands, making it perfect for automation workflows.

### Quick Examples

```bash
# Save a quick thought to your daily page
roam save "Idea: A CLI for Roam would be cool"

# Pipe content from a file to a new page
cat meeting_notes.md | roam save --title "Meeting: Project Alpha"

# Create a TODO item on today's daily page
echo "Buy milk" | roam save --todo

# Search your graph and pipe results to another tool
roam search "important" --json | jq .

# Search for pages by namespace prefix
roam search --namespace "Convention"    # Finds all Convention/* pages

# Fetch a page by title
roam get "Roam Research"

# Fetch page by UID or Roam URL
roam get page abc123def
roam get page "https://roamresearch.com/#/app/my-graph/page/abc123def"

# Sort and group results
roam get --tag Project --sort created --group-by tag

# Find references (backlinks) to a page
roam refs "Project Alpha"

# Update a block (e.g., toggle TODO status)
roam update ((block-uid)) --todo

# Multi-graph: read from a specific graph
roam get "Page Title" -g work

# Multi-graph: write to a protected graph
roam save "Note" -g work --write-key "$ROAM_SYSTEM_WRITE_KEY"
```

**Available Commands:** `get`, `search`, `save`, `refs`, `update`, `batch`, `rename`, `status`.
Run `roam <command> --help` for details on any command.

---

## MCP Server Tools

The MCP server exposes these tools to AI assistants (like Claude), enabling them to read, write, and organize your Roam graph intelligently.

> **Multi-Graph Support:** All tools accept optional `graph` and `write_key` parameters. Use `graph` to target a specific graph from your `ROAM_GRAPHS` config, and `write_key` for write operations on protected graphs.

| Tool Name | Description |
| :--- | :--- |
| `roam_fetch_page_by_title` | Fetch page content by title. |
| `roam_fetch_block_with_children` | Fetch a block and its nested children by UID (resolves refs). |
| `roam_create_page` | Create new pages, optionally with mixed text and table content. |
| `roam_update_page_markdown` | Update a page using smart diff (preserves block UIDs). |
| `roam_search_by_text` | Full-text search across the graph or within specific pages. Supports namespace prefix search for page titles. |
| `roam_search_block_refs` | Find blocks that reference a page, tag, or block UID. |
| `roam_search_by_status` | Find TODO or DONE items. |
| `roam_search_for_tag` | Find blocks containing specific tags (supports exclusion). |
| `roam_search_by_date` | Find blocks/pages by creation or modification date. |
| `roam_find_pages_modified_today` | List pages modified since midnight. |
| `roam_add_todo` | Add TODO items to today's daily page. |
| `roam_create_table` | Create properly formatted Roam tables. |
| `roam_create_outline` | Create hierarchical outlines. |
| `roam_process_batch_actions` | Execute multiple low-level actions (create, move, update, delete) in one batch. |
| `roam_move_block` | Move a block to a new parent or position. |
| `roam_remember` / `roam_recall` | specialized tools for AI memory management within Roam. |
| `roam_datomic_query` | Execute raw Datalog queries for advanced filtering. |
| `roam_markdown_cheatsheet` | Retrieve the Roam-flavored markdown reference. |

---

## Configuration

### Environment Variables

See [`.env.example`](.env.example) for all available settings.

#### Single Graph Mode

For a single Roam graph, set these in your environment or a `.env` file:

```bash
ROAM_API_TOKEN=your-api-token
ROAM_GRAPH_NAME=your-graph-name
```

#### Multi-Graph Mode (v2.0+)

Connect to multiple Roam graphs from a single server instance:

```bash
ROAM_GRAPHS='{
  "personal": {"token": "token-1", "graph": "personal-db", "memoriesTag": "#[[Personal Memories]]"},
  "work": {"token": "token-2", "graph": "work-db", "protected": true, "memoriesTag": "#[[Work Memories]]"},
  "research": {"token": "token-3", "graph": "research-db"}
}'
ROAM_DEFAULT_GRAPH=personal
ROAM_SYSTEM_WRITE_KEY=your-secret-key
```

**Graph Configuration Options:**

| Property | Required | Description |
|----------|----------|-------------|
| `token` | Yes | Roam API token for this graph |
| `graph` | Yes | Graph name/database identifier |
| `protected` | No | If `true`, writes require `ROAM_SYSTEM_WRITE_KEY` confirmation |
| `memoriesTag` | No | Tag for `roam_remember`/`roam_recall` (overrides global default) |

**Write Protection:**
Protected graphs require the `write_key` parameter matching `ROAM_SYSTEM_WRITE_KEY` for any write operation. This prevents accidental writes to sensitive graphs.

*Optional:*
- `ROAM_MEMORIES_TAG`: Default tag for `roam_remember`/`roam_recall` (fallback when per-graph `memoriesTag` not set).
- `HTTP_STREAM_PORT`: To enable HTTP Stream (defaults to 8088).

### Running the Server

**1. Stdio Mode (Default)**
Best for local integration (e.g., Claude Desktop, Claude Code, IDE extensions).

```bash
npx roam-research-mcp
```

**2. HTTP Streamable Mode**
Best for remote access, web clients, or cloud deployments. Uses a single-endpoint Streamable HTTP transport.

```bash
HTTP_STREAM_PORT=8088 npx roam-research-mcp
```

**3. Docker**

```bash
docker run -p 3000:3000 -p 8088:8088 --env-file .env roam-research-mcp
```

---

## Integrating with AI Assistants

### Claude Desktop

Add to your MCP settings file (e.g., `~/Library/Application Support/Claude/claude_desktop_config.json`):

*Single Graph:*
```json
{
  "mcpServers": {
    "roam-research": {
      "command": "npx",
      "args": ["-y", "roam-research-mcp"],
      "env": {
        "ROAM_API_TOKEN": "your-token",
        "ROAM_GRAPH_NAME": "your-graph"
      }
    }
  }
}
```

*Multi-Graph:*
```json
{
  "mcpServers": {
    "roam-research": {
      "command": "npx",
      "args": ["-y", "roam-research-mcp"],
      "env": {
        "ROAM_GRAPHS": "{\"personal\":{\"token\":\"token-1\",\"graph\":\"personal-db\",\"memoriesTag\":\"#[[Memories]]\"},\"work\":{\"token\":\"token-2\",\"graph\":\"work-db\",\"protected\":true}}",
        "ROAM_DEFAULT_GRAPH": "personal",
        "ROAM_SYSTEM_WRITE_KEY": "your-secret-key"
      }
    }
  }
}
```

### Claude Code

Register the MCP server using the `claude mcp add` command:

```bash
# Single graph
claude mcp add roam-research -- npx -y roam-research-mcp \
  --env ROAM_API_TOKEN=your-token \
  --env ROAM_GRAPH_NAME=your-graph

# Multi-graph
claude mcp add roam-research -- npx -y roam-research-mcp \
  --env ROAM_GRAPHS='{"personal":{"token":"...","graph":"..."}}' \
  --env ROAM_DEFAULT_GRAPH=personal
```

Or add directly to your project's `.claude/settings.json`:

```json
{
  "mcpServers": {
    "roam-research": {
      "command": "npx",
      "args": ["-y", "roam-research-mcp"],
      "env": {
        "ROAM_API_TOKEN": "your-token",
        "ROAM_GRAPH_NAME": "your-graph"
      }
    }
  }
}
```

### Cline / Other MCP Clients

Any MCP-compatible client can connect via stdio or Streamable HTTP. Configure the server command as shown in the Claude Desktop example above, adapting to your client's settings format.

For HTTP clients, connect to `http://localhost:8088/mcp` (or your configured port).

---

## Error Handling

Tool errors are returned as structured JSON within the tool result (with `isError: true`), allowing AI assistants to read the error and self-correct. Error responses include:

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Description of what went wrong",
  "suggestion": "How to fix the issue"
}
```

**Common error types:**
- `VALIDATION_ERROR` - Invalid parameters (missing required fields, wrong types)
- `PAGE_NOT_FOUND` / `BLOCK_NOT_FOUND` - Referenced entity doesn't exist
- `RATE_LIMIT` - Too many API requests (includes retry timing)
- `TRANSACTION_FAILED` - Batch operation partially failed (includes committed state)

---

## Security

### Credential Handling

- API tokens are passed via environment variables and never logged or exposed in responses
- Use `.env` files for local development (already excluded in `.gitignore`)
- See `.env.example` for the full list of configurable environment variables
- For production deployments, use your platform's secrets management (e.g., Docker secrets, cloud KMS)

### Write Protection

Protected graphs require a `write_key` parameter matching `ROAM_SYSTEM_WRITE_KEY` for any write operation. This prevents AI assistants from accidentally modifying sensitive graphs.

### HTTP Transport

The Streamable HTTP transport supports CORS origin validation (configurable via `CORS_ORIGIN`). For production HTTP deployments, consider placing the server behind a reverse proxy with authentication.

---

## Query Block Parser (v2.11.0+)

A utility for parsing and executing Roam query blocks programmatically. Converts `{{[[query]]: ...}}` syntax into Datalog queries.

### Supported Clauses

| Clause | Syntax | Description |
|--------|--------|-------------|
| Page ref | `[[page]]` | Blocks referencing a page |
| Block ref | `((uid))` | Blocks referencing a block |
| `and` | `{and: [[a]] [[b]]}` | All conditions must match |
| `or` | `{or: [[a]] [[b]]}` | Any condition matches |
| `not` | `{not: [[tag]]}` | Exclude matches |
| `between` | `{between: [[date1]] [[date2]]}` | Date range filter |
| `search` | `{search: text}` | Full-text search |
| `daily notes` | `{daily notes: }` | Daily notes pages only |
| `by` | `{by: [[User]]}` | Created or edited by user |
| `created by` | `{created by: [[User]]}` | Created by user |
| `edited by` | `{edited by: User}` | Edited by user |

### Relative Dates

The `between` clause supports relative dates: `today`, `yesterday`, `last week`, `last month`, `this year`, `7 days ago`, `2 months ago`, etc.

### Usage

```typescript
import { QueryExecutor } from 'roam-research-mcp/query';

const executor = new QueryExecutor(graph);

// Execute a query
const results = await executor.execute(
  '{{[[query]]: "My Query" {and: [[Project]] {between: [[last month]] [[today]]}}}}'
);

// Parse without executing (for debugging)
const { name, query } = QueryParser.parseWithName(queryBlock);
```

### Utility Functions

```typescript
import { isQueryBlock, extractQueryBlocks } from 'roam-research-mcp/query';

// Detect if text is a query block
isQueryBlock('{{[[query]]: [[tag]]}}'); // true

// Extract all query blocks from a string
extractQueryBlocks(pageContent); // ['{{[[query]]: ...}}', ...]
```

---

## Development

### Prerequisites

- Node.js >= 18.0.0
- npm

### Setup

```bash
git clone https://github.com/2b3pro/roam-research-mcp.git
cd roam-research-mcp
npm install
cp .env.example .env
# Edit .env with your Roam API credentials
```

### Build & Test

```bash
npm run build        # Compile TypeScript to build/
npm test             # Run tests (Vitest)
npm run test:watch   # Run tests in watch mode
npm run watch        # TypeScript watch mode for development
```

### Inspect

Use the MCP Inspector to verify tool schemas and test tool calls interactively:

```bash
npm run inspector
```

### Architecture

```
src/
  index.ts                  # Entry point
  server/roam-server.ts     # MCP server (stdio + Streamable HTTP)
  config/                   # Environment, graph registry
  tools/
    schemas.ts              # Tool definitions & input schemas
    tool-handlers.ts        # Tool dispatch
    operations/             # Tool implementations (pages, blocks, search, etc.)
  diff/                     # Smart diff algorithm for page updates
  query/                    # Roam query block parser
  shared/                   # Validation, error types, utilities
  cli/                      # Standalone CLI commands
```

---

## Troubleshooting

**Server won't start: "Missing required environment variables"**
Ensure `ROAM_API_TOKEN` and `ROAM_GRAPH_NAME` are set (single-graph mode) or `ROAM_GRAPHS` and `ROAM_DEFAULT_GRAPH` (multi-graph mode). Check `.env.example` for the correct format.

**"Unknown graph" errors**
Verify the graph key you're passing matches a key in your `ROAM_GRAPHS` configuration.

**Rate limit errors**
The Roam API has rate limits. Use `roam_process_batch_actions` to combine multiple operations into a single API call. The server includes exponential backoff for transient rate limits.

**Write operations rejected on protected graphs**
Provide the `write_key` parameter matching your `ROAM_SYSTEM_WRITE_KEY`. The error message will include the expected key.

**HTTP transport: "Connection refused"**
Ensure `HTTP_STREAM_PORT` is set and the port is not in use. The server auto-selects an available port if the default is taken.

---

## Support

If this project helps you manage your knowledge base or build cool agents, consider buying me a coffee! It helps keep the updates coming.

<a href="https://paypal.me/2b3/5">
  <img src="https://img.shields.io/badge/Donate-PayPal-blue.svg" alt="Donate with PayPal" />
</a>

**[https://paypal.me/2b3/5](https://paypal.me/2b3/5)**

---

## License

MIT License - Created by [Ian Shen](https://github.com/2b3pro).
