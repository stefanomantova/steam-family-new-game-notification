(() => {
  const state = { step: 1, members: {}, config: {} };
  const $ = (id) => document.getElementById(id);
  const setFeedback = (id, message, ok = false) => {
    const element = $(id);
    if (element) { element.textContent = message; element.className = `status-feedback ${ok ? "success" : "error"}`; }
  };
  const api = async (path, body) => {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok || data.success === false || data.valid === false) throw new Error(data.error || (data.errors || []).join("; ") || "Request failed.");
    return data;
  };
  const showStep = (step) => {
    state.step = Math.max(1, Math.min(4, step));
    document.querySelectorAll(".step-section").forEach((section) => section.classList.toggle("active", section.id === `step-${state.step}`));
    document.querySelectorAll(".step-item").forEach((item) => item.classList.toggle("active", Number(item.dataset.step) === state.step));
    $("current-step-num").textContent = state.step;
    $("btn-prev-step").disabled = state.step === 1;
    $("btn-next-step").textContent = state.step === 4 ? "Finish" : "Next →";
    updateSummary();
  };
  const updateSummary = () => {
    $("summary-member-count").textContent = Object.keys(state.members).length;
    $("member-count-num").textContent = Object.keys(state.members).length;
    $("summary-language").textContent = document.querySelector('input[name="message-language"]:checked')?.value || "EN";
    $("summary-country").textContent = $("store-country-select").value;
  };
  const renderMembers = () => {
    const list = $("members-list");
    list.innerHTML = Object.entries(state.members).map(([id, member]) => `<div class="member-card"><b>${escapeHtml(member.name)}</b><code>${id}</code><button class="btn btn-secondary" data-remove-member="${id}">Remove</button></div>`).join("");
    $("members-empty").classList.toggle("hidden", Object.keys(state.members).length > 0);
    list.querySelectorAll("[data-remove-member]").forEach((button) => button.addEventListener("click", () => { delete state.members[button.dataset.removeMember]; renderMembers(); updateSummary(); }));
    updateSummary();
  };
  const collectConfig = () => ({ steamApiKey: $("steam-api-key").value.trim(), discordWebhookUrl: $("discord-webhook-url").value.trim(), members: Object.fromEntries(Object.entries(state.members).map(([id, member]) => [id, member.name])), messageLanguage: document.querySelector('input[name="message-language"]:checked')?.value || "EN", storeCountryCode: $("store-country-select").value === "custom" ? $("custom-country-code").value.trim().toLowerCase() : $("store-country-select").value });
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);

  $("btn-next-step").addEventListener("click", () => showStep(state.step + 1));
  $("btn-prev-step").addEventListener("click", () => showStep(state.step - 1));
  document.querySelectorAll(".step-item").forEach((item) => item.addEventListener("click", () => showStep(Number(item.dataset.step))));
  $("btn-toggle-key-visibility").addEventListener("click", () => { $("steam-api-key").type = $("steam-api-key").type === "password" ? "text" : "password"; });
  $("btn-verify-steam-key").addEventListener("click", async () => { try { await api("/api/verify/steam", { steamApiKey: $("steam-api-key").value }); setFeedback("steam-key-feedback", "Steam API key verified.", true); } catch (error) { setFeedback("steam-key-feedback", error.message); } });
  $("btn-test-discord").addEventListener("click", async () => { try { await api("/api/test/discord", { discordWebhookUrl: $("discord-webhook-url").value }); setFeedback("discord-webhook-feedback", "Discord test message sent.", true); } catch (error) { setFeedback("discord-webhook-feedback", error.message); } });
  $("btn-add-member").addEventListener("click", async () => { try { const data = await api("/api/resolve/member", { steamApiKey: $("steam-api-key").value, input: $("member-input").value }); state.members[data.player.steamId] = data.player; $("member-input").value = ""; setFeedback("member-add-feedback", "Member added.", true); renderMembers(); } catch (error) { setFeedback("member-add-feedback", error.message); } });
  $("store-country-select").addEventListener("change", () => { $("custom-country-code").classList.toggle("hidden", $("store-country-select").value !== "custom"); updateSummary(); });
  $("btn-save-config").addEventListener("click", async () => { try { await api("/api/save", collectConfig()); setFeedback("save-feedback", "Configuration saved.", true); } catch (error) { setFeedback("save-feedback", error.message); } });
  $("btn-run-baseline").addEventListener("click", async () => { try { const data = await api("/api/run-baseline", collectConfig()); $("terminal-window").classList.remove("hidden"); $("terminal-logs").textContent = (data.logs || []).join("\n"); setFeedback("baseline-feedback", "Baseline complete.", true); } catch (error) { setFeedback("baseline-feedback", error.message); } });
  $("btn-github-setup").addEventListener("click", async () => { try { const dryRun = $("github-dry-run").checked; const data = await api("/api/github", { githubToken: $("github-token").value, targetRepo: $("github-target-repo").value, dryRun, config: collectConfig() }); setFeedback("github-feedback", dryRun ? `Dry run complete: ${data.plan.actions.join("; ")}` : "GitHub setup complete.", true); $("btn-github-setup").textContent = dryRun ? "🧪 Preview GitHub Setup" : "Apply GitHub Setup"; } catch (error) { setFeedback("github-feedback", error.message); } });
  $("github-dry-run").addEventListener("change", () => { $("btn-github-setup").textContent = $("github-dry-run").checked ? "🧪 Preview GitHub Setup" : "Apply GitHub Setup"; });
  $("btn-shutdown-server").addEventListener("click", async () => { await api("/api/shutdown", {}); window.close(); });
  fetch("/api/config").then((response) => response.json()).then((data) => { if (!data.hasExistingConfig) return; const config = data.config; $("steam-api-key").value = config.steamApiKey || ""; $("discord-webhook-url").value = config.discordWebhookUrl || ""; state.members = Object.fromEntries(Object.entries(config.members || {}).map(([id, name]) => [id, { steamId: id, name }])); document.querySelector(`input[name="message-language"][value="${config.messageLanguage || "EN"}"]`).checked = true; $("store-country-select").value = config.storeCountryCode || "br"; $("existing-config-badge").classList.remove("hidden"); renderMembers(); });
  showStep(1);
})();
