# High-level architecture

Pi Chat is a local web client backed by a server running Pi.
The server owns agent sessions; the client displays state and sends commands.

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
        Connection[WebSocket connection]
    end

    subgraph State
        AppState[App state]
        ChatState[Chat state per session]
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

- `App` manages the WebSocket connection and application state.
- Chat, Sessions, Settings, and Extensions provide the main web features.
- Shared UI and browser preferences support the features.

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
