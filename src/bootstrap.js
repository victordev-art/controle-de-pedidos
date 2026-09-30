// Composition root: único lugar que conhece todas as peças e as conecta (injeção de dependências).
import http from 'node:http';
import path from 'node:path';
import { ROOT } from './config.js';
import { openDatabase } from './infra/database.js';
import { createOrderRepository } from './infra/orderRepository.js';
import { OrderService } from './services/orderService.js';
import { createIngestion } from './integrations/datacar/ingestion.js';
import { createPoller } from './integrations/datacar/poller.js';
import { attachStatusNotifier } from './integrations/datacar/statusNotifier.js';
import { createApp } from './http/app.js';

export function createContainer(config) {
  const db = openDatabase(config.dbFile);
  const service = new OrderService({ repo: createOrderRepository(db), estoquistas: config.estoquistas });
  const ingestion = createIngestion({ service, mapping: config.datacar.mapping });
  const poller = createPoller({ cfg: config.datacar, ingestion });
  attachStatusNotifier({ service, cfg: config.datacar });
  const handler = createApp({ service, ingestion, poller, config, publicDir: path.join(ROOT, 'public') });
  return { server: http.createServer(handler), service, poller, db };
}
