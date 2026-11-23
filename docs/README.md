# Current system documentation

These guides describe the implemented system, not feature proposals or historical
verification runs. Executable scenarios remain the behavioral contract; links
below do not imply that tests or visual acceptance have just run.

- [Architecture map](architecture.md): state owners and code-reading paths for startup, sending and reopening history.
- [Core scope](core.md): essential/optional capabilities and evidence-based removal candidates; proposals, not removal approval.
- [Architecture details](architecture-details.md): retained browser behavior, state lifetimes and failure handling.
- [Usage](../packages/pi-chat/docs/usage.md): navigation, commands, prompts, widgets and file interactions.
- [Configuration](../packages/pi-chat/docs/configuration.md): server lifecycle, endpoint/security settings,
  themes and diagnostics.
- [Protocol integration](protocol.md): installed SDK authority, identities,
  response meaning, recovery and cancellation.
- [Extension API](../packages/pi-chat/docs/extension-api.md): native Pi prompts, widgets and footer status.
- [Plugin primitives](plugins.md) and [host runtime/RPC](plugin-runtime.md): declarations,
  activation/cleanup, typed WebSocket calls and the file-opening plugin.
- [Development](development.md): setup, build/test/CI, source organization and
  documentation/scenario workflow.
- [Application drivers](../packages/pi-chat/docs/integration-tests/DRIVERS.md) and
  [test guide](../packages/pi-chat/testing/README.md): faithful test boundaries and permanent contracts.
- [Monorepo packages](monorepo.md): workspace dependencies, imported history and verification.
- [Classic themes](../packages/pi-chat/themes/README.md): shipped palette files and installation.
- [Showcase assets](../packages/pi-chat/docs/readme-showcase/CAPTURE.md): capture arguments, isolation and
  current limitations; retained images are not current visual verification.
