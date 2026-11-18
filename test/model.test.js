const assert = require('assert');
const { normalizeHex, readableForeground, pickPreset } = require('../out/colors');
const { computeColors, managedKeys, withoutKeys } = require('../out/model');
const pkg = require('../package.json');

const groups = pkg.contributes.configuration.properties['projectColor.groups'].default;

// normalizeHex
assert.strictEqual(normalizeHex('#ABC'), '#aabbcc');
assert.strictEqual(normalizeHex('d4af37'), '#d4af37');
assert.strictEqual(normalizeHex('zzz'), undefined);
assert.strictEqual(normalizeHex(''), undefined);

// automatic foreground
assert.strictEqual(readableForeground('#d4af37'), '#000000'); // gold -> black text
assert.strictEqual(readableForeground('#1e3a8a'), '#ffffff'); // dark blue -> white text

// Reproduces the reference example (statusBar + titleBar with #d4af37 and black fg)
const out = computeColors('#d4af37', ['statusBar', 'titleBar'], groups, '#000000');
assert.deepStrictEqual(out, {
  'statusBar.background': '#d4af37',
  'statusBar.noFolderBackground': '#d4af37',
  'statusBar.debuggingBackground': '#d4af37',
  'statusBar.foreground': '#000000',
  'statusBar.noFolderForeground': '#000000',
  'statusBar.debuggingForeground': '#000000',
  'titleBar.activeBackground': '#d4af37',
  'titleBar.inactiveBackground': '#d4af37',
  'titleBar.activeForeground': '#000000',
  'titleBar.inactiveForeground': '#000000',
  'titleBar.border': '#d4af37'
});

// Disabled groups produce no keys; unknown groups are ignored
assert.deepStrictEqual(computeColors('#fff', [], groups, 'auto'), {});
assert.deepStrictEqual(computeColors('#ffffff', ['noExiste'], groups, 'auto'), {});

// mutedForeground carries alpha
const ab = computeColors('#1e3a8a', ['activityBar'], groups, 'auto');
assert.strictEqual(ab['activityBar.inactiveForeground'], '#ffffff99');

// managedKeys covers all groups and withoutKeys keeps foreign keys
const keys = managedKeys(groups);
assert.ok(keys.has('tab.activeBorderTop') && keys.has('sideBar.border'));
const cleaned = withoutKeys({ 'statusBar.background': '#000', 'editor.background': '#111' }, keys);
assert.deepStrictEqual(cleaned, { 'editor.background': '#111' });

// pickPreset: stable per project name, always one of the presets
const presets = pkg.contributes.configuration.properties['projectColor.presets'].default;
const picked = pickPreset('my-api', presets);
assert.ok(presets.includes(picked));
assert.strictEqual(pickPreset('my-api', presets), picked);
assert.ok(new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((n) => pickPreset(n, presets))).size > 1);
assert.strictEqual(pickPreset('my-api', []), undefined);

console.log('OK: all tests passed');
