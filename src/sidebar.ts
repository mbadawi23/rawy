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
}

export class Sidebar {
  constructor(
    private readonly root: HTMLElement,
    private readonly callbacks: SidebarCallbacks,
  ) {}

  render(data: SidebarRenderData): void {
    const treeHtml = renderTree(
      data.nodes,
      data.project.rootNodeId,
      data.activeNodeId,
    );

    this.root.innerHTML = `
    <div class="sidebar-header">
      <h1>${escapeHtml(data.project.title)}</h1>
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
  }
}

function renderTree(
  nodes: ProjectNode[],
  folderId: ID,
  activeNodeId: ID | null,
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
        return `
          <li class="sidebar-folder">
            <div class="sidebar-folder-label">${escapeHtml(node.title)}</div>
            <ul class="sidebar-children">
              ${renderTree(nodes, node.id, activeNodeId)}
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
