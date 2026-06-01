/** Cliente browser → proxy Next.js (evita exponer API key en el cliente). */
export async function callWyscoutApi<T>(
  action: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const response = await fetch('/api/wyscout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params }),
  });
  const payload = await response.json();
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error ?? `Wyscout API error (${response.status})`);
  }
  return payload as T;
}
