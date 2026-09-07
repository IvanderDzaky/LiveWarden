export const postWebhook = async (url: string, secret: string, payload: unknown, timeoutMs: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
    return { status: response.status };
  } finally { clearTimeout(timer); }
};
