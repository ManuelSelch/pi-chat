# Folder-opening architecture

- Package entries: root = contract/types, `/web` = browser adapter/picker, `/host` = provider/filesystem service.
- [General boundaries](../../../docs/plugins.md) and [host lifecycle](../../../docs/plugin-runtime.md) describe the shared infrastructure.

## Browser composition

```mermaid
flowchart TD
    subgraph Chat["Chat shell"]
        Connection["usePiChat<br/>owns PiClient and generic request function"]
        Controller["AppControllerProvider"]
        Context["AppControllerContext<br/>merged controller and plugin functions"]
        Shell["FolderPickerContainer<br/>useAppController and useOverlays"]
        Session["startFolderSession<br/>SDK session.create and focus selection"]
        Connection -->|controller.request| Controller
        Controller -->|spreads folderOpening into context| Context
        Context -->|chat.browseDirectories| Shell
        Connection -->|exposes app action| Session
    end

    subgraph Plugin["folder-opening /web"]
        Adapter["createFolderOpeningPlugin(request)<br/>returns browseDirectories"]
        Picker["FolderPicker<br/>binds hook to view"]
        Hook["useFolderPicker<br/>listing, navigation, errors and cancellation"]
        View["FolderPickerView<br/>values and callbacks only"]
        Picker -->|supplies props| Hook
        Picker -->|supplies state and callbacks| View
        View -->|user actions| Hook
        Hook -->|calls injected browseDirectories| Adapter
    end

    Controller -->|constructs with generic request| Adapter
    Adapter -->|returns browser functions| Controller
    Shell -->|opened, connected, initialPath, callbacks, focus props| Picker
    Hook -->|calls injected startSession on Open| Session
```

- `browseDirectories` is created by the plugin adapter, merged into Chat's context, then passed through the picker props to the hook. The hook does not resolve Chat services.
- `startSession` is a separate app callback, not a method on the folder RPC contract. A successful start closes the picker; a failed start leaves an actionable error.
- The hook aborts outdated local waits and ignores stale results. This does not cancel filesystem work remotely.

## Browsing over RPC

```mermaid
sequenceDiagram
    participant Hook as useFolderPicker
    participant Web as Plugin web adapter
    participant SDK as SDK PiClient
    participant RPC as Server PluginRpc
    participant Runtime as Plugin runtime
    participant Host as Folder host provider
    participant FS as DirectoryBrowserService

    Note over SDK,RPC: Existing initialized WebSocket with plugin.call capability
    Hook->>Web: browseDirectories(query, signal)
    Web->>SDK: request(client => client.plugin(contract).browse(...))
    SDK->>SDK: Validate input with shared contract
    SDK->>RPC: plugin.call: folder-opening, version 1, browse, input
    RPC->>RPC: Check allowlist, contract version and method
    RPC->>Runtime: Invoke registered browse method
    Runtime->>Runtime: Validate input with provider schema
    Runtime->>Host: browse(input)
    Host->>FS: browse(input)
    FS->>FS: Validate and canonicalize path, list and paginate folders
    FS-->>Host: Listing or classified folder error
    Host-->>Runtime: Success with listing, or safe error result
    Runtime->>Runtime: Validate result with provider schema
    Runtime-->>RPC: Validated result
    RPC-->>SDK: Response containing value
    SDK->>SDK: Validate output with shared contract
    SDK-->>Web: FolderBrowseResult
    alt Successful listing
        Web-->>Hook: DirectoryListing
        Hook->>Hook: Update current listing and path
    else Safe folder failure
        Web-->>Hook: Throw SDKError with code and message
        Hook->>Hook: Store error for the view
    end
```

- Contract and [named result schemas](../src/schemas.ts) are shared by browser and host. The host omits absent optional fields so results remain JSON-safe.
- Expected filesystem failures become safe error results. Unexpected filesystem exceptions become a generic `operationFailed` result; dispatcher/validation failures become RPC rejections.
- Server also imports this plugin's directory service for existing `directory.browse` and session-path validation; those paths do not activate or call the folder plugin RPC.
