import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
import { createContainer } from '../src/bootstrap.js';

const TOKEN = 'segredo-de-teste';
const { server } = createContainer(loadConfig({ dbFile: ':memory:', integrationToken: TOKEN, estoquistas: ['João', 'Maria'] }));
await new Promise((r) => server.listen(0, r));
const url = (p) => `http://127.0.0.1:${server.address().port}${p}`;
const post = (p, body, token = TOKEN) => fetch(url(p), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
test.after(() => server.close());

const pedido = { numero_pedido: '104582', vendedor: { nome: 'Carlos' }, cliente: { nome: 'Auto Peças Silva' }, condicao_pagamento: 'À vista - PIX', tipo_entrega: 'Balcão' };

test('webhook exige token', async () => {
  assert.equal((await post('/api/integracao/datacar/pedidos', pedido, 'errado')).status, 401);
});

test('webhook cria o pedido e é idempotente', async () => {
  const r1 = await (await post('/api/integracao/datacar/pedidos', pedido)).json();
  const r2 = await (await post('/api/integracao/datacar/pedidos', pedido)).json();
  assert.deepEqual([r1.created, r2.created, r2.duplicated], [1, 0, 1]);
  const { pedidos } = await (await fetch(url('/api/orders'))).json();
  assert.equal(pedidos.length, 1);
  assert.equal(pedidos[0].status, 'AG_PAG');
});

test('lote aceita pedidos bons e reporta os ruins', async () => {
  const r = await (await post('/api/integracao/datacar/pedidos', { pedidos: [{ ...pedido, numero_pedido: '200' }, { numero_pedido: '201' }] })).json();
  assert.equal(r.created, 1); assert.equal(r.errors.length, 1);
});

test('fluxo completo pela API (balcão)', async () => {
  const { pedidos } = await (await fetch(url('/api/orders'))).json();
  const id = pedidos.find(o => o.numero === '104582').id;
  const passo = async (acao, body = {}) => (await post(`/api/orders/${id}/${acao}`, body)).json();
  await passo('pagar');
  assert.equal((await post(`/api/orders/${id}/iniciar`, { estoquista: 'Fulano' })).status, 400); // fora da lista
  await passo('iniciar', { estoquista: 'joão' }); await passo('concluir');
  const fim = await passo('finalizar');
  assert.equal(fim.status, 'FIM'); assert.equal(fim.estoquista, 'João');
  assert.equal((await post(`/api/orders/${id}/finalizar`, {})).status, 409);
});
