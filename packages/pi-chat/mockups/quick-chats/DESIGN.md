# Quick Chats

- Revision: 1
- Status: approved for implementation.
- Goal: treat the user home folder as a permanent, recognizable destination for general conversations.

## Layout and behavior

- Quick Chats is always the first project row, above the Pinned projects and Recent projects groups. It is not a user-managed pin and cannot be unpinned.
- Use an outlined speech-bubble icon instead of a folder. Keep the existing blue selected treatment and active-session count.
- The sessions column uses the title Quick Chats, the optional home display path `~`, and a New chat action. Other projects retain New session and their pin control.
- Existing active/archived session behavior is preserved. Archiving every chat must not remove the Quick Chats row.
- At narrow widths, keep both columns visible, with wrapping labels and independently scrollable content. No added animation.
- Keyboard: native buttons, visible focus, dialog focus containment, Escape to close and focus return to Projects.

## Review states

- `/quick-chats/`: populated Quick Chats selected.
- `/quick-chats/?state=empty`: Quick Chats remains visible with zero chats and an empty-state invitation.
- `/quick-chats/?state=project`: ordinary project selected; Quick Chats remains at the top.
- Append `&theme=dark` to a state URL, or use `?theme=dark` for the default state.
- Select projects, start simulated chats, archive/restore sessions, expand Archived, and pin/unpin ordinary projects. Reload resets fake data.

## Assumptions and limitations

- “User folder” is assumed to mean the server user's home directory (`~`), not `.pi/agent` or another configured workspace. Confirm before implementation.
- Permanent positioning above the pin group is a proposed interpretation of “always show”.
- Existing home-folder sessions would appear here; this is a label/icon change for that folder, not a new session store.
- Standalone HTML/CSS/JS with fake data, no backend, filesystem access, storage, or model. Folder picker and conversation content are placeholders. Production worktree groups are not redesigned.
- Approval evidence: user said “looks good. implement it” on revision 1 (populated state and dark mode inspected).
