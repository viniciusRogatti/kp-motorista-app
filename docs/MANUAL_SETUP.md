# Configuração manual e responsabilidades

## Codex pode fazer

- criar e alterar arquivos do projeto;
- instalar dependências locais compatíveis;
- configurar Expo, CNG, EAS profiles e scripts;
- implementar UI, SQLite, serviços, testes e documentação;
- executar verificações locais, prebuild e diagnóstico não destrutivo;
- preparar integrações sem usar produção.

## Ação humana obrigatória

- aprovar o package name definitivo;
- fornecer URLs reais de desenvolvimento/homologação e confirmar que banco/storage estão isolados;
- autenticar na Expo/EAS, aceitar termos e revisar consumo de cota;
- executar `eas init` e configurar variáveis por ambiente;
- autorizar o aparelho no ADB, instalar APK e conceder permissões;
- criar projeto Firebase, registrar o package aprovado, baixar `google-services.json` e associar credenciais ao EAS;
- criar/configurar Sentry e mapas quando escolhidos;
- configurar assinatura/Google Play e aprovar privacidade;
- validar regras com a transportadora e testar condução em cenário controlado.

## Pendências antes do primeiro build útil

1. Copiar `.env.example` para `.env` e trocar o IP de exemplo.
2. Confirmar um backend de homologação com banco, Socket.IO e storage separados.
3. Aprovar o package base; o valor atual de Development é provisório.
4. Conectar/autorizar o aparelho (`adb devices -l`).
5. Escolher build local ou autenticar no EAS.

O build local inicial exigiu Platform 36 rev. 2, Build-Tools 35/36, NDK 27.1.12297006 e CMake 3.22.1. Esses componentes foram instalados lado a lado no Android SDK e podem ser gerenciados ou removidos individualmente pelo Android Studio SDK Manager.

## Firebase e push

Não existe configuração Firebase inventada. Após ação humana, mantenha `google-services.json` fora do Git e use credenciais EAS. Push precisa de Development Build e aparelho físico; emulador não substitui validação final.

## Homologação recomendada

Caso ainda não exista, provisionar backend, MySQL, bucket, Socket.IO e credenciais separados; usar contas e viagens fictícias ou dados anonimizados. Development e Preview devem falhar de forma visível quando essa configuração faltar, nunca cair automaticamente em produção.
