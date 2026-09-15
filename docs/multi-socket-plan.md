# Multi-socket transport plan

Pi Chat currently defaults to a single browser controller: a new browser connection replaces the previous one. Multi-user support should keep that default, but add a generic opt-in multi-connection transport that plugins can govern by policy.

## Core concepts

- **Connection**: one WebSocket client with a stable `connectionId`.
- **Connection mode**:
  - `single-controller`: current default; one socket controls the UI, newer sockets replace older sockets.
  - `multi-connection`: multiple sockets may stay connected.
- **Authorization middleware**: extension-owned policy checks for connecting, prompting, aborting, running actions, and receiving snapshots/events.

## Non-goals

- No built-in multi-user/invite feature in core.
- No user accounts in core.
- No plugin-specific role names in core beyond generic metadata.

## MVP path

1. Replace transport internals with a connection map while preserving default behavior.
2. Add connection lifecycle hooks.
3. Add authorization middleware with default allow behavior.
4. Add opt-in multi-connection mode.
5. Broadcast snapshots/events to authorized connections.

A multi-user plugin can then add invite links, roles, and participant state on top.
