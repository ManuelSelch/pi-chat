# Settings grouping mockup

- Revision: 6; review status: approved. User explicitly approved with “approved” after reviewing revision 6, including the top-right connection badge.
- Scope: Settings drawer ordered Session first, Feature Toggles second, then Backend server at the end. Preserve the existing drawer width and stacked panel language.
- Backend server: endpoint/status/edit/save/reset and Restart server in one panel. Remove the two routine helper descriptions; retain error and validation feedback. Populate the editable WebSocket field with the current endpoint instead of a separate Current endpoint label/value. Unsaved edits remain drafts; Save applies them. Reset restores the default endpoint in the field. Place the connection-status badge at the top right on the same row as the Backend server heading, without a separate status row. Save and reload / Reset to default share one full-width row with equal widths and a small gap. Restart is a separate action within the same panel.
- Feature Toggles: existing four switches plus Compact transcript. Transcript density has no separate panel. Remove the archived-session helper description.
- Session: Thinking level, Model, and Compact session share one panel. Compact session is distinct from Compact transcript. Omit the compaction helper description.
- States: default session, ?state=home omits session controls, ?state=running disables session controls, ?state=disconnected shows recovery feedback. Drawer scrolls on narrow/short viewports.
- All data and actions are simulated. No browser persistence, backend calls, actual reload/restart, extension controls, or confirmation dialogs. Existing production confirmations, feature availability, warnings, disabled states and callbacks must remain intact; omissions do not approve their removal.
- Review the grouping and backend density. React Grab is enabled for selection feedback.
