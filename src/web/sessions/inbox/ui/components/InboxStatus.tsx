import { STATUS_COLOR } from "../../../../ui/theme.js";
import type { TabStatus } from "../../../../app/state/view-types.js";
import { INBOX_STATUS_LABEL } from "../../domain/inbox-model.js";

export function InboxStatus({ status, label = false }: { status: TabStatus; label?: boolean }) {
  return <span className="inline-flex shrink-0 items-center gap-1.5" title={INBOX_STATUS_LABEL[status]}>
    <span className="inline-block size-1.5 shrink-0 rounded-full" role="img" aria-label={INBOX_STATUS_LABEL[status]}
      style={{ background: STATUS_COLOR[status] }} />
    {label && <span className="hidden sm:inline">{INBOX_STATUS_LABEL[status]}</span>}
  </span>;
}
