import { useConfirmDialog } from "../../../../components/confirm/ConfirmDialogProvider.js";
import { useServerSettings } from "../hooks/use-server-settings.js";
import { defaultEndpoint, isOtherHost, redactEndpoint, type EndpointPreference } from "../utils/endpoint.js";
import { saveEndpoint } from "../lib/endpoint-store.js";
import { ServerSettingsPanel } from "./ServerSettingsPanel.js";

export function ServerSettingsContainer({ preference, connected, failed }: { preference: EndpointPreference; connected: boolean; failed: boolean }) {
  const { confirm } = useConfirmDialog();
  const page = window.location;
  const settings = useServerSettings({
    preference, page, confirm,
    persist: value => saveEndpoint(value, page.protocol),
    reload: () => window.location.reload(),
  });
  return <ServerSettingsPanel
    {...settings}
    placeholder={redactEndpoint(defaultEndpoint(page))}
    connected={connected}
    failed={failed}
    warning={preference.warning}
    otherHost={isOtherHost(settings.draft || defaultEndpoint(page), page.host)}
    onEdit={settings.edit}
    onSave={() => void settings.save()}
    onReset={() => void settings.reset()}
  />;
}
