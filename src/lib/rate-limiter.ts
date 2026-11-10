const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 10;
/** Au-delà de ce nombre d'IP suivies simultanément, on force un balayage complet
 *  pour éviter une croissance mémoire non bornée (l'ancienne version ne purgeait
 *  jamais ses entrées → fuite mémoire sur un serveur de longue durée). */
const MAX_TRACKED = 10_000;

const hits = new Map<string, { count: number; resetAt: number }>();
let lastSweep = 0;

/** Supprime les entrées expirées. Balayage paresseux : au plus une fois par
 *  fenêtre par défaut, sauf dépassement du plafond d'IP suivies (balayage
 *  immédiat). Chaque entrée porte sa propre échéance (`resetAt`). */
function sweep(now: number): void {
  if (now - lastSweep < DEFAULT_WINDOW_MS && hits.size < MAX_TRACKED) return;
  lastSweep = now;
  for (const [key, entry] of hits) {
    if (now >= entry.resetAt) hits.delete(key);
  }
}

/** Limiteur en mémoire à fenêtre fixe. `key` = IP, éventuellement préfixée par
 *  la route (ex. `pdf:1.2.3.4`) pour un quota séparé. Défauts : 10 / 60 s. */
export function checkRateLimit(
  key: string,
  opts: { max?: number; windowMs?: number } = {},
): { allowed: boolean; retryAfterMs?: number } {
  const max = opts.max ?? DEFAULT_MAX_REQUESTS;
  const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
  const now = Date.now();
  sweep(now);

  const entry = hits.get(key);

  if (!entry || now >= entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (entry.count >= max) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true };
}
