# Grouped compact tools

- Revision: 1
- Goal: Compact transcript overview alternates thinking and single-row tool-group summaries, followed by the final answer.
- Scope: Compact mode only; comfortable mode remains unchanged.
- Layout: Consecutive tool calls collapse together. Thinking/text separates groups. Summary counts calls by tool name in first-use order, e.g. “Used 3 read, 1 bash”.
- Interaction: Each group is initially collapsed. Click or keyboard-toggle to reveal individual tool disclosures; expand those for arguments/results. Collapsing the group restores the single-row overview.
- Responsive: Centered transcript with narrow-screen insets and wrapping detail labels. Native accessible disclosures, visible keyboard focus, no animation.
- Fake/omitted: Static sample thinking, paths and successful tool output; no backend, streaming, persistence, or production changes.
- Review status: revision 1 approved by user: “approved. implement it”.
- Open question: Approve the grouped summary and nested tool expansion for implementation?
