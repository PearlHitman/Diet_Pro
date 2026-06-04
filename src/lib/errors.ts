// Shared error class for AI call failures.
// Lives here (not in claude.ts) so both claude.ts and backend.ts can import
// it without creating a circular dependency.

export class ClaudeError extends Error {
  constructor(
    message: string,
    public kind: 'auth' | 'rate' | 'network' | 'parse' | 'unknown',
  ) {
    super(message);
    this.name = 'ClaudeError';
  }
}
