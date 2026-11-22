# Folder opening plugin

- [Architecture diagrams](docs/architecture.md): UI composition, dependency injection and the RPC browsing flow.
- Independent npm workspace: `@manuelselch/pi-plugin-folder-opening`.
- Root export owns the read-only `folder-opening` contract and inferred types; reuses SDK directory schemas.
- `/host` owns the provider, path validation, canonicalization, hidden-folder filtering, pagination and safe errors. No Chat, Server or React imports.
- `/web` exports `createFolderOpeningPlugin(request)` and `FolderPicker`. The container/hook owns browsing, cancellation and session-start coordination; the view receives values/callbacks.
- The embedding app supplies the generic SDK request boundary, overlay state, connection state, session-start callback and optional modal focus-return props.
- Chat registers the host factory and explicitly allowlists the contract. Server also reuses the exported `DirectoryBrowserService` and `DirectoryOperationError` for its existing directory protocol and session-path validation; this does not activate the plugin.
- Browser peers are optional for host-only installations. Browser consumers supply React, Mantine and Tabler icons.
- Tests are colocated in small `__tests__` folders beside the contract, host and picker. Run `npm test -w @manuelselch/pi-plugin-folder-opening`.
- Root build/dev, lint, package typechecks/tests/coverage and artifact verification include this workspace. See [plugin composition](../../docs/plugins.md).
- No dynamic web loader, automatic installation or fallback to `directory.browse` is added.
