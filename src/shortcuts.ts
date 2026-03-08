export type ShortcutScopeName = "sidebar" | "editor";
export type KeyCombo = string;

export type ScopeCommandMap = Record<string, () => void | boolean>;

export type ScopeBindings<TCommand extends string> = Record<
  TCommand,
  KeyCombo | KeyCombo[]
>;

interface RegisteredScope {
  name: ShortcutScopeName;
  getElement: () => HTMLElement | null;
  commands: ScopeCommandMap;
  bindings: Record<string, KeyCombo[]>;
}

export class ShortcutManager {
  private scopes: RegisteredScope[] = [];

  constructor(
    private readonly overrides: Partial<
      Record<ShortcutScopeName, Record<string, KeyCombo | KeyCombo[]>>
    > = {},
  ) {}

  init(): void {
    document.addEventListener("keydown", this.handleKeyDown);
  }

  destroy(): void {
    document.removeEventListener("keydown", this.handleKeyDown);
  }

  registerScope<TCommand extends string>(config: {
    name: ShortcutScopeName;
    getElement: () => HTMLElement | null;
    commands: Record<TCommand, () => void | boolean>;
    bindings: ScopeBindings<TCommand>;
  }): void {
    const overrideBindings = this.overrides[config.name] ?? {};

    const mergedBindings: Record<string, KeyCombo[]> = {};

    for (const [command, defaultValue] of Object.entries(config.bindings)) {
      const overrideValue = overrideBindings[command];
      const resolved = overrideValue ?? defaultValue;

      mergedBindings[command] = Array.isArray(resolved) ? resolved : [resolved];
    }

    this.scopes.push({
      name: config.name,
      getElement: config.getElement,
      commands: config.commands,
      bindings: mergedBindings,
    });
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    const activeElement = document.activeElement as HTMLElement | null;
    if (!activeElement) return;

    const combo = normalizeKeyboardEvent(event);

    for (const scope of this.scopes) {
      const element = scope.getElement();
      if (!element) continue;

      const isWithinScope =
        activeElement === element || element.contains(activeElement);

      if (!isWithinScope) {
        continue;
      }

      for (const [commandName, combos] of Object.entries(scope.bindings)) {
        if (!combos.includes(combo)) {
          continue;
        }

        const handler = scope.commands[commandName];
        if (!handler) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        handler();
        return;
      }
    }
  };
}

function normalizeKeyboardEvent(event: KeyboardEvent): KeyCombo {
  const parts: string[] = [];

  if (event.ctrlKey) parts.push("Ctrl");
  if (event.metaKey) parts.push("Meta");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");

  parts.push(normalizeKey(event.key));

  return parts.join("+");
}

function normalizeKey(key: string): string {
  const k = key.trim();

  if (k === " ") return "Space";
  if (k.length === 1) return k.toUpperCase();

  switch (k) {
    case "Esc":
      return "Escape";
    case "Up":
      return "ArrowUp";
    case "Down":
      return "ArrowDown";
    case "Left":
      return "ArrowLeft";
    case "Right":
      return "ArrowRight";
    default:
      return k;
  }
}
