export class TelegramError extends Error {
  constructor(method, code, retryAfter = 0) {
    // A URL da requisição contém o token. Nunca propagar erros nativos ou a URL.
    super(`Telegram: falha em ${method} (código ${code}).`);
    this.code = code;
    this.retryAfter = retryAfter;
  }
}
export function createTelegram(token, { fetchImpl = fetch, signal } = {}) {
  const methods = new Set(['getMe','getWebhookInfo','getUpdates','sendMessage','answerCallbackQuery','setMyCommands','setWebhook','deleteWebhook']);
  return async (method, payload = {}) => {
    if (!methods.has(method)) throw new Error('Método Telegram não permitido.');
    let response, body;
    try {
      response = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(40000)]) : AbortSignal.timeout(40000)
      });
      body = await response.json();
    } catch { throw new TelegramError(method, 'rede'); }
    if (!response.ok || !body.ok) throw new TelegramError(method, body.error_code || response.status, body.parameters?.retry_after || 0);
    return body.result;
  };
}
