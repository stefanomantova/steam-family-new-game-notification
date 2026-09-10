import type { Notifier } from "../ports/notifier.js";
import { fetchJson } from "./http.js";

export class DiscordWebhookNotifier implements Notifier {
  public constructor(private readonly webhookUrl: string) {}

  public async send(message: string): Promise<void> {
    await fetchJson(this.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });
  }
}
