# Autenticação do motorista

## Contrato utilizado

- login mobile: `POST /driver-app/auth/login` com `username` e `password`;
- validação: `GET /login/verifyToken` com Bearer token;
- logout: `POST /login/logout` com Bearer token.

O login web em `POST /login` continua protegido pelo Turnstile configurado no backend. O aplicativo não envia `captchaProvider: none` nem consegue desativar a proteção pelo cliente. A dispensa do Turnstile ocorre exclusivamente na rota mobile, que exige `driverId` e possui limite próprio de cinco falhas por IP e usuário em 15 minutos.

## Regras locais

- a senha existe somente em memória durante a tentativa e nunca é persistida;
- token e identidade mínima são armazenados no `expo-secure-store`;
- somente usuários com `driverId` positivo entram no app;
- uma sessão explicitamente inválida é removida;
- se a API estiver indisponível ao reabrir o app, a sessão local é preservada para recuperação offline;
- logout local acontece mesmo sem rede e encerra o rastreamento ativo.

## Ambiente seguro para teste

O backend encontrado está configurado para um banco remoto Railway e não há homologação identificada no repositório. Não iniciar o backend para teste móvel até confirmar que o banco é de homologação ou configurar backend e banco separados. O app Development/Preview não deve autenticar nem criar viagens de teste em produção.

Com um backend seguro na porta local `3001`, encaminhe as portas pelo USB:

```bash
adb reverse tcp:8081 tcp:8081
adb reverse tcp:3001 tcp:3001
```

Depois, faça login com uma conta de motorista de teste.

## Viagem atribuída

Após autenticar, o app consulta `GET /driver-app/trips/assigned`. O backend resolve empresa e motorista pelo Bearer token; não recebe `driverId` informado pelo celular. A resposta contém a rota ativa mais recente, veículo, resumo e paradas ordenadas, ou `trip: null`.

O app:

- atualiza ao abrir a tela e a cada 30 segundos enquanto ela estiver ativa;
- permite atualização manual;
- grava o snapshot em `active_trip` e `trip_stops` no SQLite;
- mantém o último snapshot visível durante indisponibilidade da API;
- remove o cache quando o backend confirma que não há mais viagem atribuída.
