/**
 * Datomic ancestor rule for traversing Roam block hierarchies.
 * Used to find all blocks under a page or parent block.
 *
 * Usage in queries: Pass as second parameter (%) and use `(ancestor ?child ?parent)` in where clause.
 * Example: `[:find ?block :in $ % ?page-uid :where (ancestor ?block ?page)]`
 */
export const ANCESTOR_RULE = `[
  [ (ancestor ?b ?a)
    [?a :block/children ?b] ]
  [ (ancestor ?b ?a)
    [?parent :block/children ?b]
    (ancestor ?parent ?a) ]
]`;
