# Pi Chat README Showcase — Requirements

## Goal
Replace the current five large, repetitive, mostly unframed screenshots with a small, intentional visual story that makes Pi Chat feel polished and quickly communicates why it is useful. Images should show real Pi Chat UI in believable, curated states—not empty screens or invented product features.

## Scope
### In Scope
- Plan and produce a concise set of README showcase images for desktop viewing and GitHub's rendered README.
- Select screenshot moments that communicate distinct strengths, such as the chat experience, tool/Markdown rendering, steering, or project/session navigation.
- Establish a repeatable way to prepare clean, deterministic demo content and capture the real application without exposing personal data or credentials.
- Crop, frame, annotate only where helpful, and optimize assets for visual clarity and reasonable repository size.
- Replace the existing README image block with an ordered, captioned presentation of the selected assets.

### Out of Scope
- Redesigning Pi Chat's production UI solely to improve screenshots.
- Creating product claims, UI elements, or interactions that do not exist in the application.
- Reworking unrelated README documentation or producing a full marketing website/video.

## Requirements
- The showcase must use a small set of distinct images (target: 2–4), each with a clear purpose; avoid multiple near-identical transcript shots.
- At least one image must show the actual chat interface in a rich, readable, non-empty state. Other images should each demonstrate a separate user-visible capability.
- Capture the application itself; any decorative framing or labels must not obscure controls or imply unsupported behavior.
- Demo content must be curated and repeatable, and must not reveal real user prompts, project names, file paths, account details, tokens, or other private information.
- Images must be cropped to remove excessive empty desktop/browser margins, legible at typical README display width, and stored in an appropriate web-friendly format without needless resolution or file size.
- The README image area must have concise captions/alt text and a deliberate visual order, with the lead image establishing the product before supporting images explain features.
- The final set must render acceptably in GitHub's README view and remain understandable without relying on color alone.
- Existing screenshots may be reused only if they meet these criteria; otherwise replace or remove them rather than retaining the full current set by default.

## Assumptions
- Pi Chat's existing UI is the source of truth; the improvement should come primarily from better story selection, capture state, crop, and presentation rather than production UI changes.
- A deterministic local runtime/demo fixture is preferable to capturing a personal live session; existing test infrastructure can be evaluated as a starting point.
- The first delivery is aimed at desktop README readers. A separate mobile-specific asset is not required unless review shows the chosen composition fails at narrow widths.

## Implementation Plan
### 1. Choose the visual story
Description: Review current README images and identify a short sequence of distinct moments that best represents Pi Chat. Set the art direction (for example, clean app-only screenshots or screenshots placed in restrained editorial frames) and choose which features deserve supporting images. Completion is verified by an approved storyboard listing each image's message and target UI state.

### 2. Prepare repeatable demo states
Description: Define safe, realistic sample project/session content and a deterministic capture setup using the real Pi Chat UI. Reuse existing test/runtime seams where practical; do not depend on personal sessions, credentials, or nondeterministic model output. Completion is verified by being able to recreate each selected UI state from a clean local setup.

### 3. Capture and polish the assets
Description: Capture each storyboard state, then apply consistent crop, scale, spacing, and restrained framing/annotations if selected. Export optimized assets to `docs/images/` with descriptive filenames. Completion is verified by checking legibility at README display size, image dimensions/file sizes, and the absence of private data or misleading edits.

### 4. Integrate and review the README showcase
Description: Replace the current five-image block with the chosen ordered set, useful alt text, and short captions; check layout and links in a rendered GitHub-style README view, including a narrow viewport. Completion is verified by confirming all assets load, the sequence reads clearly, and no redundant legacy screenshots remain referenced.

## Open Questions
1. Should the visual direction be clean, tightly cropped product screenshots, or a more designed editorial composition with subtle backgrounds, device/browser framing, and brief callouts?
2. Which 2–4 capabilities should the showcase prioritize: rich chat/tool output, native steering, project/session navigation, command discovery/completion, or light/dark appearance?
3. Should the set be dark-mode only for consistency, or include one light-mode image to demonstrate theme support?
