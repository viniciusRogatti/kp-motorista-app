# ASTRO

Assistente de Rotas e Gestão Operacional da KP Transportes.

Novo aplicativo Android dos motoristas da KP Transportes. Este projeto é independente de `apps/driver-app`; o aplicativo anterior foi usado somente como referência operacional.

## Estado atual

- Expo SDK 56, React Native 0.85, React 19.2 e TypeScript 6.
- Expo Router, Development Build e Continuous Native Generation (CNG).
- variantes Development, Preview e Production;
- login de motorista, sessão segura, aceite e execução da viagem atribuída com cache offline e diagnóstico interno;
- SQLite com esquema inicial de viagem, paradas, ações, posições e mídias pendentes;
- localização em segundo plano durante a viagem, com persistência local e reenvio idempotente;
- reordenação de paradas e correção do resultado de uma entrega marcada por engano enquanto o canhoto ainda não foi registrado;
- ocorrências de reentrega, devolução total/parcial/quebra de peso, canhoto retido, produto faltante e cancelamento/refaturamento;
- mensagens operacionais pré-montadas, foto comprobatória quando exigida, captura de canhoto e compartilhamento orientado para o WhatsApp;
- registro de push token e recebimento de notificações operacionais;
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
npm run update:preview -- --message "fix: descrição da atualização"
```

Builds EAS são deliberadamente manuais: `build:development`, `build:preview` e `build:production`. Atualizações OTA também exigem execução e mensagem explícitas; nenhum fluxo publica automaticamente.

## Homologação e atualizações OTA

O APK Preview atual aponta para o backend publicado no Railway e opera com dados reais de homologação. As variáveis públicas do perfil `preview` ficam cadastradas no EAS, e o script `update:preview` também fixa o endpoint remoto e bloqueia o uso acidental de `localhost`.

Uma atualização OTA distribui JavaScript, TypeScript, estilos e assets compatíveis com a mesma runtime nativa. O app baixa a atualização na inicialização e reinicia automaticamente assim que ela estiver pronta; o primeiro update que habilitou esse comportamento ainda pode exigir fechar e abrir o app novamente. Mudanças em bibliotecas nativas, permissões, plugins, Manifest, Firebase, SDK Expo ou runtime exigem a geração e instalação de um novo APK.

Antes de testar, confirme que a operação pode usar os dados reais daquele motorista e daquela rota. O envio ao WhatsApp continua sob confirmação do motorista: o app prepara a mensagem e a foto, abre o compartilhamento e registra apenas que o compartilhamento foi iniciado; a postagem efetiva ainda precisa ser confirmada no grupo correto.

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

O backend continua sendo a autoridade para os fluxos operacionais. A localização possui fila offline própria, mas as demais mutações ainda são enviadas diretamente e precisam de uma outbox operacional completa para funcionar sem rede. Ocorrências sem foto são enviadas como JSON; ocorrências com foto usam upload multipart e dependem de conexão estável. A correção de uma entrega em `delivered_pending_receipt` só é permitida enquanto não existir canhoto registrado. O compartilhamento do canhoto prepara foto e legenda, porém o motorista ainda escolhe manualmente o WhatsApp e o grupo; a baixa final depende do reconhecimento da postagem pelo backend. Builds e validações em aparelho físico continuam sendo etapas obrigatórias antes de uma publicação.
