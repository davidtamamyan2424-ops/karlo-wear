const memory = new Map<string,string>();
export function saveOrderAccess(id: string, token: string) {
  memory.set(id, token);
  try { localStorage.setItem('karlo-order-' + id, token); } catch { /* Current tab retains access. */ }
}
export function orderAccess(id: string): string | undefined {
  const params = new URLSearchParams(location.hash.slice(1));
  const fromLink = params.get('access');
  if (fromLink && /^[a-f0-9]{64}$/.test(fromLink)) {
    saveOrderAccess(id, fromLink);
    history.replaceState(null,'', location.pathname + location.search);
  }
  try { return memory.get(id) ?? localStorage.getItem('karlo-order-' + id) ?? undefined; } catch { return memory.get(id); }
}
