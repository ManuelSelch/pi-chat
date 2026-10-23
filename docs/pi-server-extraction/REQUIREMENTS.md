# Pi Server Extraction — Requirements

## Goal
Extract the existing backend into a standalone `pi-server` Git repository and package (`@manuelselch/pi-server`) without changing behavior. This is the short extraction work plan; the [parent plan](../backend-sdk/REQUIREMENTS.md) retains migration history and broader SDK/deployment milestones.

## Scope
### In Scope
- Server sources, required shared helpers, public APIs, tests, build configuration, CI and documentation.
- Independent packaging and Pi Chat consumer integration.

### Out of Scope
- Protocol changes, UI redesign, new Swift functionality or remote deployment.
- Remote repository creation, pushing, publication or live service replacement without separate approval.

## Requirements
- Preserve v2 behavior, session storage, extension registration identity and loopback defaults; the SDK remains the authoritative contract owner.
- Run the compiled server headlessly or with explicitly configured static assets, without Pi Chat sources, React, Vite or runtime TypeScript loaders.
- Use documented package APIs, declared runtime dependencies and independently installable SDK artifacts; no sibling-source imports or workspace-hoisting assumptions.
- Preserve Pi Chat launcher, restart, PID/log and shutdown behavior; standalone restart must not assume a source rebuild.
- Pass clean-install server/package tests, existing SDK fixture tests, Pi Chat integration tests and production smoke checks. Remove old sources only after verification; retain a rollback revision.

## Assumptions
- Existing protocol semantics are documented in the [protocol specification](../backend-sdk/PROTOCOL.md); completed migration evidence is in [CUTOVER.md](../backend-sdk/CUTOVER.md).
- The parent's Swift conversation/dialog/reconnect prerequisite remains binding until explicitly changed. This plan does not authorize extraction or waive that prerequisite.

## Implementation Plan
### 1. Define Boundaries
Description: Map server/shared files, dependencies and test ownership; define public embedding, extension and fixture APIs. Verify current imports are covered and resolve extraction decisions before moving files.

### 2. Package Independently
Description: Following step 1, establish the server package, CLI, optional static hosting and restart/launcher adapters. Verify a packed installation starts, initializes an SDK client and shuts down from an unrelated directory without Pi Chat sources.

### 3. Extract Repository
Description: Following step 2 and prerequisite/creation approval, create the local repository using the agreed history strategy. Include tests, CI, documentation and attribution; verify a fresh clone builds/tests with independent dependency artifacts. Do not rewrite Pi Chat history.

### 4. Switch Pi Chat
Description: Following step 3, consume server/SDK package APIs and update extension examples, fixtures and build/test configuration. Run integration and production smoke checks before removing old server sources; document versions and rollback instructions.

## Open Questions
1. Retain the parent's Swift verification prerequisite, or explicitly allow extraction before it?
2. Extract `pi-sdk` alongside the server, or temporarily consume independently packed SDK artifacts from Pi Chat?
3. Where should the local repository live, and should it preserve filtered history or start with a clean initial commit?
