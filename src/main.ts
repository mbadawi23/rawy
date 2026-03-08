// src/main.ts

import { IndexedDbLibraryStore } from "./stores/indexedDbLibraryStore";
import { LibraryManager } from "./libraryManager";
import { Sidebar } from "./sidebar";
import { Editor } from "./editor";

const app = document.getElementById("app");

if (!app) {
  throw new Error("App root not found");
}

app.innerHTML = `
  <aside id="sidebar"></aside>
  <main id="editor">
    <textarea id="editor-input" placeholder="Write on..."></textarea>
  </main>
`;

const sidebarRoot = document.getElementById("sidebar")!;
const editorInput = document.getElementById(
  "editor-input",
) as HTMLTextAreaElement;

const store = new IndexedDbLibraryStore();
const manager = new LibraryManager(store);
const editor = new Editor(editorInput, manager);

const sidebar = new Sidebar(sidebarRoot, {
  onSelectDocument: async (nodeId) => {
    console.log("[main] sidebar:onSelectDocument", { nodeId });

    await manager.selectDocument(nodeId);
    await editor.refreshFromSelection();

    await renderSidebar();
  },

  onSelectFolder: async (folderId) => {
    console.log("[main] sidebar:onSelectFolder", { folderId });

    await manager.selectFolder(folderId);
    await editor.refreshFromSelection();

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

    editor.setDocumentContent(document.content);

    await renderSidebar();
    editor.focus();
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
    await editor.refreshFromSelection();

    await renderSidebar();
  },
});

async function bootstrap(): Promise<void> {
  console.log("[main] bootstrap:start");

  editor.init();

  const projects = await manager.loadLibrary();

  let activeProjectId = manager.getState().activeProjectId;

  if (!activeProjectId) {
    const project = await manager.createProject("My Project");
    activeProjectId = project.id;

    const loaded = await manager.loadProject(project.id);
    await manager.createDocument(loaded.project.rootNodeId, "Untitled");
  }

  await renderSidebar();
  await editor.refreshFromSelection();

  console.log("[main] bootstrap:done", {
    projectCount: projects.length,
  });
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

void bootstrap();
