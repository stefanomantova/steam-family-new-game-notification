# 🎮 Steam Family Notifier

Avisa no Discord quando alguém do seu grupo de compartilhamento de
biblioteca da Steam (Family Sharing / Steam Families) adiciona um jogo
novo.

Funciona 100% na nuvem via **GitHub Actions** (não precisa deixar nenhum
computador ligado) e também pode rodar localmente em **Windows, macOS ou
Linux**, usando Node.js e TypeScript.

Nenhum dado pessoal (SteamIDs, chave de API, webhook) fica no código —
tudo é configurado por variáveis de ambiente / secrets.

🇺🇸 Read this in English: [README.md](README.md)

---

## TL;DR — Configuração rápida

1. **Faça um fork** deste repositório (ou "Use this template")
   → botão no topo desta página

2. **Gere uma Steam API key**
   → https://steamcommunity.com/dev/apikey (qualquer valor serve em "Domain Name")

3. **Pegue o SteamID64 de cada membro**
   → cole a URL do perfil em https://steamid.io/ (perfis precisam ter a biblioteca de jogos pública)

4. **Crie um webhook do Discord**
   → Canal do Discord → Configurações → Integrações → Webhooks → Novo Webhook → copiar URL

5. **Adicione estes repository secrets** (Settings → Secrets and variables → Actions → New repository secret)

   | Secret | Valor |
   |---|---|
   | `STEAM_API_KEY` | chave do passo 2 |
   | `DISCORD_WEBHOOK_URL` | URL do passo 4 |
   | `STEAM_MEMBERS` | JSON, ex: `{"7656119...":"Alice","7656119...":"Bob"}` |
   | `MESSAGE_LANGUAGE` | *(opcional)* `EN` ou `PT` — padrão `EN` |
   | `STORE_COUNTRY_CODE` | *(opcional)* ex: `br`, `us` — padrão `br` |

6. **Habilite permissão de escrita do workflow**
   → Settings → Actions → General → Workflow permissions → **Read and write permissions** → Save
   *(necessário pra ele commitar o `state.json`/`stats.json` de volta)*

7. **Teste**
   → Actions → *Steam Family Notifier* → Run workflow. A primeira execução só salva a base, sem mandar mensagem.

8. *(Opcional)* **Configure o comando `/ranking` em tempo real no Discord**
   → siga [`discord-bot/README.pt-BR.md`](discord-bot/README.pt-BR.md) — precisa de uma Application no Discord (Public Key + Bot Token), uma conta grátis na Cloudflare (API Token + Account ID), e mais 4 secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DISCORD_PUBLIC_KEY`, `RANKING_BOT_GH_TOKEN`
   → edite também `discord-bot/wrangler.toml` → `GITHUB_REPO` pro seu `usuario/repositorio`
   → habilite a URL `workers.dev` do Worker, registre o comando `/ranking` via `register-command.sh`, e defina como Interactions Endpoint URL da Application

Pronto — o bot verifica periodicamente (a cada 15 minutos por padrão) e avisa no Discord quando alguém do grupo ganha um jogo novo. Detalhes completos de cada passo abaixo.

---

## Opção A — Rodando no GitHub Actions (recomendado, "plug and play")

1. Clique em **"Use this template"** no topo do repositório (ou faça um
   fork) para criar sua própria cópia.

2. Gere uma **Steam API key** (grátis, leva 1 minuto):
   https://steamcommunity.com/dev/apikey

3. Pegue o **SteamID64** de cada pessoa do grupo. Se você tem o link do
   perfil de cada um, um jeito rápido é colar em https://steamid.io/.
   *(Só funciona para perfis com biblioteca de jogos pública.)*

4. Crie um **webhook do Discord** no canal onde quer os avisos:
   Configurações do Canal → Integrações → Webhooks → Novo Webhook → copiar URL.

5. No seu repositório no GitHub, vá em
   **Settings → Secrets and variables → Actions → New repository secret**
   e crie estes secrets:

   | Nome                  | Valor |
   |------------------------|-------|
   | `STEAM_API_KEY`        | a chave do passo 2 |
   | `DISCORD_WEBHOOK_URL`  | a URL do passo 4 |
   | `STEAM_MEMBERS`        | um JSON tipo `{"76561198000000001":"Alice","76561198000000002":"Bob"}` com o SteamID64 e o nome de cada membro |
   | `MESSAGE_LANGUAGE`     | *(opcional)* `EN` ou `PT` — usa `EN` por padrão se não for definida |
   | `STORE_COUNTRY_CODE`   | *(opcional)* código de país de duas letras pros preços, ex: `us` — padrão `br` |

6. Pronto. O workflow em `.github/workflows/check-new-games.yml` já roda
   sozinho a cada 15 minutos. Para testar sem esperar, vá em
   **Actions → Steam Family Notifier → Run workflow**.

Na primeira execução o script só salva o estado atual (não notifica nada,
para não disparar uma avalanche de mensagens com jogos que já existiam).
A partir da segunda execução, todo jogo novo detectado gera um aviso.

### Ajustando a frequência

Pra mudar, edite a linha `cron` no arquivo
`.github/workflows/check-new-games.yml` (formato cron padrão, em UTC).
O GitHub Actions é gratuito pra esse uso mesmo em repositórios privados,
mas vale saber que workflows agendados (`schedule`) em repositórios com
pouca atividade não têm garantia de rodar no horário exato — o GitHub
pode atrasar ou pular execuções em picos de carga, principalmente em
minutos populares tipo `:00`/`:15`/`:30`/`:45`. Se precisar de
pontualidade confiável, considere disparar o workflow externamente via
`workflow_dispatch` (por exemplo, um serviço gratuito tipo cron-job.org
chamando a API do GitHub) em vez de depender do `schedule`.

---

## Opção B — Rodando localmente (Windows, macOS ou Linux)

Útil para testar antes de subir pro GitHub, ou se preferir rodar na sua
própria máquina/servidor em vez do GitHub Actions.

```bash
# 1. Clone o repositório e entre na pasta
git clone <url-do-seu-fork>
cd steam-family-notifier

