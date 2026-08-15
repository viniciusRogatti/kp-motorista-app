# Ambientes

## Variantes

| Ambiente | Nome | Artefato | Backend | Metro | Faixa |
|---|---|---|---|---:|---:|
| development | KP Motorista Dev | APK dev client | desenvolvimento/homologação | Sim | Sim |
| preview | KP Motorista Teste | APK interno | homologação | Não | Sim |
| production | KP Motorista | AAB | produção | Não | Não |

`APP_ENV` escolhe a variante. Development e Preview nunca recebem URL de produção por padrão. Preview exige `EXPO_PUBLIC_API_URL`; Production também rejeita host local e exige `ANDROID_PACKAGE_NAME` explícito.

## Variáveis públicas

- `EXPO_PUBLIC_API_URL`: origem HTTP do backend;
- `EXPO_PUBLIC_SOCKET_URL`: origem Socket.IO;
- `EXPO_PUBLIC_SENTRY_DSN`: DSN público opcional, não auth token;
- `EXPO_PUBLIC_MAP_PROVIDER`: `external` por padrão;
- `EXPO_PUBLIC_BUILD_CHANNEL`: identificação de canal;
- `EXPO_PUBLIC_EAS_PROJECT_ID`: somente após `eas init`.

Segredos de banco, JWT, service accounts, senhas, chaves administrativas e credenciais de storage nunca podem usar `EXPO_PUBLIC_*`. Use EAS Secrets/Environment Variables e mantenha qualquer segredo no servidor.

O package base atual é provisório apenas para permitir o ciclo Development. Production falha sem valor aprovado. Alterar package name exige novo binário e pode impedir atualização sobre uma instalação anterior.
