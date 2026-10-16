/** The modifier key label for shortcuts: ⌘ on Apple devices, Ctrl elsewhere. */
export const KMOD =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';
