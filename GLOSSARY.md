# Project Color Picker

A VS Code extension that gives each project a distinguishing color on its window chrome (status bar, title bar, etc.).

## Language

**Project**:
The folder or multi-root workspace currently open in a VS Code window.
_Avoid_: Repo, workspace (when meaning the opened unit)

**Project color**:
The single hex color chosen for a project and painted onto its affected elements.
_Avoid_: Theme, accent

**Preset**:
One of the user's palette colors offered for quick selection.
_Avoid_: Swatch, favorite

**Auto-assign**:
A user-level mode that gives an uncolored project a project color derived from its identity, without asking.
_Avoid_: Auto-color, random color

**Opted-out project**:
A project whose color the user removed, which auto-assign must leave uncolored.
_Avoid_: Ignored project, blacklisted project
