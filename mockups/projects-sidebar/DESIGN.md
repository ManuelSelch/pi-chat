# Projects sidebar mockup

- Revision: 1.
- Status: in review; not approved for production implementation.
- Goal: explore keeping project navigation open while the session stays usable, preserving Pi Chat's plain light styling and single-column project list.
- User decision: selecting or creating a session must keep Projects open (Q2 resolved).
- Wide (1680 px demo): place Projects in spare left margin; opening/closing does not move the centered 800 px chat. The panel can grow up to 340 px in the available gutter.
- Compact (1024 px demo): reserve 288 px for Projects and fit the transcript/composer into the remaining width. No backdrop or click-outside dismissal.
- Phone (390 px demo), option A: 216 px projects pane above the remaining chat; independently scrolling list; transcript and composer remain usable. Trades transcript height for simultaneous access.
- Phone option B: comparison with modal drawer/backdrop; must close explicitly to resume chat. Session selection itself still leaves Projects open.
- Breakpoints (exploratory): wide >=1400 px; compact 640–1399 px; phone below 640 px.
- Interactions: toggle/close Projects, expand groups, switch sessions, create sessions, preserve drafts by session, local message submission, and a real settings modal.
- The review shell offers sized live iframe previews. Actual-size link follows the browser viewport. Query parameters: size=wide|compact|phone on the review page; canvas=1 for the actual workspace; mobile=stacked|drawer for the narrow-screen variant.
- Fake/omitted: no backend, persistence, real folder picking, archive/pin mutations, full tab management, widget dock, or live agent execution. Mobile software-keyboard behavior and production focus/shortcut integration need later design/testing.
- Motion: none.
- Open questions: approve wide gutter / compact reserved-space behavior? Prefer stacked or modal phone treatment, or another direction?
- Approval evidence: none. This prototype is not authorization to modify production code.
