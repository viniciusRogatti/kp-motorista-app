# SQLite e sincronização offline

SQLite é o banco operacional. SecureStore será usado apenas para sessão/token; AsyncStorage não é banco principal.

## Esquema inicial

- `active_trip`: snapshot mínimo da viagem ativa;
- `trip_stops`: paradas e ordem;
- `offline_actions`: outbox idempotente;
- `location_positions`: posições aguardando confirmação;
- `pending_media`: arquivos locais até confirmação remota;
- `app_settings`: configurações não sensíveis.

Cada ação possui UUID, tipo, entidade, payload, tentativas, última tentativa, status, timestamps e idempotency key única. Estados: `pending`, `processing`, `confirmed`, `retry`, `failed`, `conflict`.

## Algoritmo de sincronização

1. gravar ação e alteração otimista em uma transação local;
2. buscar `pending/retry` por ordem de criação;
3. marcar `processing`, enviar com idempotency key e timeout;
4. em 2xx, aplicar resposta canônica e marcar `confirmed`;
5. em 409, preservar e marcar `conflict` para reconciliação;
6. em falha transitória, incrementar tentativas e aplicar backoff com jitter;
7. nunca apagar mídia antes da confirmação do backend/storage.

A primeira entrega cria o esquema e diagnósticos, mas não envia ações: contratos de lote e posição ainda precisam ser fechados. A simulação offline da tela interna bloqueia os testes de API/Socket na UI; não altera a conectividade do aparelho.

Migrações locais são incrementais por `PRAGMA user_version`. Não use `prebuild --clean` como estratégia de banco: esse comando não deve apagar dados do app instalado.
