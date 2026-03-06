/**
 * `LibraryManager` orchestrates: load list, create doc, select doc, save doc (calls `LibraryStore`).
 */

import type {
  ID,
  Project,
  ProjectNode,
  FolderNode,
  DocNode,
  Document,
} from "./schema";
import type { LibraryStore } from "./libraryStore";
import { newId } from "./helpers";

/**
 * In-memory snapshot used by the UI layer.
 *
 * This keeps the manager simple:
 * - UI asks manager for current state
 * - manager talks to store
 * - manager remembers selection
 */
export interface LibraryState {
  projects: Project[];
  activeProjectId: ID | null;
  activeNodeId: ID | null;
  activeDocumentId: ID | null;
}

/**
 * Loaded project payload for sidebar/editor use.
 */
export interface LoadedProject {
  project: Project;
  nodes: ProjectNode[];
  documents: Document[];
}

export class LibraryManager {
  private state: LibraryState = {
    projects: [],
    activeProjectId: null,
    activeNodeId: null,
    activeDocumentId: null,
  };

  constructor(private readonly store: LibraryStore) {}

  // ------------------------------------------------------------
  // Library loading
  // ------------------------------------------------------------

  /**
   * Load top-level project list.
   *
   * Useful for app startup and project picker/sidebar.
   */
  async loadLibrary(): Promise<Project[]> {
    console.log("[LibraryManager] loadLibrary:start");

    const projects = await this.store.listProjects();
    this.state.projects = projects;

    if (!this.state.activeProjectId && projects.length > 0) {
      this.state.activeProjectId = projects[0].id;
    }

    console.log("[LibraryManager] loadLibrary:done", {
      projectCount: projects.length,
      activeProjectId: this.state.activeProjectId,
    });

    return projects;
  }

  /**
   * Load a single project's tree + documents.
   *
   * This is enough for v1 sidebar + editor behavior.
   */
  async loadProject(projectId: ID): Promise<LoadedProject> {
    console.log("[LibraryManager] loadProject:start", { projectId });

    const project = await this.store.getProject(projectId);

    if (!project) {
      console.error("[LibraryManager] loadProject:project-not-found", {
        projectId,
      });
      throw new Error(`Project not found: ${projectId}`);
    }

    const [nodes, documents] = await Promise.all([
      this.store.listNodes(projectId),
      this.store.listDocuments(projectId),
    ]);

    this.state.activeProjectId = projectId;

    console.log("[LibraryManager] loadProject:done", {
      projectId,
      nodeCount: nodes.length,
      documentCount: documents.length,
    });

    return {
      project,
      nodes,
      documents,
    };
  }

  // ------------------------------------------------------------
  // Selection
  // ------------------------------------------------------------

  /**
   * Select a document node.
   *
   * The UI should call this when the user clicks a document in the sidebar.
   */
  async selectDocument(nodeId: ID): Promise<Document | null> {
    console.log("[LibraryManager] selectDocument:start", { nodeId });

    const projectId = this.requireActiveProjectId();
    const nodes = await this.store.listNodes(projectId);
    const node = nodes.find((n) => n.id === nodeId);

    if (!node) {
      console.error("[LibraryManager] selectDocument:node-not-found", {
        projectId,
        nodeId,
      });
      throw new Error(`Node not found: ${nodeId}`);
    }

    if (node.kind !== "doc") {
      console.error("[LibraryManager] selectDocument:node-not-doc", {
        nodeId,
        nodeKind: node.kind,
      });
      throw new Error(`Node is not a document: ${nodeId}`);
    }

    const document = await this.store.getDocument(node.documentId);

    if (!document) {
      console.error("[LibraryManager] selectDocument:document-not-found", {
        nodeId,
        documentId: node.documentId,
      });
      throw new Error(`Document not found: ${node.documentId}`);
    }

    this.state.activeNodeId = node.id;
    this.state.activeDocumentId = document.id;

    console.log("[LibraryManager] selectDocument:done", {
      projectId,
      nodeId: node.id,
      documentId: document.id,
    });

    return document;
  }

