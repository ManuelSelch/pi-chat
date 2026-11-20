import { ProductionServerDriver } from '../testing/infra/production/production-server-driver.mjs';

const server = await ProductionServerDriver.start();
try {
  await server.counterShouldRoundTripWithoutSession();
  await server.FailedBuildShouldKeepCurrentServer();
  await server.counterShouldRead(1);
  await server.RestartShouldRewritePid();
  await server.counterShouldRead(0);
  await server.StopShouldReleaseListenerAndFlushLogs();
  console.log('Production lifecycle smoke passed: real launcher readiness, health/UI, counter RPC without sessions, failed-build state retention, counter reset on real rebuild/restart, successor PID, logs and shutdown.');
} finally { await server.dispose(); }
