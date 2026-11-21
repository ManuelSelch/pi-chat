# /model popup enhancement

- Revision: 3; approved for implementation. User explicitly approved direct implementation with Tab toggling scope; no mockup shortcut implementation requested.
- Scope: improve the existing /model select-prompt popup, not Settings and not a new picker.
- Explicit user correction: remove the footer model selector from the prototype. No footer selector was added to production.
- Preserve existing prompt modal styling, simple option rows, active-row highlight, keyboard navigation, Cancel/OK and Escape dismissal.
- Add an always-visible search field matching other select prompts and a Scoped / All models switch within the popup.
- Omit keyboard helper text; retain keyboard behavior and right-align Cancel/OK.
- Search filters model ids; changing scope retains the query. Empty results show the existing-style message.
- Tab toggles Scoped / All models while keeping search focus; Shift+Tab retains normal focus navigation.
- Fake models and local state only; runtime scope loading and selection effects are not implemented.
- Search and arrow/Enter navigation are interactive. Opens directly in the popup; Open /model reopens after dismissal.
- Production implementation must inspect and reuse the actual /model command path and Pi's scoped/available model semantics rather than infer scope from display labels.
