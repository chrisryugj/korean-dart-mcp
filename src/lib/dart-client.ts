/**
 * OpenDART HTTP 클라이언트
 *
 * Base: https://opendart.fss.or.kr/api/
 * 인증: 모든 요청에 `crtfc_key` 쿼리파라미터 필수
 * 응답: JSON (대부분) / ZIP (원문·corp_code·XBRL)
 * 요율: 일 20,000건 (키 단위 합산)
 */

const DART_BASE_URL = "https://opendart.fss.or.kr/api";

export interface DartClientOptions {
  apiKey: string;
  /** 요청 타임아웃 (ms), 기본 30s */
  timeout?: number;
}

export class DartClient {
  private readonly apiKey: string;
  private readonly timeout: number;

  constructor(opts: DartClientOptions) {
    this.apiKey = opts.apiKey;
    this.timeout = opts.timeout ?? 30_000;
  }

  /** JSON 엔드포인트 호출 */
  async getJson<T = unknown>(
    path: string,
    params: Record<string, string | number | undefined> = {},
  ): Promise<T> {
    const url = this.buildUrl(path, params);
    const res = await this.fetch(url);
    if (!res.ok) {
      throw new Error(`DART ${path} → HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  }

  /** ZIP 엔드포인트 호출 (corp_code 덤프, 원문 XML, XBRL 등) */
  async getZip(
    path: string,
    params: Record<string, string | number | undefined> = {},
  ): Promise<Buffer> {
    const url = this.buildUrl(path, params);
    const res = await this.fetch(url);
    if (!res.ok) {
      throw new Error(`DART ${path} → HTTP ${res.status}`);
    }
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }

  private buildUrl(
    path: string,
    params: Record<string, string | number | undefined>,
  ): string {
    const u = new URL(`${DART_BASE_URL}/${path}`);
    u.searchParams.set("crtfc_key", this.apiKey);
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === "") continue;
      u.searchParams.set(k, String(v));
    }
    return u.toString();
  }

  private async fetch(url: string): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeout);
    try {
      return await fetch(url, { signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}
