// A domain failure: something the caller asked for that cannot be done, as opposed to a bug.
// The CLI renders these as ok:false envelopes with exit 1; a usage fault never reaches here.
export class SoundsError extends Error {
  readonly code: string;
  readonly recovery: string;

  constructor(code: string, message: string, recovery: string) {
    super(message);
    this.name = "SoundsError";
    this.code = code;
    this.recovery = recovery;
  }
}
