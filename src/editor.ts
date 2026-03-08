// src/editor.ts

import { LibraryManager } from "./libraryManager";

export class Editor {
  private readonly emptyPlaceholder = "Open a document to write...";
  private readonly documentPlaceholder = "Write on...";

  private saveTimer: number | null = null;

  constructor(
    private readonly input: HTMLTextAreaElement,
    private readonly manager: LibraryManager,
  ) {}

  init(): void {
    this.input.addEventListener("input", this.handleInput);
  }

  destroy(): void {
    this.input.removeEventListener("input", this.handleInput);

    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  async refreshFromSelection(): Promise<void> {
    const selected = await this.manager.getSelectedDocument();

    if (!selected) {
      this.input.value = "";
      this.input.disabled = true;
      this.input.placeholder = this.emptyPlaceholder;
      return;
    }

    this.input.disabled = false;
    this.input.placeholder = this.documentPlaceholder;
    this.input.value = selected.content;
  }

  setDocumentContent(content: string): void {
    this.input.disabled = false;
    this.input.placeholder = this.documentPlaceholder;
    this.input.value = content;
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

  private handleInput = (): void => {
    const state = this.manager.getState();

    if (!state.activeDocumentId) {
      return;
    }

    // reset debounce timer
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = window.setTimeout(async () => {
      await this.manager.saveSelectedDocument(this.input.value);
    }, 1000);
  };
}
