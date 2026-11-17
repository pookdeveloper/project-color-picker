import * as vscode from 'vscode';
import { getSettings, resetColor, setColor } from './applier';
import { normalizeHex } from './colors';

type FromWebview =
  | { type: 'ready' }
  | { type: 'preview'; color: string }
  | { type: 'apply'; color: string }
  | { type: 'reset' }
  | { type: 'openSettings' };

const DEFAULT_COLOR = '#d4af37';

export class ColorPanel {
  private static current: ColorPanel | undefined;

  private readonly disposables: vscode.Disposable[] = [];
  private saved: string | undefined;
  private dirty = false;

  static show(): void {
    if (ColorPanel.current) {
      ColorPanel.current.panel.reveal();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'projectColorPicker',
      'Project Color',
      { viewColumn: vscode.ViewColumn.Active, preserveFocus: false },
      { enableScripts: true, retainContextWhenHidden: true }
    );
    ColorPanel.current = new ColorPanel(panel);
  }

  private constructor(private readonly panel: vscode.WebviewPanel) {
    this.saved = getSettings().color;
    panel.webview.html = this.html(panel.webview);

    panel.webview.onDidReceiveMessage((m: FromWebview) => this.onMessage(m), null, this.disposables);
    panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  private async onMessage(m: FromWebview): Promise<void> {
    try {
      switch (m.type) {
        case 'ready': {
          const s = getSettings();
          this.panel.webview.postMessage({
            type: 'init',
            color: s.color ?? DEFAULT_COLOR,
            hasColor: !!s.color,
            presets: s.presets,
            enabledGroups: s.enabledGroups,
            foreground: s.foreground,
            livePreview: s.livePreview
          });
          break;
        }
        case 'preview': {
          const color = normalizeHex(m.color);
          if (color) {
            this.dirty = true;
            await setColor(color);
          }
          break;
        }
        case 'apply': {
          const color = normalizeHex(m.color);
          if (color) {
            await setColor(color);
            this.saved = color;
            this.dirty = false;
            vscode.window.setStatusBarMessage(`Project color: ${color}`, 3000);
          }
          break;
        }
        case 'reset':
          await resetColor();
          this.saved = undefined;
          this.dirty = false;
          vscode.window.setStatusBarMessage('Project color removed', 3000);
          break;
        case 'openSettings':
          await vscode.commands.executeCommand('workbench.action.openSettings', 'projectColor');
          break;
      }
    } catch (err) {
      vscode.window.showErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }

  private dispose(): void {
    ColorPanel.current = undefined;
    const restore = this.dirty;
    const saved = this.saved;
    this.disposables.forEach((d) => d.dispose());
    if (restore) {
      // Closed with an unapplied live preview: go back to the saved state.
      (saved ? setColor(saved) : resetColor()).catch(() => undefined);
    }
  }

  private html(webview: vscode.Webview): string {
    const nonce = Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
    const csp = `default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';`;
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Project Color</title>
<style nonce="${nonce}">
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 20px 28px; max-width: 640px; }
  h1 { font-size: 1.4em; font-weight: 600; margin: 0 0 4px; }
  p.sub { margin: 0 0 20px; color: var(--vscode-descriptionForeground); }
  .row { display: flex; gap: 20px; align-items: flex-start; margin-bottom: 18px; }
  input[type=color] { width: 96px; height: 96px; padding: 0; border: 1px solid var(--vscode-widget-border, #888); border-radius: 6px; background: none; cursor: pointer; }
  input[type=text] { width: 120px; padding: 4px 6px; font-family: var(--vscode-editor-font-family); color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, transparent); }
  input[type=text].invalid { outline: 1px solid var(--vscode-inputValidation-errorBorder); }
  label { display: block; font-size: 0.9em; margin-bottom: 4px; color: var(--vscode-descriptionForeground); }
  .swatches { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; max-width: 360px; }
  .sw { width: 26px; height: 26px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; padding: 0; outline: 1px solid var(--vscode-widget-border, #666); }
  .sw.active { border-color: var(--vscode-focusBorder); }
  .live { display: flex; gap: 6px; align-items: center; margin: 0 0 18px; }
  .live label { margin: 0; color: var(--vscode-foreground); }

  .mock { width: 100%; max-width: 440px; border: 1px solid var(--vscode-widget-border, #666); border-radius: 6px; overflow: hidden; font-size: 11px; margin-bottom: 20px; }
  .mock div { box-sizing: border-box; }
  .tb { padding: 6px 10px; text-align: center; background: var(--vscode-titleBar-activeBackground); color: var(--vscode-titleBar-activeForeground); border-bottom: 1px solid transparent; }
  .mid { display: flex; height: 90px; background: var(--vscode-editor-background); }
  .ab { width: 34px; background: var(--vscode-activityBar-background); border-right: 1px solid transparent; }
  .sb { width: 90px; background: var(--vscode-sideBar-background); color: var(--vscode-sideBar-foreground); padding: 6px; border-right: 1px solid transparent; }
  .ed { flex: 1; }
  .tabs { display: inline-block; padding: 5px 12px; background: var(--vscode-tab-activeBackground); color: var(--vscode-tab-activeForeground); border-top: 2px solid transparent; }
  .st { padding: 4px 10px; background: var(--vscode-statusBar-background); color: var(--vscode-statusBar-foreground); }

  .actions { display: flex; gap: 10px; flex-wrap: wrap; }
  button.btn { padding: 6px 14px; border: none; cursor: pointer; font-family: inherit; color: var(--vscode-button-foreground); background: var(--vscode-button-background); }
  button.btn:hover { background: var(--vscode-button-hoverBackground); }
  button.btn.secondary { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
  button.btn.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
</style>
</head>
<body>
  <h1>Project Color</h1>
  <p class="sub">The color is stored in this workspace's settings (<code>.vscode/settings.json</code>).</p>

  <div class="row">
    <div>
      <label for="picker">Picker</label>
      <input type="color" id="picker" value="#d4af37">
    </div>
    <div>
      <label for="hex">Hex</label>
      <input type="text" id="hex" value="#d4af37" maxlength="7" spellcheck="false">
      <div class="swatches" id="swatches"></div>
    </div>
  </div>

  <div class="mock" aria-label="Preview">
    <div class="tb" data-g="titleBar">project — Visual Studio Code</div>
    <div class="mid">
      <div class="ab" data-g="activityBar"></div>
      <div class="sb" data-g="sideBar">EXPLORER</div>
      <div class="ed"><div class="tabs" data-g="tabs">file.ts</div></div>
    </div>
    <div class="st" data-g="statusBar">⎇ main &nbsp; ⊗ 0 &nbsp; ⚠ 0</div>
  </div>

  <div class="live"><input type="checkbox" id="live"><label for="live">Apply live while choosing</label></div>

  <div class="actions">
    <button class="btn" id="apply">Apply</button>
    <button class="btn secondary" id="reset">Remove color</button>
    <button class="btn secondary" id="settings">Affected elements…</button>
  </div>

<script nonce="${nonce}">
(function () {
  var vscode = acquireVsCodeApi();
  var $ = function (id) { return document.getElementById(id); };
  var cfg = { presets: [], enabledGroups: [], foreground: 'auto' };
  var timer = null;

  function norm(v) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((v || '').trim());
    if (!m) return null;
    var h = m[1].toLowerCase();
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    return '#' + h;
  }
  function lum(h) {
    var r = [1, 3, 5].map(function (i) {
      var s = parseInt(h.substr(i, 2), 16) / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r[0] + 0.7152 * r[1] + 0.0722 * r[2];
  }
  function contrast(a, b) {
    var la = lum(a), lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  function fgFor(bg) {
    if (String(cfg.foreground).toLowerCase() !== 'auto') {
      var f = norm(cfg.foreground);
      if (f) return f;
    }
    return contrast(bg, '#ffffff') >= contrast(bg, '#000000') ? '#ffffff' : '#000000';
  }

  function renderMock(color) {
    var fg = fgFor(color);
    document.querySelectorAll('[data-g]').forEach(function (el) {
      var g = el.getAttribute('data-g');
      var on = cfg.enabledGroups.indexOf(g) !== -1;
      el.style.background = ''; el.style.color = ''; el.style.borderColor = '';
      if (!on) return;
      if (g === 'tabs') { el.style.borderTopColor = color; return; }
      el.style.background = color;
      el.style.color = fg;
      el.style.borderColor = color;
    });
  }

  function renderSwatches(color) {
    var box = $('swatches');
    box.innerHTML = '';
    cfg.presets.forEach(function (p) {
      var b = document.createElement('button');
      b.className = 'sw' + (p === color ? ' active' : '');
      b.style.background = p;
      b.title = p;
      b.addEventListener('click', function () { setColor(p, true); });
      box.appendChild(b);
    });
  }

  function setColor(color, schedule) {
    var c = norm(color);
    if (!c) return;
    $('picker').value = c;
    $('hex').value = c;
    $('hex').classList.remove('invalid');
    renderMock(c);
    renderSwatches(c);
    if (schedule) schedulePreview(c);
  }

  function schedulePreview(c) {
    if (!$('live').checked) return;
    clearTimeout(timer);
    timer = setTimeout(function () { vscode.postMessage({ type: 'preview', color: c }); }, 200);
  }

  $('picker').addEventListener('input', function (e) { setColor(e.target.value, true); });
  $('hex').addEventListener('input', function (e) {
    var c = norm(e.target.value);
    if (!c) { e.target.classList.add('invalid'); return; }
    setColor(c, true);
  });
  $('apply').addEventListener('click', function () {
    clearTimeout(timer);
    vscode.postMessage({ type: 'apply', color: norm($('hex').value) || $('picker').value });
  });
  $('reset').addEventListener('click', function () { clearTimeout(timer); vscode.postMessage({ type: 'reset' }); });
  $('settings').addEventListener('click', function () { vscode.postMessage({ type: 'openSettings' }); });

  window.addEventListener('message', function (ev) {
    var m = ev.data;
    if (m.type !== 'init') return;
    cfg = { presets: m.presets, enabledGroups: m.enabledGroups, foreground: m.foreground };
    $('live').checked = !!m.livePreview;
    setColor(m.color, false);
  });

  vscode.postMessage({ type: 'ready' });
})();
</script>
</body>
</html>`;
  }
}
