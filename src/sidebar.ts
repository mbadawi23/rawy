// src/sidebar.ts

import type { ID, ProjectNode, Document } from "./schema";
import type { LoadedProject } from "./libraryManager";

export interface SidebarRenderData {
  project: LoadedProject["project"];
  nodes: ProjectNode[];
  documents: Document[];
  activeNodeId: ID | null;
}

export interface SidebarCallbacks {
  onSelectDocument: (nodeId: ID) => void;
  onSelectFolder: (folderId: ID) => void;
  onAddToFolder: (folderId: ID) => void;
}

export class Sidebar {
  constructor(
    private readonly root: HTMLElement,
    private readonly callbacks: SidebarCallbacks,
  ) {}

  render(data: SidebarRenderData): void {
    const actionFolderId = getActionFolderId(
      data.nodes,
      data.project.rootNodeId,
      data.activeNodeId,
    );

    const showHeaderAddButton = actionFolderId === data.project.rootNodeId;

    const treeHtml = renderTree(
      data.nodes,
      data.project.rootNodeId,
      data.activeNodeId,
      actionFolderId,
    );

    const headerAddButton = showHeaderAddButton
      ? `
      <button
        class="sidebar-add-button"
        type="button"
        data-folder-id="${data.project.rootNodeId}"
        aria-label="Add item to ${escapeHtml(data.project.title)}"
      >
        +
      </button>
    `
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

  private bindEvents(): void {
    const docButtons =
      this.root.querySelectorAll<HTMLElement>("[data-node-id]");

    for (const button of docButtons) {
      button.addEventListener("click", () => {
        const nodeId = button.dataset.nodeId;
        if (!nodeId) return;
        this.callbacks.onSelectDocument(nodeId);
      });
    }

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

    const addButtons =
      this.root.querySelectorAll<HTMLElement>("[data-folder-id]");

    for (const button of addButtons) {
      button.addEventListener("click", () => {
        const folderId = button.dataset.folderId;
        if (!folderId) return;
        this.callbacks.onAddToFolder(folderId);
      });
    }
  }
}

function renderTree(
  nodes: ProjectNode[],
  folderId: ID,
  activeNodeId: ID | null,
  actionFolderId: ID | null,
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
        const activeClass = node.id === activeNodeId ? "is-active" : "";
        const plusButton = isActionFolder
          ? `
            <button
              class="sidebar-add-button"
              type="button"
              data-folder-id="${node.id}"
              aria-label="Add item to ${escapeHtml(node.title)}"
            >
              +
            </button>
          `
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
                ${plusButton}
                </div>
                <ul class="sidebar-children">
                ${renderTree(nodes, node.id, activeNodeId, actionFolderId)}
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
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

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
