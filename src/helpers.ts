/**
 * A helper function that returns an randomly generated UUID
 * @returns UUID
 */

export function newId(): string {
  // good enough for v1. Later you can switch to crypto.randomUUID().
  return (
    globalThis.crypto?.randomUUID?.() ?? `id_${Date.now()}_${Math.random()}`
  ).toString();
}
