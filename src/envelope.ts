export const SCHEMA_VERSION = 1;

export interface Envelope {
  schema_version: number;
  ok: boolean;
  error: { code: string; message: string; recovery: string } | null;
  data: unknown;
}

export function ok(data: unknown): Envelope {
  return { schema_version: SCHEMA_VERSION, ok: true, error: null, data };
}

export function fail(code: string, message: string, recovery: string): Envelope {
  return {
    schema_version: SCHEMA_VERSION,
    ok: false,
    error: { code, message, recovery },
    data: null,
  };
}

/** Thrown for a grammar mistake: printed as help on stderr with exit 2, never an envelope. */
export class UsageError extends Error {}
