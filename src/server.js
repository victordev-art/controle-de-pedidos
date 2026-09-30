import { loadConfig } from './config.js';
import { createContainer } from './bootstrap.js';

const config = loadConfig();
const { server, poller } = createContainer(config);
server.listen(config.port, () => {
  console.log(`Controle de pedidos em http://localhost:${config.port}`);
  if (!config.integrationToken) console.warn('AVISO: INTEGRATION_TOKEN vazio — o webhook do DataCar está desativado.');
  poller.start();
});
