# Current system documentation

These guides describe the implemented system, not feature proposals or historical
verification runs. Executable scenarios remain the behavioral contract; links
below do not imply that tests or visual acceptance have just run.

- [Architecture](architecture.md): package boundaries, ownership, state lifetimes,
  runtime flows and failure handling.
- [Usage](usage.md): navigation, commands, prompts, widgets and file interactions.
- [Configuration](configuration.md): server lifecycle, endpoint/security settings,
  themes and diagnostics.
- [Protocol integration](protocol.md): installed SDK authority, identities,
  response meaning, recovery and cancellation.
- [Extension API](extension-api.md): public registry and native Pi UI contributions.
- [Development](development.md): setup, build/test/CI, source organization and
  documentation/scenario workflow.
- [Application drivers](integration-tests/DRIVERS.md) and
  [test guide](../test/README.md): faithful test boundaries and permanent contracts.
- [Dependency provenance](../vendor/README.md): pinned releases and source ownership.
- [Classic themes](../themes/README.md): shipped palette files and installation.
- [Showcase assets](readme-showcase/CAPTURE.md): capture arguments, isolation and
  current limitations; retained images are not current visual verification.
