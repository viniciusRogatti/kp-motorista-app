# Testes no Android

## Requisitos no Ubuntu

- Node `20.19.x` (`nvm use` usa a versão do `.nvmrc`);
- npm, Git e JDK 17;
- Android Studio/SDK Platform 36, Build-Tools 35 e 36, NDK side-by-side 27.1.12297006, CMake 3.22.1, Platform Tools e ADB;
- celular com depuração USB habilitada e cabo de dados.

Diagnóstico:

```bash
node --version
npm --version
java --version
adb version
adb devices -l
npm run doctor
```

Na inspeção inicial, Node 20.19.5, JDK 17 e ADB 36.0.2 estavam disponíveis. O primeiro build instalou, lado a lado pelo SDK Manager/Gradle, Platform 36 rev. 2, Build-Tools 35/36, NDK 27.1 e CMake 3.22.1. O NDK 26 existente foi preservado. Nenhum aparelho estava autorizado/conectado.

## Primeira instalação por EAS

1. Entre na pasta, execute `nvm use`, `npm install` e copie `.env.example` para `.env`.
2. Configure URLs de desenvolvimento/homologação usando o IP LAN do computador, nunca produção.
3. Instale/use a EAS CLI pelo script local e faça login manualmente: `npx eas-cli login`.
4. Associe o projeto uma única vez: `npx eas-cli init`. Copie o project id para o ambiente EAS; não publique credenciais.
5. Configure no EAS as variáveis `EXPO_PUBLIC_API_URL` e `EXPO_PUBLIC_SOCKET_URL` do perfil Development.
6. Execute `npm run build:development`. Esse passo envia um build à EAS e pode consumir cota; revise antes.
7. Baixe o APK pelo link, autorize a fonte no Android e instale.
8. Execute `npm run start:dev-client`, abra “ASTRO Dev” e selecione o servidor Metro.

## Build local por USB

Com Android SDK configurado e o aparelho aparecendo como `device` em `adb devices -l`:

```bash
npm run prebuild:clean
npm run android:device
npm run start:dev-client
```

O primeiro comando recria apenas os diretórios nativos ignorados pelo Git. O segundo compila e instala no aparelho; não publica nada.

Para apenas gerar o APK local, sem instalar:

```bash
cd android
NODE_ENV=development GRADLE_USER_HOME="$PWD/.gradle-user-home" ./gradlew :app:assembleDebug --no-daemon
```

Saída: `android/app/build/outputs/apk/debug/app-debug.apk`. O cache isolado fica dentro de `android/` e também é descartável. O build pode instalar componentes ausentes do Android SDK; revise as versões acima no SDK Manager antes de executar.

## Uso diário

```bash
nvm use
npm install
npm run start:dev-client
```

- Mesma rede Wi-Fi: use o IP LAN no `.env`; libere a porta do Metro no firewall se necessário.
- USB: mantenha `adb devices` autorizado; encaminhamento pode ser feito com `adb reverse tcp:8081 tcp:8081` e, se o backend for local, a porta correspondente.
- Tunnel: `npm run start:tunnel`; é mais lento, mas atravessa algumas redes restritas.
- Menu de desenvolvimento: agite o aparelho ou use `adb shell input keyevent 82`.
- Recarregar: menu de desenvolvimento → Reload.
- Logs: terminal do Metro; para nativo, `adb logcat` com filtro do package.
- Cache: `npm run start:dev-client -- --clear`.

Se o app não encontrar o Metro, confira computador/celular na mesma rede, VPN, firewall, IP do QR code e se a Development Build (não Preview) está instalada.

## Quando recompilar

| Alteração | Nova Development Build? |
|---|---:|
| JSX, TypeScript, estilos, textos | Não |
| Regra JS da fila/API | Não |
| Biblioteca somente JS | Normalmente não |
| Biblioteca com código nativo | Sim |
| Permissão ou `app.config.ts` nativo | Sim |
| Config plugin, Manifest, Kotlin | Sim |
| Expo SDK / React Native | Sim |
| Firebase ou recurso nativo | Sim |

## Preview

Defina o endpoint real de homologação no EAS e execute `npm run build:preview`. O APK funciona sem Metro. Mesmo package e assinatura permitem atualização por cima; mudança de package ou assinatura exige desinstalação. Desinstalar apaga SQLite e sessão local.

## Produção

Após aprovação do package name, credenciais e URLs, execute `npm run build:production`. O resultado é AAB. O script não submete nem publica.

## Matriz física obrigatória

Registre fabricante, modelo, Android, app/build, bateria e economia de bateria. Teste Samsung, Motorola e Xiaomi quando usados na frota: câmera, GPS, background/tela bloqueada, notificação persistente, Wi-Fi↔dados, modo avião, force stop, reinício, fila, upload e permissões. Faça testes dirigindo apenas em cenário controlado e com outra pessoa operando o aparelho.

## Teste de localização com a página de monitoramento

1. Instale um APK Preview gerado depois da integração ou recarregue o bundle no Development Build. As permissões nativas necessárias já constavam no projeto.
2. Entre com um usuário vinculado ao motorista e confirme que há uma viagem atribuída.
3. Na tela da viagem, toque em **Ativar** no bloco de localização.
4. Autorize localização precisa e, quando o Android solicitar, **Permitir o tempo todo**.
5. Abra a página web de monitoramento na data/empresa da rota. O contador “motoristas localizados” deve aumentar e o pin com o nome do motorista deve aparecer.
6. Toque no pin para conferir o horário e a precisão da última posição.
7. Bloqueie a tela e desloque o aparelho pelo menos 50 m para validar o serviço em segundo plano.
8. Ao encerrar, toque em **Parar** ou saia da conta.

Se o fabricante interromper atualizações com a tela bloqueada, retire a restrição de bateria do ASTRO nas configurações do Android.
