/**
 * corp_code 리졸버
 *
 * 문제: LLM은 "삼성전자" 만 아는데, 모든 OpenDART 엔드포인트는 8자리 corp_code 필수.
 * 해결: 서버 기동 시 `corpCode.xml` 전체 덤프를 내려받아 SQLite 로 인덱싱.
 *       첫 호출 시 한 번만 받고, 이후는 캐시 디렉터리에서 재사용 (24h TTL).
 *
 * 엔드포인트: /api/corpCode.xml  (ZIP → CORPCODE.xml)
 * 레코드 형식: <list><corp_code>...</corp_code><corp_name>...</corp_name>
 *              <corp_eng_name>...</corp_eng_name><stock_code>...</stock_code>
 *              <modify_date>...</modify_date></list>
 */

import { mkdirSync, existsSync, unlinkSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { DOMParser } from "@xmldom/xmldom";
import type { DartClient } from "./dart-client.js";
import { safeUnzipToMemory } from "../utils/safe-zip.js";

export interface CorpRecord {
  corp_code: string;
  corp_name: string;
  corp_eng_name?: string;
  stock_code?: string;
  modify_date?: string;
}

export interface CorpCodeResolverOptions {
  /** 캐시 디렉터리 (기본: ~/.korean-dart-mcp) */
  cacheDir?: string;
  /** 디스크 캐시를 무시하고 재다운로드 */
  forceRefresh?: boolean;
  /** 캐시 TTL (ms, 기본 24h) */
  ttlMs?: number;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const CORP_CODE_RE = /^\d{8}$/;
const STOCK_CODE_RE = /^\d{6}$/;

// 영문 corp_name 으로 등록된 한국 상장사 — 한글 query 로 LIKE 매칭이 안 되어
// 자회사로 잘못 resolve 되는 케이스 방어. corp_code 는 OpenDART corpCode.xml 검증 필요.
// "현대차" 같은 약어도 자회사 우선 정렬되는 케이스라 alias 에 포함.
const KOREAN_ALIAS: Record<string, string> = {
  네이버: "00266961", // NAVER
  현대차: "00164742", // 현대자동차
};

export class CorpCodeResolver {
  private readonly cacheDir: string;
  private readonly dbPath: string;
  private readonly forceRefresh: boolean;
  private readonly ttlMs: number;
  private db: Database.Database | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(opts: CorpCodeResolverOptions = {}) {
    this.cacheDir = opts.cacheDir ?? join(homedir(), ".korean-dart-mcp");
    this.dbPath = join(this.cacheDir, "corp_code.sqlite");
    this.forceRefresh = opts.forceRefresh ?? false;
    this.ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
  }

  /** 서버 기동 시 1회 호출. 캐시 유효하면 DB만 열고 끝. */
  async init(client: DartClient): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doInit(client);
    return this.initPromise;
  }

  private async doInit(client: DartClient): Promise<void> {
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }

    const cacheFresh = !this.forceRefresh && this.isCacheFresh();
    if (cacheFresh) {
      this.db = new Database(this.dbPath, { readonly: false });
      return;
    }

    console.error("[corp-code] 덤프 다운로드 중... (수 초 소요)");
    const zipBuf = await client.getZip("corpCode.xml");
    const xml = await extractCorpCodeXml(zipBuf);
    const records = parseCorpCodeXml(xml);
    console.error(`[corp-code] ${records.length}개 회사 적재 중...`);
    this.db = buildDatabase(this.dbPath, records);
    console.error("[corp-code] 준비 완료");
  }

  private isCacheFresh(): boolean {
    if (!existsSync(this.dbPath)) return false;
    try {
      const db = new Database(this.dbPath, { readonly: true });
      const row = db
        .prepare("SELECT value FROM meta WHERE key = 'updated_at'")
        .get() as { value: string } | undefined;
      db.close();
      if (!row) return false;
      const age = Date.now() - Number(row.value);
      return age < this.ttlMs;
    } catch {
      return false;
    }
  }

  /** 키워드로 회사 검색. alias → 상장사 → 완전일치 → 접두사 → 짧은 이름 → 낮은 종목코드 순. */
  search(keyword: string, limit = 10): CorpRecord[] {
    const db = this.requireDb();
    const k = keyword.trim();
    if (!k) return [];

    // 1. 한글 alias 우선: 영문등록 한국 상장사가 LIKE 매칭에서 누락되는 케이스 방어
    const aliasCode = KOREAN_ALIAS[k];
    let aliased: CorpRecord | undefined;
    if (aliasCode) aliased = this.byCorpCode(aliasCode);

    // 2. 일반 LIKE 검색. 동률 정렬 시 stock_code ASC 추가 (낮은 종목코드 = 오래된 대형사 휴리스틱).
    const like = `%${k}%`;
    const rows = db
      .prepare(
        `SELECT corp_code, corp_name, corp_eng_name, stock_code, modify_date
         FROM corps
         WHERE corp_name LIKE ?
            OR corp_eng_name LIKE ?
         ORDER BY
           (stock_code IS NULL OR stock_code = '') ASC,
           CASE WHEN corp_name = ? THEN 0
                WHEN corp_name LIKE ? THEN 1
                ELSE 2 END,
           length(corp_name) ASC,
           CASE WHEN stock_code IS NULL OR stock_code = '' THEN 1 ELSE 0 END,
           stock_code ASC
         LIMIT ?`,
      )
      .all(like, like, k, `${k}%`, limit) as CorpRecord[];
    const normalized = rows.map(normalize);

    // alias 결과를 1위로 prepend (중복 제거)
    if (aliased) {
      const others = normalized.filter((r) => r.corp_code !== aliased!.corp_code);
      return [aliased, ...others].slice(0, limit);
    }
    return normalized;
  }

  byStockCode(code: string): CorpRecord | undefined {
    const db = this.requireDb();
    const row = db
      .prepare(
        `SELECT corp_code, corp_name, corp_eng_name, stock_code, modify_date
         FROM corps WHERE stock_code = ? LIMIT 1`,
      )
      .get(code) as CorpRecord | undefined;
    return row ? normalize(row) : undefined;
  }

  byCorpCode(code: string): CorpRecord | undefined {
    const db = this.requireDb();
    const row = db
      .prepare(
        `SELECT corp_code, corp_name, corp_eng_name, stock_code, modify_date
         FROM corps WHERE corp_code = ? LIMIT 1`,
      )
      .get(code) as CorpRecord | undefined;
    return row ? normalize(row) : undefined;
  }

  /**
   * 입력 문자열을 단일 corp_code 로 해석.
   *  - 8자리 숫자 → byCorpCode
   *  - 6자리 숫자 → byStockCode
   *  - 그 외 → search() 상위 1건
   */
  resolve(input: string): CorpRecord | undefined {
    const s = input.trim();
    if (CORP_CODE_RE.test(s)) return this.byCorpCode(s);
    if (STOCK_CODE_RE.test(s)) return this.byStockCode(s);
    return this.search(s, 1)[0];
  }

  private requireDb(): Database.Database {
    if (!this.db) {
      throw new Error("CorpCodeResolver.init() 을 먼저 호출하세요.");
    }
    return this.db;
  }
}

