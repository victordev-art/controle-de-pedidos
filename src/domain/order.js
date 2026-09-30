// Camada de DOMÍNIO: regras de negócio puras (sem banco, sem HTTP).
import { randomUUID } from 'node:crypto';

export class DomainError extends Error {
  constructor(message, code = 'VALIDATION') { super(message); this.code = code; }
}

export const TIPOS = { FATURADO: 'Faturado (PA)', PAGO: 'Pago na hora' };
export const SAIDAS = { BALCAO: 'Balcão', ENTREGA: 'Entrega' };

export const rotuloStatus = (o) => ({
  AG_PAG: 'Aguardando pagamento no caixa',
  AG_SEP: 'Aguardando separação',
  SEP: 'Em separação',
  PRONTO: o.entrega === 'BALCAO' ? 'Aguardando retirada' : 'Aguardando saída',
  ROTA: 'Em rota',
  FIM: o.entrega === 'BALCAO' ? 'Retirado' : 'Entregue'
})[o.status];

export function criar(d, now) {
  for (const k of ['numero', 'vendedor', 'cliente'])
    if (!String(d[k] ?? '').trim()) throw new DomainError(`Campo obrigatório: ${k}.`);
  if (!TIPOS[d.tipo]) throw new DomainError('Tipo de pedido inválido.');
  if (!SAIDAS[d.entrega]) throw new DomainError('Tipo de saída inválido.');
  const pagoNaHora = d.tipo === 'PAGO';
  return {
    id: randomUUID(), source: d.source ?? 'manual', externalId: d.externalId ?? null,
    numero: String(d.numero).trim(), vendedor: String(d.vendedor).trim(), cliente: String(d.cliente).trim(),
    tipo: d.tipo, entrega: d.entrega, estoquista: null,
    status: pagoNaHora ? 'AG_PAG' : 'AG_SEP',
    t: { criado: now, pago: pagoNaHora ? null : now }
  };
}

// Máquina de estados: ação -> (pré-condição, novo status, campo de data que registra o momento)
const TRANSICOES = {
  pagar:     { ok: (o) => o.status === 'AG_PAG', para: 'AG_SEP', campo: 'pago' },
  iniciar:   { ok: (o) => o.status === 'AG_SEP', para: 'SEP', campo: 'sepIni' },
  concluir:  { ok: (o) => o.status === 'SEP', para: 'PRONTO', campo: 'sepFim' },
  sair:      { ok: (o) => o.status === 'PRONTO' && o.entrega === 'ENTREGA', para: 'ROTA', campo: 'rota' },
  finalizar: { ok: (o) => (o.status === 'PRONTO' && o.entrega === 'BALCAO') || o.status === 'ROTA', para: 'FIM', campo: 'fim' }
};

export function aplicar(o, acao, now, extra = {}) {
  const tr = TRANSICOES[acao];
  if (!tr) throw new DomainError(`Ação desconhecida: ${acao}.`);
  if (!tr.ok(o)) throw new DomainError('Ação não permitida no status atual do pedido.', 'CONFLICT');
  let estoquista = o.estoquista;
  if (acao === 'iniciar') {
    estoquista = String(extra.estoquista ?? '').trim();
    if (!estoquista) throw new DomainError('Informe o nome do estoquista.');
  }
  return { ...o, estoquista, status: tr.para, t: { ...o.t, [tr.campo]: now } };
}

// Cronômetros: [rótulo, início, fim]. fim = null significa "ainda correndo".
export function cronometros(o) {
  const { t } = o, r = [];
  if (o.status === 'AG_PAG') return [['No caixa', t.criado, null]];
  r.push(['Na fila do estoque', t.pago ?? t.criado, t.sepIni ?? null]);
  if (t.sepIni) r.push(['Separação', t.sepIni, t.sepFim ?? null]);
  if (t.sepFim) {
    if (o.entrega === 'BALCAO') r.push(['Aguardando retirada', t.sepFim, t.fim ?? null]);
    else {
      r.push(['Aguardando saída', t.sepFim, t.rota ?? null]);
      if (t.rota) r.push(['Em rota', t.rota, t.fim ?? null]);
    }
  }
  return r;
}