# 2. Instale as dependências (Node.js 20 ou mais recente)
npm ci

# 4. Configure suas variáveis
cp .env.example .env
# edite o .env com sua STEAM_API_KEY, DISCORD_WEBHOOK_URL, STEAM_MEMBERS etc.

# 4. Compile e rode
npm run build
npm run check-new-games
```

Pra rodar de tempos em tempos localmente, agende com o **Agendador de
Tarefas** (Windows), **cron** (Linux/macOS) ou **launchd** (macOS).

---

## Estrutura do projeto

```
src/                          -> domínio, aplicação, portas, adaptadores e CLIs em TypeScript
package.json                  -> comandos e dependências do Node.js
package-lock.json             -> versões reproduzíveis das dependências
.env.example                  -> modelo de variáveis para rodar local
members.example.json          -> modelo do formato de membros (alternativa a STEAM_MEMBERS)
state.json                     -> "banco de dados" com o snapshot da última checagem (versionado)
stats.json                      -> totais de gamificação por membro, gasto / compras (versionado)
.github/workflows/
  check-new-games.yml             -> o notificador agendado
   backfill-purchase.yml           -> workflow manual "Backfill Purchase Stats"
discord-bot/                    -> comando /ranking em tempo real, opcional (Cloudflare Worker)
README.md / README.pt-BR.md    -> docs em inglês / português
```

## Como funciona por baixo dos panos

O script usa o endpoint `GetOwnedGames` da Steam Web API para cada SteamID
configurado. Esse endpoint retorna a lista de jogos que aparecem na conta
(incluindo jogos recebidos via Family Sharing), desde que o perfil esteja
com a biblioteca pública. A cada execução, o script compara a lista atual
de cada membro com o snapshot salvo em `state.json`.

A API não informa diretamente se um jogo novo foi comprado ou recebido via
Family Sharing, então o script usa uma heurística: quando um jogo novo
aparece na conta de alguém, ele verifica se **outro** membro do grupo já
tinha esse jogo antes dessa execução.

- Se sim → assume que foi compartilhado, e a mensagem é
  *"🔗 Um jogo novo está disponível no Family Sharing! **X**, compartilhado
  por **Z**."*
- Se nenhum outro membro já tinha e só uma pessoa ganhou acesso → assume
  compra própria: *"🎮 **Y** comprou um jogo novo: **X**."*
- Se ninguém tinha antes e várias pessoas ganharam acesso ao mesmo tempo
  (não dá pra saber quem comprou) → mensagem genérica: *"🎮 Um jogo novo
  apareceu no grupo: **X**."*

Se o mesmo jogo aparecer pra vários membros na mesma execução, o script
manda **uma única mensagem** por jogo (não uma por pessoa que recebeu
acesso), já que o que importa é o jogo em si e quem disponibilizou.

Jogos grátis são detectados e ignorados por completo — nem mensagem no
Discord, nem entrada no ranking (veja a seção de Gamificação abaixo).

O snapshot é atualizado e commitado de volta no repositório a cada execução.

## Idioma das mensagens

Defina a variável de ambiente / secret `MESSAGE_LANGUAGE` como `PT` para
mensagens em português, ou `EN` (ou deixe sem definir) para inglês.
Qualquer outro valor cai para inglês por padrão.

## Gamificação: ranking de gasto e de quantidade de compras

Toda vez que uma **compra nova e inequívoca** é detectada (um único membro
ganha acesso a um jogo que ninguém mais do grupo tinha antes), o script
busca o preço desse jogo e soma na conta desse membro em `stats.json` —
total gasto e total de jogos comprados.

### Jogos grátis são ignorados por completo

Se a Steam Store marca o título como free-to-play (`is_free`), ele é
ignorado inteiramente: nem mensagem no Discord, nem atualização de stats.
Essa checagem usa o campo oficial da própria Steam — a ausência de preço
**não** é tratada como "grátis" (veja a próxima seção pra entender por
quê essa distinção importa).

### Ordem de busca do preço (pra jogos pagos)

1. O preço próprio do jogo (`price_overview`) — o caso normal.
2. Se o jogo não tem ficha própria de preço (só é vendido dentro de um
   bundle/pacote, sem SKU individual) — o preço mais barato entre os
   pacotes que dão acesso a ele, já que foi isso que a pessoa realmente
   pagou. A mensagem no Discord ganha uma notinha:
   *"(preço contabilizado a partir do bundle/pacote em que veio)"*.
3. Se o appid nem tem ficha de loja (`success: false` — alguns appids
   "wrapper", que só existem na biblioteca, são assim) — uma busca por
   **nome do jogo** na própria Steam, usando o preço do resultado mais
   compatível. Mesma nota de bundle se aplica. Depende de um endpoint de
   busca informal da Steam, então é menos preciso que uma consulta direta
   por appid.
4. Se nada disso encontrar um preço — a compra ainda é anunciada, mas
   marcada como **não contabilizada no ranking**, e a mensagem já diz
   pro admin do grupo qual comando rodar pra corrigir manualmente (veja
   abaixo).

Outros casos que **não** contam no ranking, de propósito:
- Jogos recebidos via Family Sharing (já contabilizados pra quem comprou
  originalmente).
- Um jogo aparecendo pra vários membros ao mesmo tempo sem dono anterior
  no grupo (não dá pra saber quem comprou de fato).

A região de consulta é controlada pela variável/secret opcional
`STORE_COUNTRY_CODE` (padrão `"br"`; use `"us"` pra preços em dólar, por
exemplo).

### Corrigindo uma compra não contabilizada: CLI de backfill

Quando uma compra não pode ser precificada automaticamente, a mensagem no
Discord avisa isso e já inclui o `steamid` e `appid` exatos necessários
pra corrigir. Duas formas de rodar a correção:

**Via GitHub Actions (sem instalar nada local):** Actions → *Backfill
Purchase Stats* → Run workflow → preenche `steamid` e `appid` (e
opcionalmente `game_name`, um `price`/`currency` manual, e se quer
`notify` o Discord sobre a correção). Ele atualiza o `stats.json` e
commita de volta sozinho.

**Localmente:**
```bash
npm run build
npm run backfill-purchase -- --steamid 76561198000000001 --appid 4659620
# adicione --notify pra também postar uma mensagem no Discord sobre a correção
# adicione --price 59.90 --currency BRL pra definir o preço manualmente,
# pro caso raro em que nem a busca por nome encontra nada
```

Isso só mexe no `stats.json` — o jogo já deve estar rastreado no
`state.json`, então uma execução normal não vai (e não deve) tratá-lo
como "novo" de novo.

### Comando `/ranking` em tempo real

Pra transformar esses totais num comando `/ranking` em tempo real no
Discord, veja [`discord-bot/`](discord-bot/README.pt-BR.md) — um
complemento pequeno e gratuito rodando em Cloudflare Worker. Membros
empatados no mesmo valor/quantidade são agrupados na mesma linha do
ranking (ex: `🥇 Alice & Bob — R$ 199.90`).

## Limitações

- Depende do perfil Steam de cada membro estar público (a biblioteca, especificamente).
- Não existe webhook nativo da Steam para esse evento — o script funciona por
  checagem periódica (polling), então pode levar até um ciclo de execução
  para detectar um jogo novo.
- A atribuição "compartilhado por Z" é uma heurística baseada em quem do
  grupo já tinha o jogo antes, não uma informação oficial da Steam — em
  casos raros pode errar o nome de quem compartilhou (ex: se dois membros
  ganharam acesso ao mesmo jogo na mesma execução).
- O preço é o da loja no momento da detecção, não necessariamente o que a
  pessoa pagou de fato (promoções, câmbio, etc. não são rastreados).
- O fallback de busca por nome (passo 3 acima) depende de um endpoint
  informal e não-documentado da Steam — confiável na prática, mas sem
  garantia contratual.

## Licença

MIT — veja [LICENSE](LICENSE).
