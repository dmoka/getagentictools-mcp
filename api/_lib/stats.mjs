/**
 * Ecosystem aggregates for the ecosystem_stats tool — the same measured
 * figures /stats publishes, computed from the loaded agent index at runtime.
 * Everything is derived from harvested metrics; nothing is estimated.
 */

export function ecosystemStats(entries) {
  const total = entries.length;
  const perCategory = {};
  for (const e of entries) perCategory[e.category] = (perCategory[e.category] || 0) + 1;

  const maintainers = new Set(
    entries.map((e) => (e.repo ? String(e.repo).split('/')[0].toLowerCase() : null)).filter(Boolean),
  ).size;

  const unlicensed = entries.filter((e) => !e.license).length;

  const starred = entries.map((e) => e.stars || 0).filter((s) => s > 0).sort((a, b) => b - a);
  const starSum = starred.reduce((a, b) => a + b, 0);
  const topOnePct = Math.max(1, Math.round(starred.length * 0.01));
  const topOnePctShare = starSum
    ? Math.round((starred.slice(0, topOnePct).reduce((a, b) => a + b, 0) / starSum) * 100)
    : 0;

  return {
    total,
    perCategory,
    maintainers,
    unlicensed,
    unlicensedPct: total ? Math.round((unlicensed / total) * 100) : 0,
    totalStars: starSum,
    medianStars: starred[Math.floor(starred.length / 2)] ?? 0,
    zeroStarPct: total ? Math.round(((total - starred.length) / total) * 100) : 0,
    topOnePctShare,
    methodology: 'https://getagentictools.com/stats?ref=mcp',
  };
}
