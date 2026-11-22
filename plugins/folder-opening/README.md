# Folder opening plugin

- [Architecture](docs/architecture.md): UI composition, dependency injection and the RPC browsing flow.
- Independent npm workspace: `@manuelselch/pi-plugin-folder-opening`.
- Root export owns the read-only `folder-opening` contract and inferred types; reuses SDK directory schemas.
- `/host` owns the provider, path validation, canonicalization, hidden-folder filtering, pagination and safe errors. No Chat, Server or React imports.
- `/web` exports `folderOpeningWebPlugin`, which contributes its Open folder command and picker overlay. Plugin-local React state owns whether the picker is open; its container/hook owns browsing, cancellation and session-start coordination.
- The embedding app supplies generic host capabilities: current-client requests, connection/project context, session creation/navigation and shared modal focus handling. It renders commands and the generic overlay outlet, not the picker directly.
- Chat registers the host factory and explicitly allowlists the contract. Server also reuses the exported `DirectoryBrowserService` and `DirectoryOperationError` for its existing directory protocol and session-path validation; this does not activate the plugin.
- Browser peers are optional for host-only installations. Browser consumers supply React, Mantine and Tabler icons.
- Tests are colocated in small `__tests__` folders beside the contract, host and picker. Run `npm test -w @manuelselch/pi-plugin-folder-opening`.
- Root build/dev, lint, package typechecks/tests/coverage and artifact verification include this workspace. See [plugin composition](../../docs/plugins.md).
- No dynamic web loader, automatic installation or fallback to `directory.browse` is added.
