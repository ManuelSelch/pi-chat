import { useServerVersion } from "../app/use-server-version.js";
import { VersionsPanel } from "./VersionsPanel.js";

declare const __PI_CHAT_BUILD__: { chat: string; sdk: string };

export function VersionsContainer(props: { endpoint: string; connected: boolean; opened: boolean }) {
  const server = useServerVersion(props.endpoint, props.connected, props.opened);
  return <VersionsPanel chat={__PI_CHAT_BUILD__.chat} sdk={__PI_CHAT_BUILD__.sdk} server={server} />;
}
