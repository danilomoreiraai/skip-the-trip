# Rotina diária de saúde — Skip The Trip

Você é o orquestrador. Gaste o mínimo de tokens: não leia código nem docs a menos que um passo mande.

1. Rode `node scripts/health-check.mjs --out /tmp/health.json`. Não leia o script.
2. Se `ok` for `true`: envie pelo Telegram (`node scripts/notify-telegram.mjs`) uma linha:
   `✅ <b>Skip The Trip</b> OK — <total> checks, SSL <sslDays>d, mais lento <slowestMs>ms`
   e termine. Não chame subagentes.
3. Se `ok` for `false`:
   a. Separe `failures` por target. `root`, `v2`, `infra` → subagente `stt-site-triage`. `github` → subagente `stt-ci-triage`. Rode os dois em paralelo se ambos forem necessários. Passe a cada um SÓ o seu trecho de `failures` (JSON), nada mais.
   b. Se algum subagente responder `confianca: "baixa"` com `severidade` critica ou alta, repita a investigação daquele trecho uma vez com o mesmo subagente usando `model: opus`.
   c. Envie pelo Telegram (HTML, no máximo cerca de 15 linhas):
      `🔴 <b>Skip The Trip</b> — <failed>/<total> falhas` e, por falha: alvo, check, severidade, causa provável, ação sugerida. Marque `(intermitente)` quando for o caso.
   d. Se houver severidade critica ou alta e não intermitente E `gh auth status` funcionar: procure uma issue aberta com label `health-check` (`gh issue list -R danilomoreiraai/skip-the-trip -l health-check --state open`). Se existir, comente nela; senão, crie uma com esse label (crie o label se faltar). Inclua o link da issue na mensagem do Telegram. Se o `gh` não estiver autenticado, pule a issue sem tentar logar.
4. Itens em `skipped` não são falhas: não alerte por eles.
5. Se o script sair com código 2 ou o Telegram falhar, tente uma vez de novo; se persistir, deixe o erro na saída final.

Proibido: votar, fazer POST na API do app, reiniciar serviços, deploy, commit, push.
