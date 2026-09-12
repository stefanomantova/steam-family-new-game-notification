"use client";

import React, { useEffect, useState } from "react";
import { Stepper } from "@/components/Stepper";
import { StepCredentials } from "@/components/StepCredentials";
import { StepMembers, type MemberRecord } from "@/components/StepMembers";
import { StepPreferences } from "@/components/StepPreferences";
import { StepRankingBot } from "@/components/StepRankingBot";
import { StepDeploy } from "@/components/StepDeploy";
import { ToastContainer } from "@/components/Toast";

export default function Home() {
  const [uiLanguage, setUiLanguage] = useState<"EN" | "PT">("PT");
  const [view, setView] = useState<"dashboard" | "setup">("dashboard");
  const [managementMode, setManagementMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [steamApiKey, setSteamApiKey] = useState("");
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState("");
  const [members, setMembers] = useState<Record<string, MemberRecord>>({});
  const [messageLanguage, setMessageLanguage] = useState<"EN" | "PT">("EN");
  const [storeCountryCode, setStoreCountryCode] = useState("br");
  const [hasExistingConfig, setHasExistingConfig] = useState(false);

  // Ranking Bot State
  const [enableRankingBot, setEnableRankingBot] = useState(false);
  const [discordAppId, setDiscordAppId] = useState("");
  const [discordBotToken, setDiscordBotToken] = useState("");
  const [discordPublicKey, setDiscordPublicKey] = useState("");
  const [discordGuildId, setDiscordGuildId] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [githubTargetRepo, setGithubTargetRepo] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [cloudflareAccountId, setCloudflareAccountId] = useState("");
  const [cloudflareApiToken, setCloudflareApiToken] = useState("");
  const [rankingBotGhToken, setRankingBotGhToken] = useState("");
  const [workerUrl, setWorkerUrl] = useState("");

  const [toasts, setToasts] = useState<Array<{ id: number; message: string }>>([]);

  const addToast = (message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // Load existing configuration from root repo on mount
  useEffect(() => {
    const savedLanguage = window.localStorage.getItem("steam-family-ui-language");
    if (savedLanguage === "EN" || savedLanguage === "PT") setUiLanguage(savedLanguage);
    async function loadConfig() {
      try {
        const res = await fetch("/api/config");
        if (!res.ok) return;
        const data = await res.json();
        if (data.hasExistingConfig) {
          setHasExistingConfig(true);
          setView("dashboard");
          const c = data.config;
          if (c.steamApiKey) setSteamApiKey(c.steamApiKey);
          if (c.discordWebhookUrl) setDiscordWebhookUrl(c.discordWebhookUrl);
          if (c.messageLanguage) setMessageLanguage(c.messageLanguage);
          if (c.storeCountryCode) setStoreCountryCode(c.storeCountryCode);

          if (c.enableRankingBot !== undefined) setEnableRankingBot(c.enableRankingBot);
          if (c.discordAppId) setDiscordAppId(c.discordAppId);
          if (c.discordPublicKey) setDiscordPublicKey(c.discordPublicKey);
          if (c.cloudflareAccountId) setCloudflareAccountId(c.cloudflareAccountId);
          if (c.cloudflareApiToken) setCloudflareApiToken(c.cloudflareApiToken);
          if (c.rankingBotGhToken) setRankingBotGhToken(c.rankingBotGhToken);
          if (c.workerUrl) setWorkerUrl(c.workerUrl);
          if (c.githubRepo) setGithubRepo(c.githubRepo);

          if (c.members && Object.keys(c.members).length > 0) {
            const initialMembers: Record<string, MemberRecord> = {};
            for (const [id, name] of Object.entries(c.members)) {
              initialMembers[id] = {
                steamId: id,
                name: String(name),
                avatarUrl: "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg",
                isProfilePublic: true,
              };
            }
            setMembers(initialMembers);
          }
        } else if (data.config?.githubRepo) {
          setGithubRepo(data.config.githubRepo);
        }
      } catch {
        // Non-fatal
      }
    }
    loadConfig();
  }, []);

  const handleAddMember = (member: MemberRecord) => {
    setMembers((prev) => ({ ...prev, [member.steamId]: member }));
  };

  const handleRemoveMember = (steamId: string) => {
    setMembers((prev) => {
      const next = { ...prev };
      delete next[steamId];
      return next;
    });
    addToast("Removed member.");
  };

  const handleUpdateMemberName = (steamId: string, newName: string) => {
    setMembers((prev) => {
      const existing = prev[steamId];
      if (!existing) return prev;
      return { ...prev, [steamId]: { ...existing, name: newName } };
    });
  };

  const canProceed = () => {
    if (currentStep === 1) {
      return steamApiKey.trim().length > 0 && discordWebhookUrl.trim().length > 0;
    }
    if (currentStep === 2) {
      return Object.keys(members).length > 0;
    }
    return true;
  };

  const handleNext = () => {
    if (!canProceed()) {
      if (currentStep === 1) {
        addToast("Please fill in both Steam API Key and Discord Webhook URL.");
      } else if (currentStep === 2) {
        addToast("Please add at least one family member.");
      }
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, 5));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  if (view === "dashboard") {
    return <Dashboard
      configured={hasExistingConfig}
      memberCount={Object.keys(members).length}
      members={members}
      onSetup={() => { setManagementMode(false); setCurrentStep(1); setView("setup"); }}
      onManage={() => { setManagementMode(true); setCurrentStep(2); setView("setup"); }}
      language={uiLanguage}
      onLanguageChange={(language) => { setUiLanguage(language); window.localStorage.setItem("steam-family-ui-language", language); }}
    />;
  }

  return (
    <div className="container">
      <LanguageSelector language={uiLanguage} onChange={(language) => { setUiLanguage(language); window.localStorage.setItem("steam-family-ui-language", language); }} />
      {/* Top Header */}
      <header className="header">
        <div className="brand-badge-group">
          <div className="brand-badge steam">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15.7l-2.4-1.02c-.89-.38-1.5-1.25-1.5-2.22 0-1.35 1.1-2.45 2.45-2.45.64 0 1.22.25 1.66.65l3.22-1.38C13.56 8.52 14.2 8 15 8c1.66 0 3 1.34 3 3s-1.34 3-3 3c-.47 0-.91-.11-1.3-.31l-3.32 1.41c.08.3.12.61.12.93 0 1.22-.61 2.3-1.54 2.94L12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/>
            </svg>
            <span>Steam</span>
          </div>
          <span className="brand-plus">+</span>
          <div className="brand-badge discord">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            <span>Discord</span>
          </div>
        </div>

        <h1 className="title">Steam Family Notifier</h1>
        <p className="subtitle">{managementMode ? (uiLanguage === "PT" ? "Gerencie os membros da família e corrija as estatísticas de compras." : "Manage your family members and repair purchase statistics.") : (uiLanguage === "PT" ? "Configure o Steam Family Notifier para seu servidor Discord." : "Set up Steam Family Notifier for your Discord server.")}</p>

        {hasExistingConfig && (
          <div className="existing-config-alert">
            <span className="pulse-dot" />
            <span>Loaded existing configuration from <code>.env</code></span>
          </div>
        )}
      </header>

      {/* Stepper Navigation */}
      <Stepper currentStep={currentStep} onSelectStep={(step) => setCurrentStep(step)} language={uiLanguage} />

      {/* Main Form Content */}
      <main className="main-card">
        {currentStep === 1 && (
          <StepCredentials
            steamApiKey={steamApiKey}
            onChangeSteamApiKey={setSteamApiKey}
            discordWebhookUrl={discordWebhookUrl}
            onChangeDiscordWebhookUrl={setDiscordWebhookUrl}
            onToast={addToast}
            language={uiLanguage}
          />
        )}

        {currentStep === 2 && (
          <StepMembers
            steamApiKey={steamApiKey}
            members={members}
            onAddMember={handleAddMember}
            onRemoveMember={handleRemoveMember}
            onUpdateMemberName={handleUpdateMemberName}
            onToast={addToast}
            language={uiLanguage}
          />
        )}

        {currentStep === 3 && (
          <StepPreferences
            messageLanguage={messageLanguage}
            onChangeMessageLanguage={setMessageLanguage}
            storeCountryCode={storeCountryCode}
            onChangeStoreCountryCode={setStoreCountryCode}
            language={uiLanguage}
          />
        )}

        {currentStep === 4 && (
          <StepRankingBot
            enableRankingBot={enableRankingBot}
            onChangeEnableRankingBot={setEnableRankingBot}
            discordAppId={discordAppId}
            onChangeDiscordAppId={setDiscordAppId}
            discordBotToken={discordBotToken}
            onChangeDiscordBotToken={setDiscordBotToken}
            discordPublicKey={discordPublicKey}
            onChangeDiscordPublicKey={setDiscordPublicKey}
            discordGuildId={discordGuildId}
            onChangeDiscordGuildId={setDiscordGuildId}
            githubRepo={githubRepo}
            onChangeGithubRepo={setGithubRepo}
            cloudflareAccountId={cloudflareAccountId}
            onChangeCloudflareAccountId={setCloudflareAccountId}
            cloudflareApiToken={cloudflareApiToken}
            onChangeCloudflareApiToken={setCloudflareApiToken}
            rankingBotGhToken={rankingBotGhToken}
            onChangeRankingBotGhToken={setRankingBotGhToken}
            workerUrl={workerUrl}
            onChangeWorkerUrl={setWorkerUrl}
            onToast={addToast}
          />
        )}

        {currentStep === 5 && (
          <StepDeploy
            steamApiKey={steamApiKey}
            discordWebhookUrl={discordWebhookUrl}
            members={members}
            messageLanguage={messageLanguage}
            storeCountryCode={storeCountryCode}
            enableRankingBot={enableRankingBot}
            discordAppId={discordAppId}
            discordPublicKey={discordPublicKey}
            cloudflareAccountId={cloudflareAccountId}
            cloudflareApiToken={cloudflareApiToken}
            rankingBotGhToken={rankingBotGhToken}
            workerUrl={workerUrl}
            githubRepo={githubRepo}
            onChangeGithubRepo={setGithubRepo}
            githubTargetRepo={githubTargetRepo}
            onChangeGithubTargetRepo={setGithubTargetRepo}
            onToast={addToast}
            githubToken={githubToken}
            onChangeGithubToken={setGithubToken}
            managementMode={managementMode}
            language={uiLanguage}
          />
        )}

        {/* Navigation Footer */}
        <footer className="nav-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleBack}
            disabled={currentStep === 1}
          >
            {uiLanguage === "PT" ? "← Voltar" : "← Back"}
          </button>

          <span className="step-counter">{uiLanguage === "PT" ? `Etapa ${currentStep} de 5` : `Step ${currentStep} of 5`}</span>

          {currentStep < 5 ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleNext}
            >
              {uiLanguage === "PT" ? "Próxima →" : "Next →"}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-success"
              onClick={() => addToast("Setup complete! Your configuration is ready.")}
            >
              {uiLanguage === "PT" ? "✓ Concluído" : "✓ All Set"}
            </button>
          )}
        </footer>
      </main>

      <ToastContainer toasts={toasts} />
    </div>
  );
}

