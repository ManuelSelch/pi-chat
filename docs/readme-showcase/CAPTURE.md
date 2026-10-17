# Capture the README showcase

The script builds Pi Chat, runs its real browser UI against isolated real Pi SDK sessions with scripted model responses, and assembles a **Product first** image. It does not use your existing Pi Chat server, personal sessions, extensions, account credentials, or a live model provider.

## Run

```sh
npm ci
npx playwright install chromium
npm run capture:readme
```

Optional arguments:

```sh
# Use an existing production build during capture-script iteration.
npm run capture:readme -- --skip-build

# Write to a different directory (relative paths resolve from the repository root).
npm run capture:readme -- --output /tmp/pi-chat-showcase
```

The build is required because the browser driver serves the production UI from `dist/web`. The script reuses the existing browser driver and test harness, so development dependencies must be installed. It does not require a separately running dev server or image-processing package.

## Outputs

The default output directory is `docs/images/showcase/`:

| File | Contents |
| --- | --- |
| `workspace.png` | Populated dark-mode chat, three named session tabs, a real completed skill-read tool card, highlighted TypeScript, and a Markdown table |
| `projects.png` | Actual Projects drawer with expanded, isolated demo projects and sessions |
| `commands.png` | Complete command menu filtered by `/session`, with its composer query, captured at a narrow viewport |
| `light.png` | The same populated session in the application's light theme |
| `pi-chat-showcase.png` | Assembled Product first layout: bold Workspace heading, large hero, three supporting cards with names only |
| `preview.html` | Self-contained image composition for local inspection; ignored by Git |
| `manifest.json` | Capture settings and output inventory |

The combined image is 2400 pixels wide (1200 CSS pixels at 2× device scale). Individual captures remain available for full-size inspection or linking. Re-running overwrites these named outputs, not the existing legacy screenshots. No README edit is performed automatically.

Suggested integration after reviewing the generated image:

```markdown
![Pi Chat workspace, projects, command panel, and light mode](./docs/images/showcase/pi-chat-showcase.png)
```

## Capture behavior and limits

- The responses and sample skill are fictional demo data; only the model response boundary is scripted. Tool execution, session naming, transport, panels, Markdown, syntax highlighting, theme behavior, and rendering use the real application and Pi runtime.
- A separate agent directory, temporary fixture projects, and an ephemeral loopback HTTP port keep the run isolated. The browser, server, and temporary directories are cleaned up on completion or ordinary errors.
- The script uses accessible UI interactions and waits for meaningful rendered state, not arbitrary sleeps. Page JavaScript errors fail the run.
- Folder paths are hidden through the application's own Settings switch. Capture fixture folders have readable names (`pi-chat-demo` and `retry-review`) without changing production behavior.
- PNG captures are framed/cropped only at assembly time. The script does not alter the real app DOM, CSS, transcript content, or controls to make them resemble the illustrative mockup.
- The real project navigation is a drawer, not the mockup's invented permanent sidebar. The command capture uses `/session` to show a native command and session actions without a partially visible scroll row; assembly fits the entire capture without cropping. The tool card is shown in its native collapsed state so the prompt and answer fit in the hero.
- Browser/font/platform differences can change rasterization; the script guarantees curated reproducible scenarios, not byte-identical PNGs across machines.

## Verification

```sh
npm test
npx tsc --noEmit
npm run capture:readme
```

The full capture is also an integration smoke check: it asserts the completed tool, rich answer, populated Projects drawer, command menu, light theme, and absence of browser JavaScript errors before assembling the image. Unit tests cover the four-image ordering, approved labels, embedded/offline composition, input validation, and cleanup of named fixture folders.
