// src/sidebar.ts

import type { ID, ProjectNode, Document } from "./schema";
import type { LoadedProject } from "./libraryManager";

/**
 * Data required to render the sidebar.
 * This is provided by main.ts after querying the LibraryManager.
 */
export interface SidebarRenderData {
  project: LoadedProject["project"];
  nodes: ProjectNode[];
  documents: Document[];
  activeNodeId: ID | null;
}

/**
 * Callbacks implemented by the application layer.
 * Sidebar remains purely a UI component and does not perform any data changes.
 */
export interface SidebarCallbacks {
  onSelectDocument: (nodeId: ID) => void;
  onSelectFolder: (folderId: ID) => void;
  onAddToFolder: (folderId: ID, kind: "doc" | "folder") => void;
  onRenameNode: (nodeId: ID, title: string) => void | Promise<void>;
  onDeleteNode: (nodeId: ID, kind: "doc" | "folder", title: string) => void;
}

/**
 * Sidebar UI controller.
 *
 * Responsibilities:
 * - Render the project tree
 * - Manage the inline "+" creation menu
 * - Emit UI events via callbacks
 *
 * It does NOT manage any project state itself.
 */
export class Sidebar {
  /**
   * Folder currently showing the inline add menu.
   * If null, no menu is visible.
   */
  private addMenuFolderId: ID | null = null;

  /**
   * Which node is currently being renamed inline.
   */
  private editingNodeId: ID | null = null;