function LanguageSelector({ language, onChange }: { language: "EN" | "PT"; onChange: (language: "EN" | "PT") => void }) {
  return <div className="language-selector"><label htmlFor="ui-language">Idioma</label><select id="ui-language" value={language} onChange={(event) => onChange(event.target.value as "EN" | "PT")}><option value="EN">🇺🇸 English</option><option value="PT">🇧🇷 Português</option></select></div>;
}

function Dashboard({ configured, memberCount, members, onSetup, onManage, language, onLanguageChange }: { configured: boolean; memberCount: number; members: Record<string, MemberRecord>; onSetup: () => void; onManage: () => void; language: "EN" | "PT"; onLanguageChange: (language: "EN" | "PT") => void }) {
  const [showBackfill, setShowBackfill] = useState(false);
  const [steamId, setSteamId] = useState("");
  const [appid, setAppid] = useState("");
  const [price, setPrice] = useState("");
  const [notify, setNotify] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [feedback, setFeedback] = useState("");
  const runBackfill = async () => {
    setFeedback("Executando…");
    const response = await fetch("/api/backfill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ steamId, appid, manualPrice: price, notify: dryRun ? false : notify, dryRun }) });
    const data = await response.json();
    setFeedback(data.success ? `Backfill concluído: ${data.result}.` : `Erro: ${data.error}`);
  };
  const pt = language === "PT";
  return <div className="container">
    <LanguageSelector language={language} onChange={onLanguageChange} />
    <header className="header"><div className="brand-badge-group">🎮 Steam Family Notifier</div><h1 className="title">{pt ? "Seu painel da família" : "Your family dashboard"}</h1><p className="subtitle">{pt ? "Configure uma vez, acompanhe a biblioteca e mantenha as estatísticas consistentes." : "Configure once, monitor the library, and keep your statistics consistent."}</p>{configured && <div className="existing-config-alert"><span className="pulse-dot" /> {pt ? `Aplicação configurada · ${memberCount} membros` : `Application configured · ${memberCount} members`}</div>}</header>
    <main className="dashboard-grid">
      {!configured && <section className="main-card dashboard-card"><span className="card-kicker">{pt ? "Primeiro passo" : "First step"}</span><h2>{pt ? "Comece sua configuração" : "Start your setup"}</h2><p className="field-desc">{pt ? "Conecte sua chave Steam, webhook do Discord e escolha os membros da família." : "Connect your Steam key, Discord webhook, and choose your family members."}</p><button className="btn btn-primary" onClick={onSetup}>{pt ? "Começar setup →" : "Start setup →"}</button></section>}
      {configured && <>
        <section className="main-card dashboard-card"><span className="card-kicker">{pt ? "Aplicação ativa" : "Active application"}</span><h2>{pt ? "Gerenciar aplicação" : "Manage application"}</h2><p className="field-desc">{pt ? "Edite membros e preferências. Alterações de membros enviam avisos somente aqui — nunca durante o setup inicial." : "Edit members and preferences. Member changes notify only here — never during initial setup."}</p><button className="btn btn-primary" onClick={onManage}>{pt ? "Editar membros e configurações →" : "Edit members and settings →"}</button></section>
        <section className="main-card dashboard-card"><span className="card-kicker">{pt ? "Correção operacional" : "Operational repair"}</span><h2>Manual backfill</h2><p className="field-desc">{pt ? "Recalcule uma compra que ficou fora das estatísticas do GitHub Actions." : "Recalculate a purchase missing from GitHub Actions statistics."}</p><button className="btn btn-secondary" onClick={() => setShowBackfill((value) => !value)}>{showBackfill ? (pt ? "Fechar" : "Close") : (pt ? "Abrir backfill" : "Open backfill")}</button>
          {showBackfill && <div className="backfill-form"><label className="field-label">{pt ? "Membro" : "Member"}<select value={steamId} onChange={(e) => setSteamId(e.target.value)}><option value="">{pt ? "Selecione…" : "Select…"}</option>{Object.entries(members).map(([id, member]) => <option key={id} value={id}>{member.name} — {id}</option>)}</select></label><label className="field-label">AppID<input type="text" value={appid} onChange={(e) => setAppid(e.target.value)} placeholder="4659620" /></label><label className="field-label">{pt ? "Preço manual (opcional)" : "Manual price (optional)"}<input type="text" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={pt ? "deixe vazio para consultar Steam" : "leave empty to query Steam"} /></label><label className="check-row"><input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} /> {pt ? "Dry run — não salvar nem notificar" : "Dry run — do not save or notify"}</label>{!dryRun && <label className="check-row"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> {pt ? "Notificar no Discord" : "Notify on Discord"}</label>}<button className={`btn ${dryRun ? "btn-secondary" : "btn-success"}`} onClick={runBackfill} disabled={!steamId || !appid}>{dryRun ? (pt ? "Simular backfill" : "Simulate backfill") : (pt ? "Executar backfill" : "Run backfill")}</button>{feedback && <div className="feedback-box info">{feedback}</div>}</div>}
        </section>
      </>}
    </main>
  </div>;
}
