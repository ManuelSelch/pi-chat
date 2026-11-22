# Pi Chat

A local browser workspace for [Pi](https://github.com/earendil-works/pi), using your existing credentials, extensions, tools, and persistent sessions.

[![Pi Chat workspace, project and session navigation, Quick Switcher, and light mode](docs/images/showcase/pi-chat-showcase.png)](docs/images/showcase/pi-chat-showcase.png)

## Features

- Streaming chat with Markdown, LaTeX, and a fixed dark theme.
- Tool cards with highlighted code, edit diffs, and file previews.
- Persistent session tabs, optional sidebar Inbox with Later, project browsing, and a Quick Switcher.
- Native steering to guide Pi during a run.
- Pi commands, skills, argument completion, and bash execution.
- Extension dialogs, ANSI-styled plain-text widgets, status labels, and experimental web UI hooks.

## Get started

From the monorepo root, install dependencies and register this local Pi package:

```sh
npm ci --ignore-scripts
pi install ./packages/pi-chat
```

The private workspace root is not a Pi extension package.

Run `/pi-chat start`, then open [localhost:8788](http://localhost:8788).
Use `/pi-chat stop` to stop the server, `/pi-chat restart` to rebuild and restart,
or `/pi-chat` to check its status.

## Development

- Chat, [Server](../pi-server/README.md) and [TypeScript SDK](../pi-sdk-typescript/README.md) share one npm workspace.
- Run `npm ci --ignore-scripts`, then `npm run dev` or `npm run build` from the root.
- See [monorepo development and verification](../../docs/monorepo.md). Workspace migration does not publish the current SDK/Server candidate versions; external package installation requires matching published versions or explicit tarballs.

## Documentation

- [Usage](docs/usage.md): shortcuts, sessions, steering, commands, and file previews.
- [Configuration](docs/configuration.md): server settings, environment variables, and troubleshooting.
- [System development](../../docs/development.md) and [Chat development](docs/development.md): setup, testing and source organization.
- [Architecture](../../docs/architecture.md): components and data flow.
- [Protocol integration](../../docs/protocol.md): SDK ownership, operation outcomes, and recovery.
- [Extension API](docs/extension-api.md): native Pi prompts, widgets and footer status.
- [All system guides](../../docs/README.md): drivers, workspace ownership, themes, and capture limitations.
