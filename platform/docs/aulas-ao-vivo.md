# Aulas ao vivo · Academia DeMaria

## Operação com YouTube e OBS

1. No YouTube Studio, habilite lives com antecedência. Crie uma transmissão **não listada**, permita a incorporação e confira as restrições da conta.
2. Conecte o OBS ao YouTube e prepare câmera, microfone e tela. A chave de transmissão pertence ao OBS; nunca cole essa chave na Academia.
3. Na Academia, abra **Administração → Ao vivo → Criar aula ao vivo**. Informe título, professor, horário de Brasília, público e link do vídeo. Use **Agendar e publicar**.
4. Inicie o sinal no OBS e publique a transmissão no YouTube. Confira vídeo e áudio. Na Academia, marque a confirmação e use **Colocar aula no ar**.
5. O hero passa a priorizar a transmissão, com prévia sem som à direita e indicação vermelha. O menu Aprender e o catálogo convidam o público autorizado.
6. A sala reúne vídeo e chat. Administradores podem fixar uma mensagem, remover mensagens ou pausar o chat no editor.
7. Ao terminar, encerre no YouTube/OBS e use **Encerrar aula** na Academia. A sala indica que a gravação está sendo preparada.
8. Confira o replay no YouTube. Use **Publicar gravação** para liberá-lo. O endereço da sala e o histórico do chat são preservados. Se houver uma edição do vídeo, informe o novo link no campo de gravação.

O status da Academia é gerenciado manualmente. Agendar ou clicar em colocar no ar não inicia o OBS nem o YouTube. A Academia não recebe a chave de transmissão e não faz uma cópia do arquivo de vídeo. O YouTube hospeda a live e o replay. Links não listados podem ser compartilhados fora da Academia.

## Hero com até oito conteúdos

**Administração → Destaques** permite selecionar cursos, aulas específicas, desafios disponíveis, artigos, encontros e comunicados com destino interno. É possível ordenar, escolher o público e definir início/fim de exibição.

Transmissões em andamento têm prioridade máxima e ocupam as primeiras posições, respeitando o limite total de oito. Os destaques manuais vêm depois; vagas livres recebem sugestões automáticas. Conteúdos indisponíveis para o perfil não entram na seleção. Sem destaques manuais, a seleção automática continua funcionando.

No destaque ao vivo, a rotação automática fica pausada. O usuário pode navegar pelas setas. No celular, o vídeo aparece abaixo do convite. Navegadores podem exigir um toque para reproduzir; o som é ativado pelo usuário.

## Dados e permissões

- Eventos e mensagens usam tabelas próprias, fora do estado global de cursos.
- Cadastro/publicação/moderação passam pela API autenticada, com validação Zod e funções SQL acessíveis somente ao servidor.
- Edições de eventos e destaques usam versão otimista para evitar sobrescritas.
- O histórico do chat é paginado; novas mensagens e a moderação usam Supabase Realtime com leitura protegida por RLS.
- Cliente precisa estar vinculado a cartório ativo. O público da live define quem recebe o convite e pode acessar a sala.
- As mensagens guardam o nome e o papel verificados do autor, aceitam até 1.000 caracteres e usam intervalo mínimo de três segundos. Reenvios com o mesmo ID não duplicam mensagens.
- Remoção é uma atualização que apaga o texto e preserva o registro da moderação. O chat encerra na etapa de processamento; a gravação mantém o histórico consultável.
- Abrir a prévia ou participar do chat não altera XP, conclusão ou progresso de cursos.
- O vídeo é distribuído pelo YouTube. O limite de conexões/mensagens do plano Supabase deve ser acompanhado no dashboard durante eventos maiores.
- O plano gratuito atual comporta 200 conexões simultâneas e 100 mensagens de WebSocket por segundo, contando as entregas aos participantes. Em um chat com 150 pessoas, um fluxo intenso pode exigir plano Pro. Durante uma interrupção do Realtime, a sala recupera o histórico automaticamente a cada cinco segundos, sem perder mensagens salvas.

## Verificação

Os testes de contrato e PostgreSQL cobrem URLs, oito itens, transições, concorrência, RLS, proteção dos RPCs, ritmo, idempotência e persistência. A verificação de navegador em homologação cobre cadastro/publicação, convite de clientes, prioridade no hero, chat entre duas contas, fixação/remoção, mobile/dark e replay no mesmo endereço.
