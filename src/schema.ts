// src/schema.ts

export type ID = string;
export type ISODateString = string; // new Date().toISOString()

/**
 * Common metadata for anything that belongs to a project and may be synced/stored.
 */
export interface BaseRecord {
  id: ID;
  projectId: ID;

  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/**
 * Full library snapshot (useful for export/import, debugging, or future sync packing).
 * For IndexedDB, you'll likely store tables separately (projects/nodes/documents).
 */
export interface Library {
  schemaVersion: 1;
  libraryId: ID;

  projects: Record<ID, Project>;
  nodes: Record<ID, ProjectNode>;
  documents: Record<ID, Document>;

  app: AppState;

  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface AppState {
  activeProjectId: ID | null;
  activeNodeId: ID | null; // points to a ProjectNode.id
  focusMode: boolean;

  // UI preferences (keep minimal in v1)
  sidebarWidthPx?: number;
  theme?: "light" | "dark";
}

/**
 * A writing project (book, story, notebook).
 */
export interface Project {
  id: ID;
  title: string;

  rootNodeId: ID; // points to a ProjectNode.id

  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/**
 * Nodes define the project tree (folders + document references).
 * Node IDs are globally unique across the library.
 */
export type ProjectNode = FolderNode | DocNode;

export interface BaseNode extends BaseRecord {
  parentId: ID | null; // null for root
  sortIndex: number; // sibling ordering
  title: string;
}

export interface FolderNode extends BaseNode {
  kind: "folder";
  childIds: ID[]; // ordered list of children (folders or docs)
  isCollapsed?: boolean; // UI convenience
}

export interface DocNode extends BaseNode {
  kind: "doc";
  documentId: ID; // points to Document.id
}

/**
 * Document content (kept separate from tree nodes so content is not coupled to UI structure).
 */
export interface Document extends BaseRecord {
  // content
  content: string; // v1: plain text/markdown
  format: "markdown" | "plain";

  // optional future hooks
  wordCount?: number;
  lastCursor?: { pos: number };
}
