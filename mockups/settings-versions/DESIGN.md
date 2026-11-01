# Settings versions

- Revision: 2. Status: in review; no approval yet.
- Add a read-only Versions panel below Backend server; preserve all existing controls and journeys.
- Pi Chat: exact release tag when available, otherwise dev + short build commit. Do not use placeholder package version; tagged but modified builds must not appear as clean releases.
- Pi Server: version of the connected running backend, not files currently installed on disk. Unavailable while disconnected or not reported.
- Pi SDK: version used to build this browser frontend (not the server's potentially separate SDK dependency).
- Responsive: existing medium right drawer; simple two-column rows. No explanatory paragraph below the versions (removed at user request).
- States: default untagged development, ?state=release simulated future tag, ?state=disconnected unavailable server version.
- Fake versions/local controls only; no connections, persistence, or actual restart. Existing settings copied for placement context; not production behavior verification.
- No existing journeys removed or changed. Source of runtime metadata will need implementation after approval.
