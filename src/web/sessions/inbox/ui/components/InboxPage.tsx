import { useState } from "react";
import { Alert, Text, Title, UnstyledButton } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import type { InboxRow } from "../../domain/inbox-model.js";
import { InboxCard } from "./InboxCard.js";
import styles from "./InboxPage.module.css";

export interface InboxPageProps {
  rows: readonly InboxRow[]; later: readonly InboxRow[]; pending: boolean; error?: string;
  laterOpen: boolean; onLaterToggle(): void;
  onOpen(row: InboxRow, later: boolean): void; onPark(row: InboxRow): void; onArchive(row: InboxRow): void;
}
export function InboxPage(p: InboxPageProps) {
  const blocked = p.rows.filter(row => row.status === "blocked");
  const ready = p.rows.filter(row => row.status === "idle");
  const card = (row: InboxRow, later = false) => <InboxCard key={row.key} row={row} later={later} pending={p.pending}
    onOpen={() => p.onOpen(row, later)} onPark={() => p.onPark(row)} onArchive={() => p.onArchive(row)} />;
  const sections = [{ label: "Blocked", rows: blocked }, { label: "Ready", rows: ready }];
  return <div>
    {p.error && <Alert color="red" role="alert" mb="md">{p.error}</Alert>}
    {sections.map(({ label, rows }) => {
      if (!rows.length) return null;
      return <section key={label} aria-label={label} className={styles.section}>
        <Title order={2} size="xs" fw={600} mb={10}>{label}</Title>
        <div className={styles.cards}>{rows.map(row => card(row))}</div>
      </section>;
    })}
    {p.rows.some(row => row.status === "running") && <WorkingSection rows={p.rows.filter(row => row.status === "running")} pending={p.pending} onOpen={p.onOpen} onPark={p.onPark} onArchive={p.onArchive} />}
    {p.later.length > 0 && <div className={styles.section}>
      <UnstyledButton display="flex" w="100%" py={10} className={styles.later} aria-expanded={p.laterOpen} onClick={p.onLaterToggle}>
        <IconChevronRight size={13} className={p.laterOpen ? "rotate-90" : ""} /><Text size="xs">Later</Text><Text size="xs" c="dimmed">{p.later.length}</Text>
      </UnstyledButton>
      {p.laterOpen && <div className={styles.cards}>{p.later.map(row => card(row, true))}</div>}
    </div>}
  </div>;
}

function WorkingSection(p: Pick<InboxPageProps, "rows" | "pending" | "onOpen" | "onPark" | "onArchive">) {
  const [open, setOpen] = useState(false);
  return <div className={styles.section}>
    <UnstyledButton display="flex" w="100%" py={10} className={styles.later} aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <IconChevronRight size={13} className={open ? "rotate-90" : ""} /><Text size="xs">Working</Text><Text size="xs" c="dimmed">{p.rows.length}</Text>
    </UnstyledButton>
    {open && <div className={styles.cards}>{p.rows.map(row => <InboxCard key={row.key} row={row} later={false} pending={p.pending}
      onOpen={() => p.onOpen(row, false)} onPark={() => p.onPark(row)} onArchive={() => p.onArchive(row)} />)}</div>}
  </div>;
}
