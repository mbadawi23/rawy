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
   * Cached render data used for lightweight re-rendering
   * when only UI state changes (like opening the add menu).
   */
  private lastRenderData: SidebarRenderData | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly callbacks: SidebarCallbacks,
  ) {}

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
   * Attach event listeners to newly rendered DOM elements.
   *
   * Because the sidebar is re-rendered completely, listeners must
   * be rebound every time render() runs.
   */
  private bindEvents(): void {
    // Document selection
    const docButtons =
      this.root.querySelectorAll<HTMLElement>("[data-node-id]");

    for (const button of docButtons) {
      button.addEventListener("click", () => {
        const nodeId = button.dataset.nodeId;
        if (!nodeId) return;

        this.callbacks.onSelectDocument(nodeId);
      });
    }

    // Folder selection
    const folderButtons = this.root.querySelectorAll<HTMLElement>(
      "[data-folder-node-id]",
    );

    for (const button of folderButtons) {
      button.addEventListener("click", () => {
        const folderId = button.dataset.folderNodeId;
        if (!folderId) return;

        this.callbacks.onSelectFolder(folderId);
      });
    }

    // "+" button toggle
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

    // Create new document or folder
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

    // Close menu
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
  }
}

/**
 * Recursively renders the project tree.
 */
function renderTree(
  nodes: ProjectNode[],
  folderId: ID,
  activeNodeId: ID | null,
  actionFolderId: ID | null,
  addMenuFolderId: ID | null,
): string {
  const children = nodes
    .filter((node) => node.parentId === folderId)
    .sort((a, b) => a.sortIndex - b.sortIndex);

  if (children.length === 0) {
    return "";
  }

  const items = children
    .map((node) => {
      if (node.kind === "folder") {
        const isActionFolder = node.id === actionFolderId;
        const isMenuOpen = node.id === addMenuFolderId;

        const activeClass = node.id === activeNodeId ? "is-active" : "";

        const addControl = isActionFolder
          ? renderAddControl(node.id, node.title, isMenuOpen)
          : "";

        return `
          <li class="sidebar-folder">
            <div class="sidebar-folder-row">
              <button
                class="sidebar-folder-button ${activeClass}"
                type="button"
                data-folder-node-id="${node.id}"
              >
                ${escapeHtml(node.title)}
              </button>

              ${addControl}
            </div>

            <ul class="sidebar-children">
              ${renderTree(
                nodes,
                node.id,
                activeNodeId,
                actionFolderId,
                addMenuFolderId,
              )}
            </ul>
          </li>
        `;
      }

      const activeClass = node.id === activeNodeId ? "is-active" : "";

      return `
        <li class="sidebar-doc">
          <button
            class="sidebar-doc-button ${activeClass}"
            type="button"
            data-node-id="${node.id}"
          >
            ${escapeHtml(node.title)}
          </button>
        </li>
      `;
    })
    .join("");

  return `<ul class="sidebar-level">${items}</ul>`;
}

/**
 * Renders the "+" control or the inline creation menu.
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