  /**
   * Returns the currently selected document, if any.
   */
  async getSelectedDocument(): Promise<Document | null> {
    if (!this.state.activeDocumentId) {
      return null;
    }

    return this.store.getDocument(this.state.activeDocumentId);
  }

  getState(): LibraryState {
    return { ...this.state };
  }

  // ------------------------------------------------------------
  // Create
  // ------------------------------------------------------------

  /**
   * Create a new project with a root folder.
   *
   * This keeps project creation self-contained for v1.
   */
  async createProject(title = "Untitled Project"): Promise<Project> {
    console.log("[LibraryManager] createProject:start", { title });

    const now = isoNow();
    const projectId = newId();
    const rootNodeId = newId();

    const project: Project = {
      id: projectId,
      title,
      rootNodeId,
      createdAt: now,
      updatedAt: now,
    };

    const rootNode: FolderNode = {
      id: rootNodeId,
      projectId,
      parentId: null,
      sortIndex: 0,
      title,
      kind: "folder",
      childIds: [],
      isCollapsed: false,
      createdAt: now,
      updatedAt: now,
    };

    await this.store.putProject(project);
    await this.store.putNode(rootNode);

    this.state.projects = [...this.state.projects, project];
    this.state.activeProjectId = project.id;
    this.state.activeNodeId = null;
    this.state.activeDocumentId = null;

    console.log("[LibraryManager] createProject:done", {
      projectId: project.id,
      rootNodeId,
      projectCount: this.state.projects.length,
    });

    return project;
  }

  /**
   * Create a folder under a given parent folder node.
   *
   * Useful for sidebar organization.
   */
  async createFolder(parentId: ID, title = "New Folder"): Promise<FolderNode> {
    console.log("[LibraryManager] createFolder:start", { parentId, title });

    const projectId = this.requireActiveProjectId();
    const project = await this.store.getProject(projectId);

    if (!project) {
      console.error("[LibraryManager] createFolder:project-not-found", {
        projectId,
      });
      throw new Error(`Project not found: ${projectId}`);
    }

    const nodes = await this.store.listNodes(projectId);
    const parent = nodes.find((n) => n.id === parentId);

    if (!parent) {
      console.error("[LibraryManager] createFolder:parent-not-found", {
        parentId,
      });
      throw new Error(`Parent node not found: ${parentId}`);
    }

    if (parent.kind !== "folder") {
      console.error("[LibraryManager] createFolder:parent-not-folder", {
        parentId,
        parentKind: parent.kind,
      });
      throw new Error(`Parent node is not a folder: ${parentId}`);
    }

    const now = isoNow();
    const nodeId = newId();

    const folder: FolderNode = {
      id: nodeId,
      projectId,
      parentId: parent.id,
      sortIndex: parent.childIds.length,
      title,
      kind: "folder",
      childIds: [],
      isCollapsed: false,
      createdAt: now,
      updatedAt: now,
    };

    const updatedParent: FolderNode = {
      ...parent,
      childIds: [...parent.childIds, folder.id],
      updatedAt: now,
    };

    console.log("[LibraryManager] createFolder:writing", {
      projectId,
      folderId: folder.id,
      parentId: parent.id,
      sortIndex: folder.sortIndex,
    });

    await this.store.putNode(folder);
    await this.store.putNode(updatedParent);
    await this.store.putProject({
      ...project,
      updatedAt: now,
    });

    console.log("[LibraryManager] createFolder:done", {
      folderId: folder.id,
      title: folder.title,
    });

    return folder;
  }

