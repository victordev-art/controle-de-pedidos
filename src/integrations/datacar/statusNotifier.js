// Retorno opcional: avisa o DataCar a cada etapa concluída (separado, em rota, entregue...).
export function attachStatusNotifier({ service, cfg, log = console, fetchFn = fetch }) {
  if (!cfg.callbackUrl) return;
  service.on('order.updated', async (o, acao) => {
    if (o.source !== 'datacar') return;
    try {
      const res = await fetchFn(cfg.callbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(cfg.callbackToken && { Authorization: `Bearer ${cfg.callbackToken}` }) },
        body: JSON.stringify({ numero: o.numero, externalId: o.externalId, evento: acao, status: o.status, estoquista: o.estoquista, tempos: o.t }),
        signal: AbortSignal.timeout(10000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) { log.error(`[datacar] retorno de status falhou (pedido ${o.numero}): ${e.message}`); }
  });
}
