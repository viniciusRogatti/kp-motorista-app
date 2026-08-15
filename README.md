# KP Motorista

Novo aplicativo Android dos motoristas da KP Transportes. Este projeto é independente de `apps/driver-app`; o aplicativo anterior foi usado somente como referência operacional.

## Estado da primeira entrega

- Expo SDK 56, React Native 0.85, React 19.2 e TypeScript 6.
- Expo Router, Development Build e Continuous Native Generation (CNG).
- variantes Development, Preview e Production;
- login de motorista, sessão segura, viagem atribuída com cache offline e diagnóstico interno;
- SQLite com esquema inicial de viagem, paradas, ações, posições e mídias pendentes;
- tarefa de localização em segundo plano para teste controlado;
- configuração central validada e bloqueio de localhost em produção;
- nenhum segredo, credencial, endpoint de produção ou projeto Firebase incluído.

## Início rápido

```bash
cd apps/kp-motorista-app
nvm use
cp .env.example .env
# ajuste o IP LAN e use somente backend de desenvolvimento/homologação
npm install
npm run start:dev-client
```

O Expo Go não é o ambiente oficial e não valida as capacidades nativas deste projeto. Instale primeiro uma Development Build conforme [TESTING_ANDROID.md](docs/TESTING_ANDROID.md).

Um APK universal de Development Build foi validado localmente em `android/app/build/outputs/apk/debug/app-debug.apk`. Como `android/` é gerado por CNG e ignorado, execute novamente o build após `prebuild --clean` se o artefato for removido.

## Comandos

```bash
npm run start:dev-client   # Metro + Development Build
npm run start:tunnel       # alternativa quando LAN falhar
npm run android:device     # build local e instalação via ADB
npm run prebuild:clean     # regenera Android por CNG
npm run doctor
npm run lint
npm run typecheck
npm test
```

Builds EAS são deliberadamente manuais: `build:development`, `build:preview` e `build:production`. Nenhum script publica automaticamente.

## Documentação

- [Arquitetura e diagnóstico dos repositórios](docs/ARCHITECTURE.md)
- [Teste no Android](docs/TESTING_ANDROID.md)
- [Ambientes](docs/ENVIRONMENTS.md)
- [Build e release](docs/BUILD_AND_RELEASE.md)
- [Permissões](docs/PERMISSIONS.md)
- [Localização em segundo plano](docs/BACKGROUND_LOCATION.md)
- [SQLite e sincronização offline](docs/OFFLINE_SYNC.md)
- [Autenticação do motorista](docs/AUTHENTICATION.md)
- [Ações manuais](docs/MANUAL_SETUP.md)

## Limites atuais

Esta entrega ainda não inicia/finaliza rotas, envia POD, recebe notificações push reais nem publica posições. Login, sessão local e leitura da viagem atribuída estão implementados, mas o teste ponta a ponta aguarda um backend de homologação confirmado. O backend continua sendo a autoridade para os fluxos operacionais.
