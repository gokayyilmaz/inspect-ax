# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-02-11

### Added

- Right-click context menu command: `Inspect AX`.
- In-page popup near pointer showing `Role` and `Name`.
- Copy support for Role/Name via click and text selection.
- Auto-dismiss behavior (outside click + `Escape`).
- Light/dark theme support for popup UI.
- Improved icon pipeline with dedicated extension icon sizes.

### Changed

- Extension name, menu naming, and UI labels standardized as `Inspect AX`.
- Popup workflow replaced separate tab flow for faster inspection.

### Security

- Added payload sanitization for captured target descriptors.
- Added short TTL for captured targets to reduce stale inspection risk.
- Added post-inspection cleanup of stored target data.

### Notes

- Role/Name may be inferred from semantic/ARIA signals when computed accessibility APIs are unavailable.
- Some iframe-heavy pages may still have element resolution limitations.
