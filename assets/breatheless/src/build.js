/**
 * What to do when the running build and the deployed build disagree.
 *
 * A free function, not a condition buried in a startup handler, because the
 * last policy that lived inside a listener (`shouldGrabPointer`) was unreachable
 * from every harness and a phone had to find the bug. This one guards against a
 * failure that is invisible from inside the game -- a cached module makes old
 * code and broken code look identical.
 *
 * `edgeStale` is what makes the difference between useful advice and useless
 * advice. Staleness upstream of the browser cannot be cleared from inside the
 * browser: reloading re-requests the same URL, the CDN serves the same old copy,
 * and the only thing achieved is throwing away caches that were not the problem.
 * Telling someone to clear their site data in that situation sends them to do
 * work that cannot possibly help.
 *
 * @param running    the id compiled into the entry module
 * @param served     the id the origin reports, or undefined if unknown
 * @param tries      how many automatic recoveries have already been attempted
 * @param edgeStale  true when the CDN is serving something older than the origin
 * @returns 'ok'     nothing to do
 *          'reload' clear caches and reload -- worth one attempt
 *          'warn'   reloading cannot help; say what actually will
 */
export function staleAction(running, served, tries = 0, edgeStale = false) {
  // 'dev' is an unstamped checkout. Nothing was deployed, so nothing can be
  // stale, and a developer editing files must never be nagged or reloaded.
  if (!running || running === 'dev') return 'ok';
  // No answer from the server is not evidence of staleness: offline, a local
  // file:// load, or a harness with no version.json all land here.
  if (!served) return 'ok';
  if (served === running) return 'ok';
  // Nothing local is wrong, so do not spend a reload proving it.
  if (edgeStale) return 'warn';
  // One automatic recovery only. A server whose id never matches -- a broken
  // deploy, a proxy rewriting responses -- would otherwise reload forever.
  return tries < 1 ? 'reload' : 'warn';
}
