// Camada de APLICAÇÃO: casos de uso. Orquestra domínio + repositório e emite eventos.
import { EventEmitter } from 'node:events';
import * as Domain from '../domain/order.js';

export class OrderService extends EventEmitter {
  constructor({ repo, estoquistas = [], clock = Date.now }) { super(); this.repo = repo; this.estoquistas = estoquistas; this.clock = clock; }

  // Idempotente: o mesmo pedido (origem + id externo) nunca é criado duas vezes.
  receber(dados, raw = null) {
    if (dados.externalId) {
      const existente = this.repo.findByExternal(dados.source, dados.externalId);
      if (existente) return { order: existente, duplicated: true };
    }
    const order = Domain.criar(dados, this.clock());
    this.repo.insert(order, raw);
    this.emit('order.created', order);
    return { order, duplicated: false };
  }

  criarManual(d) {
    return this.receber({ ...d, source: 'manual', externalId: null, numero: d.numero || this.repo.nextManualNumber() }).order;
  }

  executar(id, acao, extra = {}) {
    const atual = this.repo.findById(id);
    if (!atual) throw new Domain.DomainError('Pedido não encontrado.', 'NOT_FOUND');
    if (acao === 'iniciar') extra = { ...extra, estoquista: this.#estoquistaDaLista(extra.estoquista) };
    const novo = Domain.aplicar(atual, acao, this.clock(), extra);
    this.repo.update(novo);
    this.emit('order.updated', novo, acao);
    return novo;
  }

  // O estoquista só pode ser escolhido da lista cadastrada (config/estoquistas.json).
  #estoquistaDaLista(nome) {
    if (!this.estoquistas.length) throw new Domain.DomainError('Nenhum estoquista cadastrado em config/estoquistas.json.');
    const achado = this.estoquistas.find((n) => n.toLowerCase() === String(nome ?? '').trim().toLowerCase());
    if (!achado) throw new Domain.DomainError('Selecione um estoquista da lista.');
    return achado;
  }

  listar(filtro) { return this.repo.list(filtro); }
}
