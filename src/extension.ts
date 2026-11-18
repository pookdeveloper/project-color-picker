import * as vscode from 'vscode';
import { autoAssign, getSettings, hasWorkspace, init, removeColor, setColor, syncFromSettings } from './applier';
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

    vscode.commands.registerCommand('projectColor.reset', async () => {
      if (requireWorkspace()) {
        await removeColor().catch(report);
      }
    }),

    vscode.commands.registerCommand('projectColor.openSettings', async () => {
      if (!requireWorkspace()) {
        return;
      }
      try {
        const settings = getSettings();
        const picked = await vscode.window.showQuickPick(
          Object.keys(settings.groups).map((name) => ({
            label: name,
            picked: settings.enabledGroups.includes(name)
          })),
          { title: 'Configure affected elements', placeHolder: 'Select the groups that receive the project color', canPickMany: true }
        );
        if (picked !== undefined) {
          await vscode.workspace.getConfiguration('projectColor').update(
            'enabledGroups', picked.map((group) => group.label), vscode.ConfigurationTarget.Workspace
          );
        }
      } catch (err) {
        report(err);
      }
    }),

    // Any change to projectColor.* (groups, foreground, hand-edited color...) is re-applied.
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('projectColor')) {
        refreshItem();
        syncFromSettings().catch(report);
      }
    })
  );

  // On startup, make sure the colors match the current configuration.
  syncFromSettings()
    .then(autoAssign)
    .then(async (color) => {
      if (!color) {
        return;
      }
      const action = await vscode.window.showInformationMessage(`Project color assigned: ${color}`, 'Change', 'Remove');
      if (action === 'Change') {
        ColorPanel.show();
      } else if (action === 'Remove') {
        await removeColor();
      }
    })
    .catch(report);
}

export function deactivate(): void {
  // Nothing to clean up: colors live in the workspace settings.
}
