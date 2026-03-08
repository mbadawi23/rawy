// src/editor.ts

import { LibraryManager } from "./libraryManager";

export class Editor {
  private readonly emptyPlaceholder = "Open a document to write...";
  private readonly documentPlaceholder = "Write on...";

  constructor(
    private readonly input: HTMLTextAreaElement,
    private readonly manager: LibraryManager,
  ) {}

  init(): void {
    this.input.addEventListener("input", this.handleInput);
  }

  destroy(): void {
    this.input.removeEventListener("input", this.handleInput);
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

  private handleInput = async (): Promise<void> => {
    const state = this.manager.getState();

    if (!state.activeDocumentId) {
      return;
    }

    await this.manager.saveSelectedDocument(this.input.value);
  };
}
