# Controle de Pedidos + integração automática com o DataCar

Fluxo: **DataCar → (entrada automática) → Caixa (só "pago na hora") → Estoque → Expedição (balcão ou entrega)**.
Cada pedido guarda número, vendedor, cliente, estoquista e os tempos de fila, separação, espera de retirada/saída e rota.

## Rodar
Requer Node 22.13 ou superior. Não tem dependências para instalar.

    cp .env.example .env      # defina INTEGRATION_TOKEN
    npm start                 # http://localhost:3000
    npm test

## Arquitetura (cada camada só conhece a de baixo)

    public/index.html            Interface (consome a API)
    src/http/app.js              API REST — sem regra de negócio
    src/services/orderService.js Casos de uso + eventos (order.created / order.updated)
    src/domain/order.js          Regras puras: status, transições, cronômetros
    src/infra/*                  SQLite e repositório (único lugar com SQL)
    src/integrations/datacar/    Anticorrupção: mapper, ingestão, poller, retorno de status
    src/bootstrap.js             Composition root (injeção de dependências)

## Como o DataCar entrega os pedidos (escolha um ou combine)

1. **Webhook (push):** o DataCar ou um middleware faz `POST /api/integracao/datacar/pedidos`
   com `Authorization: Bearer <INTEGRATION_TOKEN>`. Aceita um pedido, uma lista ou `{ "pedidos": [...] }`.
2. **Consulta periódica (pull):** preencha `DATACAR_POLL_URL` (pode usar `{since}` na URL) e o sistema busca sozinho a cada N segundos.
3. **Retorno de status (opcional):** com `DATACAR_STATUS_CALLBACK_URL`, cada etapa concluída é enviada de volta.

Teste rápido:

    curl -X POST localhost:3000/api/integracao/datacar/pedidos \
      -H "Authorization: Bearer $INTEGRATION_TOKEN" -H "Content-Type: application/json" \
      -d @examples/pedido-datacar.json

O envio repetido do mesmo pedido não duplica (chave: origem + id externo).

## Lista de estoquistas
Os nomes ficam em `config/estoquistas.json`. Na tela do estoque o estoquista é escolhido numa lista, e o servidor recusa nomes que não estejam nela. Depois de editar o arquivo, reinicie o servidor.

## Adaptar aos campos reais do DataCar
Não encontrei documentação pública da API do DataCar; os nomes de campos do exemplo são **suposições**.
Ajuste `config/datacar.mapping.json` (nomes dos campos e as palavras que definem "pago na hora" e "entrega").
Se o DataCar só oferecer exportação de arquivo ou acesso ao banco, crie outro leitor na pasta
`integrations/datacar/` que chame `ingestion.ingest(...)` — o resto do sistema não muda.

## Antes de usar em produção
- A API interna (`/api/orders`) ainda não exige login: coloque atrás da rede da loja ou adicione autenticação por perfil.
- Use HTTPS (proxy reverso) para o webhook.
- Para vários servidores ou alto volume, troque o SQLite por PostgreSQL (só o repositório muda).
# controle-de-pedidos
