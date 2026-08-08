export type DomainOk<T> = { ok: true; data: T; status?: number };
export type DomainErr = { ok: false; error: string; status: number; data?: unknown };
export type DomainResult<T> = DomainOk<T> | DomainErr;

export function ok<T>(data: T, status = 200): DomainOk<T> {
  return { ok: true, data, status };
}

export function err(error: string, status = 400, data?: unknown): DomainErr {
  return { ok: false, error, status, data };
}
