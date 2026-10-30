import { Alert, Button, Container } from "@mantine/core";

interface InboxNoticeProps { error: string | undefined; canUndo: boolean; pending: boolean; onDismiss(): void; onUndo(): void }
export function InboxNotice({ error, canUndo, pending, onDismiss, onUndo }: InboxNoticeProps) {
  if (!error && !canUndo) return null;
  return <Container size="sm" py="xs">
    {error && <Alert color="red" role="alert" withCloseButton onClose={onDismiss}>{error}</Alert>}
    {canUndo && <Alert color="blue" role="status">Session archived.
      <Button size="compact-xs" variant="subtle" ml="xs" disabled={pending} onClick={onUndo}>Undo archive</Button>
    </Alert>}
  </Container>;
}
