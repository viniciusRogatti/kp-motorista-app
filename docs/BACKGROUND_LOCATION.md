# Localização em segundo plano

## Política

Rastrear somente depois do aceite formal da rota. O motorista não possui botão para interromper o compartilhamento. Ele termina no logout ou uma hora após a conclusão operacional da última parada, o que acontecer primeiro.

O diagnóstico oferece um teste manual independente do fluxo operacional. Na rota real, o app usa `expo-location` + `expo-task-manager`, grava primeiro no SQLite e envia ao backend com identificador idempotente. O prazo final também fica no armazenamento seguro e a tarefa encerra o serviço ao alcançá-lo.

## Fluxo final

1. Confirmar sessão e viagem ativa no snapshot local/canônico.
2. Registrar o aceite da rota no backend.
3. Confirmar as permissões foreground/background já preparadas pela empresa.
4. Iniciar tarefa com notificação “ASTRO — viagem em andamento e localização ativa”.
5. Persistir primeiro no SQLite e enviar em lote por endpoint idempotente.
6. Ao concluir todas as paradas, manter por uma hora e então parar e lembrar o motorista de fazer logout.

## Estratégia adaptativa proposta

- alta frequência quando em deslocamento;
- menor frequência parado;
- precisão e intervalo controlados pelo `/driver-app/tracking/config`;
- fila local em perda de rede;
- alertar posição atrasada sem inventar movimento.

## Integração disponível

- `POST /driver-app/tracking/location`: recebe uma posição autenticada e atualiza a sessão acompanhada pela página web.
- Se a rede falhar, a posição permanece com estado `retry` no SQLite e é reenviada no próximo lote.
- Ao aceitar, uma primeira posição é coletada imediatamente; as demais respeitam o intervalo de `/driver-app/tracking/config` e o deslocamento mínimo configurado no app.

## Bateria e fabricantes

Orientar, sem alterar silenciosamente: permitir atividade em segundo plano, remover restrição de bateria e manter localização ativa. Samsung, Motorola e Xiaomi exigem validação física. Force stop pelo usuário impede garantias de execução; isso deve ser explicado claramente.
