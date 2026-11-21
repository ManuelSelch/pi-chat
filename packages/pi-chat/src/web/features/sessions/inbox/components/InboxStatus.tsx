import { STATUS_COLOR, THEME } from "../../../../config/theme.js";
import type { TabStatus } from "../../../../types/view-types.js";
import { INBOX_STATUS_LABEL } from "../utils/inbox-model.js";

export function InboxStatus({ status, label = false, later = false }: { status: TabStatus; label?: boolean; later?: boolean }) {
  return <span className="inline-flex shrink-0 items-center gap-1.5">
    <span className="inline-block size-1.5 shrink-0 rounded-full" role="img" aria-label={INBOX_STATUS_LABEL[status]}
      style={{ background: later ? THEME.status.later : STATUS_COLOR[status] }} />
    {label && <span className="hidden sm:inline">{INBOX_STATUS_LABEL[status]}</span>}
  </span>;
}
