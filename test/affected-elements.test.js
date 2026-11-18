const assert = require('assert');
const Module = require('module');

const commands = new Map();
const updates = [];
const warnings = [];
const errors = [];
const executed = [];
const settings = {
  groups: { statusBar: {}, titleBar: {}, customPanel: {} },
  enabledGroups: ['titleBar', 'customPanel'],
  showStatusBarItem: true
};
let hasWorkspace = true;
let selection;
let pickerItems;
let pickerOptions;
let updateError;
const vscode = {
  StatusBarAlignment: { Left: 1 },
  ConfigurationTarget: { Workspace: 2 },
  window: {
    createStatusBarItem: () => ({ show() {}, hide() {} }),
    showWarningMessage: (message) => warnings.push(message),
    showErrorMessage: (message) => errors.push(message),
    showQuickPick: async (items, options) => {
      pickerItems = items;
      pickerOptions = options;
      return selection;
    }
  },
  commands: {
    registerCommand: (name, handler) => commands.set(name, handler),
    executeCommand: async (...args) => executed.push(args)
  },
  workspace: {
    onDidChangeConfiguration() {},
    getConfiguration: (section) => ({
      update: async (...args) => {
        if (updateError) throw updateError;
        updates.push([section, ...args]);
      }
    })
  }
};
const applier = {
  init() {},
  getSettings: () => settings,
  hasWorkspace: () => hasWorkspace,
  syncFromSettings: async () => {}
};
const originalLoad = Module._load;
let activate;
let ColorPanel;
try {
  Module._load = function (request, parent, isMain) {
    if (request === 'vscode') return vscode;
    if (request === './applier') return applier;
    return originalLoad.call(this, request, parent, isMain);
  };
  ({ activate } = require('../out/extension'));
  ({ ColorPanel } = require('../out/panel'));
} finally {
  Module._load = originalLoad;
}

async function run() {
  activate({ subscriptions: [] });
  assert.strictEqual(commands.has('projectColor.preset'), false);
  assert.strictEqual(require('../package.json').contributes.commands.some((command) => command.command === 'projectColor.preset'), false);
  const configure = commands.get('projectColor.openSettings');

  // Cancel preserves settings, with current and custom groups preselected.
  await configure();
  assert.strictEqual(pickerOptions.canPickMany, true);
  assert.deepStrictEqual(pickerItems, [
    { label: 'statusBar', picked: false },
    { label: 'titleBar', picked: true },
    { label: 'customPanel', picked: true }
  ]);
  assert.deepStrictEqual(updates, []);

  selection = [pickerItems[0], pickerItems[2]];
  await configure();
  assert.deepStrictEqual(updates.pop(), ['projectColor', 'enabledGroups', ['statusBar', 'customPanel'], 2]);

  selection = [];
  await configure();
  assert.deepStrictEqual(updates.pop(), ['projectColor', 'enabledGroups', [], 2]);

  hasWorkspace = false;
  pickerItems = undefined;
  await configure();
  assert.strictEqual(pickerItems, undefined);
  assert.strictEqual(warnings.length, 1);
  assert.deepStrictEqual(updates, []);

  hasWorkspace = true;
  updateError = new Error('Workspace settings are read-only');
  await configure();
  assert.deepStrictEqual(errors, ['Workspace settings are read-only']);
  assert.deepStrictEqual(updates, []);

  await ColorPanel.prototype.onMessage.call({}, { type: 'openSettings' });
  assert.deepStrictEqual(executed, [['projectColor.openSettings']]);
  console.log('OK: affected element checkbox tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
