/**
 * Types for Roam Query Block parsing and Datalog generation
 */

// AST Node types for parsed query
export type QueryNode =
  | AndNode
  | OrNode
  | NotNode
  | BetweenNode
  | TagNode
  | BlockRefNode
  | SearchNode
  | DailyNotesNode
  | ByNode
  | CreatedByNode
  | EditedByNode;

// Shared structure for logical operators with children
interface LogicalNode<T extends string> {
  type: T;
  children: QueryNode[];
}

export type AndNode = LogicalNode<'and'>;
export type OrNode = LogicalNode<'or'>;

export interface NotNode {
  type: 'not';
  child: QueryNode;
}

export interface BetweenNode {
  type: 'between';
  startDate: string;
  endDate: string;
}

export interface TagNode {
  type: 'tag';
  value: string; // The tag name without [[ ]]
}

export interface BlockRefNode {
  type: 'block-ref';
  uid: string; // The block UID without (( ))
}

export interface SearchNode {
  type: 'search';
  text: string; // The search text
}

export interface DailyNotesNode {
  type: 'daily-notes';
}

// Shared structure for user-based clauses
interface UserNode<T extends string> {
  type: T;
  user: string;
}

export type ByNode = UserNode<'by'>;           // Matches created OR edited by
export type CreatedByNode = UserNode<'created-by'>;
export type EditedByNode = UserNode<'edited-by'>;

// Result of Datalog generation
export interface DatalogClauses {
  where: string[];      // WHERE clause fragments
  inputs: string[];     // :in clause variable names (e.g., ?start-date)
  inputValues: (string | number)[]; // Actual values to pass
}

// Options for query execution
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  pageUid?: string; // Scope to specific page
}
