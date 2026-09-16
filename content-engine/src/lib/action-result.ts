/** 서버 액션 공통 결과 타입 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}
export function fail<T = undefined>(error: string, fieldErrors?: Record<string, string[]>): ActionResult<T> {
  return { ok: false, error, fieldErrors };
}
