# Compact session panel

- Revision 2 — visually approved by user: “approved”.
- Scope: remove session search; omit Needs you, Ready, Working and Later sections entirely when their count is zero. No placeholder or reserved section spacing.
- Preserve populated section order, Working collapse, session actions, populated Later collapse/resume, Settings and responsive layout.
- Reuses the existing Inbox prototype with fake data; unrelated prototype lifecycle behavior is not a proposed production change.
- Review states: default (all statuses), `?state=ready-only`, `?state=empty`, `?state=no-later` (Later hidden).
- Visual approval recorded; production implementation awaits scenario/design approval.
