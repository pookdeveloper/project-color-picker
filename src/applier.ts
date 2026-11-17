import * as vscode from 'vscode';
import { normalizeHex } from './colors';
import { computeColors, Groups, managedKeys, withoutKeys } from './model';

const SECTION = 'projectColor';
const COLORS_KEY = 'workbench.colorCustomizations';
const EXTRA_KEYS_STATE = 'projectColor.managedExtraKeys';
const WS = vscode.ConfigurationTarget.Workspace;

export interface Settings {
  color?: string;
  enabledGroups: string[];
  groups: Groups;
  foreground: string;
  extraSettings: Record<string, unknown>;
  presets: string[];
  livePreview: boolean;
  showStatusBarItem: boolean;
}

let state: vscode.Memento;

export function init(context: vscode.ExtensionContext): void {
  state = context.workspaceState;
}

export function getSettings(): Settings {
  const c = vscode.workspace.getConfiguration(SECTION);
  return {
    color: normalizeHex(c.get<string>('color', '')),
    enabledGroups: c.get<string[]>('enabledGroups', []),
    groups: c.get<Groups>('groups', {}),
    foreground: c.get<string>('foreground', 'auto'),
    extraSettings: c.get<Record<string, unknown>>('extraSettings', {}),
    presets: c.get<string[]>('presets', []).map((p) => normalizeHex(p)).filter((p): p is string => !!p),
    livePreview: c.get<boolean>('livePreview', true),
    showStatusBarItem: c.get<boolean>('showStatusBarItem', true)
  };
}

export function hasWorkspace(): boolean {
  return !!(vscode.workspace.workspaceFolders?.length || vscode.workspace.workspaceFile);
}

/* Queue: serializes writes so they never overlap. */
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn);
  queue = next.catch(() => undefined);
  return next;
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

async function updateIfChanged(key: string, current: unknown, next: unknown): Promise<void> {
  if (!sameJson(current, next)) {
    await vscode.workspace.getConfiguration().update(key, next, WS);
  }
}

function emptyToUndefined(obj: Record<string, unknown>): Record<string, unknown> | undefined {
  return Object.keys(obj).length ? obj : undefined;
}

/** Writes colors to workbench.colorCustomizations (workspace scope), preserving everything else. */
async function writeColors(color: string | undefined): Promise<void> {
  const s = getSettings();
  const root = vscode.workspace.getConfiguration();
  const current = (root.inspect<Record<string, unknown>>(COLORS_KEY)?.workspaceValue ?? {}) as Record<string, unknown>;
  const cleaned = withoutKeys(current, managedKeys(s.groups));
  const next = color ? { ...cleaned, ...computeColors(color, s.enabledGroups, s.groups, s.foreground) } : cleaned;
  await updateIfChanged(COLORS_KEY, emptyToUndefined(current), emptyToUndefined(next));
}

/** Writes (or removes) the user-defined extra settings. */
async function writeExtras(apply: boolean): Promise<void> {
  const s = getSettings();
  const root = vscode.workspace.getConfiguration();
  const wanted = apply ? s.extraSettings : {};
  const previous = state.get<string[]>(EXTRA_KEYS_STATE, []);

  for (const key of previous) {
    if (!(key in wanted)) {
      await root.update(key, undefined, WS);
    }
  }
  for (const [key, value] of Object.entries(wanted)) {
    const currentValue = root.inspect(key)?.workspaceValue;
    await updateIfChanged(key, currentValue, value);
  }
  await state.update(EXTRA_KEYS_STATE, Object.keys(wanted));
}

async function doApply(color: string): Promise<void> {
  await writeColors(color);
  await writeExtras(true);
}

function assertWorkspace(): void {
  if (!hasWorkspace()) {
    throw new Error('Open a folder or workspace to change the project color.');
  }
}

/** Stores the color in projectColor.color and applies it. */
export function setColor(hex: string): Promise<void> {
  return enqueue(async () => {
    assertWorkspace();
    const color = normalizeHex(hex);
    if (!color) {
      throw new Error(`Invalid color: ${hex}`);
    }
    const cfg = vscode.workspace.getConfiguration(SECTION);
    if (normalizeHex(cfg.get<string>('color', '')) !== color) {
      await cfg.update('color', color, WS);
    }
    await doApply(color);
  });
}

/** Re-applies the stored color (e.g. after groups change in settings). */
export function syncFromSettings(): Promise<void> {
  return enqueue(async () => {
    if (!hasWorkspace()) {
      return;
    }
    const color = getSettings().color;
    if (color) {
      await doApply(color);
    }
  });
}

/** Removes the color and everything the extension wrote. */
export function resetColor(): Promise<void> {
  return enqueue(async () => {
    assertWorkspace();
    await writeColors(undefined);
    await writeExtras(false);
    await vscode.workspace.getConfiguration(SECTION).update('color', undefined, WS);
  });
}
