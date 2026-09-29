# Progresso e conclusão dos vídeos

## Regra

- Alunos e gestores: ao menos 50% de trechos únicos assistidos e chegada ao final.
- Administradores: chegada ao final, sem mínimo de trechos assistidos. O banco consulta o perfil ativo; não aceita privilégio do payload.
- Final: duração menos o menor valor entre 2 segundos e 1% da duração real.
- Trechos e maior posição são acumulados por usuário, curso, versão e aula. Voltar a trechos anteriores não apaga a chegada ao fim.
- Conclusões existentes são preservadas; XP de aula e curso permanece idempotente.
- Minutos editoriais continuam definindo XP, mas não validam a duração real do vídeo.

## Falha reproduzida e correção

O debounce do Vimeo era reiniciado por todos os eventos `timeupdate`, adiando o primeiro envio. A RPC rejeitava um primeiro envio com mais de 15 segundos assistidos; o mesmo payload continuava sendo rejeitado nas tentativas seguintes.

Agora o player envia durante a reprodução, tenta novamente após falhas inclusive pausado e mantém a mesma instância e os trechos ao repetir o envio. Requisições de vídeo têm timeout de 20 segundos. A RPC mescla intervalos reportados pelo player, sem inferir tempo assistido pela distância entre requisições — que também varia com buffering, reprodução acelerada, outra aba e perda de rede.

Esta medição é telemetria do navegador, não atestado inviolável de presença. Permissões, versão, duração estável, limites dos intervalos, conclusão e XP continuam sendo validados no servidor.

## Verificação

Executar dentro de `platform`:

```sh
pnpm test
pnpm test:players
pnpm typecheck
pnpm build
```

`test:players` usa Chromium instalado pelo Playwright e a porta local 4189. Abre navegador visível por padrão; `HEADLESS=true` ou CI habilita execução sem janela. Usa componentes reais com SDKs e persistência simulados, sem autenticação nem escrita em banco externo.

`src/lib/video-progress.test.ts` executa as migrações e a RPC reais em PostgreSQL embarcado (PGlite), reproduz o erro anterior e testa limites, retorno, sobreposição de trechos, requisições repetidas, XP e permissões.

O teste com vídeo real e login de staging continua disponível em `tests/e2e/video-resume.spec.ts`; depende das credenciais e do curso de staging descritos em `tests/e2e/README.md`.

## Publicação

Aplicar `supabase/migrations/20260929112304_video_completion_recovery.sql` no ambiente alvo antes de publicar a aplicação. A migração substitui a RPC sem apagar progresso nem reprocessar todos os usuários. Aulas antigas elegíveis são concluídas no próximo envio do player, inclusive ao reabrir no final.

Se um período nunca chegou ao servidor e a página foi fechada, não há evidência salva desse período para recuperar retroativamente.
