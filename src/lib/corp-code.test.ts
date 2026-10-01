import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CorpCodeResolver } from "./corp-code.js";
import type { DartClient } from "./dart-client.js";

/** 윈도우에서 남이 연 파일을 지우거나 옮길 수 없는 상황을 재현하는 스위치. */
const fsFailure = { unlink: false, rename: false };

vi.mock("node:fs", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:fs")>();
  const eperm = (op: string): NodeJS.ErrnoException => {
    const err = new Error(`EPERM: operation not permitted, ${op}`) as NodeJS.ErrnoException;
    err.code = "EPERM";
    return err;
  };
  return {
    ...real,
    unlinkSync: (...args: Parameters<typeof real.unlinkSync>) => {
      if (fsFailure.unlink) throw eperm("unlink");
      return real.unlinkSync(...args);
    },
    renameSync: (...args: Parameters<typeof real.renameSync>) => {
      if (fsFailure.rename) throw eperm("rename");
      return real.renameSync(...args);
    },
  };
});

/**
 * MCP 클라이언트(예: Claude 데스크톱 앱)는 서버 프로세스를 하나만 띄운다는 보장이 없다.
 * 실제로 앱은 기동 때마다 두 개를 띄우고, 둘 다 같은 캐시 디렉터리를 본다.
 * 캐시가 없거나 TTL 이 지난 순간에는 두 인스턴스가 같은 SQLite 파일을 동시에 다시 만들게 되고,
 * 그때 한쪽이 SqliteError 로 죽으면 프로세스가 통째로 내려가 서버 연결이 끊긴다.
 */

const zipFixture = readFileSync(
  fileURLToPath(new URL("./__fixtures__/corpcode-sample.zip", import.meta.url)),
);

/** getZip 만 쓰는 doInit 경로용 최소 스텁. */
function fakeClient(): DartClient {
  return {
    getZip: async () => zipFixture,
  } as unknown as DartClient;
}

describe("CorpCodeResolver — 캐시 동시 재생성", () => {
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = mkdtempSync(join(tmpdir(), "corp-code-test-"));
    // 덤프 다운로드 진행 로그가 시험 출력을 덮지 않게 막는다.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    fsFailure.unlink = false;
    fsFailure.rename = false;
    vi.restoreAllMocks();
    rmSync(cacheDir, { recursive: true, force: true });
  });

  it("기존 캐시 파일을 지울 수 없어도 재생성이 실패하지 않는다", async () => {
    const first = new CorpCodeResolver({ cacheDir, forceRefresh: true });
    await first.init(fakeClient());

    // 윈도우에서는 다른 인스턴스가 열어 둔 캐시 파일을 지울 수 없다.
    // 그 상태에서 기존 파일 위에 그대로 스키마를 만들면 SqliteError 로 프로세스가 죽는다.
    fsFailure.unlink = true;

    const second = new CorpCodeResolver({ cacheDir, forceRefresh: true });
    await expect(second.init(fakeClient())).resolves.toBeUndefined();
    expect(second.search("삼성전자")[0]?.corp_code).toBe("00126380");
  });

  it("두 인스턴스가 같은 캐시를 동시에 만들어도 둘 다 살아남는다", async () => {
    const a = new CorpCodeResolver({ cacheDir, forceRefresh: true });
    const b = new CorpCodeResolver({ cacheDir, forceRefresh: true });

    const settled = await Promise.allSettled([a.init(fakeClient()), b.init(fakeClient())]);
    const failed = settled.filter((s) => s.status === "rejected");
    expect(
      failed.map((s) => String((s as PromiseRejectedResult).reason)),
    ).toEqual([]);

    for (const r of [a, b]) {
      expect(r.search("삼성전자")[0]?.corp_code).toBe("00126380");
    }
  });

  it("이미 완성된 캐시 위에 다시 만들어도 내용이 온전하다", async () => {
    const first = new CorpCodeResolver({ cacheDir, forceRefresh: true });
    await first.init(fakeClient());

    const second = new CorpCodeResolver({ cacheDir, forceRefresh: true });
    await second.init(fakeClient());

    expect(second.search("삼성전자")[0]?.corp_code).toBe("00126380");
    expect(second.search("당근마켓")[0]?.corp_code).toBe("01547845");
  });

  it("재생성 뒤 임시 파일을 남기지 않는다", async () => {
    const r = new CorpCodeResolver({ cacheDir, forceRefresh: true });
    await r.init(fakeClient());

    expect(existsSync(join(cacheDir, "corp_code.sqlite"))).toBe(true);
    expect(readdirSync(cacheDir).filter((f) => f.includes(".tmp-"))).toEqual([]);
  });
  it("교체에 실패해도 목적지에 쓸 수 있는 캐시가 있으면 그것을 쓴다", async () => {
    const first = new CorpCodeResolver({ cacheDir, forceRefresh: true });
    await first.init(fakeClient());

    // 다른 인스턴스가 먼저 교체해 목적지를 잡고 있는 상황.
    fsFailure.rename = true;

    const second = new CorpCodeResolver({ cacheDir, forceRefresh: true });
    await expect(second.init(fakeClient())).resolves.toBeUndefined();
    expect(second.search("삼성전자")[0]?.corp_code).toBe("00126380");
    expect(readdirSync(cacheDir).filter((f) => f.includes(".tmp-"))).toEqual([]);
  });

  it("교체에 실패했는데 쓸 수 있는 캐시도 없으면 조용히 넘어가지 않는다", async () => {
    // 권한·경로 문제로 교체가 막힌 경우다. 삼키면 빈 DB 를 열어 나중에
    // "no such table: corps" 로 엉뚱한 곳에서 터진다.
    fsFailure.rename = true;

    const r = new CorpCodeResolver({ cacheDir, forceRefresh: true });
    await expect(r.init(fakeClient())).rejects.toThrow(/EPERM/);
    expect(readdirSync(cacheDir).filter((f) => f.includes(".tmp-"))).toEqual([]);
  });
});
