import { useCallback, useState } from "react";
import { counterContract } from "../../../../plugins/counter-demo/contract.js";
import { useAppController } from "../../../app/AppControllerContext.js";
import { useCounterDemo } from "../hooks/use-counter-demo.js";
import { CounterDemoView } from "./CounterDemoView.js";

export function CounterDemoContainer() {
  const { app, plugin } = useAppController();
  const [opened, setOpened] = useState(false);
  const connected = app.connection === "open";
  const read = useCallback(() => plugin(counterContract).read(null), [plugin]);
  const increment = useCallback(() => plugin(counterContract).increment(null), [plugin]);
  const counter = useCounterDemo({ opened, connected, serverInstanceId: app.serverInstanceId, read, increment });

  return <CounterDemoView opened={opened} connected={connected} state={counter.view}
    onOpenChange={setOpened} onRead={() => void counter.read()} onIncrement={() => void counter.increment()} />;
}
