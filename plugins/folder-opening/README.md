# Folder opening plugin

- [Architecture](docs/architecture.md): UI composition, dependency injection and the RPC browsing flow.
- Independent npm workspace: `@manuelselch/pi-plugin-folder-opening`.
- Root exports the canonical `folderOpeningPlugin`, the read-only browsing contract and inferred types; reuses SDK directory schemas. Host and UI implementations load independently.
- `/host` owns the provider, path validation, canonicalization, hidden-folder filtering, pagination and safe errors. No Chat, Server or React imports.
- `/web` exports `folderOpeningUI` (an ID-free `PluginUI`), which contributes its Open folder command and picker overlay. Its React provider owns open state shared by the command and overlay; its container/hook owns browsing, cancellation and session-start coordination.
- The embedding app supplies generic host capabilities: current-client requests, connection/project context, session creation/navigation and shared modal focus handling. It renders commands and the generic overlay outlet, not the picker directly.
- Chat registers the same declaration in its host and browser and explicitly allowlists the contract. Server also reuses the exported `DirectoryBrowserService` and `DirectoryOperationError` for its existing directory protocol and session-path validation; this does not activate the plugin.
- Browser peers are optional for host-only installations. Browser consumers supply React, Mantine and Tabler icons.
- Tests are colocated in small `__tests__` folders beside the contract, host and picker. Run `npm test -w @manuelselch/pi-plugin-folder-opening`.
- Root build/dev, lint, package typechecks/tests/coverage and artifact verification include this workspace. See [plugin composition](../../docs/plugins.md).
- Web entries load from the explicit list before rendering; no automatic installation or fallback to `directory.browse` is added.
