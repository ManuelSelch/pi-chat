import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { publishPidFile } from "../../../../../src/bootstrap/Infra/pid-file.js";

vi.mock("node:fs/promises", async importOriginal => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, rename: vi.fn(actual.rename), writeFile: vi.fn(actual.writeFile) };
});
const actualFs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
const previous = { pid: 1, port: 8788, cwd: "/old workspace" };
const successor = { pid: 2, port: 8789, cwd: "/new workspace" };
let directory: string;
let path: string;

beforeEach(async () => {
  vi.mocked(rename).mockReset().mockImplementation(actualFs.rename);
  vi.mocked(writeFile).mockReset().mockImplementation(actualFs.writeFile);
  directory = await mkdtemp(join(tmpdir(), "pi pid publication "));
  path = join(directory, "server.pid");
});
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

async function record() { return JSON.parse(await readFile(path, "utf8")); }

describe("atomic CLI PID publication", () => {
  it("keeps the previous record readable until the complete successor replaces it", async () => {
    await writeFile(path, JSON.stringify(previous));
    vi.mocked(rename).mockImplementationOnce(async (temporary, target) => {
      expect(dirname(String(temporary))).toBe(directory);
      expect(target).toBe(path);
      expect(await record()).toEqual(previous);
      expect(JSON.parse(await readFile(temporary, "utf8"))).toEqual(successor);
      await actualFs.rename(temporary, target);
    });

    await publishPidFile(path, successor);

    expect(rename).toHaveBeenCalledOnce();
    expect(await record()).toEqual(successor);
    expect(await readdir(directory)).toEqual(["server.pid"]);
  });

  it("publishes a complete record on first startup", async () => {
    await publishPidFile(path, successor);
    expect(await record()).toEqual(successor);
    expect(await readdir(directory)).toEqual(["server.pid"]);
  });

  it("preserves the old record and removes the temporary file if rename fails", async () => {
    await writeFile(path, JSON.stringify(previous));
    const failure = new Error("rename failed");
    vi.mocked(rename).mockRejectedValueOnce(failure);

    await expect(publishPidFile(path, successor)).rejects.toBe(failure);

    expect(await record()).toEqual(previous);
    expect(await readdir(directory)).toEqual(["server.pid"]);
  });

  it("cleans up a partial temporary write without changing the old record", async () => {
    await writeFile(path, JSON.stringify(previous));
    const failure = new Error("write failed");
    vi.mocked(writeFile).mockImplementationOnce(async temporary => {
      await actualFs.writeFile(temporary, "{");
      throw failure;
    });

    await expect(publishPidFile(path, successor)).rejects.toBe(failure);

    expect(rename).not.toHaveBeenCalled();
    expect(await record()).toEqual(previous);
    expect(await readdir(directory)).toEqual(["server.pid"]);
  });
});
