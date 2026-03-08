import { LibraryManager } from "./libraryManager";

// Local UI session state that should survive reloads.
// We store the last opened document node and cursor positions per document.
const STORAGE_KEYS = {
  activeDocNodeId: "rawy.editor.activeDocNodeId",
  cursorByDocumentId: "rawy.editor.cursorByDocumentId",
} as const;

type CursorMap = Record<string, number>;

export class Editor {
  // Placeholder text for editor states:
  // - no active document selected
  // - active document ready for writing
  private readonly emptyPlaceholder = "Open a document to write...";
  private readonly documentPlaceholder = "Write on...";

  // Debounced autosave state.
  // saveTimer delays writes while the user is still typing.
  // pendingSavePromise lets callers wait for an in-flight save to finish.
  private saveTimer: number | null = null;
  private pendingSavePromise: Promise<void> | null = null;
  private isFocusMode = false;

  constructor(
    private readonly input: HTMLTextAreaElement,
    private readonly manager: LibraryManager,
  ) {}

  // Wire up editor DOM events once at startup.
  init(): void {
    this.input.addEventListener("input", this.handleInput);
    this.input.addEventListener("keyup", this.handleCursorChange);
    this.input.addEventListener("click", this.handleCursorChange);
    this.input.addEventListener("select", this.handleCursorChange);
  }

  // Clean up listeners and timers if the editor is ever torn down.
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

  // Re-render the editor to match the current LibraryManager selection.
  // If a folder is selected, disable the editor.
  // If a document is selected, load its content and restore its cursor.
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

  // Used right after creating a new document so the editor can show it
  // immediately without needing a separate fetch.
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

  // Clear and disable the editor when no document is active.
  clear(): void {
    this.input.value = "";
    this.input.disabled = true;
    this.input.placeholder = this.emptyPlaceholder;
  }

  // Focus the textarea only when it is usable.
  focus(): void {
    if (!this.input.disabled) {
      this.input.focus();
    }
  }

  getElement(): HTMLTextAreaElement {
    return this.input;
  }

  toggleFocusMode(): void {
    this.isFocusMode = !this.isFocusMode;
    document.body.classList.toggle("rawy-focus-mode", this.isFocusMode);
  }

  exitFocusMode(): void {
    if (!this.isFocusMode) return;

    this.isFocusMode = false;
    document.body.classList.remove("rawy-focus-mode");
  }

  // Force any pending debounced save to complete before navigation.
  // This prevents losing the last typed characters when switching quickly.
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

    this.pendingSavePromise = this.manager
      .saveSelectedDocument(content)
      .then(() => {
        this.saveCursorPosition(documentId, this.input.selectionStart ?? 0);
      })
      .finally(() => {
        this.pendingSavePromise = null;
      });

    await this.pendingSavePromise;
  }

  // Restore the last open document from localStorage on app startup.
  // Returns true if a session was restored successfully.
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

  // Handle typing:
  // - remember the active document
  // - remember the latest cursor position
  // - debounce document saves so we do not write on every keystroke
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

      this.pendingSavePromise = this.manager
        .saveSelectedDocument(content)
        .then(() => {
          this.saveCursorPosition(documentId, this.input.selectionStart ?? 0);
        })
        .finally(() => {
          this.pendingSavePromise = null;
        });

      this.saveTimer = null;
    }, 1000);
  };

  // Track cursor movement separately from typing so caret position is restored
  // even when the user only clicks or changes selection.
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

  // Persist the currently selected document node for session restore.
  // We store the node id because selection in the sidebar is node-based.
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

  // Read the last saved cursor position for a document.
  private getSavedCursorPosition(documentId: string): number {
    const map = this.readCursorMap();
    return map[documentId] ?? 0;
  }

  // Persist cursor position per document.
  private saveCursorPosition(documentId: string, position: number): void {
    const map = this.readCursorMap();
    map[documentId] = position;

    window.localStorage.setItem(
      STORAGE_KEYS.cursorByDocumentId,
      JSON.stringify(map),
    );
  }

  // Read the full cursor-position map from localStorage.
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

  // Clamp and restore the cursor safely within document bounds.
  private setCursorPosition(position: number): void {
    const bounded = Math.max(0, Math.min(position, this.input.value.length));

    this.input.focus();
    this.input.setSelectionRange(bounded, bounded);
  }
}
