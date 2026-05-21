/**
 * Lightweight API client — no external CDN (fixes ES module load failures)
 */
export async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = { error: 'תשובה לא תקינה מהשרת' };
  }

  if (!res.ok) {
    throw new Error(data.error || `שגיאת שרת (${res.status})`);
  }

  return data;
}
