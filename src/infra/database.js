// Camada de INFRAESTRUTURA: conexão SQLite (módulo nativo do Node, sem dependências).
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export function openDatabase(file) {
  if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      external_id TEXT,
      numero TEXT NOT NULL,
      vendedor TEXT NOT NULL,
      cliente TEXT NOT NULL,
      tipo TEXT NOT NULL,
      entrega TEXT NOT NULL,
      status TEXT NOT NULL,
      estoquista TEXT,
      t TEXT NOT NULL,
      raw TEXT,
      created_at INTEGER NOT NULL,
      UNIQUE (source, external_id)
    );
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
  `);
  return db;
}
