# Pending prompt readability mockup

## Scope
Revision 4; review status: approved. User approval: “okay the mockup looks good. Next create the design doc which explains how to implement this, and how pi-chat and the pi-sdk protocol api has to change”. Approval applies to the visual mockup, not to the technical design or production implementation.
Isolated Pi Chat mockup for existing select/editor prompts: minimize and reopen without cancellation, plus Markdown question content. No production modifications or backend integration.

## Layout and interaction
- Preserve compact dark Pi Chat header, tabs, transcript, and composer.
- Modal has a short heading without a stage badge, formatted question body, code block, list and display math; choices remain plain text.
- Minimize action in header and footer releases the modal, reveals an above-composer pending control, and permits reading/scrolling the transcript.
- Reopen restores selection or reasoning draft without a draft-saved label in the pending bar. Choice and reasoning are separate stages. Continue commits the selection to the mock reasoning stage; Submit completes the local fake question.
- Escape/Cancel cancels; minimize does not. No explanatory minimize/cancel sentence below the footer controls. No automatic grading, correctness colors or progress-as-mastery.
- Narrow screens use a fluid modal and compact pending bar. Mantine supplies focus trapping and keyboard-accessible controls; no custom animations.

## Review states
- /quiz-prompts/?state=select : question with actual Markdown/code/math rendering.
- /quiz-prompts/?state=editor : reasoning draft ready to minimize/reopen.
- /quiz-prompts/?state=minimized : full feedback visible and pending-question bar.
- Toolbar switches/reset states. Final submit/cancel status is simulated.

## Limitations and design decisions
Fake state only, reset on page reload; no API, actual request lifetimes, snapshot semantics, reconnect or timeouts. Chat composer disabled while pending in this mockup; steering behavior is not decided here. Formatted body is explicitly assumed available; real select/editor API transport and metadata must be settled in technical design. Plain-text extension menus must remain supported. Minimize/reopen is generic prompt UI, not a special browser quiz component. Code blocks use Markdown monospace styling without syntax highlighting in this preview. Uses existing Markdown packages locally; React Grab is development-only. No browser automation performed.
