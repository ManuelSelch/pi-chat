/** Shorten display text only; branch identity and hover text stay unchanged. */
export function worktreeLabel(branch: string): string {
  return branch.replace(/^(?:feature|feat|fix|bugfix)\/(?=.)/, "");
}
