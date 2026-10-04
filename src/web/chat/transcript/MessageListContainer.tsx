import { Container } from "@mantine/core";
import { useAppController } from "../../app/AppControllerContext.js";
import { useAutoScroll } from "./use-auto-scroll.js";
import { MessageList } from "./MessageList.js";

interface MessageListContainerProps {
  footerHeight: number;
}

export function MessageListContainer({ footerHeight }: MessageListContainerProps) {
  const { state } = useAppController();
  const followKey = `${state.messages.length}:${state.messages.at(-1)?.id ?? ""}:${state.draft?.text.length ?? 0}:${state.draft?.thinking.length ?? 0}:${state.status}`;
  const bottomRef = useAutoScroll({ sessionId: state.sessionId, followKey });

  return (
    <Container size="sm" py="xl">
      <MessageList key={state.sessionId} messages={state.messages} draft={state.draft} />
      <div ref={bottomRef} aria-hidden="true" style={{ scrollMarginBottom: footerHeight }} />
    </Container>
  );
}
