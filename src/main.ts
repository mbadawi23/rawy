import { IndexedDbLibraryStore } from "./stores/indexedDbLibraryStore";
import { LibraryManager } from "./libraryManager";
import { Sidebar } from "./sidebar";
import { Editor } from "./editor";
import { ShortcutManager } from "./shortcuts";

// Build the base app shell in the DOM.
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

// Core application services.
// - store: persistence
// - manager: library/project/document state
// - editor: textarea behavior and autosave
const store = new IndexedDbLibraryStore();
const manager = new LibraryManager(store);
const editor = new Editor(editorInput, manager);

// Keyboard shortcut abstraction layer.
// v1 goal:
// - sidebar navigation commands
// - editor focus mode toggle
// Later this can load user-customized keymaps from storage.
const shortcuts = new ShortcutManager();

shortcuts.registerScope({
  name: "sidebar",
  getElement: () => sidebarRoot,
  commands: {
    moveUp: () => sidebar.moveUp(),
    moveDown: () => sidebar.moveDown(),
    expandNode: () => sidebar.expandNode(),
    collapseNode: () => sidebar.collapseNode(),
    confirm: () => sidebar.confirm(),
    rename: () => sidebar.rename(),
    newDocument: () => sidebar.newDocument(),
    newFolder: () => sidebar.newFolder(),
  },
  bindings: {
    moveUp: "ArrowUp",
    moveDown: "ArrowDown",
    expandNode: "ArrowRight",
    collapseNode: "ArrowLeft",
    confirm: "Enter",
    rename: "F2",
    newDocument: ["Ctrl+N", "Meta+N"],
    newFolder: ["Ctrl+Shift+N", "Meta+Shift+N"],
  },
});

shortcuts.registerScope({
  name: "editor",
  getElement: () => editor.getElement(),
  commands: {
    toggleFocusMode: () => editor.toggleFocusMode(),
    exitFocusMode: () => editor.exitFocusMode(),
  },
  bindings: {
    toggleFocusMode: "F9",
    exitFocusMode: "Escape",
  },
});

// Sidebar drives navigation and document/folder actions.
// main.ts acts as the orchestration layer between Sidebar, Manager, and Editor.
const sidebar = new Sidebar(sidebarRoot, {
  onSelectDocument: async (nodeId) => {
    console.log("[main] sidebar:onSelectDocument", { nodeId });

    await editor.flushPendingSave();
    await manager.selectDocument(nodeId);
    await editor.refreshFromSelection();

    await renderSidebar();
  },

  onSelectFolder: async (folderId) => {
    console.log("[main] sidebar:onSelectFolder", { folderId });

    await editor.flushPendingSave();
    await manager.selectFolder(folderId);
    await editor.refreshFromSelection();

    await renderSidebar();
  },

  onAddToFolder: async (folderId, kind) => {
    console.log("[main] sidebar:onAddToFolder", { folderId, kind });

    await editor.flushPendingSave();

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

    await editor.flushPendingSave();
    await manager.deleteNode(nodeId);
    await editor.refreshFromSelection();

    await renderSidebar();
  },
});

// App startup flow:
// 1. initialize editor listeners
// 2. load library state
// 3. create a default project/document for first run
// 4. restore last session if possible
// 5. render sidebar + editor
async function bootstrap(): Promise<void> {
  console.log("[main] bootstrap:start");

  editor.init();
  shortcuts.init();

  const projects = await manager.loadLibrary();

  let activeProjectId = manager.getState().activeProjectId;

  if (!activeProjectId) {
    const project = await manager.createProject("My Project");
    activeProjectId = project.id;

    const loaded = await manager.loadProject(project.id);
    await manager.createDocument(loaded.project.rootNodeId, "Untitled");
  }

  const restored = await editor.restoreLastSession();

  if (!restored) {
    await editor.refreshFromSelection();
  }

  await renderSidebar();

  console.log("[main] bootstrap:done", {
    projectCount: projects.length,
  });
}

// Re-render sidebar from the currently active project state.
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
