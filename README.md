# Project Color Picker

Change the look of the **current project** (status bar, title bar, etc.) with a color picker. Everything is written to the *workspace* settings (`.vscode/settings.json`), so each project gets its own color and it can be shared through git.

## Usage

- Click the paint-palette button in the status bar, or press `Ctrl/Cmd+Shift+P` → **Project Color: Pick project color (color picker)**.
- Other commands: *Set project color (hex)*, *Remove project color*, *Configure affected elements*.

The panel includes a color picker, a hex field, quick presets and a preview. With `projectColor.livePreview` enabled, the color is applied while you choose it; if you close the panel without pressing **Apply**, the previous color is restored.

## Settings

| Setting | Default | Description |
|---|---|---|
| `projectColor.color` | `""` | Current color (managed by the extension; you can also edit it by hand). |
| `projectColor.enabledGroups` | `["statusBar","titleBar"]` | Groups that receive the color: `statusBar`, `titleBar`, `activityBar`, `tabs`, `sideBar`, or your own. |
| `projectColor.groups` | see `package.json` | Which `workbench.colorCustomizations` keys make up each group and their role: `background`, `mutedBackground` (color at 60% opacity, used for the inactive title bar), `foreground`, `mutedForeground` (text at 60% opacity), `border`. |
| `projectColor.foreground` | `"auto"` | `auto` = white/black by WCAG contrast; or a fixed hex (`#000000`). |
| `projectColor.extraSettings` | `{}` | Extra workspace settings written when a color is applied and removed when it is cleared. |
| `projectColor.presets` | 9 colors | Quick palette. |
| `projectColor.livePreview` | `true` | Apply live from the picker. |
| `projectColor.showStatusBarItem` | `true` | Status bar button. |
| `projectColor.autoAssign` | `false` | User-level. Opening a project with no color assigns a preset derived from the project name (always the same one for that name). Removing the color opts that project out. Writes `.vscode/settings.json` in every project you open. |
| `projectColor.branchColors` | `{}` | Color per Git branch, overriding the project color while that branch is checked out, e.g. `{ "main": "#e53935" }`. Uses the repository of the first folder. |
| `projectColor.remoteColor` | `""` | Color used when the project is opened remotely (SSH, container, WSL...), overriding the project color. |

### Which color is painted

A matching `branchColors` rule wins, then `remoteColor` (only in remote windows), then the project color. When the window loses focus, the title bar is dimmed so the active window stands out.

### Example: status bar + title bar with a fixed text color

```jsonc
// settings.json (user or workspace)
{
  "projectColor.enabledGroups": ["statusBar", "titleBar"],
  "projectColor.foreground": "#000000",
  "projectColor.extraSettings": { "workbench.statusBar.visible": true }
}
```

With the color `#d4af37` this generates:

```jsonc
{
  "workbench.statusBar.visible": true,
  "workbench.colorCustomizations": {
    "statusBar.background": "#d4af37",
    "statusBar.foreground": "#000000",
    "statusBar.noFolderBackground": "#d4af37",
    "statusBar.noFolderForeground": "#000000",
    "statusBar.debuggingBackground": "#d4af37",
    "statusBar.debuggingForeground": "#000000",
    "titleBar.activeBackground": "#d4af37",
    "titleBar.activeForeground": "#000000",
    "titleBar.inactiveBackground": "#d4af37",
    "titleBar.inactiveForeground": "#000000",
    "titleBar.border": "#d4af37"
  }
}
```

### Add your own group

```jsonc
{
  "projectColor.groups": {
    "panel": {
      "background": ["panel.background"],
      "foreground": ["panelTitle.activeForeground"],
      "border": ["panel.border", "panelTitle.activeBorder"]
    }
  },
  "projectColor.enabledGroups": ["statusBar", "titleBar", "panel"]
}
```

Groups are merged by name with the built-in ones.

## Notes and limitations

- Only the keys defined in `projectColor.groups` are touched; the rest of `workbench.colorCustomizations` is preserved.
- If the workspace has per-theme blocks (`"[Theme name]": { ... }`) that redefine the same keys, those blocks take precedence and the extension does not modify them.
- A folder or workspace must be open (otherwise there is nowhere to store the settings).
- If you remove a group from `enabledGroups`, its keys are removed from the workspace the next time the color is re-applied.

## Development

```bash
npm install
npm test            # compiles and runs the color-logic tests
npm run package     # builds the .vsix
code --install-extension project-color-picker-X.Y.Z.vsix
```

To debug, open the folder in VS Code and press **F5** (Extension Development Host).

To publish a new version, see [RELEASING.md](RELEASING.md).

## License

[MIT](LICENSE)
