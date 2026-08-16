# Build, versão e release

## Estratégia

- `version`: versão funcional do app; começa em `0.1.0`.
- `android.versionCode`: inteiro monotônico; começa em 1.
- `runtimeVersion`: política `appVersion`; OTA só atravessa binários compatíveis.
- canais: `development`, `preview`, `production`.
- artefatos: APK para Development/Preview; AAB para Production.

Antes de cada release, registre build date e commit via CI e aumente `versionCode`. O app mostra versão, build, ambiente e canal.

## Comandos

```bash
npm run build:development
npm run build:preview
npm run build:production
```

Todos exigem revisão humana, autenticação EAS e variáveis do ambiente. Nenhum publica na loja.

## EAS Update

Pode distribuir mudanças de JS/TS, estilos e assets que sejam compatíveis com a mesma runtime nativa. Exigem novo APK/AAB: biblioteca nativa, permissão, config plugin, Manifest, Kotlin, Firebase, package name, SDK Expo ou qualquer alteração de contrato nativo. Nunca publique OTA automaticamente.

## Checklist Preview/Production

1. lint, typecheck, testes e doctor verdes;
2. backend e banco do ambiente confirmados;
3. package name e assinatura confirmados;
4. política de privacidade e permissões aprovadas;
5. teste físico e matriz de fabricantes registrados;
6. plano de rollback e compatibilidade mínima do backend definidos;
7. revisão de logs para excluir dados sensíveis.

Uma futura resposta do backend deve informar versão mínima suportada. O app então bloqueará o fluxo com mensagem de atualização obrigatória, sem inferir compatibilidade localmente.

## Firebase / FCM V1 para o Preview APK

O APK de testes usa o package `com.kptransportes.motorista.preview`. No Firebase, adicione exatamente esse app Android e baixe o `google-services.json` correspondente. Não reutilize o arquivo de outro package.

1. No projeto Firebase, habilite o Cloud Messaging e crie/baixe uma chave de conta de serviço para FCM V1.
2. No EAS, abra `eas credentials -p android`, selecione o perfil Android e envie a chave da conta de serviço em **Push Notifications (FCM V1)**.
3. Cadastre o `google-services.json` como variável de arquivo EAS chamada `GOOGLE_SERVICES_JSON` no ambiente `preview`. O `app.config.ts` só inclui o arquivo quando essa variável existe, evitando versionar o segredo.
4. Confirme `EXPO_PUBLIC_EAS_PROJECT_ID=3d541892-4d00-4433-a862-903e3d60a3ca` e execute `npm run build:preview`.
5. Instale o novo APK em aparelho físico, aceite notificações e confira no backend o cadastro em `driver_push_tokens`.

Alterar Firebase, `google-services.json` ou permissões nativas exige um APK novo; não pode ser entregue por atualização OTA. Para produção, repita o cadastro com o package definitivo, sem compartilhar credenciais do Preview.
