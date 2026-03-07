// src/main.ts

import { IndexedDbLibraryStore } from "./stores/indexedDbLibraryStore";
import { LibraryManager } from "./libraryManager";
import { Sidebar } from "./sidebar";

const app = document.getElementById("app");

if (!app) {
  throw new Error("App root not found");
}

app.innerHTML = `
  <aside id="sidebar"></aside>
  <main id="editor">
    <textarea id="editor-input" placeholder="Start writing..."></textarea>
  </main>
`;

const sidebarRoot = document.getElementById("sidebar")!;
const editorInput = document.getElementById(
  "editor-input",
) as HTMLTextAreaElement;

const store = new IndexedDbLibraryStore();
const manager = new LibraryManager(store);

const sidebar = new Sidebar(sidebarRoot, {
  onSelectDocument: async (nodeId) => {
    console.log("[main] sidebar:onSelectDocument", { nodeId });

    const document = await manager.selectDocument(nodeId);
    editorInput.value = document?.content ?? "";

    await renderSidebar();
  },

  onSelectFolder: async (folderId) => {
    console.log("[main] sidebar:onSelectFolder", { folderId });

    await manager.selectFolder(folderId);
    editorInput.value = "";

    await renderSidebar();
  },

  onAddToFolder: async (folderId, kind) => {
    console.log("[main] sidebar:onAddToFolder", { folderId, kind });

    if (kind === "folder") {
      const folder = await manager.createFolder(folderId, "New Folder");
      await renderSidebar();
      sidebar.startRename(folder.id);
      return;
    }

    const { node, document } = await manager.createDocument(
      folderId,
      "New Document",
    );
    editorInput.value = document.content;
    await renderSidebar();
    sidebar.startRename(node.id);
  },

  onRenameNode: async (nodeId, title) => {
    console.log("[main] sidebar:onRenameNode", { nodeId, title });

    await manager.renameNode(nodeId, title);
    await renderSidebar();
  },

  onDeleteNode: async (nodeId, kind, title) => {
    console.log("[main] sidebar:onDeleteNode", { nodeId, kind, title });

    const confirmed =
      kind === "folder"
        ? window.confirm(`Delete folder "${title}" and all its contents?`)
        : window.confirm(`Delete document "${title}"?`);

    if (!confirmed) return;

    await manager.deleteNode(nodeId);

    // After deletion the manager already fixed the selection.
    // Ask it which document (if any) is now active.
    const activeDocument = await manager.getActiveDocument();

    editorInput.value = activeDocument?.content ?? "";

    await renderSidebar();
  },
});

async function bootstrap(): Promise<void> {
  console.log("[main] bootstrap:start");

  const projects = await manager.loadLibrary();

  let activeProjectId = manager.getState().activeProjectId;

  if (!activeProjectId) {
    const project = await manager.createProject("My Project");
    activeProjectId = project.id;

    const loaded = await manager.loadProject(project.id);
    await manager.createDocument(loaded.project.rootNodeId, "Untitled");
  }

  await renderSidebar();

  const selected = await manager.getSelectedDocument();
  editorInput.value = selected?.content ?? "";

  console.log("[main] bootstrap:done");
}

async function renderSidebar(): Promise<void> {
  const state = manager.getState();

  if (!state.activeProjectId) {
    sidebarRoot.innerHTML = `<p>No project loaded.</p>`;
    return;
  }

  const loaded = await manager.loadProject(state.activeProjectId);

  sidebar.render({
    project: loaded.project,
    nodes: loaded.nodes,
    documents: loaded.documents,
    activeNodeId: state.activeNodeId,
  });
}

editorInput.addEventListener("input", async () => {
  const state = manager.getState();
  if (!state.activeDocumentId) return;

  await manager.saveSelectedDocument(editorInput.value);
});

void bootstrap();