function normalize(row: CorpRecord): CorpRecord {
  return {
    corp_code: row.corp_code,
    corp_name: row.corp_name,
    corp_eng_name: row.corp_eng_name || undefined,
    stock_code: row.stock_code && row.stock_code.trim() !== "" ? row.stock_code : undefined,
    modify_date: row.modify_date || undefined,
  };
}

async function extractCorpCodeXml(zipBuf: Buffer): Promise<string> {
  // corp_code 전량 덤프는 현재 ~30MB 수준. 장기 성장 대비 총 300MB · 단일 300MB 허용.
  const entries = await safeUnzipToMemory(zipBuf, {
    maxTotalBytes: 300 * 1024 * 1024,
    maxEntryBytes: 300 * 1024 * 1024,
    maxEntries: 16,
    filter: (name) => /CORPCODE\.xml$/i.test(name),
  });
  const hit = entries[0];
  if (!hit) throw new Error("CORPCODE.xml not found in zip");
  return hit.data.toString("utf8");
}

function parseCorpCodeXml(xml: string): CorpRecord[] {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const listEls = doc.getElementsByTagName("list");
  const out: CorpRecord[] = [];
  for (let i = 0; i < listEls.length; i++) {
    const el = listEls[i];
    const code = text(el, "corp_code");
    const name = text(el, "corp_name");
    if (!code || !name) continue;
    out.push({
      corp_code: code,
      corp_name: name,
      corp_eng_name: text(el, "corp_eng_name") || undefined,
      stock_code: text(el, "stock_code") || undefined,
      modify_date: text(el, "modify_date") || undefined,
    });
  }
  return out;
}

