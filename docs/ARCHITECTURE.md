# Arquitetura e diagnóstico

Revisão: 2026-08-31.

## Decisão

O novo app vive em `apps/kp-motorista-app` e não compartilha código com `apps/driver-app`. A arquitetura é offline-first, separada por capacidade, com Expo Router nas bordas e backend como única autoridade de negócio.

```text
src/app                 rotas e composição
src/components          UI compartilhada
src/config              configuração pública validada
src/database            schema SQLite e repositórios
src/services            HTTP/Socket (sem regra de negócio)
src/tasks               tarefas headless registradas no topo
src/types               contratos internos
```

## Diagnóstico dos repositórios

### Backend

- Node/Express, Sequelize/MySQL, JWT com sessão de 8 horas e escopo por `company_id`.
- Login real: `POST /login`; validação: `GET /login/verifyToken`; logout: `POST /login/logout`. O login exige verificação humana conforme configuração do backend.
- A viagem atribuída usa a fachada autenticada `GET /driver-app/trips/assigned`, com fallback legado isolado no cliente para compatibilidade.
- O namespace `/driver-app` expõe:
  - `POST /driver-app/auth/login`;
  - `GET /driver-app/trips/assigned`;
  - `GET /driver-app/tracking/config`;
  - `POST /driver-app/tracking/location` e `/tracking/logout`;
  - `POST /driver-app/push-token`;
  - `GET /driver-app/pending-receipts`;
  - `POST /driver-app/trips/:tripId/accept` e `/reorder`;
  - `POST /driver-app/trip-stops/:id/status`;
  - `POST /driver-app/trip-stops/:id/select-next`, `/cancellation-request` e `/occurrences`;
  - `POST /driver-app/driver-occurrences/:id/share-started`;
  - `POST /driver-app/alerts`.
- A mudança de status já valida transições, empresa, vínculo do motorista, parada bloqueante, `client_event_id` para deduplicação e localização anexada ao evento.
- Há tabelas de sessões de rastreamento, posições e eventos de execução, além de Socket.IO para o painel web.
- Posições periódicas são persistidas primeiro no SQLite e enviadas individualmente ao endpoint idempotente. Ainda não há endpoint de lote.
- O app prepara canhoto, legenda e grupo para compartilhamento; o bot/ backend confirma a postagem e conclui a entrega.
- Ocorrências de devolução, quebra de peso, canhoto retido, produto faltante, reentrega e cancelamento usam uma fachada mobile com evidência e `client_event_id`.

### Frontend web

- React/TypeScript; usa o mesmo backend, Socket.IO e as rotas atuais de monitoramento.
- O painel de acompanhamento escuta eventos de status e alertas e já consome `/driver-app/trip-stops/:id/status` em operações administrativas.
- O web confirma nomes e estados operacionais, mas não deve ser copiado como arquitetura móvel.

### Bot OCR / canhotos

- O bot de WhatsApp, o backend de receipts e os modelos OCR formam um fluxo existente separado.
- O app deve enviar mídia ao backend e receber um identificador/resultado; nunca deve falar diretamente com credenciais de storage ou executar a regra OCR localmente.

## Fluxo de dados proposto

1. A tela cria uma ação com UUID/idempotency key no SQLite.
2. O sincronizador envia a ação autenticada ao backend.
3. O backend valida transação e responde com estado canônico.
4. Somente após confirmação a ação vira `confirmed`; arquivos continuam locais até a confirmação de upload.
5. Socket.IO acelera atualização, mas reconciliação HTTP continua obrigatória.

## Decisão de versões

Foi escolhido Expo SDK 56 / RN 0.85 / React 19.2.3. O SDK 56 suporta Node 20.19.x e Android API 36. O SDK 57 é o mais recente na data da revisão, mas exige Node 22.13.x; a estação tinha Node 22.12 e Node 20.19.5. A escolha evita mudança global e permanece numa versão estável atual.

## Segurança

- Tokens futuros irão apenas para `expo-secure-store`.
- Dados operacionais ficam no SQLite; senhas nunca são persistidas.
- `EXPO_PUBLIC_*` é público dentro do binário.
- produção rejeita API local e exige package name explicitamente aprovado.
- logs e diagnóstico copiado não incluem token.

## Próximo contrato recomendado

Completar a outbox offline das mutações operacionais e, se o volume justificar, criar envio em lote de posições. Cada mutação deve continuar aceitando idempotency key e retornando versão/timestamp canônicos sem quebrar as rotas web legadas.
