# Changelog

## 0.3.0

- New `projectColor.branchColors` setting: a color per Git branch (e.g. red on `main`) that overrides the project color while that branch is checked out.
- New `projectColor.remoteColor` setting: a color for remote windows (SSH, containers, WSL) that overrides the project color.
- The title bar of an inactive window is now dimmed, so the focused window stands out. Groups get a new `mutedBackground` role.

## 0.2.0

- New `projectColor.autoAssign` setting (user-level, off by default): projects opened with no color get a preset derived from the project name, always the same one for that name. A notification offers **Change** and **Remove**.
- Removing a project's color now opts that project out of auto-assign.
- Configure affected elements with checkboxes instead of typing a list.
- Removed the standalone "Choose a color from palette" command (presets remain in the picker panel).
- Added the extension icon.

## 0.1.0

- Initial release: color picker panel, presets, live preview, configurable element groups, extra settings.
