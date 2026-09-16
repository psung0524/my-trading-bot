import { threadsBodySchema } from "@/lib/schemas/content";
import { PublishError, type PublisherProvider, type PublishInput, type PublishResult } from "./types";

const API = "https://graph.threads.net/v1.0";

/**
 * Threads 공식 API (Meta Graph). 흐름: 컨테이너 생성(POST /{user}/threads) → 게시(POST /{user}/threads_publish).
 * 계정의 accessToken(복호화됨)과 externalId(threads user id)가 필요하다.
 */
export class ThreadsPublisher implements PublisherProvider {
  readonly channel = "THREADS" as const;
  readonly name = "threads";
  isConfigured(account: PublishInput["account"]) {
    return Boolean(account?.accessToken && account?.externalId && account.provider === "threads");
  }
  async publish(input: PublishInput): Promise<PublishResult> {
    const acct = input.account;
    if (!this.isConfigured(acct) || !acct) throw new PublishError("Threads 계정이 연결되지 않았습니다", false);
    const body = threadsBodySchema.parse(input.body);
    const params = new URLSearchParams({ media_type: "TEXT", text: body.text, access_token: acct.accessToken! });
    input.log("Threads 컨테이너 생성");
    const c = await fetch(`${API}/${acct.externalId}/threads`, { method: "POST", body: params });
    const cj = (await c.json()) as { id?: string; error?: { message?: string; code?: number } };
    if (!c.ok || !cj.id) throw new PublishError(`Threads 컨테이너 실패: ${cj.error?.message ?? c.status}`, c.status >= 500 || c.status === 429);
    input.log(`컨테이너 ${cj.id} 게시`);
    const p = await fetch(`${API}/${acct.externalId}/threads_publish`, { method: "POST", body: new URLSearchParams({ creation_id: cj.id, access_token: acct.accessToken! }) });
    const pj = (await p.json()) as { id?: string; error?: { message?: string } };
    if (!p.ok || !pj.id) throw new PublishError(`Threads 게시 실패: ${pj.error?.message ?? p.status}`, p.status >= 500 || p.status === 429);
    let permalink = "";
    try {
      const info = await fetch(`${API}/${pj.id}?fields=permalink&access_token=${encodeURIComponent(acct.accessToken!)}`);
      permalink = ((await info.json()) as { permalink?: string }).permalink ?? "";
    } catch {
      /* permalink 조회 실패는 무시 */
    }
    return { externalId: pj.id, externalUrl: permalink || `https://www.threads.net/post/${pj.id}`, raw: pj };
  }
}

/** 장기 토큰 갱신 (60일). 만료 7일 전부터 갱신 */
export async function refreshThreadsToken(accessToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await fetch(`${API.replace("/v1.0", "")}/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(accessToken)}`);
  const j = (await res.json()) as { access_token?: string; expires_in?: number; error?: { message?: string } };
  if (!res.ok || !j.access_token) throw new Error(`토큰 갱신 실패: ${j.error?.message ?? res.status}`);
  return { accessToken: j.access_token, expiresAt: new Date(Date.now() + (j.expires_in ?? 5184000) * 1000) };
}

export function threadsAuthorizeUrl(appId: string, redirectUri: string, state: string) {
  const u = new URL("https://threads.net/oauth/authorize");
  u.searchParams.set("client_id", appId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("scope", "threads_basic,threads_content_publish");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("state", state);
  return u.toString();
}

export async function exchangeThreadsCode(appId: string, appSecret: string, redirectUri: string, code: string) {
  const short = await fetch(`${API.replace("/v1.0", "")}/oauth/access_token`, { method: "POST", body: new URLSearchParams({ client_id: appId, client_secret: appSecret, grant_type: "authorization_code", redirect_uri: redirectUri, code }) });
  const sj = (await short.json()) as { access_token?: string; user_id?: string; error_message?: string };
  if (!short.ok || !sj.access_token) throw new Error(`토큰 교환 실패: ${sj.error_message ?? short.status}`);
  const long = await fetch(`${API.replace("/v1.0", "")}/access_token?grant_type=th_exchange_token&client_secret=${encodeURIComponent(appSecret)}&access_token=${encodeURIComponent(sj.access_token)}`);
  const lj = (await long.json()) as { access_token?: string; expires_in?: number };
  const token = lj.access_token ?? sj.access_token;
  const expiresAt = new Date(Date.now() + (lj.expires_in ?? 3600) * 1000);
  const me = await fetch(`${API}/me?fields=id,username&access_token=${encodeURIComponent(token)}`);
  const mj = (await me.json()) as { id?: string; username?: string };
  return { accessToken: token, expiresAt, userId: String(sj.user_id ?? mj.id ?? ""), username: mj.username ?? "" };
}
