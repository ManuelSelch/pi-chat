import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import piChatExtension from '../../../extension/pi-chat.ts';
import { resolveNpmCli } from '../../../src/shared/node/npm-command.ts';

const commands = new Map();
piChatExtension({
  registerCommand(name, command) { commands.set(name, command); },
  async exec(command, args, options) {
    if (command !== 'npm') throw new Error('Unexpected launcher executable');
    try {
      const result = await promisify(execFile)(process.execPath, [resolveNpmCli(), ...args], { ...options, maxBuffer: 4 * 1024 * 1024 });
      return { ...result, code: 0 };
    } catch (error) { return { stdout: error.stdout ?? '', stderr: error.stderr ?? '', code: error.code ?? 1 }; }
  },
});
const command = process.argv[2] === 'stop' ? 'pi-chat-stop' : 'pi-chat-start';
await commands.get(command).handler(process.argv.slice(3).join(' '), {
  cwd: process.env.PI_CHAT_CWD ?? process.cwd(), ui: { notify(message) { console.log(message); } },
});