  /**
   * Cached render data used for lightweight re-rendering
   * when only UI state changes (like opening the add menu).
   */
  private lastRenderData: SidebarRenderData | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly callbacks: SidebarCallbacks,
  ) {}

  /**
   * Public entrypoint for inline rename mode.
   *
   * Used after creating a new doc/folder so the user can
   * immediately overwrite the default title.
   */
  startRename(nodeId: ID): void {
    this.editingNodeId = nodeId;
    this.rerender();
    this.focusRenameInput();
  }

  /**
   * Main render entrypoint.
   *
   * Rebuilds the entire sidebar HTML from the current tree state.
   */
  render(data: SidebarRenderData): void {
    this.lastRenderData = data;

    // Determine which folder should show the "+" action
    const actionFolderId = getActionFolderId(
      data.nodes,
      data.project.rootNodeId,
      data.activeNodeId,
    );

    const showHeaderAddButton = actionFolderId === data.project.rootNodeId;

    // Build the recursive tree HTML
    const treeHtml = renderTree(
      data.nodes,
      data.project.rootNodeId,
      data.activeNodeId,
      actionFolderId,
      this.addMenuFolderId,
      this.editingNodeId,
    );

    // Root-level add button
    const headerAddButton = showHeaderAddButton
      ? renderAddControl(
          data.project.rootNodeId,
          data.project.title,
          this.addMenuFolderId === data.project.rootNodeId,
        )
      : "";

    this.root.innerHTML = `
      <div class="sidebar-header">
        <h1>${escapeHtml(data.project.title)}</h1>
        ${headerAddButton}
      </div>

      <div class="sidebar-tree">
        ${treeHtml}
      </div>
    `;

    this.bindEvents();
    this.focusRenameInput();
  }

  /**
   * Lightweight re-render used when only UI state changes.
   * (example: opening or closing the add menu)
   */
  private rerender(): void {
    if (!this.lastRenderData) return;
    this.render(this.lastRenderData);
  }

  /**
   * Focus the active rename input, if present.
   */
  private focusRenameInput(): void {
    if (!this.editingNodeId) return;

    const input = this.root.querySelector<HTMLInputElement>(
      `[data-rename-input-node-id="${this.editingNodeId}"]`,
    );

    if (!input) return;

    input.focus();
    input.select();
  }

  /**
   * Save a rename action from the inline input.
   */
  private async commitRename(nodeId: ID, rawTitle: string): Promise<void> {
    const trimmedTitle = rawTitle.trim();

    // Empty names are ignored for now.
    // This keeps the previous/default title intact.
    if (!trimmedTitle) {
      this.editingNodeId = null;
      this.rerender();
      return;
    }

    this.editingNodeId = null;
    await this.callbacks.onRenameNode(nodeId, trimmedTitle);
  }

  /**
   * Cancel rename mode and restore normal rendering.
   */
  private cancelRename(): void {
    this.editingNodeId = null;
    this.rerender();
  }

  /**
   * Attach event listeners to newly rendered DOM elements.
   *
   * Because the sidebar is re-rendered completely, listeners must
   * be rebound every time render() runs.
   */
  private bindEvents(): void {
    // ------------------------------------------------------------
    // Document selection
    // ------------------------------------------------------------
    const docButtons =
      this.root.querySelectorAll<HTMLElement>("[data-node-id]");

    for (const button of docButtons) {
      button.addEventListener("click", () => {
        const nodeId = button.dataset.nodeId;
        if (!nodeId) return;

        this.callbacks.onSelectDocument(nodeId);
      });

      // Double click starts inline rename for docs.
      button.addEventListener("dblclick", (event) => {
        event.preventDefault();

        const nodeId = button.dataset.nodeId;
        if (!nodeId) return;

        this.startRename(nodeId);
      });
    }

    // ------------------------------------------------------------
    // Folder selection
    // ------------------------------------------------------------
    const folderButtons = this.root.querySelectorAll<HTMLElement>(
      "[data-folder-node-id]",
    );

    for (const button of folderButtons) {
      button.addEventListener("click", () => {
        const folderId = button.dataset.folderNodeId;
        if (!folderId) return;

        this.callbacks.onSelectFolder(folderId);
      });

      // Double click starts inline rename for folders.
      button.addEventListener("dblclick", (event) => {
        event.preventDefault();

        const folderId = button.dataset.folderNodeId;
        if (!folderId) return;

        this.startRename(folderId);
      });
    }

    // ------------------------------------------------------------
    // "+" add-menu toggle
    // ------------------------------------------------------------
    const addToggleButtons = this.root.querySelectorAll<HTMLElement>(
      "[data-add-toggle-folder-id]",
    );

    for (const button of addToggleButtons) {
      button.addEventListener("click", (event) => {
        event.stopPropagation();

        const folderId = button.dataset.addToggleFolderId;
        if (!folderId) return;

        // Toggle menu open/closed
        this.addMenuFolderId =
          this.addMenuFolderId === folderId ? null : folderId;

        this.rerender();
      });
    }

    // ------------------------------------------------------------
    // Create new document or folder
    // ------------------------------------------------------------
    const createButtons = this.root.querySelectorAll<HTMLElement>(
      "[data-create-in-folder-id]",
    );

    for (const button of createButtons) {
      button.addEventListener("click", (event) => {
        event.stopPropagation();

        const folderId = button.dataset.createInFolderId;
        const kind = button.dataset.createKind as "doc" | "folder" | undefined;

        if (!folderId || !kind) return;

        this.addMenuFolderId = null;
        this.callbacks.onAddToFolder(folderId, kind);
      });
    }

    // ------------------------------------------------------------
    // Close add menu
    // ------------------------------------------------------------
    const cancelButtons = this.root.querySelectorAll<HTMLElement>(
      "[data-cancel-add-menu]",
    );

    for (const button of cancelButtons) {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        this.addMenuFolderId = null;
        this.rerender();
      });
    }

    // ------------------------------------------------------------
    // Inline rename
    // ------------------------------------------------------------
    const renameInputs = this.root.querySelectorAll<HTMLInputElement>(
      "[data-rename-input-node-id]",
    );

    for (const input of renameInputs) {
      let didSubmit = false;

      const nodeId = input.dataset.renameInputNodeId;
      if (!nodeId) continue;

      // Enter saves. Escape cancels.
      input.addEventListener("keydown", async (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          didSubmit = true;
          await this.commitRename(nodeId, input.value);
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          didSubmit = true;
          this.cancelRename();
        }
      });

      // Clicking outside saves, unless already handled above.
      input.addEventListener("blur", async () => {
        if (didSubmit) return;
        didSubmit = true;
        await this.commitRename(nodeId, input.value);
      });
    }

    // ------------------------------------------------------------
    // Delete node
    // ------------------------------------------------------------
    const deleteButtons = this.root.querySelectorAll<HTMLElement>(
      "[data-delete-node-id]",
    );

    for (const button of deleteButtons) {
      button.addEventListener("click", (event) => {
        event.stopPropagation();

        const nodeId = button.dataset.deleteNodeId;
        const kind = button.dataset.deleteNodeKind as
          | "doc"
          | "folder"
          | undefined;
        const title = button.dataset.deleteNodeTitle;

        if (!nodeId || !kind || !title) return;

        this.callbacks.onDeleteNode(nodeId, kind, title);
      });
    }
  }
}

/**
 * Recursively render the tree under a folder.
 */
