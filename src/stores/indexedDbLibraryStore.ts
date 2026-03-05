// src/stores/IndexedDbLibraryStore.ts

import type { LibraryStore } from "../libraryStore";
import type { Project, ProjectNode, Document, ID } from "../schema";
import { openDb, req, done, store } from "./indexedDb";

export class IndexedDbLibraryStore implements LibraryStore {
  // -----------------------
  // Projects
  // -----------------------

  async listProjects(): Promise<Project[]> {
    const db = await openDb();
    const txn = db.transaction(["projects"], "readonly");
    const projects = await req<Project[]>(store(txn, "projects").getAll());
    await done(txn);
    return projects;
  }

  async getProject(id: ID): Promise<Project | null> {
    assertNonEmptyId(id, "project id");

    const db = await openDb();
    const txn = db.transaction(["projects"], "readonly");
    const project = await req<Project | undefined>(
      store(txn, "projects").get(id),
    );
    await done(txn);
    return project ?? null;
  }

  async putProject(project: Project): Promise<void> {
    assertNonEmptyId(project.id, "project.id");

    const db = await openDb();
    const txn = db.transaction(["projects"], "readwrite");
    store(txn, "projects").put(project);
    await done(txn);
  }

  async deleteProject(id: ID): Promise<void> {
    assertNonEmptyId(id, "project id");

    const db = await openDb();
    const txn = db.transaction(["projects", "documents", "nodes"], "readwrite");

    const projects = store(txn, "projects");
    const documents = store(txn, "documents");
    const nodes = store(txn, "nodes");

    // Delete project
    projects.delete(id);

    // Cascade delete documents
    const docsIdx = documents.index("byProjectId");
    const docs = await req<Document[]>(docsIdx.getAll(id));
    for (const d of docs) documents.delete(d.id);

    // Cascade delete nodes
    const nodesIdx = nodes.index("byProjectId");
    const ns = await req<ProjectNode[]>(nodesIdx.getAll(id));
    for (const n of ns) nodes.delete(n.id);

    await done(txn);
  }

  // -----------------------
  // Documents
  // -----------------------

  async listDocuments(projectId: ID): Promise<Document[]> {
    assertNonEmptyId(projectId, "projectId");

    const db = await openDb();
    const txn = db.transaction(["documents"], "readonly");
    const idx = store(txn, "documents").index("byProjectId");
    const docs = await req<Document[]>(idx.getAll(projectId));
    await done(txn);
    return docs;
  }

  async getDocument(id: ID): Promise<Document | null> {
    assertNonEmptyId(id, "document id");

    const db = await openDb();
    const txn = db.transaction(["documents"], "readonly");
    const doc = await req<Document | undefined>(
      store(txn, "documents").get(id),
    );
    await done(txn);
    return doc ?? null;
  }

  async putDocument(doc: Document): Promise<void> {
    assertNonEmptyId(doc.id, "document.id");
    assertNonEmptyId(doc.projectId, "document.projectId");

    const db = await openDb();
    const txn = db.transaction(["documents"], "readwrite");
    store(txn, "documents").put(doc);
    await done(txn);
  }

  async deleteDocument(id: ID): Promise<void> {
    assertNonEmptyId(id, "document id");

    const db = await openDb();
    const txn = db.transaction(["documents"], "readwrite");
    store(txn, "documents").delete(id);
    await done(txn);
  }

  // -----------------------
  // Nodes
  // -----------------------

  async listNodes(projectId: ID): Promise<ProjectNode[]> {
    assertNonEmptyId(projectId, "projectId");

    const db = await openDb();
    const txn = db.transaction(["nodes"], "readonly");
    const idx = store(txn, "nodes").index("byProjectId");
    const nodes = await req<ProjectNode[]>(idx.getAll(projectId));
    await done(txn);
    return nodes;
  }

  async putNode(node: ProjectNode): Promise<void> {
    assertNonEmptyId(node.id, "node.id");
    assertNonEmptyId(node.projectId, "node.projectId");

    const db = await openDb();
    const txn = db.transaction(["nodes"], "readwrite");
    store(txn, "nodes").put(node);
    await done(txn);
  }

  async deleteNode(id: ID): Promise<void> {
    assertNonEmptyId(id, "node id");

    const db = await openDb();
    const txn = db.transaction(["nodes"], "readwrite");
    store(txn, "nodes").delete(id);
    await done(txn);
  }
}

// -----------------------
// Validation
// -----------------------

function assertNonEmptyId(value: unknown, label: string): asserts value is ID {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid ${label}: expected a non-empty string`);
  }
}
