# Package and Release Guide

## 1. Required files in release package

- `manifest.json`
- `service-worker.js`
- `content-script.js`
- `icons/accessibility_new_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.png`
- `icons/accessibility_new_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg`
- `icons/inspect-ax-16.png`
- `icons/inspect-ax-32.png`
- `icons/inspect-ax-48.png`
- `icons/inspect-ax-128.png`

## 2. Files to exclude from release package

- `.DS_Store`
- temp/cache files
- editor metadata directories
- docs not required by runtime (`docs/*`)

## 3. Create package zip

Run from project root (`/Users/gokay/Documents/inspect-ax`):

```bash
cd /Users/gokay/Documents/inspect-ax
zip -r inspect-ax-v1.0.0.zip \
  manifest.json \
  service-worker.js \
  content-script.js \
  icons/ \
  -x "*.DS_Store" "*/.DS_Store"
```

## 4. Verify zip content

```bash
unzip -l inspect-ax-v1.0.0.zip
```

Expected top-level entries:

- `manifest.json`
- `service-worker.js`
- `content-script.js`
- `icons/...`

## 5. GitHub release steps

1. Commit release files (`LICENSE`, `CHANGELOG.md`, docs updates).
2. Tag release:

```bash
git tag -a v1.0.0 -m "Inspect AX v1.0.0"
git push origin main --tags
```

3. Create a GitHub release for tag `v1.0.0`.
4. Attach `inspect-ax-v1.0.0.zip` to release assets.

## 6. Chrome Web Store upload

1. Upload `inspect-ax-v1.0.0.zip` in Developer Dashboard.
2. Paste listing copy from `docs/STORE_LISTING.md`.
3. Upload screenshots.
4. Publish first as `Unlisted` for soft launch.
