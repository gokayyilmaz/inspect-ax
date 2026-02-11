# Chrome Web Store Submission Checklist

## 1. Developer setup

- [ ] Chrome Web Store Developer account is active.
- [ ] One-time registration fee is paid.
- [ ] Publisher profile (name, website, support email) is configured.

## 2. Compliance and policy

- [ ] Extension only requests minimal permissions.
- [ ] Permission rationale is clearly explained in listing.
- [ ] Privacy policy URL is prepared (recommended even if no personal data is collected).
- [ ] No misleading claims (e.g. "opens native DevTools AX panel") in listing.
- [ ] Description includes known limitations.

## 3. Package upload

- [ ] Upload `.zip` package.
- [ ] Verify parsed metadata in CWS matches:
  - Name: `Inspect AX`
  - Version: current manifest version
  - Icons/screenshots render correctly

## 4. Store listing assets

- [ ] Short description (clear one-line value proposition)
- [ ] Full description (how it works + limitations)
- [ ] At least 1 screenshot (recommended 3-5)
- [ ] Optional small promo tile / marquee promo tile
- [ ] Category selected (Developer Tools)
- [ ] Language selection reviewed

## 5. Publishing strategy

- [ ] Start as `Unlisted` for soft launch (recommended)
- [ ] Share with initial users and gather feedback
- [ ] Switch to `Public` when stable

## 6. After publish

- [ ] Verify install from store on a clean Chrome profile
- [ ] Verify updates work by bumping version once
- [ ] Monitor reviews + support inbox in first 72 hours
