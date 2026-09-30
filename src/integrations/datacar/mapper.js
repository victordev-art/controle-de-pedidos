// Camada anticorrupção: traduz o formato do DataCar para o modelo interno.
// Os nomes dos campos ficam em config/datacar.mapping.json — sem mexer em código.
import { DomainError } from '../../domain/order.js';

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const pick = (obj, paths = []) => {
  for (const p of paths) {
    const v = p.split('.').reduce((a, k) => a?.[k], obj);
    if (v !== undefined && v !== null && typeof v !== 'object' && String(v).trim() !== '') return String(v).trim();
  }
  return '';
};

export function extrairItens(body, map) {
  if (Array.isArray(body)) return body;
  for (const k of map.listaEm ?? []) if (Array.isArray(body?.[k])) return body[k];
  return [body];
}

export function mapear(raw, map, source = 'datacar') {
  const numero = pick(raw, map.numero), vendedor = pick(raw, map.vendedor), cliente = pick(raw, map.cliente);
  const faltando = Object.entries({ numero, vendedor, cliente }).filter(([, v]) => !v).map(([k]) => k);
  if (faltando.length) throw new DomainError(`Campos ausentes no payload: ${faltando.join(', ')}.`, 'MAPPING');
  const contem = (texto, palavras) => palavras.some((p) => texto.includes(norm(p)));
  return {
    source, externalId: pick(raw, map.externalId) || numero, numero, vendedor, cliente,
    tipo: contem(norm(pick(raw, map.pagamento)), map.regras.pagoNaHora) ? 'PAGO' : 'FATURADO',
    entrega: contem(norm(pick(raw, map.entrega)), map.regras.entrega) ? 'ENTREGA' : 'BALCAO'
  };
}
