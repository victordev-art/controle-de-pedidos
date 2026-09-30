// Camada de APRESENTAÇÃO (API REST + página). Não contém regra de negócio.
import { readFile } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import * as Domain from '../domain/order.js';

const HTTP = { VALIDATION: 400, MAPPING: 422, NOT_FOUND: 404, CONFLICT: 409, TOO_BIG: 413 };

const dto = (o) => ({ ...o, statusLabel: Domain.rotuloStatus(o), tipoLabel: Domain.TIPOS[o.tipo],
  entregaLabel: Domain.SAIDAS[o.entrega], cronometros: Domain.cronometros(o) });

async function lerJson(req) {
  const partes = []; let total = 0;
  for await (const c of req) {
    total += c.length;
    if (total > 1_000_000) throw new Domain.DomainError('Corpo da requisição muito grande.', 'TOO_BIG');
    partes.push(c);
  }
  const txt = Buffer.concat(partes).toString('utf8');
  if (!txt) return {};
  try { return JSON.parse(txt); } catch { throw new Domain.DomainError('JSON inválido.'); }
}

function tokenValido(req, esperado) {
  const recebido = String((req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.headers['x-api-key'] || '');
  const a = Buffer.from(recebido), b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createApp({ service, ingestion, poller, config, publicDir, log = console }) {
  const rotas = [
    ['GET', /^\/api\/health$/, () => [200, { ok: true }]],

    // ENTRADA AUTOMÁTICA: o DataCar (ou middleware) envia o pedido aqui.
    ['POST', /^\/api\/integracao\/datacar\/pedidos$/, async (req) => {
      if (!config.integrationToken) return [503, { erro: 'INTEGRATION_TOKEN não configurado no servidor.' }];
      if (!tokenValido(req, config.integrationToken)) return [401, { erro: 'Token inválido.' }];
      const r = ingestion.ingest(await lerJson(req));
      return [r.errors.length && !r.created && !r.duplicated ? 422 : 200, r];
    }],
    ['GET', /^\/api\/integracao\/status$/, () => [200, poller.state]],

    ['GET', /^\/api\/estoquistas$/, () => [200, { estoquistas: config.estoquistas }]],
    ['GET', /^\/api\/orders$/, (req, m, url) => {
      const statuses = (url.searchParams.get('status') || '').split(',').filter(Boolean);
      return [200, { agora: Date.now(), pedidos: service.listar({ statuses }).map(dto) }];
    }],
    ['POST', /^\/api\/orders$/, async (req) => [201, dto(service.criarManual(await lerJson(req)))]],
    ['POST', /^\/api\/orders\/([\w-]+)\/(\w+)$/, async (req, m) => [200, dto(service.executar(m[1], m[2], await lerJson(req)))]]
  ];

  return async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const send = (code, data) => {
      const b = JSON.stringify(data);
      res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(b) });
      res.end(b);
    };
    try {
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(await readFile(path.join(publicDir, 'index.html')));
      }
      for (const [metodo, re, handler] of rotas) {
        const m = url.pathname.match(re);
        if (req.method === metodo && m) { const [code, data] = await handler(req, m, url); return send(code, data); }
      }
      send(404, { erro: 'Rota não encontrada.' });
    } catch (e) {
      if (e instanceof Domain.DomainError) return send(HTTP[e.code] ?? 400, { erro: e.message });
      log.error(e); send(500, { erro: 'Erro interno.' });
    }
  };
}
