// Repositório: única camada que conhece SQL. Trocar de banco = trocar este arquivo.
const toOrder = (r) => ({
  id: r.id, source: r.source, externalId: r.external_id, numero: r.numero, vendedor: r.vendedor,
  cliente: r.cliente, tipo: r.tipo, entrega: r.entrega, status: r.status, estoquista: r.estoquista,
  t: JSON.parse(r.t)
});

export function createOrderRepository(db) {
  const ins = db.prepare(`INSERT INTO orders (id, source, external_id, numero, vendedor, cliente, tipo,
    entrega, status, estoquista, t, raw, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const upd = db.prepare('UPDATE orders SET status = ?, estoquista = ?, t = ? WHERE id = ?');
  const byId = db.prepare('SELECT * FROM orders WHERE id = ?');
  const byExt = db.prepare('SELECT * FROM orders WHERE source = ? AND external_id = ?');
  const nextNum = db.prepare(`SELECT COALESCE(MAX(CAST(numero AS INTEGER)), 0) + 1 AS n FROM orders WHERE source = 'manual'`);

  return {
    insert(o, raw = null) {
      ins.run(o.id, o.source, o.externalId, o.numero, o.vendedor, o.cliente, o.tipo, o.entrega,
        o.status, o.estoquista, JSON.stringify(o.t), raw ? JSON.stringify(raw) : null, o.t.criado);
    },
    update(o) { upd.run(o.status, o.estoquista, JSON.stringify(o.t), o.id); },
    findById: (id) => { const r = byId.get(id); return r ? toOrder(r) : null; },
    findByExternal: (source, ext) => { const r = byExt.get(source, ext); return r ? toOrder(r) : null; },
    nextManualNumber: () => String(nextNum.get().n),
    list({ statuses = [], limit = 300 } = {}) {
      const where = statuses.length ? `WHERE status IN (${statuses.map(() => '?').join(',')})` : '';
      return db.prepare(`SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT ?`)
        .all(...statuses, limit).map(toOrder);
    }
  };
}
