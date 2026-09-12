export async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const body = await fetchText(url, init);
  return (body ? JSON.parse(body) : undefined) as T;
}
