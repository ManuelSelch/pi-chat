# Worktree-first session labels — mockup

## Goal and scope
Refine Inbox row typography only. Preserve the approved session-inbox revision 14 source unchanged.

## Revision and review
Revision 4; approved for implementation. Approval evidence: user reviewed the padding refinement and said “looks good. impelement”. The user requested branch/worktree names large and conversation titles small; this prototype makes that hierarchy reviewable before production edits.

## Layout and behavior
- Linked worktrees with a branch: project context above, branch in the primary line, smaller muted session title below.
- Main checkout, non-worktree sessions, or missing branch: retain the conversation title as the primary line.
- Apply the same hierarchy to Needs you, Ready, Working and Later; this preview shows Ready, Working and expanded Later.
- Multiple conversations in one worktree retain separate rows with distinct secondary titles.
- Suppress an identical secondary title rather than repeating the branch.
- Status dots sit beside the smaller project name, leaving the primary branch/session line unindented and wider. Secondary titles align with the primary line.
- Running sessions omit Move to Later and Archive entirely, including on hover/focus, and reclaim their reserved text space.
- Preserve selection, truncation and reserved action space for other rows. No header or original Projects-panel redesign.
- Section labels (Ready, Working, Later) use 2px left padding rather than the rows’ 10px inset.
- Narrow screens constrain the same row; no new interaction or animation.

## Fake behavior and limitations
Fake fixtures only. Selection works locally; action buttons are illustrative. No backend, storage, real sessions or lifecycle changes. Later is expanded solely for comparison.

## Outstanding questions
None. Revision 4 is approved; preserve these files as the visual baseline.