// xmldom 의 Element 타입을 직접 쓰지 않고 duck-typing 으로 접근.
// DOM lib 을 tsconfig 에 포함시키지 않아 전역 Element 가 없음.
function text(parent: { getElementsByTagName(tag: string): { length: number; [i: number]: { textContent: string | null } } }, tag: string): string {
  const t = parent.getElementsByTagName(tag)[0]?.textContent ?? "";
  return t.trim();
}

/** 실패해도 무시하는 삭제 — 임시 파일 정리와 옛 판본이 남긴 WAL 사이드카 청소에만 쓴다. */
function discard(path: string): void {
  try {
    if (existsSync(path)) unlinkSync(path);
  } catch {
    /* 다른 프로세스가 잡고 있으면 그대로 둔다 */
  }
}

/**
 * 캐시 DB 를 새로 만든다.
 *
 * 목적지에 바로 쓰지 않고 임시 파일에 완성한 뒤 원자적으로 옮긴다. MCP 서버는 여러 개가
 * 동시에 뜰 수 있고(클라이언트에 따라 기동 때마다 두 개를 띄운다), 그 인스턴스들이 같은
 * 캐시 디렉터리를 공유한다. 목적지에서 바로 작업하면 두 인스턴스가 같은 파일을 두고 다투다
 * 한쪽이 SqliteError 로 죽고, 그 예외가 프로세스를 통째로 내려 서버 연결이 끊긴다.
 * 교체에서 지더라도 상대가 만들어 둔 DB 가 같은 덤프에서 나온 것이므로 그대로 쓴다.
 */
function buildDatabase(path: string, records: CorpRecord[]): Database.Database {
  const tmpPath = `${path}.tmp-${process.pid}-${Date.now()}`;
  const db = new Database(tmpPath);
  // WAL 을 쓰지 않는다 — 사이드카가 없어야 교체가 파일 하나로 끝난다.
  db.pragma("journal_mode = DELETE");
  db.exec(`
    CREATE TABLE corps (
      corp_code TEXT PRIMARY KEY,
      corp_name TEXT NOT NULL,
      corp_eng_name TEXT,
      stock_code TEXT,
      modify_date TEXT
    );
    CREATE INDEX idx_corps_name ON corps(corp_name);
    CREATE INDEX idx_corps_stock ON corps(stock_code) WHERE stock_code IS NOT NULL AND stock_code != '';
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  const insert = db.prepare(
    `INSERT OR REPLACE INTO corps (corp_code, corp_name, corp_eng_name, stock_code, modify_date)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const tx = db.transaction((items: CorpRecord[]) => {
    for (const r of items) {
      insert.run(
        r.corp_code,
        r.corp_name,
        r.corp_eng_name ?? null,
        r.stock_code ?? null,
        r.modify_date ?? null,
      );
    }
  });
  try {
    tx(records);
    db.prepare("INSERT OR REPLACE INTO meta(key, value) VALUES('updated_at', ?)").run(
      String(Date.now()),
    );
    db.prepare("INSERT OR REPLACE INTO meta(key, value) VALUES('count', ?)").run(
      String(records.length),
    );
    db.close();
  } catch (err) {
    try {
      db.close();
    } catch {
      /* 이미 닫혔다 */
    }
    discard(tmpPath);
    throw err;
  }

  try {
    renameSync(tmpPath, path);
    // 옛 판본이 WAL 로 만들어 두고 간 사이드카를 걷어낸다.
    discard(`${path}-wal`);
    discard(`${path}-shm`);
  } catch {
    // 다른 인스턴스가 먼저 교체해 파일을 잡고 있다 — 같은 덤프에서 나왔으니 그쪽 결과를 쓴다.
    discard(tmpPath);
  }
  return new Database(path);
}