  /**
   * Create a document under a given parent folder node.
   *
   * For now this is the main "new file" entry point.
   */
  async createDocument(
    parentId: ID,
    title = "Untitled",
    content = "",
    format: Document["format"] = "markdown",
  ): Promise<{ node: DocNode; document: Document }> {
    console.log("[LibraryManager] createDocument:start", {
      parentId,
      title,
      format,
    });

    const projectId = this.requireActiveProjectId();
    const project = await this.store.getProject(projectId);

    if (!project) {
      console.error("[LibraryManager] createDocument:project-not-found", {
        projectId,
      });
      throw new Error(`Project not found: ${projectId}`);
    }

    const nodes = await this.store.listNodes(projectId);
    const parent = nodes.find((n) => n.id === parentId);

    if (!parent) {
      console.error("[LibraryManager] createDocument:parent-not-found", {
        parentId,
      });
      throw new Error(`Parent node not found: ${parentId}`);
    }

    if (parent.kind !== "folder") {
      console.error("[LibraryManager] createDocument:parent-not-folder", {
        parentId,
        parentKind: parent.kind,
      });
      throw new Error(`Parent node is not a folder: ${parentId}`);
    }

    const now = isoNow();
    const documentId = newId();
    const nodeId = newId();

    const document: Document = {
      id: documentId,
      projectId,
      content,
      format,
      wordCount: countWords(content),
      createdAt: now,
      updatedAt: now,
    };

    const node: DocNode = {
      id: nodeId,
      projectId,
      parentId: parent.id,
      sortIndex: parent.childIds.length,
      title,
      kind: "doc",
      documentId,
      createdAt: now,
      updatedAt: now,
    };

    const updatedParent: FolderNode = {
      ...parent,
      childIds: [...parent.childIds, node.id],
      updatedAt: now,
    };

    console.log("[LibraryManager] createDocument:writing", {
      projectId,
      parentId: parent.id,
      nodeId,
      documentId,
      sortIndex: node.sortIndex,
      wordCount: document.wordCount,
    });

    await this.store.putDocument(document);
    await this.store.putNode(node);
    await this.store.putNode(updatedParent);
    await this.store.putProject({
      ...project,
      updatedAt: now,
    });

    this.state.activeNodeId = node.id;
    this.state.activeDocumentId = document.id;

    console.log("[LibraryManager] createDocument:done", {
      nodeId: node.id,
      documentId: document.id,
      activeDocumentId: this.state.activeDocumentId,
    });

    return { node, document };
  }

  // ------------------------------------------------------------
  // Save
  // ------------------------------------------------------------

  /**
   * Save the currently selected document.
   *
   * Editor can call this whenever content changes or on explicit save.
   */
  async saveSelectedDocument(content: string): Promise<Document> {
    console.log("[LibraryManager] saveSelectedDocument:start", {
      activeDocumentId: this.state.activeDocumentId,
      nextWordCount: countWords(content),
    });

    const documentId = this.requireActiveDocumentId();

    const current = await this.store.getDocument(documentId);
    if (!current) {
      console.error(
        "[LibraryManager] saveSelectedDocument:document-not-found",
        {
          documentId,
        },
      );
      throw new Error(`Document not found: ${documentId}`);
    }

    const updated: Document = {
      ...current,
      content,
      wordCount: countWords(content),
      updatedAt: isoNow(),
    };

    await this.store.putDocument(updated);

    console.log("[LibraryManager] saveSelectedDocument:done", {
      documentId: updated.id,
      wordCount: updated.wordCount,
      updatedAt: updated.updatedAt,
    });

    return updated;
  }

  /**
   * Small convenience if the UI wants to rename the selected/open doc later.
   */
  async renameNode(nodeId: ID, title: string): Promise<ProjectNode> {
    console.log("[LibraryManager] renameNode:start", { nodeId, title });

    const projectId = this.requireActiveProjectId();
    const nodes = await this.store.listNodes(projectId);
    const node = nodes.find((n) => n.id === nodeId);

    if (!node) {
      console.error("[LibraryManager] renameNode:node-not-found", { nodeId });
      throw new Error(`Node not found: ${nodeId}`);
    }

    const updated: ProjectNode = {
      ...node,
      title,
      updatedAt: isoNow(),
    };

    await this.store.putNode(updated);

    console.log("[LibraryManager] renameNode:done", {
      nodeId: updated.id,
      title: updated.title,
    });

    return updated;
  }

  // ------------------------------------------------------------
  // Internal helpers
  // ------------------------------------------------------------

  private requireActiveProjectId(): ID {
    if (!this.state.activeProjectId) {
      throw new Error("No active project selected");
    }

    return this.state.activeProjectId;
  }

  private requireActiveDocumentId(): ID {
    if (!this.state.activeDocumentId) {
      throw new Error("No active document selected");
    }

    return this.state.activeDocumentId;
  }
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function isoNow(): string {
  return new Date().toISOString();
}
