import { ProductionServerDriver } from '../test/infra/production/production-server-driver.mjs';

const server = await ProductionServerDriver.start();
try {
  await server.FailedBuildShouldKeepCurrentServer();
  await server.RestartShouldRewritePid();
  await server.StopShouldReleaseListenerAndFlushLogs();
  console.log('Production lifecycle smoke passed: real launcher readiness, health/UI, failed-build retention, real rebuild/restart, successor PID, logs and shutdown.');
} finally { await server.dispose(); }
