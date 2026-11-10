const windowMs = 60_000;
const maxRequests = 10;
/** Au-delà de ce nombre d'IP suivies simultanément, on force un balayage complet
 *  pour éviter une croissance mémoire non bornée (l'ancienne version ne purgeait
 *  jamais ses entrées → fuite mémoire sur un serveur de longue durée). */
const MAX_TRACKED = 10_000;

const hits = new Map<string, { count: number; resetAt: number }>();
let lastSweep = 0;

/** Supprime les entrées expirées. Balayage paresseux : au plus une fois par
 *  fenêtre, sauf dépassement du plafond d'IP suivies (balayage immédiat). */
function sweep(now: number): void {
  if (now - lastSweep < windowMs && hits.size < MAX_TRACKED) return;
  lastSweep = now;
  for (const [key, entry] of hits) {
    if (now >= entry.resetAt) hits.delete(key);
  }
}

export function checkRateLimit(ip: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  sweep(now);

  const entry = hits.get(ip);

  if (!entry || now >= entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true };
}
