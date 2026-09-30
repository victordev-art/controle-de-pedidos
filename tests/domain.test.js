import test from 'node:test';
import assert from 'node:assert/strict';
import { criar, aplicar, cronometros } from '../src/domain/order.js';
import { mapear } from '../src/integrations/datacar/mapper.js';
import { loadConfig } from '../src/config.js';

const base = { numero: '10', vendedor: 'Ana', cliente: 'Loja X', entrega: 'ENTREGA' };

test('pago na hora passa pelo caixa; faturado vai direto ao estoque', () => {
  assert.equal(criar({ ...base, tipo: 'PAGO' }, 0).status, 'AG_PAG');
  assert.equal(criar({ ...base, tipo: 'FATURADO' }, 0).status, 'AG_SEP');
});

test('fluxo de entrega registra todos os tempos', () => {
  let o = criar({ ...base, tipo: 'PAGO' }, 1000);
  o = aplicar(o, 'pagar', 2000);
  o = aplicar(o, 'iniciar', 3000, { estoquista: 'João' });
  o = aplicar(o, 'concluir', 5000);
  o = aplicar(o, 'sair', 9000);
  o = aplicar(o, 'finalizar', 12000);
  assert.equal(o.estoquista, 'João');
  assert.equal(o.status, 'FIM');
  assert.deepEqual(cronometros(o).map(c => c[0]), ['Na fila do estoque', 'Separação', 'Aguardando saída', 'Em rota']);
});

test('regras de bloqueio', () => {
  const o = criar({ ...base, tipo: 'FATURADO' }, 0);
  assert.throws(() => aplicar(o, 'iniciar', 1, {}), /estoquista/);
  assert.throws(() => aplicar(o, 'concluir', 1), /não permitida/);
});

test('mapper traduz payload do DataCar', () => {
  const { mapping } = loadConfig().datacar;
  const m = mapear({ numero_pedido: '77', vendedor: { nome: 'Carlos' }, cliente: { nome: 'Silva' }, condicao_pagamento: 'À vista - PIX', tipo_entrega: 'Entrega' }, mapping);
  assert.deepEqual([m.numero, m.vendedor, m.tipo, m.entrega], ['77', 'Carlos', 'PAGO', 'ENTREGA']);
  assert.equal(mapear({ numero_pedido: '78', vendedor: 'A', cliente: 'B', condicao_pagamento: 'Boleto 30 dias' }, mapping).tipo, 'FATURADO');
  assert.throws(() => mapear({ numero_pedido: '1' }, mapping), /ausentes/);
});
