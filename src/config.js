import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(path.join(ROOT, '.env'))) process.loadEnvFile(path.join(ROOT, '.env'));

export function loadConfig(overrides = {}) {
  const env = process.env;
  return {
    port: Number(env.PORT || 3000),
    dbFile: env.DB_FILE || path.join(ROOT, 'data', 'pedidos.db'),
    estoquistas: JSON.parse(readFileSync(path.join(ROOT, 'config', 'estoquistas.json'), 'utf8')),
    integrationToken: env.INTEGRATION_TOKEN || '',
    datacar: {
      pollUrl: env.DATACAR_POLL_URL || '',
      pollToken: env.DATACAR_POLL_TOKEN || '',
      pollIntervalS: Number(env.DATACAR_POLL_INTERVAL_S || 30),
      callbackUrl: env.DATACAR_STATUS_CALLBACK_URL || '',
      callbackToken: env.DATACAR_STATUS_CALLBACK_TOKEN || '',
      mapping: JSON.parse(readFileSync(path.join(ROOT, 'config', 'datacar.mapping.json'), 'utf8'))
    },
    ...overrides
  };
}
