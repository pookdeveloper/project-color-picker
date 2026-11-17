import { normalizeHex, readableForeground, withAlpha } from './colors';

/** Color roles a workbench.colorCustomizations key can receive. */
export interface GroupDef {
  background?: string[];
  foreground?: string[];
  mutedForeground?: string[];
  border?: string[];
}

export type Groups = Record<string, GroupDef>;

export function resolveForeground(color: string, foreground: string): string {
  if (foreground.trim().toLowerCase() !== 'auto') {
    const fixed = normalizeHex(foreground);
    if (fixed) {
      return fixed;
    }
  }
  return readableForeground(color);
}

/** Computes workbench.colorCustomizations keys for a color and the enabled groups. */
export function computeColors(
  color: string,
  enabledGroups: string[],
  groups: Groups,
  foreground: string
): Record<string, string> {
  const fg = resolveForeground(color, foreground);
  const out: Record<string, string> = {};
  for (const name of enabledGroups) {
    const def = groups[name];
    if (!def) {
      continue;
    }
    for (const k of def.background ?? []) {
      out[k] = color;
    }
    for (const k of def.foreground ?? []) {
      out[k] = fg;
    }
    for (const k of def.mutedForeground ?? []) {
      out[k] = withAlpha(fg, '99');
    }
    for (const k of def.border ?? []) {
      out[k] = color;
    }
  }
  return out;
}

/** Every key the extension may manage (from all groups, enabled or not). */
export function managedKeys(groups: Groups): Set<string> {
  const keys = new Set<string>();
  for (const def of Object.values(groups)) {
    for (const list of [def.background, def.foreground, def.mutedForeground, def.border]) {
      for (const k of list ?? []) {
        keys.add(k);
      }
    }
  }
  return keys;
}

/** Copy of `obj` without the given keys. */
export function withoutKeys(obj: Record<string, unknown>, keys: Set<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!keys.has(k)) {
      out[k] = v;
    }
  }
  return out;
}
