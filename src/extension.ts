import * as vscode from 'vscode';
import { getSettings, hasWorkspace, init, resetColor, setColor, syncFromSettings } from './applier';
import { normalizeHex } from './colors';
import { ColorPanel } from './panel';

function report(err: unknown): void {
  vscode.window.showErrorMessage(err instanceof Error ? err.message : String(err));
}

function requireWorkspace(): boolean {
  if (!hasWorkspace()) {
    vscode.window.showWarningMessage('Open a folder or workspace to change the project color.');
    return false;
  }
  return true;
}

export function activate(context: vscode.ExtensionContext): void {
  init(context);

  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
  item.text = '$(symbol-color)';
  item.tooltip = 'Project Color: pick project color';
  item.command = 'projectColor.pick';
  const refreshItem = () => (getSettings().showStatusBarItem ? item.show() : item.hide());
  refreshItem();

  context.subscriptions.push(
    item,

    vscode.commands.registerCommand('projectColor.pick', () => {
      if (requireWorkspace()) {
        ColorPanel.show();
      }
    }),

    vscode.commands.registerCommand('projectColor.setHex', async () => {
      if (!requireWorkspace()) {
        return;
      }
      const value = await vscode.window.showInputBox({
        title: 'Project color',
        prompt: 'Hex color (#rgb or #rrggbb)',
        value: getSettings().color ?? '#d4af37',
        validateInput: (v) => (normalizeHex(v) ? undefined : 'Invalid format. Example: #d4af37')
      });
      if (value) {
        await setColor(value).catch(report);
      }
    }),

    vscode.commands.registerCommand('projectColor.preset', async () => {
      if (!requireWorkspace()) {
        return;
      }
      const presets = getSettings().presets;
      const picked = await vscode.window.showQuickPick(
        presets.map((p) => ({ label: `$(circle-filled) ${p}`, description: undefined, hex: p })),
        { title: 'Project color', placeHolder: 'Choose a color from the palette' }
      );
      if (picked) {
        await setColor(picked.hex).catch(report);
      }
    }),

    vscode.commands.registerCommand('projectColor.reset', async () => {
      if (requireWorkspace()) {
        await resetColor().catch(report);
      }
    }),

    vscode.commands.registerCommand('projectColor.openSettings', () =>
      vscode.commands.executeCommand('workbench.action.openSettings', 'projectColor')
    ),

    // Any change to projectColor.* (groups, foreground, hand-edited color...) is re-applied.
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('projectColor')) {
        refreshItem();
        syncFromSettings().catch(report);
      }
    })
  );

  // On startup, make sure the colors match the current configuration.
  syncFromSettings().catch(report);
}

export function deactivate(): void {
  // Nothing to clean up: colors live in the workspace settings.
}
