# Localização em segundo plano

## Política

Rastrear somente entre início e encerramento explícitos de uma viagem ativa. Nunca rastrear deslogado, sem viagem, após finalização ou por simples abertura do app.

O diagnóstico atual oferece um teste manual independente do fluxo operacional. Ele usa `expo-location` + `expo-task-manager`, grava posições no SQLite e mostra foreground service. Pare o teste ao terminar.

## Fluxo final

1. Confirmar sessão e viagem ativa no snapshot local/canônico.
2. Solicitar foreground e explicar background.
3. Criar sessão de rastreamento no backend.
4. Iniciar tarefa com notificação “KP Motorista — viagem em andamento e localização ativa”.
5. Persistir primeiro no SQLite e enviar em lote por endpoint idempotente.
6. Parar ao finalizar/cancelar/logout e reconciliar viagens abandonadas com limite temporal do backend.

## Estratégia adaptativa proposta

- alta frequência quando em deslocamento;
- menor frequência parado;
- precisão e intervalo controlados pelo `/driver-app/tracking/config`;
- fila local em perda de rede;
- alertar posição atrasada sem inventar movimento.

## Gap de backend

O serviço `registerLocation` existe, mas não está exposto por rota/controller. Até a fachada autenticada ser implementada, o app apenas grava posições locais. Não apontar para um endpoint presumido.

## Bateria e fabricantes

Orientar, sem alterar silenciosamente: permitir atividade em segundo plano, remover restrição de bateria e manter localização ativa. Samsung, Motorola e Xiaomi exigem validação física. Force stop pelo usuário impede garantias de execução; isso deve ser explicado claramente.
