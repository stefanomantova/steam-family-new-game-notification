# Steam Family Notifier — comando `/ranking` do Discord

Um complemento opcional: um comando `/ranking` em tempo real que mostra
quem mais gastou e quem mais comprou jogos no grupo, com base no
`stats.json` rastreado pelo script principal.

Roda como um **Cloudflare Worker** pequeno — camada gratuita pra sempre,
sem servidor pra manter no ar. Ele não guarda estado nenhum: toda vez que
alguém roda `/ranking`, ele busca o `stats.json` direto do seu
repositório no GitHub e responde com os números atuais.

🇺🇸 Read this in English: [README.md](README.md)

## Como funciona

Comandos slash do Discord funcionam de dois jeitos: um bot que fica
conectado o tempo todo (gateway), ou um **HTTP Interactions Endpoint**,
onde o Discord manda uma requisição pro seu servidor só quando o comando
é usado de fato. Esse projeto usa a segunda abordagem — bem mais leve, e
encaixa perfeitamente numa camada gratuita serverless.

## Configuração

### 1. Crie uma Application no Discord

1. Vá em https://discord.com/developers/applications → **New Application**.
2. Em **General Information**, copie o **Application ID** e a
   **Public Key** — você vai precisar dos dois.
3. Vá na aba **Bot**, clique em **Add Bot** (ou **Reset Token**), e copie
   o **Bot Token**. Esse token é usado só uma vez, pra registrar o
   comando — o Worker em si nunca precisa dele.

### 2. Faça o deploy do Worker

Precisa do [Node.js](https://nodejs.org) e de uma conta na Cloudflare
(grátis) onde vai fazer o deploy.

```bash
cd discord-bot
npm install

# Faça login na sua conta Cloudflare (abre uma janela do navegador)
npx wrangler login

# Configure os dois secrets (vai pedir pra colar cada valor)
npx wrangler secret put DISCORD_PUBLIC_KEY
npx wrangler secret put GITHUB_TOKEN

npm run deploy
```

O `GITHUB_TOKEN` deve ser um **fine-grained personal access token** do
GitHub (Settings → Developer settings → Personal access tokens →
Fine-grained tokens), com escopo limitado a esse único repositório e
permissão **Contents: Read-only**. Isso já é suficiente pra buscar o
`stats.json`, mesmo em repositório privado.

Antes de rodar o deploy, edite o `wrangler.toml` e defina `GITHUB_REPO`
com o seu `usuario/repositorio` real (e `GITHUB_BRANCH` /
`GITHUB_STATS_PATH` se você mudou os padrões).

O `wrangler deploy` imprime a URL do seu Worker
(`https://steam-family-ranking-bot.<seu-subdominio>.workers.dev`) — copie ela.

### 3. Aponte o Discord pro seu Worker

De volta no Discord Developer Portal, na página **General Information**
da sua application, cole a URL do Worker em **Interactions Endpoint URL**
e salve. O Discord manda uma requisição de teste na hora — se o Worker
estiver no ar corretamente, ele valida na hora.

### 4. Registre o comando `/ranking`

Rode uma vez, de dentro da pasta `discord-bot/`:

```bash
DISCORD_APP_ID=<seu application id> \
DISCORD_BOT_TOKEN=<seu bot token> \
GUILD_ID=<id do seu servidor Discord, opcional mas recomendado pra testar na hora> \
./register-command.sh
```

Sem `GUILD_ID`, o comando é registrado globalmente, o que pode levar até
uma hora pra aparecer. Com `GUILD_ID`, aparece na hora, mas só nesse
servidor — bom pra testar antes de tornar global.

### 5. Adicione o comando ao seu servidor

Abre essa URL no navegador (troque `<APP_ID>`), escolhe seu servidor, e
autoriza:

```
https://discord.com/oauth2/authorize?client_id=<APP_ID>&scope=applications.commands
```

Isso concede só o escopo `applications.commands` — nenhum bot entra como
membro do servidor, nenhuma permissão extra é pedida.

### 6. Testa

Digita `/ranking` no seu servidor. Deve vir uma mensagem com quem mais
gastou e quem mais comprou jogos, puxado ao vivo do `stats.json`.

## Observações

- Se o `stats.json` ainda não tiver dados (ninguém comprou nada desde que
  você ativou o rastreamento de stats), o comando responde avisando isso.
- Os preços vêm do valor **atual** listado na Steam Store no momento em
  que a compra foi detectada — não necessariamente o que a pessoa pagou
  de fato (promoções, mudança de câmbio, etc. não são considerados).
- Só compras inequívocas são contabilizadas — veja o
  [README principal](../README.pt-BR.md#como-funciona-por-baixo-dos-panos)
  pra entender o que conta como "compartilhado" vs "comprado".
