# Permissões Android

Permissões são contextuais, nunca solicitadas em lote no login.

1. Localização durante o uso: ao abrir diagnóstico ou iniciar rota.
2. Localização em segundo plano: depois de explicar o rastreamento da viagem ativa e obter foreground.
3. Notificações: antes de iniciar a rota, para a notificação operacional.
4. Câmera: somente ao fotografar canhoto.
5. Arquivos: preferir diretório privado e seletor do sistema; não pedir acesso amplo.

Para cada estado (`undetermined`, permitido, parcial, negado, bloqueado, GPS desligado), a UI deve explicar por que, o impacto e como corrigir. Se for necessário abrir Configurações, explique primeiro e permita cancelar.

O motorista deve saber que negar background impede rastreamento com tela bloqueada, mas não bloqueia funções que usam apenas foreground. O app não muda bateria, GPS ou permissões silenciosamente.

Após alterar permissões ou o plugin de localização em `app.config.ts`, execute `npm run prebuild:clean` e gere uma nova Development Build.
