/** 0: no failing findings. 1: findings at the failing level. 2: a usage or config problem. */
export const EXIT_CODES = { ok: 0, findings: 1, setup: 2 } as const;
