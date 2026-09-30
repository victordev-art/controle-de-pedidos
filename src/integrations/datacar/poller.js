// Modo PULL: consulta o DataCar periodicamente. Como a ingestão é idempotente,
// repetir a consulta nunca duplica pedidos.
export function createPoller({ cfg, ingestion, log = console, fetchFn = fetch }) {
  const state = { enabled: Boolean(cfg.pollUrl), lastRun: null, lastOk: null, lastError: null, lastResult: null };
  const inicioDoDia = new Date().setHours(0, 0, 0, 0);
  let timer = null, running = false;

  async function run() {
    if (running) return;
    running = true; state.lastRun = Date.now();
    try {
      const since = encodeURIComponent(new Date(state.lastOk ?? inicioDoDia).toISOString());
      const res = await fetchFn(cfg.pollUrl.replace('{since}', since), {
        headers: { Accept: 'application/json', ...(cfg.pollToken && { Authorization: `Bearer ${cfg.pollToken}` }) },
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.lastResult = ingestion.ingest(await res.json());
      state.lastOk = Date.now(); state.lastError = null;
    } catch (e) {
      state.lastError = e.message; log.error(`[datacar] falha na consulta: ${e.message}`);
    } finally { running = false; }
  }

  return {
    state, run,
    start() { if (!state.enabled) return; run(); timer = setInterval(run, cfg.pollIntervalS * 1000); timer.unref?.(); },
    stop() { clearInterval(timer); }
  };
}
