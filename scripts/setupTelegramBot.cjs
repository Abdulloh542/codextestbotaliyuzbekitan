const fs = require("fs");
const path = require("path");
const https = require("https");

loadEnv(path.join(process.cwd(), ".env"));

const token = process.env.TELEGRAM_BOT_TOKEN || "";
const appUrl = process.env.APP_URL || "";
const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL || "";

if (!token) {
  console.error("TELEGRAM_BOT_TOKEN topilmadi.");
  process.exit(1);
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

async function run() {
  await api("setMyCommands", {
    commands: [
      { command: "start", description: "Mini Appni ochish" },
      { command: "help", description: "Yordam" }
    ]
  });

  if (appUrl) {
    await api("setChatMenuButton", {
      menu_button: {
        type: "web_app",
        text: "Mini App",
        web_app: {
          url: appUrl
        }
      }
    });
  }

  if (webhookUrl) {
    await api("setWebhook", {
      url: webhookUrl
    });
  }

  console.log("Telegram bot setup tugadi.");
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const index = trimmed.indexOf("=");
    if (index === -1) {
      continue;
    }
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function api(method, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = https.request(
      {
        hostname: "api.telegram.org",
        path: `/bot${token}/${method}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body)
        }
      },
      (response) => {
        let raw = "";
        response.on("data", (chunk) => {
          raw += chunk;
        });
        response.on("end", () => {
          const data = raw ? JSON.parse(raw) : {};
          if (response.statusCode >= 200 && response.statusCode < 300 && data.ok) {
            resolve(data);
            return;
          }
          reject(new Error(data.description || `Telegram API error ${response.statusCode}`));
        });
      }
    );

    request.on("error", reject);
    request.write(body);
    request.end();
  });
}
