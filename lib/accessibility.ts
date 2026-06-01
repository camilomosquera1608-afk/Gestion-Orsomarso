// WCAG 2.1 AA Accessibility Utilities

// Color contrast ratios (WCAG 2.1 AA requires 4.5:1 for normal text, 3:1 for large text)
export const CONTRAST_RATIOS = {
  AA_NORMAL: 4.5,
  AA_LARGE: 3.0,
  AAA_NORMAL: 7.0,
  AAA_LARGE: 4.5,
};

// Calculate relative luminance of a color (for contrast ratio calculation)
export function calculateLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Calculate contrast ratio between two colors
export function calculateContrastRatio(
  color1: { r: number; g: number; b: number },
  color2: { r: number; g: number; b: number }
): number {
  const l1 = calculateLuminance(color1.r, color1.g, color1.b);
  const l2 = calculateLuminance(color2.r, color2.g, color2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Parse hex color to RGB
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// Check if color contrast meets WCAG AA standards
export function meetsWCAGAA(
  foreground: string,
  background: string,
  isLargeText = false
): boolean {
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);
  if (!fg || !bg) return false;

  const ratio = calculateContrastRatio(fg, bg);
  const requiredRatio = isLargeText ? CONTRAST_RATIOS.AA_LARGE : CONTRAST_RATIOS.AA_NORMAL;
  return ratio >= requiredRatio;
}

// ARIA role mappings for common UI patterns
export const ARIA_ROLES = {
  button: 'button',
  link: 'link',
  navigation: 'navigation',
  main: 'main',
  complementary: 'complementary',
  contentinfo: 'contentinfo',
  search: 'search',
  form: 'form',
  dialog: 'dialog',
  alert: 'alert',
  status: 'status',
  tablist: 'tablist',
  tab: 'tab',
 tabpanel: 'tabpanel',
  menu: 'menu',
  menuitem: 'menuitem',
  listbox: 'listbox',
  option: 'option',
  combobox: 'combobox',
  checkbox: 'checkbox',
  radio: 'radio',
  radiogroup: 'radiogroup',
  switch: 'switch',
  slider: 'slider',
  progressbar: 'progressbar',
  scrollbar: 'scrollbar',
  tooltip: 'tooltip',
};

// Keyboard navigation utilities
export const KEYBOARD_KEYS = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown',
};

// Check if key is an activation key (Enter or Space)
export function isActivationKey(key: string): boolean {
  return key === KEYBOARD_KEYS.ENTER || key === KEYBOARD_KEYS.SPACE;
}

// Check if key is a navigation key
export function isNavigationKey(key: string): boolean {
  return [
    KEYBOARD_KEYS.ARROW_UP,
    KEYBOARD_KEYS.ARROW_DOWN,
    KEYBOARD_KEYS.ARROW_LEFT,
    KEYBOARD_KEYS.ARROW_RIGHT,
    KEYBOARD_KEYS.HOME,
    KEYBOARD_KEYS.END,
    KEYBOARD_KEYS.PAGE_UP,
    KEYBOARD_KEYS.PAGE_DOWN,
  ].includes(key);
}

// Focus management utilities
export function trapFocus(element: HTMLElement): () => void {
  const focusableElements = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstFocusable = focusableElements[0] as HTMLElement;
  const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === KEYBOARD_KEYS.TAB) {
      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          lastFocusable.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          firstFocusable.focus();
          e.preventDefault();
        }
      }
    }
  };

  element.addEventListener('keydown', handleKeyDown);
  firstFocusable?.focus();

  return () => {
    element.removeEventListener('keydown', handleKeyDown);
  };
}

// Screen reader announcements
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

// Skip link utility for keyboard users
export function createSkipLink(targetId: string, label: string = 'Saltar al contenido principal'): string {
  return `
    <a
      href="#${targetId}"
      class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg"
    >
      ${label}
    </a>
  `;
}

// Heading level validator (ensures proper heading hierarchy)
export function validateHeadingHierarchy(headings: HTMLElement[]): boolean {
  let previousLevel = 0;
  
  for (const heading of headings) {
    const level = parseInt(heading.tagName[1]);
    if (level > previousLevel + 1) {
      return false;
    }
    previousLevel = level;
  }
  
  return true;
}

// Alt text validator for images
export function hasValidAltText(img: HTMLImageElement): boolean {
  return img.alt !== '' && img.alt !== null;
}

// Form field accessibility checker
export function checkFormFieldAccessibility(field: HTMLElement): {
  hasLabel: boolean;
  hasError: boolean;
  hasDescription: boolean;
  isValid: boolean;
} {
  const hasLabel = field.getAttribute('aria-label') !== null ||
                   field.getAttribute('aria-labelledby') !== null ||
                   field.closest('label') !== null;
  
  const hasError = field.getAttribute('aria-invalid') !== null ||
                   field.getAttribute('aria-describedby') !== null;
  
  const hasDescription = field.getAttribute('aria-describedby') !== null;
  
  return {
    hasLabel,
    hasError,
    hasDescription,
    isValid: hasLabel,
  };
}

// Focus visible indicator (for keyboard users)
export function addFocusVisibleStyles(): void {
  const style = document.createElement('style');
  style.textContent = `
    :focus-visible {
      outline: 2px solid #2563eb;
      outline-offset: 2px;
    }
    
    .focus-ring {
      outline: 2px solid #2563eb;
      outline-offset: 2px;
    }
  `;
  document.head.appendChild(style);
}

// Reduced motion preference check
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// High contrast mode check
export function prefersHighContrast(): boolean {
  return window.matchMedia('(prefers-contrast: high)').matches;
}

// Screen reader only utility class
export const srOnly = `
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

// Accessible icon button generator
export function generateAccessibleIconButtonProps(
  label: string,
  isPressed?: boolean,
  isExpanded?: boolean,
  isDisabled?: boolean
) {
  return {
    role: 'button',
    'aria-label': label,
    'aria-pressed': isPressed,
    'aria-expanded': isExpanded,
    'aria-disabled': isDisabled,
    tabIndex: isDisabled ? -1 : 0,
  };
}

// Accessible link generator
export function generateAccessibleLinkProps(label: string, isExternal = false) {
  return {
    role: 'link',
    'aria-label': label,
    ...(isExternal && { 'aria-describedby': 'opens-in-new-tab' }),
  };
}

// Accessible modal props generator
export function generateAccessibleModalProps(title: string, isOpen: boolean) {
  return {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'modal-title',
    'aria-describedby': 'modal-description',
    'aria-hidden': !isOpen,
  };
}

// Accessible table props generator
export function generateAccessibleTableProps(caption?: string) {
  return {
    role: 'table',
    ...(caption && { 'aria-label': caption }),
  };
}
