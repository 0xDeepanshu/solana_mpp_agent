/**
 * matchStore.ts
 *
 * Shared in-memory store for match counts, keyed by wallet public key.
 * Lives at module scope so it survives across requests in the same process.
 *
 * Keys:   wallet public key (base58 string)
 * Values: number of completed matches
 */

export const matchStore = new Map<string, number>()
