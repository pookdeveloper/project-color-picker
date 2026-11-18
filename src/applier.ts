import * as vscode from 'vscode';
import { normalizeHex, pickPreset } from './colors';
import { computeColors, effectiveColor, Groups, managedKeys, withoutKeys } from './model';

const SECTION = 'projectColor';
const COLORS_KEY = 'workbench.colorCustomizations';
const EXTRA_KEYS_STATE = 'projectColor.managedExtraKeys';
const OPTED_OUT_STATE = 'projectColor.optedOut';
const PAINTED_STATE = 'projectColor.painted';
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
  autoAssign: boolean;
  branchColors: Record<string, string>;
  remoteColor: string;
}

let state: vscode.Memento;
let branch: string | undefined;

export function init(context: vscode.ExtensionContext): void {
  state = context.workspaceState;
  watchGitBranch(context).catch(() => undefined); // no Git extension: branch rules simply never match
}

/* Minimal slice of the built-in Git extension API (vscode.git, API v1). */
interface GitRepository {
  state: { HEAD?: { name?: string }; onDidChange: vscode.Event<void> };
}
interface GitApi {
  repositories: GitRepository[];
  onDidOpenRepository: vscode.Event<GitRepository>;
}

async function watchGitBranch(context: vscode.ExtensionContext): Promise<void> {
  const ext = vscode.extensions.getExtension<{ getAPI(version: 1): GitApi }>('vscode.git');
  if (!ext) {
    return;
  }
  const api = (ext.isActive ? ext.exports : await ext.activate()).getAPI(1);
  const refresh = () => {
    // ponytail: first repository only; per-folder branches in multi-root workspaces are not tracked.
    const next = api.repositories[0]?.state.HEAD?.name;
    if (next !== branch) {
      branch = next;
      syncFromSettings().catch((err) => vscode.window.showErrorMessage(String(err)));
    }
  };
  const watch = (repo: GitRepository) => {
    context.subscriptions.push(repo.state.onDidChange(refresh));
    refresh();
  };
  api.repositories.forEach(watch);
  context.subscriptions.push(api.onDidOpenRepository(watch));
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
    showStatusBarItem: c.get<boolean>('showStatusBarItem', true),
    autoAssign: c.get<boolean>('autoAssign', false),
    branchColors: c.get<Record<string, string>>('branchColors', {}),
    remoteColor: c.get<string>('remoteColor', '')
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

/** Paints the effective color (branch rule > remote color > project color), or clears everything if there is none. */
async function applyEffective(): Promise<void> {
  const s = getSettings();
  const color = effectiveColor({
    project: s.color,
    branch,
    branchColors: s.branchColors,
    remote: vscode.env.remoteName,
    remoteColor: s.remoteColor
  });
  if (!color && !state.get<boolean>(PAINTED_STATE, false)) {
    return; // never painted here: leave hand-written colors alone
  }
  await writeColors(color);
  await writeExtras(!!color);
  await state.update(PAINTED_STATE, !!color);
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
    await applyEffective();
  });
}

/** Re-applies the stored color (e.g. after groups change in settings). */
export function syncFromSettings(): Promise<void> {
  return enqueue(async () => {
    if (hasWorkspace()) {
      await applyEffective();
    }
  });
}

/** Removes the color and everything the extension wrote. */
export function resetColor(): Promise<void> {
  return enqueue(async () => {
    assertWorkspace();
    await writeColors(undefined);
    await writeExtras(false);
    await state.update(PAINTED_STATE, false);
    await vscode.workspace.getConfiguration(SECTION).update('color', undefined, WS);
  });
}

/** Explicit user removal: clears the color and opts the project out of auto-assign. */
export async function removeColor(): Promise<void> {
  await resetColor();
  await state.update(OPTED_OUT_STATE, true);
}

/** Gives an uncolored, non-opted-out project a preset derived from its name. Returns the color assigned. */
export async function autoAssign(): Promise<string | undefined> {
  const s = getSettings();
  if (!s.autoAssign || !hasWorkspace() || s.color || state.get<boolean>(OPTED_OUT_STATE, false)) {
    return undefined;
  }
  const color = pickPreset(vscode.workspace.name ?? '', s.presets);
  if (color) {
    await setColor(color);
  }
  return color;
}
