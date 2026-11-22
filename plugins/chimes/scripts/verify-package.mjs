import assert from 'node:assert/strict';
import { verifyPluginPackage } from '../../../scripts/verify-plugin-package.mjs';

await verifyPluginPackage();
const { chimesPlugin, chimesUI } = await import('@manuelselch/pi-plugin-chimes');
const web = await import('@manuelselch/pi-plugin-chimes/web');
assert.equal(web.chimesPlugin, chimesPlugin);
assert.equal(chimesPlugin.id, 'chimes');
assert.equal(chimesPlugin.web(), chimesUI);
assert.equal('host' in chimesPlugin, false);
assert.equal('commands' in chimesUI, false);
assert.equal('Overlay' in chimesUI, false);
assert.equal(chimesUI.contributions[0].id, 'chimes.enabled');
assert.equal(chimesUI.contributions[0].placement, 'settings.feature-toggles');
console.log('Verified browser-only chimes declaration and compiled settings contribution.');
