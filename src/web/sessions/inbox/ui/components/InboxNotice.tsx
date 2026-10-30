import { Alert, Container } from "@mantine/core";

interface InboxNoticeProps { error: string | undefined; onDismiss(): void }
export function InboxNotice({ error, onDismiss }: InboxNoticeProps) {
  if (!error) return null;
  return <Container size="sm" py="xs">
    <Alert color="red" role="alert" withCloseButton onClose={onDismiss}>{error}</Alert>
  </Container>;
}
