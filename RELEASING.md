# Releasing

Pushing to GitHub does **not** publish the extension. There is no CI; every release is published by hand to the [VS Code Marketplace](https://marketplace.visualstudio.com/manage/publishers/pookdeveloper) under the `pookdeveloper` publisher.

## 1. Prepare the version (both methods)

1. Add a section for the new version at the top of `CHANGELOG.md`.
2. Bump the version (the Marketplace rejects a version that already exists):

   ```bash
   npm version minor --no-git-tag-version   # or patch / major
   ```

3. Check that everything passes:

   ```bash
   npm test
   ```

4. Commit, tag and push:

   ```bash
   git add CHANGELOG.md package.json package-lock.json
   git commit -m "chore: release X.Y.Z"
   git tag vX.Y.Z
   git push origin main vX.Y.Z
   ```

## 2a. Manual: upload the .vsix

1. Build the package (compiles first through `vscode:prepublish`):

   ```bash
   npm run package
   ```

   This creates `project-color-picker-X.Y.Z.vsix` in the repo root.

2. Check what it contains. It must only hold `out/`, `images/icon.png`, the README, CHANGELOG, LICENSE and `package.json`:

   ```bash
   npx vsce ls
   ```

   If anything else shows up (local tooling, caches, `.claude/`...), add it to `.vscodeignore` and rebuild.

3. Open <https://marketplace.visualstudio.com/manage>, find **Project Color Picker**, open the **⋯** menu → **Update**, and drop the `.vsix`.

4. Optional: test the package locally before uploading:

   ```bash
   code --install-extension project-color-picker-X.Y.Z.vsix
   ```

## 2b. Command line: `vsce publish`

Needs a Personal Access Token (PAT) from Azure DevOps.

1. One-time setup:
   1. In <https://dev.azure.com>, go to **User settings → Personal access tokens → New token**.
   2. Set **Organization** to *All accessible organizations* and **Scopes** to *Custom defined → Marketplace → Manage*.
   3. Log in with it (stored in your OS keychain):

      ```bash
      npx vsce login pookdeveloper
      ```

2. Each release, after step 1 above:

   ```bash
   npx vsce ls        # check the package contents (see 2a, step 2)
   npx vsce publish
   ```

   `vsce publish` builds and uploads the version in `package.json`. Alternatively `npx vsce publish minor` bumps, commits and tags for you, but then skip the bump in step 1.

The token expires; when `vsce publish` fails with an authentication error, create a new one and run `npx vsce login pookdeveloper` again. Never commit the token.

## Icon requirements

`images/icon.png` must be a PNG between 128×128 and 1024×1024 pixels (SVG is not allowed). The Marketplace rejects larger icons. To shrink one on macOS:

```bash
sips -Z 256 images/icon.png
```
