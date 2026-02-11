# Inspect AX (Chrome Extension)

Adds `Inspect AX` to the Chrome context menu.
When you right-click an element, it shows a compact in-page popup near the pointer with only the key accessibility fields:

- `Role`
- `Name`

The popup is optimized for quick checks:

- Small layout, readable text, and wrapped content.
- Click `Role` or `Name` to copy the value.
- Select part of `Role` or `Name` and it is copied automatically.
- Shows a short `Copied` feedback message.
- Closes automatically when you left/right click anywhere outside it.
- Closes with `Escape`.
- Adapts to light/dark theme (`prefers-color-scheme`).
- Uses your Google Material Symbols `accessibility_new` icon files from `icons/`.

## Install (Load unpacked)

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this folder: `/Users/gokay/Documents/inspect-ax`.

## Usage

1. Right-click any element on a page.
2. Click `Inspect AX`.
3. Read `Role` and `Name` from the popup near your cursor.
4. Click or select `Role`/`Name` text to copy it.

## Security / technical notes

- Captured right-click targets expire quickly (15 seconds) to avoid stale/incorrect element inspection.
- Target payload is sanitized in the background service worker before use.
- If `getComputedAccessibleNode` is not available on the page, role/name are inferred from ARIA attributes and semantic HTML.
- If the right-click target is inside an iframe, selector resolution can fail in some cases.

## Release docs

- GitHub release checklist: `docs/RELEASE_CHECKLIST.md`
- Chrome Web Store checklist: `docs/CHROME_WEB_STORE_CHECKLIST.md`
- Store listing draft: `docs/STORE_LISTING.md`
- Package + release guide: `docs/PACKAGE_AND_RELEASE.md`

