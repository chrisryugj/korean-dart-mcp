import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { CorpCodeResolver } from "./corp-code.js";
import type { DartClient } from "./dart-client.js";

/**
 * DART 는 정기·임시 점검 때 corpCode.xml 요청에 ZIP 대신
 * `<status>800</status>` XML 을 돌려준다. 캐시 TTL 이 지난 상태에서 이 응답을 받아도
 * 서버가 죽지 않고, 만료된 캐시가 있으면 그것으로 계속 동작해야 한다.
 */

const MAINTENANCE = new Error(
  "DART corpCode.xml → 비-ZIP 응답 (175B): <result><status>800</status><message>시스템 점검으로 인한 서비스가 중지 중입니다.</message></result>",
);

function failingClient(): DartClient & { calls: number } {
  const c = {
    calls: 0,
    getZip: async () => {
      c.calls++;
      throw MAINTENANCE;
    },
  };
  return c as unknown as DartClient & { calls: number };
}

/** TTL 이 한참 지난 캐시를 직접 만든다. */
function writeStaleCache(cacheDir: string): void {
  const db = new Database(join(cacheDir, "corp_code.sqlite"));
  db.exec(`
    CREATE TABLE corps (corp_code TEXT PRIMARY KEY, corp_name TEXT NOT NULL,
      corp_eng_name TEXT, stock_code TEXT, modify_date TEXT);
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  db.prepare("INSERT INTO corps VALUES (?, ?, ?, ?, ?)").run(
    "00126380", "삼성전자", "SAMSUNG ELECTRONICS CO,.LTD", "005930", "20240101",
  );
  db.prepare("INSERT INTO meta VALUES ('updated_at', ?)").run("1000");
  db.close();
}

describe("CorpCodeResolver — 덤프 다운로드 실패", () => {
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = mkdtempSync(join(tmpdir(), "corp-code-initfail-"));
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(cacheDir, { recursive: true, force: true });
  });

  it("만료된 캐시가 있으면 그것으로 초기화한다", async () => {
    writeStaleCache(cacheDir);
    const resolver = new CorpCodeResolver({ cacheDir });
    await expect(resolver.init(failingClient())).resolves.toBeUndefined();
    expect(resolver.resolve("005930")?.corp_name).toBe("삼성전자");
  });

  it("캐시가 없으면 거부하되, 다음 호출에서 다시 시도한다", async () => {
    const client = failingClient();
    const resolver = new CorpCodeResolver({ cacheDir });
    await expect(resolver.init(client)).rejects.toThrow("status>800");
    await expect(resolver.init(client)).rejects.toThrow("status>800");
    expect(client.calls).toBe(2);
  });

  it("corps 테이블이 비어 있으면 원래 오류를 올린다", async () => {
    writeStaleCache(cacheDir);
    const db = new Database(join(cacheDir, "corp_code.sqlite"));
    db.exec("DELETE FROM corps");
    db.close();
    const resolver = new CorpCodeResolver({ cacheDir });
    await expect(resolver.init(failingClient())).rejects.toThrow("status>800");
  });

  it("캐시가 깨져 있으면 원래 오류를 올린다", async () => {
    const db = new Database(join(cacheDir, "corp_code.sqlite"));
    db.exec("CREATE TABLE unrelated (x INTEGER)");
    db.close();
    const resolver = new CorpCodeResolver({ cacheDir });
    await expect(resolver.init(failingClient())).rejects.toThrow("status>800");
  });
});
