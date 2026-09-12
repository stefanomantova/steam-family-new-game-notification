# 🎮 Steam Family Notifier

Receba uma mensagem no Discord toda vez que alguém do seu grupo de compartilhamento de biblioteca da Steam adicionar um jogo novo — automaticamente, na nuvem, sem precisar mexer em código.

🇺🇸 Read this in English: [README.md](README.md)

---

## Parte 1 — Guia de Configuração

### O que você vai precisar
- Uma [conta no GitHub](https://github.com) (grátis)
- Uma conta Steam com uma API key (grátis, leva 1 minuto)
- Um canal do Discord onde você quer receber os avisos

---

### Passo 1 — Crie sua própria cópia do projeto

Clique em **"Use this template"** no topo desta página, depois em **"Create a new repository"**. Dê qualquer nome que quiser. Isso cria uma cópia privada sua onde suas configurações ficam armazenadas.

---

### Passo 2 — Pegue uma Steam API Key

Acesse https://steamcommunity.com/dev/apikey. Entre com sua conta Steam e coloque qualquer domínio no campo "Domain Name" (não importa o que você colocar). Copie a chave exibida na página.

---

### Passo 3 — Crie um Webhook do Discord

No Discord, abra o canal onde quer receber as notificações. Clique em **Editar Canal → Integrações → Webhooks → Novo Webhook**. Dê um nome (ex: "Notificador de Jogos") e copie a URL.

---

### Passo 4 — Use o Assistente de Configuração (Recomendado)

A forma mais fácil de configurar tudo é pelo assistente visual no navegador:

```bash
npm install && npm run setup:ui
```

Depois abra **http://localhost:3000** no seu navegador. O assistente guia você por:

1. **Credenciais** — Cole sua Steam API Key e a URL do Webhook do Discord. Teste a conexão ao vivo.
2. **Membros da Família** — Adicione cada membro colando o link do perfil Steam. O assistente busca o avatar e o nome automaticamente.
3. **Preferências** — Escolha o idioma das notificações (Português ou Inglês) e a região da loja Steam para preços.
4. **Ranking Bot** *(Opcional)* — Habilite o comando `/ranking` no Discord, integrado a um Cloudflare Worker gratuito.
5. **Deploy e Finalizar** — Salve tudo e copie os secrets do GitHub, já preenchidos e prontos para colar.

> **Não tem Node.js instalado?** Você também pode configurar tudo manualmente — veja o passo alternativo abaixo.

### Opção Windows sem instalação

Usuários do Windows podem baixar o pacote portátil em **Actions → Build Windows Portable Package → Artifacts**. Ele já inclui seu próprio runtime do Node, portanto não é necessário instalar Node.js ou NPM separadamente.

Execute `run-setup.cmd` para abrir o assistente local e use a opção **Dry Run** para validar a configuração e visualizar os arquivos gerados sem gravá-los. Use `run-check.cmd` para uma verificação manual depois da configuração.

O pacote portátil é um auxiliar local; ele não substitui o repositório privado do GitHub usado pelo agendamento a cada 15 minutos e pela persistência do estado. Uma versão futura pode transformar o mesmo ponto de entrada em um executável único, mas o pacote portátil é o primeiro formato de distribuição de menor risco.

---

### Passo 4 (Alternativo) — Configuração Manual

Se preferir não usar o assistente, adicione os secrets diretamente no GitHub:

Vá até seu repositório → **Settings → Secrets and variables → Actions → New repository secret** e adicione:

| Secret | O que colocar |
|---|---|
| `STEAM_API_KEY` | A chave do Passo 2 |
| `DISCORD_WEBHOOK_URL` | A URL do webhook do Passo 3 |
| `STEAM_MEMBERS` | `{"SteamID64":"Nome", ...}` — busque os SteamID64s em [steamid.io](https://steamid.io) |
| `MESSAGE_LANGUAGE` | `EN` ou `PT` *(opcional, padrão EN)* |
| `STORE_COUNTRY_CODE` | ex: `us`, `br` *(opcional, padrão br)* |

Depois vá em **Settings → Actions → General → Workflow permissions** e habilite **Read and write permissions**.

---

### Passo 5 — Rode pela primeira vez

Vá em **Actions → Steam Family Notifier → Run workflow**.

> Na primeira execução, o sistema tira uma foto das bibliotecas de todos. Nenhuma mensagem é enviada. A partir da próxima execução, qualquer jogo adicionado vai gerar uma notificação.

O bot verifica novos jogos automaticamente a cada 15 minutos.

---

### (Opcional) Habilitar o Comando `/ranking` no Discord

Quer que os membros possam digitar `/ranking` no Discord e ver quem gastou mais e comprou mais jogos? Esse é um add-on opcional e gratuito.

O assistente de configuração (Passo 4 acima) tem uma etapa dedicada ao **Ranking Bot** que guia você por todo o processo — incluindo registrar o comando slash no Discord com um clique e verificar se o Cloudflare Worker está funcionando. Você vai precisar de:

- Uma Application gratuita no Discord (criada em [discord.com/developers](https://discord.com/developers))
- Uma [conta gratuita na Cloudflare](https://cloudflare.com)

Todo o restante é configurado automaticamente pelo assistente ou pelo GitHub Actions.

---

## Parte 2 — Referência Técnica

### Como funciona

O script chama o endpoint `GetOwnedGames` da Steam para cada membro a cada execução e compara com o último snapshot (`state.json`, commitado no repositório). App IDs novos são os "jogos novos."

**Heurística de compartilhado vs. comprado**: A Steam não expõe se um jogo foi comprado ou recebido via Family Sharing. O script infere:
- Se outro membro do grupo já tinha o jogo antes → *compartilhado por ele*
- Se só um membro ganhou acesso e ninguém mais tinha → *comprado*
- Se vários membros ganharam acesso ao mesmo tempo → *mensagem genérica* (ambíguo)

**Detecção de jogos grátis**: O campo `is_free` da Steam Store é o único critério. Preço ausente **não** é tratado como grátis — essa distinção é importante para o ranking.

---

### Busca de Preço (para o ranking)

Quando uma compra é detectada, o preço do jogo é resolvido nessa ordem:

1. `price_overview` direto do app na Steam Store API
2. Bundle/pacote mais barato que inclui o app (para jogos sem SKU individual)
3. Busca por nome na Steam Store (cobre appids "wrapper" sem página de loja)
4. Preço exibido pelo SteamDB (fallback somente leitura)
5. Candidatos a bundle no SteamDB
6. Se nada funcionar → compra é anunciada mas **não contabilizada no ranking**, e a mensagem inclui o comando exato para corrigir manualmente

A região é controlada por `STORE_COUNTRY_CODE` (padrão `br`).

---

### Corrigindo uma entrada de stat ausente

Quando o preço não consegue ser resolvido automaticamente, rode o backfill:

**Via GitHub Actions** (sem instalar nada): Actions → *Backfill Purchase Stats* → Run workflow, preencha `steamid` e `appid`.

**Localmente:**
```bash
npm run build
npm run backfill-purchase -- --steamid 76561198000000001 --appid 123456
# --notify para postar uma mensagem de correção no Discord
# --price 29.99 --currency BRL para definir o preço manualmente
```

---

### Visão Geral da Arquitetura

| Camada | Tecnologia |
|---|---|
| Notificador agendado | GitHub Actions (cron, a cada 15 min) |
| Persistência de estado | `state.json` + `stats.json` commitados no repositório |
| Assistente de configuração | Next.js 14 (roda apenas localmente, não é deployado) |
| Comando `/ranking` | Cloudflare Worker (serverless, plano gratuito) |
| Dados Steam | Steam Web API (`GetOwnedGames`, `GetAppDetails`) |
| Preços | Steam Store API → fallback SteamDB |

A lógica de domínio fica em `src/application/`. Adaptadores para Steam, Discord e os repositórios JSON ficam em `src/adapters/`. O workflow do GitHub Actions chama os CLIs compilados em `dist/cli/`.

---

### Estrutura do Projeto

```
check_new_games.py          → notificador Python legado (ainda funciona)
src/                        → reescrita em TypeScript (application, adapters, CLIs)
web/                        → assistente Next.js (apenas local)
discord-bot/                → Cloudflare Worker opcional para /ranking
state.json                  → snapshot commitado das bibliotecas ("o banco de dados")
stats.json                  → totais de compras commitados para o /ranking
.github/workflows/
  check-new-games.yml       → workflow agendado principal
  deploy-ranking-bot.yml    → faz deploy do Cloudflare Worker no push
  backfill-purchase.yml     → workflow manual de correção de stats
```

---

### Limitações

- Exige que a biblioteca de jogos de cada membro esteja **pública** no perfil Steam.
- Baseado em polling: pode levar até um ciclo (15 min) para detectar um jogo novo.
- A atribuição "compartilhado por X" é uma heurística — pode errar em casos onde dois membros ganham o mesmo jogo na mesma execução.
- Os preços refletem a Steam Store no momento da detecção, não o que a pessoa de fato pagou (promoções, variações de câmbio etc. não são rastreados).

---

## Licença

MIT — veja [LICENSE](LICENSE).
