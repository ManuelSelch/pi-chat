# High-level architecture

Pi Chat is a local web client backed by a server running Pi. The server owns
runtime execution; navigation and focus are application-owned. The coordinated
v2-only protocol and UI-independent TypeScript `PiClient` live in the independent
`pi-sdk-typescript` repository. Chat installs a pinned packed
[`@manuelselch/pi-sdk` artifact](../vendor/README.md); Swift lives in the separate
`pi-sdk-swift` repository. Server and application use the same public
`@manuelselch/pi-sdk/protocol` module. Pi Chat uses one client per mounted
controller: `use-pi-chat.ts` binds its lifecycle/typed operations to React and
`bindPiChat` composes SDK projections with browser-only presentation. No web-owned
wire parser, request trackers or session reducer remain. Slice 5's coordinated
server/SDK/application cutover is complete; there is no live v1 path.

```mermaid
flowchart LR
    WebClient[Web Client] <-->|WebSocket| Server[Server]
    Server --> Pi[Pi]
```

## Web

```mermaid
flowchart TD
    App[App]

    subgraph Coordination
        Controller[App controller]
        Connection[PiClient SDK]
    end

    subgraph State
        AppState[App state]
        ChatState[SDK session projections plus local notice views]
    end

    subgraph Features
        Chat[Chat]
        Sessions[Sessions]
        Settings[Settings]
        Extensions[Extensions]
    end

    subgraph Presentation
        UI[Shared UI]
        Preferences[Browser preferences]
    end

    App --> Controller
    Controller <--> Connection
    Controller --> AppState
    Controller --> ChatState

    App --> Chat
    App --> Sessions
    App --> Settings
    App --> Extensions

    Chat --> UI
    Sessions --> UI
    Settings --> UI
    Extensions --> UI
    Settings --> Preferences
```

- `App` mounts the controller; `usePiChat` creates/disposes PiClient and exposes
  typed actions. The browser supplies the explicit endpoint (including the page
  query string) and a logging transport adapter. SDK lifecycle owns backoff,
  takeover, initial-sync timeout, cancellation, request limits and sequencing.
- Chat, Sessions, Settings, and Extensions provide the main web features.
- Shared UI and browser preferences support the features.
- `app/state` composes read-only SDK projections without reducing wire events
  again. It owns transient notification bubbles/anchors, dismissed-error masks,
  optimistic opening/closing placeholders and rollback after local send failures.
  SDK snapshots remain immutable; views accept read-only props. Navigation, input
  drafts and composer focus remain browser-owned. The domain integration driver
  uses the same SDK/view binding, rather than a second WebSocket/reducer path.

## Server

```mermaid
flowchart TD
    HTTP[HTTP server / composition root]

    subgraph Transport
        WebSocket[WebSocket transport]
        Handler[Command handler]
        Publisher[Server publisher]
    end

    subgraph Application
        Chat[Chat application service]
        Registry[Session registry]
        Actions[Feature actions]
    end

    subgraph Projects
        Catalogue[Catalogue assembly]
        Store[Pi session store]
        Directory[Directory browser]
    end

    subgraph Extensions
        ExtensionRegistry[Extension registry]
        UIRegistries[Prompt, widget, and status registries]
    end

    subgraph Runtime
        Adapter[Pi runtime adapter]
        Factory[Runtime factory]
        Mapping[Event, message, tool, and snapshot mapping]
        Pi[Pi SDK runtime]
    end

    Files[(Session files)]

    HTTP --> WebSocket
    WebSocket --> Handler
    Handler --> Chat
    Chat --> Registry
    Chat --> Actions
    Chat --> Catalogue
    Chat --> Directory
    Chat --> ExtensionRegistry
    Chat --> Publisher
    Publisher --> WebSocket
    Registry --> Adapter
    Adapter --> Factory
    Adapter --> Mapping
    Factory --> Pi
    Mapping --> Pi
    Catalogue --> Store
    Store --> Files
    Adapter --> UIRegistries
    ExtensionRegistry --> Pi
```

- The HTTP server serves the client and hosts the WebSocket connection.
- Application services manage sessions, projects, actions, and extensions.
- The runtime adapter connects the application to Pi and session files.
