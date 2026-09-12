"use client";

import { useEffect, useState } from "react";

type Diff = { createdAt: string; members: Array<{ name: string; games: Array<{ appid: string; name: string }> }> };

export default function FamilyDiff({ params }: { params: { diffId: string } }) {
  const [diff, setDiff] = useState<Diff | null>(null);
  useEffect(() => { fetch(`/api/member-diffs/${params.diffId}`).then((r) => r.ok ? r.json() : null).then(setDiff); }, [params.diffId]);
  return <main className="container diff-page">
    <header className="header"><div className="brand-badge-group">🎮 Steam Family Notifier</div><h1 className="title">Jogos novos para compartilhar</h1><p className="subtitle">A lista de jogos diferentes encontrados na biblioteca do novo membro.</p></header>
    <section className="main-card">
      {!diff && <p className="field-desc">Carregando lista…</p>}
      {diff && diff.members.map((member) => <div className="diff-member" key={member.name}><h2>{member.name}</h2><p className="field-desc">{member.games.length} jogo(s) novo(s)</p><ul>{member.games.map((game) => <li key={game.appid}><a href={`https://store.steampowered.com/app/${game.appid}`} target="_blank" rel="noreferrer">{game.name}</a></li>)}</ul></div>)}
      {diff && diff.members.every((member) => member.games.length === 0) && <p className="field-desc">Nenhum jogo novo foi encontrado em relação à família atual.</p>}
    </section>
  </main>;
}
