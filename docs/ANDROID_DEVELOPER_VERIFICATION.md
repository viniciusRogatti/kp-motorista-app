# Verificação de desenvolvedor Android

O Play Console exige um APK assinado contendo o snippet exclusivo de comprovação de propriedade em:

`app/src/main/assets/adi-registration.properties`

O arquivo não deve ser versionado. O plugin `withAndroidDeveloperVerificationToken` cria o arquivo durante o prebuild usando a variável protegida `ANDROID_DEVELOPER_VERIFICATION_SNIPPET`.

## Preparar a versão de homologação

1. No Play Console, copie integralmente o snippet exibido na etapa **Enviar APK** do pacote `com.kptransportes.motorista.preview`.
2. Cadastre o valor no ambiente `preview` do EAS:

```bash
npx eas-cli@latest env:create \
  --environment preview \
  --name ANDROID_DEVELOPER_VERIFICATION_SNIPPET \
  --visibility secret
```

Informe o snippet somente quando o EAS CLI solicitar o valor, evitando gravá-lo no histórico do terminal.

3. Gere um novo APK usando o perfil que já possui o keystore registrado:

```bash
npx eas-cli@latest build --platform android --profile preview
```

4. Envie ao Play Console o novo APK, não um APK criado antes do cadastro da variável.

O APK precisa continuar assinado pelo certificado SHA-256 associado ao pacote de homologação.
