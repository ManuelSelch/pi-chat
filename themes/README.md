# Pi Chat Classic

Native Pi themes based on Pi Chat's original Mantine defaults (before commit `97bf5dd`), with its original GitHub-light/GitHub-dark syntax palette.

- [Light](pi-chat-classic-light.json)
- [Dark](pi-chat-classic-dark.json)

Copy both JSON files to `~/.pi/agent/themes/`, then run `/reload` and select a variant in `/settings`.

For automatic terminal appearance selection, set the `theme` field in `~/.pi/agent/settings.json` to `pi-chat-classic-light/pi-chat-classic-dark`. Preserve other settings. You can also try the pair without changing settings:

```sh
pi --use-theme pi-chat-classic-light/pi-chat-classic-dark
```

The primary, text, neutral surfaces, border, link and status colors follow the old application palette. Additional terminal-only roles are mapped to matching colors. Pi does not paint the terminal's whole background: use `#ffffff` for light or `#242424` for dark in your terminal configuration for an exact page-background match.

Pi Chat's existing server chooses the dark member of an automatic pair. Select the light theme explicitly for new light Pi Chat runtimes. Existing runtime themes do not update automatically. The current browser adapter also derives interaction shades, so these themes restore the original palette rather than guarantee a pixel-identical copy of every Mantine state.
