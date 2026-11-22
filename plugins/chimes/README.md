# Chimes plugin

- Browser-only workspace `@manuelselch/pi-plugin-chimes`; root and `/web` export `chimesPlugin` and `chimesUI`. No host entry, RPC or Chat/Server imports.
- Explicit browser registration mounts `ChimesProvider` for the app lifetime. It observes read-only `{ sessionId, status }` summaries, including background sessions; no tab/navigation or transcript state is exposed.
- Declares `chimes.enabled` at `settings.feature-toggles`. Chat owns the section, order and spacing; the plugin owns the label, disabled state and switch behavior. No dummy commands or overlays are needed.
- Preferences remain browser-local under `pi-chat:chimes`, default off. Settings visibility does not own playback; reopening the panel preserves the value and does not replay sounds.
- Initial/new session snapshots and unchanged status lists stay silent. Known sessions becoming idle play finished tones; becoming blocked plays waiting tones. Enabling previews finished tones; disabling stays silent.
- Web Audio remains best-effort: gesture/visibility listeners unlock it, unavailable browsers disable the switch, and provider teardown removes listeners and closes audio. No OS notification or server audio is added.
- [Colocated tests](src/web/) preserve transition/audio/preferences coverage. [Chat scenarios](../../packages/pi-chat/src/web/app/plugins/__test__/chimes-plugin.dom.test.tsx) exercise actual registration, settings placement, background playback and teardown with simulated audio and server transport.
- Uses [shared tooling](../../docs/plugin-development.md); root package verification discovers it automatically. See [UI contribution contracts](../../docs/plugins.md#settings-contributions).
