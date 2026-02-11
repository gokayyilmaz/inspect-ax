# Inspect AX Release Checklist

## 1. Pre-release QA

- [ ] Verify context menu item is `Inspect AX` on multiple sites.
- [ ] Verify popup appears near pointer on left-to-right and right-to-left pages.
- [ ] Verify `Role` and `Name` copy behavior (click + text selection).
- [ ] Verify popup close behavior (outside click + `Escape`).
- [ ] Verify light/dark theme contrast.
- [ ] Verify icon appears correctly in:
  - [ ] Chrome extensions page
  - [ ] Context menu row
  - [ ] Extension toolbar menu
- [ ] Verify iframe fallback behavior (known limitations still acceptable).
- [ ] Verify no console errors in service worker/content script during normal flow.

## 2. Repo readiness

- [ ] `README.md` is accurate and up to date.
- [ ] Add `LICENSE` (recommended: MIT).
- [ ] Add `CHANGELOG.md` with release notes.
- [ ] Add `CONTRIBUTING.md` (optional but recommended).
- [ ] Add issue templates (bug report / feature request) (optional).
- [ ] Tag release version in `manifest.json` (e.g. `1.0.0`).

## 3. Versioning

- [ ] Bump `manifest.json` version.
- [ ] Ensure release tag matches manifest (e.g. `v1.0.0`).
- [ ] Keep a short release note:
  - What changed
  - Known limitations
  - Migration notes (if any)

## 4. Build/package

- [ ] Create a clean zip package from project root contents (exclude hidden/system files).
- [ ] Confirm zip includes required files:
  - `manifest.json`
  - `service-worker.js`
  - `content-script.js`
  - `icons/*`
- [ ] Confirm zip does not include local junk:
  - `.DS_Store`
  - editor temp files
  - test artifacts

## 5. Post-release monitoring

- [ ] Watch Chrome Web Store crash/error reports.
- [ ] Watch user reviews for false positives in `Role/Name` output.
- [ ] Track top requested improvements for next minor version.

## Suggested release cadence

- `patch` (`x.y.Z`): icon fixes, copy behavior, minor bug fixes
- `minor` (`x.Y.z`): UX improvements, better element resolution
- `major` (`X.y.z`): behavior changes that can surprise existing users
