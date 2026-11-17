/** Pure color utilities (no VS Code dependencies). */

/** Normalizes "#abc", "abc", "#AABBCC" to "#aabbcc". Returns undefined if invalid. */
export function normalizeHex(input: string | undefined): string | undefined {
  if (!input) {
    return undefined;
  }
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim());
  if (!m) {
    return undefined;
  }
  let h = m[1].toLowerCase();
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return '#' + h;
}

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance of a normalized hex (#rrggbb). */
export function luminance(hex: string): number {
  const r = channel(parseInt(hex.slice(1, 3), 16));
  const g = channel(parseInt(hex.slice(3, 5), 16));
  const b = channel(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** White or black, whichever has the better contrast on `bg`. */
export function readableForeground(bg: string): string {
  return contrastRatio(bg, '#ffffff') >= contrastRatio(bg, '#000000') ? '#ffffff' : '#000000';
}

/** Appends an alpha channel (2-digit hex) to a #rrggbb. */
export function withAlpha(hex: string, alpha = '99'): string {
  return hex + alpha;
}
