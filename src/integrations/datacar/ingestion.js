// Caso de uso de entrada: recebe o que veio do DataCar (webhook OU consulta) e grava.
// Um pedido inválido não bloqueia os demais do mesmo lote.
import { extrairItens, mapear } from './mapper.js';

export function createIngestion({ service, mapping, log = console }) {
  return {
    ingest(body, source = 'datacar') {
      const r = { created: 0, duplicated: 0, errors: [] };
      extrairItens(body, mapping).forEach((raw, i) => {
        try {
          const { duplicated } = service.receber(mapear(raw, mapping, source), raw);
          duplicated ? r.duplicated++ : r.created++;
        } catch (e) {
          r.errors.push({ item: i, erro: e.message });
          log.warn(`[datacar] item ${i} rejeitado: ${e.message}`);
        }
      });
      return r;
    }
  };
}
