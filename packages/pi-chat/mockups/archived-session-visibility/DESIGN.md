# Archived-session visibility — revision 1

Review status: approved. User approved revision 1: “looks good. The default value should be true (hide archived sessions) Implement it”. Mockup preview stopped before production implementation.

## Goal and scope

Add a Settings preference called **Hide archived sessions**. When enabled, archived session rows and each per-project **Archived** heading/count disappear from the Projects panel. Archived history remains saved and is not deleted. Other project grouping remains unchanged.

## Review behavior

- The toggle updates the example Projects panel immediately and persists in this mockup's local storage.
- The initial state is enabled to reflect the requested uncluttered list; switch it off to see archived rows and expand the Archived section.
- Narrow layout stacks Settings and the Projects preview.

## Fake or omitted behavior

Fake project/session data only; no real Pi Chat state, archive operations, restoration, or production preference persistence is connected. The preview is a plain HTML/CSS approximation of the app.

## Approved decisions

- Default to enabled: hide archived sessions.
- Hide archived rows and Archived headings/counts, retaining all archive data.
- Use the existing production Settings Projects section and switch styling; the separate side-by-side mockup is only a review aid.
