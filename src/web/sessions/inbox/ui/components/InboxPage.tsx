import { Alert, Button, Text, Title, UnstyledButton } from "@mantine/core";
import { IconChevronRight, IconInbox } from "@tabler/icons-react";
import type { InboxRow } from "../../domain/inbox-model.js";
import { InboxCard } from "./InboxCard.js";
import styles from "./InboxPage.module.css";

export interface InboxPageProps {
  rows: readonly InboxRow[]; later: readonly InboxRow[]; pending: boolean; error?: string;
  laterOpen: boolean; onLaterToggle(): void;
  onOpen(row: InboxRow, later: boolean): void; onPark(row: InboxRow): void; onArchive(row: InboxRow): void; onNew(): void;
}
export function InboxPage(p: InboxPageProps) {
  const blocked = p.rows.filter(row => row.status === "blocked");
  const ready = p.rows.filter(row => row.status === "idle");
  const card = (row: InboxRow, later = false) => <InboxCard key={row.key} row={row} later={later} pending={p.pending}
    onOpen={() => p.onOpen(row, later)} onPark={() => p.onPark(row)} onArchive={() => p.onArchive(row)} />;
  const sections = [{ label: "Blocked", rows: blocked }, { label: "Ready", rows: ready }];
  return <div className={styles.page}>
    <Title order={1} size={31} fw={550} mb={28}>Inbox</Title>
    {p.error && <Alert color="red" role="alert" mb="md">{p.error}</Alert>}
    {sections.map(({ label, rows }) => {
      if (!rows.length) return null;
      return <section key={label} aria-label={label} className={styles.section}>
        <Title order={2} size="xs" fw={600} mb={10}>{label}</Title>
        <div className={styles.cards}>{rows.map(row => card(row))}</div>
      </section>;
    })}
    {!blocked.length && !ready.length && <div className={styles.empty}>
      <IconInbox size={36} /><Title order={2} size="lg" fw={500} mt="md">Nothing waiting here</Title>
      <Text size="sm" c="dimmed" my="md">Sessions appear here when they finish or need a decision.</Text>
      <Button variant="default" onClick={p.onNew}>Start a session</Button>
    </div>}
    {p.later.length > 0 && <div className={styles.section}>
      <UnstyledButton display="flex" w="100%" py={10} className={styles.later} aria-expanded={p.laterOpen} onClick={p.onLaterToggle}>
        <IconChevronRight size={13} className={p.laterOpen ? "rotate-90" : ""} /><Text size="xs">Later</Text><Text size="xs" c="dimmed">{p.later.length}</Text>
      </UnstyledButton>
      {p.laterOpen && <div className={styles.cards}>{p.later.map(row => card(row, true))}</div>}
    </div>}
  </div>;
}
