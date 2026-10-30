# README showcase assets

[Capture script](../../scripts/capture-readme.ts) builds Pi Chat, serves the real
frontend through an isolated browser driver with scripted Pi model responses,
and assembles the Product first image. The script does not use the user's live
Chat server, personal sessions, provider credentials or live model responses.
Existing committed PNGs are presentation assets, not proof of current UI state.

## Current limitation

Source inspection shows stale UI assumptions: the script expects Projects as a
`dialog` at its desktop viewport and does not explicitly select tabs mode, while
current desktop navigation is a sidebar and Inbox defaults on. Its light capture
also assumes a browser color-scheme change controls appearance, which is not a
runtime-theme guarantee. The complete capture has **not** been revalidated for
this UI. Do not treat the command or retained screenshots as a current successful
visual acceptance run. Correcting the capture workflow is a separately reviewed
behavioral change, not part of documentation maintenance.

## Invocation and isolation

First follow [development setup](../development.md#local-workflow), including
explicit compilation of the source-only harness. Chromium is required:

```sh
npx playwright install chromium
npm run capture:readme
# Reuse an already-built frontend:
npm run capture:readme -- --skip-build
# Write to a separate directory:
npm run capture:readme -- --output /tmp/pi-chat-showcase
```

These are the script's supported arguments, not a claim that its stale selectors
currently succeed. The script builds unless `--skip-build` is supplied; the
driver serves `dist/web`. Run it serially with other workflows that rebuild the
same output. Capture starts a headless browser and creates screenshots; obtain
permission before agent-owned visual-review automation.

The script creates a private agent directory before SDK/driver imports, fixture
projects and an ephemeral loopback backend. Cleanup attempts driver, browser and
agent-directory disposal even after failure. Only model replies/sample skill are
fictional; tool execution, transport and rendering use real application code.
Folder paths are hidden using the application's preference rather than editing
image pixels or production styles.

## Outputs

The default output directory is `docs/images/showcase/`:

| File | Intended content |
|---|---|
| `workspace.png` | Populated chat, completed skill-read card, code and a Markdown table |
| `projects.png` | Project navigation with isolated demo projects and sessions |
| `quick-switcher.png` | Session-scope results with keyboard controls |
| `light.png` | Light appearance of the populated workspace |
| `pi-chat-showcase.png` | Combined Product first composition |
| `manifest.json` | Capture settings and output inventory |
| `preview.html` | Self-contained composition for local inspection; ignored by Git |

The combined image is 2400 pixels wide (1200 CSS pixels at 2× scale). The root
README uses the [combined asset](../images/showcase/pi-chat-showcase.png).
Re-running overwrites the named outputs, not legacy standalone PNGs, and does not
automatically edit README. Browser/font/platform differences can change pixels;
there is no byte-identical cross-platform image guarantee.

## Checks and boundaries

The script asserts intended tool/content/navigation states, absence of page
JavaScript errors and non-clipped results before composing images. Those checks
must actually complete before a capture can be called verified.
[Composition tests](../../test/infra-tests/readme-showcase.test.ts) cover image
ordering, labels, offline assembly and input validation;
[fixture tests](../../test/infra-tests/showcase-fixtures.test.ts) cover cleanup.
Neither substitutes for a successful current browser capture or user visual
acceptance.
