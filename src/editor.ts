// src/editor.ts

import { LibraryManager } from "./libraryManager";

const STORAGE_KEYS = {
  activeDocNodeId: "rawy.editor.activeDocNodeId",
  cursorByDocumentId: "rawy.editor.cursorByDocumentId",
} as const;

type CursorMap = Record<string, number>;

export class Editor {
  private readonly emptyPlaceholder = "Open a document to write...";
  private readonly documentPlaceholder = "Write on...";

  private saveTimer: number | null = null;
  private pendingSavePromise: Promise<void> | null = null;
  private pendingDocumentId: string | null = null;

  constructor(
    private readonly input: HTMLTextAreaElement,
    private readonly manager: LibraryManager,
  ) {}

  init(): void {
    this.input.addEventListener("input", this.handleInput);
    this.input.addEventListener("keyup", this.handleCursorChange);
    this.input.addEventListener("click", this.handleCursorChange);
    this.input.addEventListener("select", this.handleCursorChange);
  }

  destroy(): void {
    this.input.removeEventListener("input", this.handleInput);
    this.input.removeEventListener("keyup", this.handleCursorChange);
    this.input.removeEventListener("click", this.handleCursorChange);
    this.input.removeEventListener("select", this.handleCursorChange);

    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  async refreshFromSelection(): Promise<void> {
    const selected = await this.manager.getSelectedDocument();

    if (!selected) {
      this.clear();
      return;
    }

    this.input.disabled = false;
    this.input.placeholder = this.documentPlaceholder;
    this.input.value = selected.content;

    this.persistActiveDocumentNodeId();

    const cursor = this.getSavedCursorPosition(selected.id);
    this.setCursorPosition(cursor);
  }

  setDocumentContent(content: string): void {
    this.input.disabled = false;
    this.input.placeholder = this.documentPlaceholder;
    this.input.value = content;

    this.persistActiveDocumentNodeId();

    const state = this.manager.getState();
    if (state.activeDocumentId) {
      const cursor = this.getSavedCursorPosition(state.activeDocumentId);
      this.setCursorPosition(cursor);
    }
  }

  clear(): void {
    this.input.value = "";
    this.input.disabled = true;
    this.input.placeholder = this.emptyPlaceholder;
  }

  focus(): void {
    if (!this.input.disabled) {
      this.input.focus();
    }
  }

  async flushPendingSave(): Promise<void> {
    if (this.saveTimer === null) {
      if (this.pendingSavePromise) {
        await this.pendingSavePromise;
      }
      return;
    }

    window.clearTimeout(this.saveTimer);
    this.saveTimer = null;

    const state = this.manager.getState();
    if (!state.activeDocumentId) {
      return;
    }

    const content = this.input.value;
    const documentId = state.activeDocumentId;

    this.pendingDocumentId = documentId;
    this.pendingSavePromise = this.manager
      .saveSelectedDocument(content)
      .then(() => {
        this.saveCursorPosition(documentId, this.input.selectionStart ?? 0);
      })
      .finally(() => {
        this.pendingSavePromise = null;
        this.pendingDocumentId = null;
      });

    await this.pendingSavePromise;
  }

  async restoreLastSession(): Promise<boolean> {
    const nodeId = window.localStorage.getItem(STORAGE_KEYS.activeDocNodeId);
    if (!nodeId) {
      return false;
    }

    try {
      const document = await this.manager.selectDocument(nodeId);
      if (!document) {
        return false;
      }

      await this.refreshFromSelection();
      return true;
    } catch {
      window.localStorage.removeItem(STORAGE_KEYS.activeDocNodeId);
      return false;
    }
  }

  private handleInput = (): void => {
    const state = this.manager.getState();
    if (!state.activeDocumentId) {
      return;
    }

    this.persistActiveDocumentNodeId();
    this.saveCursorPosition(
      state.activeDocumentId,
      this.input.selectionStart ?? 0,
    );

    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
    }

    this.saveTimer = window.setTimeout(() => {
      const latestState = this.manager.getState();
      if (!latestState.activeDocumentId) {
        this.saveTimer = null;
        return;
      }

      const content = this.input.value;
      const documentId = latestState.activeDocumentId;

      this.pendingDocumentId = documentId;
      this.pendingSavePromise = this.manager
        .saveSelectedDocument(content)
        .then(() => {
          this.saveCursorPosition(documentId, this.input.selectionStart ?? 0);
        })
        .finally(() => {
          this.pendingSavePromise = null;
          this.pendingDocumentId = null;
        });

      this.saveTimer = null;
    }, 1000);
  };

  private handleCursorChange = (): void => {
    const state = this.manager.getState();
    if (!state.activeDocumentId || this.input.disabled) {
      return;
    }

    this.saveCursorPosition(
      state.activeDocumentId,
      this.input.selectionStart ?? 0,
    );
    this.persistActiveDocumentNodeId();
  };

  private persistActiveDocumentNodeId(): void {
    const state = this.manager.getState();

    if (!state.activeDocumentId || !state.activeNodeId) {
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEYS.activeDocNodeId,
      state.activeNodeId,
    );
  }

  private getSavedCursorPosition(documentId: string): number {
    const map = this.readCursorMap();
    return map[documentId] ?? 0;
  }

  private saveCursorPosition(documentId: string, position: number): void {
    const map = this.readCursorMap();
    map[documentId] = position;
    window.localStorage.setItem(
      STORAGE_KEYS.cursorByDocumentId,
      JSON.stringify(map),
    );
  }

  private readCursorMap(): CursorMap {
    const raw = window.localStorage.getItem(STORAGE_KEYS.cursorByDocumentId);
    if (!raw) {
      return {};
    }

    try {
      const parsed = JSON.parse(raw) as CursorMap;
      return parsed ?? {};
    } catch {
      return {};
    }
  }

  private setCursorPosition(position: number): void {
    const bounded = Math.max(0, Math.min(position, this.input.value.length));

    this.input.focus();
    this.input.setSelectionRange(bounded, bounded);
  }
}
