# Counter plugin demo

- Start Chat normally: `npm run dev` (web at [localhost:5174](http://localhost:5174)), or `npm run build && npm start` (default [localhost:8788](http://localhost:8788)).
- Click **Counter** in the header on Home or a session screen. Increment calls the host; the refresh icon reads its current value. No environment flag, special URL, model call or Pi session is required.
- [Chat's host](../src/host/index.ts) explicitly activates the [demo plugin](../src/plugins/counter-demo/index.ts) and exposes its adjacent `test-counter` revision 1 contract. It is not an SDK built-in, and does not activate file opening.
- Each server activation owns its count. Browsers on that server share it; reload, reopening and tab changes do not reset it. A server restart starts at zero. There is no persistence, reset method or push synchronization; use refresh to observe another client's changes.
- The panel calls `PiClient.plugin(counterContract)` through Chat's existing connection. [Plugin RPC](plugin-runtime.md) validates both directions; the browser never increments locally or opens a second socket.
- Reads run on open/reconnect. Disconnection disables actions; unknown mutation results require an explicit read before another increment. Late replies from a closed panel or former connection are ignored. Calls are never replayed.
- A backend without the RPC capability/contract shows **Counter plugin unavailable on this server**. Other failures stay in the panel rather than becoming chat notices.
- [Hook/view tests](../src/web/features/counter-demo/__test__/), [browser scenarios](../testing/e2e/counter-demo.spec.ts) and [production lifecycle smoke](../scripts/production-server-smoke.mjs) cover the integration. Browser geometry checks are not visual acceptance against the [approved mockup](../mockups/counter-demo/DESIGN.md).
