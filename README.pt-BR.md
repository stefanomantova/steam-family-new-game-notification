# 🎮 Steam Family Notifier

Avisa no Discord quando alguém do seu grupo de compartilhamento de
biblioteca da Steam (Family Sharing / Steam Families) adiciona um jogo
novo.

Funciona 100% na nuvem via **GitHub Actions** (não precisa deixar nenhum
computador ligado) e também pode rodar localmente em **Windows, macOS ou
Linux**, já que é código Python puro.

Nenhum dado pessoal (SteamIDs, chave de API, webhook) fica no código —
tudo é configurado por variáveis de ambiente / secrets.

🇺🇸 Read this in English: [README.md](README.md)

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

6. Pronto. O workflow em `.github/workflows/check-new-games.yml` já roda
   sozinho de hora em hora (`cron: "0 * * * *"`). Para testar sem esperar,
   vá em **Actions → Steam Family Notifier → Run workflow**.

Na primeira execução o script só salva o estado atual (não notifica nada,
para não disparar uma avalanche de mensagens com jogos que já existiam).
A partir da segunda execução, todo jogo novo detectado gera um aviso.

### Ajustando a frequência

O padrão é a cada hora. Para mudar, edite a linha `cron` no arquivo
`.github/workflows/check-new-games.yml` (formato cron padrão, em UTC).
Exemplos: `*/15 * * * *` (a cada 15 min), `0 */6 * * *` (a cada 6h).
O GitHub Actions é gratuito para esse uso mesmo em repositórios privados
(consome poucos minutos por mês nessa frequência).

---

## Opção B — Rodando localmente (Windows, macOS ou Linux)

Útil para testar antes de subir pro GitHub, ou se preferir rodar na sua
própria máquina/servidor em vez do GitHub Actions.

```bash
# 1. Clone o repositório e entre na pasta
git clone <url-do-seu-fork>
cd steam-family-notifier

# 2. Crie um ambiente virtual (opcional, mas recomendado)
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# 3. Instale as dependências
pip install -r requirements.txt

# 4. Configure suas variáveis
cp .env.example .env
# edite o .env com sua STEAM_API_KEY, DISCORD_WEBHOOK_URL, STEAM_MEMBERS etc.

# 5. Rode
python check_new_games.py
```

Pra rodar de tempos em tempos localmente, agende com o **Agendador de
Tarefas** (Windows), **cron** (Linux/macOS) ou **launchd** (macOS).

---

## Estrutura do projeto

```
check_new_games.py          -> script principal
requirements.txt            -> dependências
.env.example                  -> modelo de variáveis para rodar local
members.example.json          -> modelo do formato de membros (alternativa a STEAM_MEMBERS)
state.json                     -> "banco de dados" com o snapshot da última checagem (versionado)
stats.json                      -> totais de gamificação por membro, gasto / compras (versionado)
.github/workflows/             -> automação do GitHub Actions
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

O snapshot é atualizado e commitado de volta no repositório a cada execução.

## Idioma das mensagens

Defina a variável de ambiente / secret `MESSAGE_LANGUAGE` como `PT` para
mensagens em português, ou `EN` (ou deixe sem definir) para inglês.
Qualquer outro valor cai para inglês por padrão.

## Gamificação: ranking de gasto e de quantidade de compras

Toda vez que uma **compra nova e inequívoca** é detectada (um único membro
ganha acesso a um jogo que ninguém mais do grupo tinha antes), o script
consulta o preço atual desse jogo na Steam Store e soma na conta desse
membro em `stats.json` — total gasto e total de jogos comprados.

- Jogos recebidos via Family Sharing não contam de novo (já foram
  contabilizados pra quem comprou originalmente).
- Se um jogo aparece pra vários membros ao mesmo tempo sem dono anterior
  no grupo, ele é ignorado pra fins de estatística (não dá pra saber quem
  comprou de fato).
- O preço usado é o **atual** da loja no momento da detecção, não
  necessariamente o que a pessoa pagou de fato (promoções, câmbio, etc.
  não são rastreados).
- A região de consulta é controlada pela variável/secret opcional
  `STORE_COUNTRY_CODE` (padrão `"br"`; use `"us"` pra preços em dólar,
  por exemplo).

Pra transformar esses totais num comando `/ranking` em tempo real no
Discord, veja [`discord-bot/`](discord-bot/README.pt-BR.md) — um
complemento pequeno e gratuito rodando em Cloudflare Worker.

## Limitações

- Depende do perfil Steam de cada membro estar público (a biblioteca, especificamente).
- Não existe webhook nativo da Steam para esse evento — o script funciona por
  checagem periódica (polling), então pode levar até um ciclo de execução
  para detectar um jogo novo.
- A atribuição "compartilhado por Z" é uma heurística baseada em quem do
  grupo já tinha o jogo antes, não uma informação oficial da Steam — em
  casos raros pode errar o nome de quem compartilhou (ex: se dois membros
  ganharam acesso ao mesmo jogo na mesma execução).

## Licença

MIT — veja [LICENSE](LICENSE).