function renderTree(
  nodes: ProjectNode[],
  folderId: ID,
  activeNodeId: ID | null,
  actionFolderId: ID | null,
  addMenuFolderId: ID | null,
  editingNodeId: ID | null,
): string {
  const children = nodes
    .filter((node) => node.parentId === folderId)
    .sort((a, b) => a.sortIndex - b.sortIndex);

  if (children.length === 0) {
    return "";
  }

  const items = children
    .map((node) => {
      const isEditing = node.id === editingNodeId;

      if (node.kind === "folder") {
        const isActionFolder = node.id === actionFolderId;
        const isMenuOpen = node.id === addMenuFolderId;
        const activeClass = node.id === activeNodeId ? "is-active" : "";

        const addControl = isActionFolder
          ? renderAddControl(node.id, node.title, isMenuOpen)
          : "";

        const deleteControl =
          node.id === activeNodeId
            ? renderDeleteButton(node.id, "folder", node.title)
            : "";

        const folderLabel = isEditing
          ? renderRenameInput(node.id, node.title, "folder")
          : `
              <button
                class="sidebar-folder-button ${activeClass}"
                type="button"
                data-folder-node-id="${node.id}"
              >
                ${escapeHtml(node.title)}
              </button>
            `;

        return `
          <li class="sidebar-folder">
            <div class="sidebar-folder-row">
              ${folderLabel}
              
              <div class="sidebar-row-actions">
                ${addControl}
                ${deleteControl}
              </div>
            </div>

            <ul class="sidebar-children">
              ${renderTree(
                nodes,
                node.id,
                activeNodeId,
                actionFolderId,
                addMenuFolderId,
                editingNodeId,
              )}
            </ul>
          </li>
        `;
      }

      const activeClass = node.id === activeNodeId ? "is-active" : "";

      const docLabel = isEditing
        ? renderRenameInput(node.id, node.title, "doc")
        : `
            <button
              class="sidebar-doc-button ${activeClass}"
              type="button"
              data-node-id="${node.id}"
            >
              ${escapeHtml(node.title)}
            </button>
          `;

      const deleteControl =
        node.id === activeNodeId
          ? renderDeleteButton(node.id, "doc", node.title)
          : "";

      return `
        <li class="sidebar-doc">
          <div class="sidebar-doc-row">
            ${docLabel}

            <div class="sidebar-row-actions">
              ${deleteControl}
            </div>
          </div>
        </li>
      `;
    })
    .join("");

  return `<ul class="sidebar-level">${items}</ul>`;
}

/**
 * Render the add button or the temporary inline add menu.
 */
function renderAddControl(
  folderId: ID,
  folderTitle: string,
  isOpen: boolean,
): string {
  if (!isOpen) {
    return `
      <button
        class="sidebar-add-button"
        type="button"
        data-add-toggle-folder-id="${folderId}"
        aria-label="Add item to ${escapeHtml(folderTitle)}"
      >
        +
      </button>
    `;
  }

  return `
    <div class="sidebar-add-menu">
      <button
        class="sidebar-add-menu-button"
        type="button"
        data-create-in-folder-id="${folderId}"
        data-create-kind="doc"
      >
        New doc
      </button>

      <button
        class="sidebar-add-menu-button"
        type="button"
        data-create-in-folder-id="${folderId}"
        data-create-kind="folder"
      >
        New folder
      </button>

      <button
        class="sidebar-add-menu-cancel"
        type="button"
        data-cancel-add-menu="true"
        aria-label="Close add menu"
      >
        ×
      </button>
    </div>
  `;
}

/**
 * Render inline rename input for a doc or folder.
 */
function renderRenameInput(
  nodeId: ID,
  title: string,
  kind: "doc" | "folder",
): string {
  return `
    <input
      class="sidebar-rename-input sidebar-rename-input-${kind}"
      type="text"
      value="${escapeHtmlAttribute(title)}"
      data-rename-input-node-id="${nodeId}"
      aria-label="Rename ${kind}"
    />
  `;
}

/**
 * Render the delete button for the active node.
 *
 * We only show this on the currently active item to keep
 * the sidebar from getting too cluttered.
 */
function renderDeleteButton(
  nodeId: ID,
  kind: "doc" | "folder",
  title: string,
): string {
  return `
    <button
      class="sidebar-delete-button"
      type="button"
      data-delete-node-id="${nodeId}"
      data-delete-node-kind="${kind}"
      data-delete-node-title="${escapeHtmlAttribute(title)}"
      aria-label="Delete ${escapeHtml(title)}"
      title="Delete"
    >
      🗑
    </button>
  `;
}

/**
 * Escapes user-facing text for safe HTML rendering.
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Escape text for attribute values, such as input.value in HTML.
 */
function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value);
}

/**
 * Determines which folder should show the "+" control.
 *
 * Rules:
 * - If nothing selected → root
 * - If folder selected → that folder
 * - If document selected → its parent folder
 */
function getActionFolderId(
  nodes: ProjectNode[],
  rootNodeId: ID,
  activeNodeId: ID | null,
): ID {
  if (!activeNodeId) {
    return rootNodeId;
  }

  const activeNode = nodes.find((node) => node.id === activeNodeId);

  if (!activeNode) {
    return rootNodeId;
  }

  if (activeNode.kind === "folder") {
    return activeNode.id;
  }

  return activeNode.parentId ?? rootNodeId;
}
