# Pi Chat Classic Theme — Design

## Overview
Create a native Pi theme pair reproducing Pi Chat's original Mantine light and dark palettes, before runtime theme integration (`97bf5dd`). This is theme configuration only; application code, dependencies and current settings remain unchanged.

## Components
| Package/module | Component | Change | Responsibility |
|---|---|---|---|
| Pi user configuration | Proposed `~/.pi/agent/themes/pi-chat-classic-light.json` and `pi-chat-classic-dark.json` | New | Own the reusable palette and all Pi color roles |
| Pi | Existing theme loader/settings selector | Reused | Validate, discover and activate the theme |
| Pi Chat | Existing runtime palette integration | Reused | Consume the selected theme on runtime creation |

## Runtime flow
1. Pi discovers both installed user themes.
2. The user selects either variant, or configures the native automatic pair `pi-chat-classic-light/pi-chat-classic-dark`.
3. Pi resolves the named hex variables into terminal color roles and chooses the automatic variant from terminal appearance. Existing Pi Chat server behavior chooses the dark member of an automatic pair; this configuration-only task does not change that behavior.

## Contracts & API changes
None. Use Pi's existing JSON theme schema, including explicit light/dark appearance and matching export surfaces in each file. Pi's native automatic-pair setting joins two theme names; a single theme JSON does not contain both palettes. Do not change saved theme selection automatically.

## Decisions & Trade-offs
- Match the old dark palette: page `#242424`, panel `#2e2e2e`, hover/message `#3b3b3b`, border `#424242`, text `#c9c9c9`, muted `#828282`, primary `#228be6`, link `#4dabf7`.
- Match the old light palette: page `#ffffff`, panel `#ffffff`, hover/message `#f8f9fa`, border `#ced4da`, text `#000000`, muted `#868e96`, primary/link `#228be6`.
- Reuse original green/yellow/red status colors and the corresponding GitHub-light/GitHub-dark syntax colors from the stylesheet.
- Map additional terminal-only roles to this palette; these have no exact browser counterpart.
- Pi does not paint the terminal's entire background. Export backgrounds can match exactly; terminal users must set their terminal background separately for an exact page match.
- Install globally without changing application layout; no new UI mockup or dependency is needed.

## Verification
Validate both JSON files with Pi's installed validator and load each with Pi's truecolor loader. Check native automatic-pair resolution for light and dark terminal appearances. Resolve every foreground/background role to catch missing variables. Confirm existing settings and unrelated files remain untouched. These checks are planned, not yet run.

## Open Questions
None. Both original appearances are required.
