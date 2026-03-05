// src/schema.ts (suggested new file)

export type UUID = string;

export type ISODateString = string; // new Date().toISOString()

export interface Library {
  schemaVersion: 1;
  libraryId: UUID;

  projects: Record<UUID, Project>;
  documents: Record<UUID, Document>; // normalized for sync + fast lookup

  app: AppState;

  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface AppState {
  activeProjectId: UUID | null;
  activeNodeId: UUID | null; // points to a ProjectNode (doc or folder)
  focusMode: boolean;

  // UI preferences (keep minimal in v1)
  sidebarWidthPx?: number;
  theme?: "light" | "dark";
}

export interface Project {
  projectId: UUID;
  title: string;

  // root of a tree. nodes live inside the project to keep it easy.
  rootNodeId: UUID;
  nodes: Record<UUID, ProjectNode>;

  // metadata
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type ProjectNode = FolderNode | DocNode;

export interface BaseNode {
  nodeId: UUID;
  parentId: UUID | null; // null for root
  sortIndex: number; // sibling ordering
  title: string;

  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface FolderNode extends BaseNode {
  kind: "folder";
  childIds: UUID[]; // ordered list of children (folders or docs)
  isCollapsed?: boolean; // purely UI but convenient
}

export interface DocNode extends BaseNode {
  kind: "doc";
  documentId: UUID; // points to Library.documents
}

export interface Document {
  documentId: UUID;

  // content
  content: string; // v1: plain text/markdown
  format: "markdown" | "plain";

  // optional future hooks
  wordCount?: number;
  lastCursor?: { pos: number };

  createdAt: ISODateString;
  updatedAt: ISODateString;
}
