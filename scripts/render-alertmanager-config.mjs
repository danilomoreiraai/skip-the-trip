import { chown, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const output = process.env.ALERTMANAGER_CONFIG_PATH ?? "/alertmanager/config/alertmanager.yml";
const dataDirectory = process.env.ALERTMANAGER_DATA_PATH ?? "/alertmanager/data";
const webhookUrl = process.env.ALERT_WEBHOOK_URL?.trim();
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
const telegramChatId = process.env.TELEGRAM_CHAT_ID?.trim();

function receiver() {
  if (webhookUrl) {
    return { name: "operations", webhook_configs: [{ url: webhookUrl, send_resolved: true }] };
  }

  if (!telegramBotToken || !telegramChatId) {
    throw new Error(
      "Set ALERT_WEBHOOK_URL or both TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID",
    );
  }

  const chatId = Number(telegramChatId);
  if (!Number.isSafeInteger(chatId)) {
    throw new Error("TELEGRAM_CHAT_ID must be an integer");
  }

  return {
    name: "operations",
    telegram_configs: [
      {
        bot_token: telegramBotToken,
        chat_id: chatId,
        parse_mode: "",
        send_resolved: true,
        message:
          "{{ .Status | toUpper }}: {{ .CommonLabels.alertname }}\nSeverity: {{ .CommonLabels.severity }}\n{{ range .Alerts }}{{ .Annotations.summary }}\n{{ .Annotations.description }}\nRunbook: {{ .Annotations.runbook_url }}\n{{ end }}",
      },
    ],
  };
}

const config = {
  global: { resolve_timeout: "5m" },
  route: {
    receiver: "operations",
    group_by: ["alertname", "severity"],
    group_wait: "1s",
    group_interval: "5m",
    repeat_interval: "4h",
  },
  receivers: [receiver()],
};

await mkdir(dirname(output), { recursive: true });
await mkdir(dataDirectory, { recursive: true });
await writeFile(output, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o644 });
await chown(dataDirectory, 65_534, 65_534);
console.log(`Alertmanager configuration written to ${output}`);
