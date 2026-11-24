import { Button, Text } from "@mantine/core";
import type { ReviewActions } from "../hooks/use-review.js";
export function ReviewFooter({review}: {review:ReviewActions}) {
  const {state,stale} = review;
  if (!state.comments.length && !state.error) return null;
  return <div className="border-t border-(--mantine-color-default-border) px-3 py-2">
    {stale.length>0 && <div role="alert" className="mb-2 text-xs text-(--mantine-color-dimmed)">Changes moved since these comments were created. Remove outdated comments and reselect the current lines.
      {stale.map(comment=><div key={comment.id} className="flex items-center justify-between gap-2"><span className="min-w-0 wrap-anywhere">{comment.path}:{comment.line} — {comment.body}</span><Button size="compact-xs" variant="subtle" color="gray" disabled={state.sending} onClick={()=>review.remove(comment.id)}>Delete</Button></div>)}
    </div>}
    {state.error && <Text role="alert" size="xs" c="red" mb={6}>{state.error}</Text>}
    <div className="flex items-center justify-between gap-2">
      <Text size="xs" c="dimmed">{state.comments.filter(comment=>comment.body).length} comments{review.waitingForIdle ? " — wait for the agent to finish" : ""}</Text>
      <Button size="xs" variant="light" color="gray" disabled={!review.canSend} loading={state.sending} onClick={()=>{void review.send();}}>Send comments</Button>
    </div>
  </div>;
}
