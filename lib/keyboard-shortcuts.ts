// Keyboard shortcuts system

export interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
}

class KeyboardShortcuts {
  private shortcuts: Map<string, Shortcut[]> = new Map();
  private isEnabled: boolean = true;

  register(shortcut: Shortcut): void {
    const key = this.generateKey(shortcut);
    if (!this.shortcuts.has(key)) {
      this.shortcuts.set(key, []);
    }
    this.shortcuts.get(key)!.push(shortcut);
  }

  unregister(shortcut: Shortcut): void {
    const key = this.generateKey(shortcut);
    const shortcuts = this.shortcuts.get(key);
    if (shortcuts) {
      const index = shortcuts.indexOf(shortcut);
      if (index > -1) {
        shortcuts.splice(index, 1);
      }
      if (shortcuts.length === 0) {
        this.shortcuts.delete(key);
      }
    }
  }

  private generateKey(shortcut: Shortcut): string {
    const parts = [];
    if (shortcut.ctrl) parts.push('ctrl');
    if (shortcut.shift) parts.push('shift');
    if (shortcut.alt) parts.push('alt');
    parts.push(shortcut.key.toLowerCase());
    return parts.join('+');
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (!this.isEnabled) return;

    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const parts = [];
    if (event.ctrlKey || event.metaKey) parts.push('ctrl');
    if (event.shiftKey) parts.push('shift');
    if (event.altKey) parts.push('alt');
    parts.push(event.key.toLowerCase());
    
    const key = parts.join('+');
    const shortcuts = this.shortcuts.get(key);

    if (shortcuts && shortcuts.length > 0) {
      event.preventDefault();
      shortcuts[0].action(); // Execute first matching shortcut
    }
  }

  enable(): void {
    this.isEnabled = true;
  }

  disable(): void {
    this.isEnabled = false;
  }

  getAllShortcuts(): Shortcut[] {
    return Array.from(this.shortcuts.values()).flat();
  }
}

// Singleton instance
export const keyboardShortcuts = new KeyboardShortcuts();

// Register global shortcuts if in browser
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => keyboardShortcuts.handleKeyDown(e));
}

// Common shortcuts
export const commonShortcuts = {
  search: () => {
    // Trigger search
    const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
    }
  },
  save: () => {
    // Trigger save
    const saveButton = document.querySelector('[data-save-button]') as HTMLButtonElement;
    if (saveButton) {
      saveButton.click();
    }
  },
  new: () => {
    // Trigger new/create
    const newButton = document.querySelector('[data-new-button]') as HTMLButtonElement;
    if (newButton) {
      newButton.click();
    }
  },
  export: () => {
    // Trigger export
    const exportButton = document.querySelector('[data-export-button]') as HTMLButtonElement;
    if (exportButton) {
      exportButton.click();
    }
  },
  help: () => {
    // Show help modal
    const helpButton = document.querySelector('[data-help-button]') as HTMLButtonElement;
    if (helpButton) {
      helpButton.click();
    }
  },
  home: () => {
    // Navigate to home
    window.location.href = '/';
  },
  players: () => {
    // Navigate to players
    window.location.href = '/jugadores';
  },
  wellness: () => {
    // Navigate to wellness
    window.location.href = '/wellness';
  },
  competition: () => {
    // Navigate to competition
    window.location.href = '/competencia';
  },
};
