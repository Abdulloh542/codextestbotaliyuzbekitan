const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");

loadEnv(path.join(process.cwd(), ".env"));

const {
  buildAdminSnapshot,
  ensureStoreShape,
  projectList,
  recordEvent,
  removeProject,
  saveReminder,
  updateUserProfile,
  upsertProject,
  upsertUser
} = require("./src/serverData.cjs");

const root = process.cwd();
const port = Number(process.env.PORT || 8000);
const dataDir = path.join(root, "data");
const dataFile = path.join(dataDir, "app-data.json");
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const ADMIN_TELEGRAM_IDS = (process.env.ADMIN_TELEGRAM_IDS || "5980483689,5716548745")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const APP_URL = process.env.APP_URL || "";
const TELEGRAM_WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_SCHEMA = process.env.SUPABASE_SCHEMA || "public";
const SUPABASE_USERS_TABLE = process.env.SUPABASE_USERS_TABLE || "tma_users";
const SUPABASE_EVENTS_TABLE = process.env.SUPABASE_EVENTS_TABLE || "tma_events";
const SUPABASE_REMINDERS_TABLE = process.env.SUPABASE_REMINDERS_TABLE || "tma_reminders";
const SUPABASE_NOTIFICATIONS_TABLE = process.env.SUPABASE_NOTIFICATIONS_TABLE || "tma_notifications";
const SUPABASE_PROJECTS_TABLE = process.env.SUPABASE_PROJECTS_TABLE || "tma_projects";

const DEFAULT_PROJECTS = [
  {
    slug: "taomlar",
    title: "Taomlar",
    tagline: "Restoranlar, combo va tez buyurtma",
    description:
      "Restoranlar, combo kartalar, chegirmalar va silliq checkout oqimi bitta premium interfeysda jamlanadi.",
    eta: "3-5 kun",
    category: "Food delivery",
    size: "wide",
    iconKey: "burger",
    accentKey: "amber",
    accent: "#f5c542",
    accentSecondary: "#ff8a1d",
    sortOrder: 0
  },
  {
    slug: "yetkazish",
    title: "Yetkazish",
    tagline: "Kuryer va live tracking",
    description:
      "Parcel va kuryer yetkazish moduli real vaqt tracking, status chiplar va foydalanuvchi uchun aniq ETA bilan ishlaydi.",
    eta: "3-5 kun",
    category: "Courier",
    size: "wide",
    iconKey: "delivery",
    accentKey: "gold",
    accent: "#ffd15e",
    accentSecondary: "#ff9b1a",
    sortOrder: 1
  },
  {
    slug: "market",
    title: "Market",
    tagline: "Mahsulotlar va aksiyalar",
    description:
      "Market katalogi, promo bloklar, qayta buyurtma va mahsulot kartalari Yandex Go ruhidagi premium ko'rinishda ochiladi.",
    eta: "3-5 kun",
    category: "Retail",
    size: "wide",
    iconKey: "market",
    accentKey: "sunset",
    accent: "#ffd877",
    accentSecondary: "#ff7c55",
    sortOrder: 2
  },
  {
    slug: "taksi",
    title: "Taksi",
    tagline: "Tez chaqirish va ETA",
    description:
      "Haydovchi topish, narx ko'rsatish va buyurtma bosqichlarini minimalist, tushunarli va premium usulda beradi.",
    eta: "2-4 daq",
    category: "Ride hailing",
    size: "wide",
    iconKey: "taxi",
    accentKey: "bright",
    accent: "#ffe36f",
    accentSecondary: "#ffaf2e",
    sortOrder: 3
  },
  {
    slug: "samokatlar",
    title: "Samokatlar",
    tagline: "Micro mobility",
    description: "Yaqin samokatni ochish va sessiyani boshqarish moduli.",
    eta: "3-5 kun",
    category: "Mobility",
    size: "mini",
    iconKey: "scooter",
    accentKey: "amber",
    accent: "#f6cf63",
    accentSecondary: "#ff9330",
    sortOrder: 4
  },
  {
    slug: "transport",
    title: "Transport",
    tagline: "Bus va route overview",
    description: "Jamoat transporti va bekat ko'rinishlari.",
    eta: "3-5 kun",
    category: "Transit",
    size: "mini",
    iconKey: "bus",
    accentKey: "sand",
    accent: "#f6d98b",
    accentSecondary: "#ff9146",
    sortOrder: 5
  },
  {
    slug: "navigator",
    title: "Navigator",
    tagline: "Yo'nalishlar",
    description: "Adres qidirish va route tavsiyasi.",
    eta: "3-5 kun",
    category: "Maps",
    size: "mini",
    iconKey: "pin",
    accentKey: "ochre",
    accent: "#f3ce74",
    accentSecondary: "#ff7d3b",
    sortOrder: 6
  },
  {
    slug: "powerbanklar",
    title: "Powerbanklar",
    tagline: "Charge stations",
    description: "Powerbank ijarasi va yaqin stansiyalar.",
    eta: "3-5 kun",
    category: "Utility",
    size: "mini",
    iconKey: "battery",
    accentKey: "gold",
    accent: "#f7d25b",
    accentSecondary: "#ff9259",
    sortOrder: 7
  }
];

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

ensureDataFile();

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
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

function ensureDataFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(
      dataFile,
      JSON.stringify(
        {
          settings: {
            brandName: "Orbit Hub",
            supportText: "Premium Telegram Mini App",
            defaultTheme: "light",
            defaultLanguage: "uz"
          },
          users: {},
          events: [],
          reminders: [],
          notifications: [],
          projects: {}
        },
        null,
        2
      )
    );
  }
}

function loadStore() {
  try {
    const raw = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    return ensureStoreShape(raw, DEFAULT_PROJECTS);
  } catch (error) {
    console.error("Failed to read data store:", error);
    return ensureStoreShape({}, DEFAULT_PROJECTS);
  }
}

function saveStore(store) {
  fs.writeFileSync(dataFile, JSON.stringify(store, null, 2));
}

function nowIso() {
  return new Date().toISOString();
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 4_000_000) {
        reject(new Error("Payload too large"));
      }
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

function decodeHeaderValue(value) {
  if (!value || Array.isArray(value)) {
    return "";
  }

  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

function parseTelegramInitData(initData) {
  if (!initData) {
    return { user: null, verified: false };
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const userParam = params.get("user");
  let user = null;

  if (userParam) {
    try {
      user = JSON.parse(userParam);
    } catch (error) {
      user = null;
    }
  }

  if (!BOT_TOKEN || !hash) {
    return { user, verified: false };
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  const isValid =
    computedHash.length === hash.length &&
    crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(hash));

  return {
    user: isValid ? user : null,
    verified: isValid
  };
}

function mapUser(user) {
  if (!user || !user.id) {
    return null;
  }

  return {
    telegramId: Number(user.id),
    username: user.username || "",
    firstName: user.first_name || "",
    lastName: user.last_name || "",
    languageCode: user.language_code || "",
    isPremium: Boolean(user.is_premium),
    allowsWriteToPm: Boolean(user.allows_write_to_pm),
    photoUrl: user.photo_url || ""
  };
}

function isAdminId(telegramId) {
  return ADMIN_TELEGRAM_IDS.includes(String(telegramId));
}

function resolveUserContext(req) {
  const initDataHeader = req.headers["x-telegram-init-data"];
  const parsed = parseTelegramInitData(Array.isArray(initDataHeader) ? initDataHeader[0] : initDataHeader);

  if (parsed.user) {
    const user = mapUser(parsed.user);
    return {
      mode: parsed.verified ? "telegram-verified" : "telegram-unverified",
      verified: parsed.verified,
      user,
      isAdmin: isAdminId(user.telegramId)
    };
  }

  const devUserId = req.headers["x-dev-user-id"];
  if (devUserId) {
    const user = mapUser({
      id: Number(devUserId),
      first_name: decodeHeaderValue(req.headers["x-dev-first-name"]),
      last_name: decodeHeaderValue(req.headers["x-dev-last-name"]),
      username: decodeHeaderValue(req.headers["x-dev-username"]),
      language_code: decodeHeaderValue(req.headers["x-dev-language"]),
      is_premium: String(req.headers["x-dev-premium"] || "") === "1",
      photo_url: decodeHeaderValue(req.headers["x-dev-photo-url"])
    });

    const forceAdmin = String(req.headers["x-dev-admin"] || "") === "1";
    return {
      mode: "dev",
      verified: false,
      user,
      isAdmin: forceAdmin || isAdminId(user.telegramId)
    };
  }

  return {
    mode: "guest",
    verified: false,
    user: null,
    isAdmin: false
  };
}

function projectWithState(project) {
  const ready = project.status === "ready";
  return {
    ...project,
    statusMessage: ready
      ? "Loyiha tayyor. Eslatma qoldirgan foydalanuvchilarga Telegram bot orqali xabar yuboriladi."
      : `Bu loyiha hozirda ishlab chiqilmoqda. Taxminiy tayyor bo'lish vaqti: ${project.eta}.`
  };
}

function validateProject(store, slug) {
  return store.projects[String(slug || "")] || null;
}

function publicUserProfile(user) {
  if (!user) {
    return null;
  }

  return {
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName,
    photoUrl: user.photoUrl,
    role: user.role,
    profile: user.profile,
    preferences: user.preferences,
    languageCode: user.languageCode,
    isPremium: user.isPremium,
    lastSeenAt: user.lastSeenAt
  };
}

function requestJson(urlString, method, payload, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const body = payload ? JSON.stringify(payload) : "";

    const request = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        method,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          ...extraHeaders
        }
      },
      (response) => {
        let raw = "";
        response.on("data", (chunk) => {
          raw += chunk;
        });
        response.on("end", () => {
          const contentType = response.headers["content-type"] || "";
          const data = contentType.includes("application/json") && raw ? JSON.parse(raw) : raw;

          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(data);
            return;
          }

          reject(new Error(typeof data === "string" ? data : JSON.stringify(data)));
        });
      }
    );

    request.on("error", reject);
    if (body) {
      request.write(body);
    }
    request.end();
  });
}

async function mirrorSupabase(table, record, onConflict) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }

  const conflict = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : "";
  const url = `${SUPABASE_URL}/rest/v1/${table}${conflict}`;

  await requestJson(url, "POST", record, {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    Prefer: onConflict ? "resolution=merge-duplicates,return=minimal" : "return=minimal",
    "Accept-Profile": SUPABASE_SCHEMA,
    "Content-Profile": SUPABASE_SCHEMA
  });
}

async function mirrorUser(userRecord) {
  if (!userRecord) {
    return;
  }

  try {
    await mirrorSupabase(
      SUPABASE_USERS_TABLE,
      {
        telegram_id: userRecord.telegramId,
        username: userRecord.username,
        first_name: userRecord.firstName,
        last_name: userRecord.lastName,
        language_code: userRecord.languageCode,
        is_premium: userRecord.isPremium,
        allows_write_to_pm: userRecord.allowsWriteToPm,
        photo_url: userRecord.photoUrl,
        display_name: userRecord.displayName,
        role: userRecord.role,
        profile: userRecord.profile,
        preferences: userRecord.preferences,
        created_at: userRecord.createdAt,
        last_seen_at: userRecord.lastSeenAt
      },
      "telegram_id"
    );
  } catch (error) {
    console.error("Supabase user mirror failed:", error.message);
  }
}

async function mirrorEvent(eventRecord) {
  try {
    await mirrorSupabase(SUPABASE_EVENTS_TABLE, {
      id: eventRecord.id,
      telegram_id: eventRecord.user?.telegramId || null,
      display_name: eventRecord.user?.displayName || "",
      username: eventRecord.user?.username || "",
      action: eventRecord.action,
      route: eventRecord.route,
      page_key: eventRecord.pageKey,
      project_slug: eventRecord.projectSlug,
      metadata: eventRecord.metadata,
      created_at: eventRecord.timestamp
    });
  } catch (error) {
    console.error("Supabase event mirror failed:", error.message);
  }
}

async function mirrorReminder(reminderRecord) {
  try {
    await mirrorSupabase(
      SUPABASE_REMINDERS_TABLE,
      {
        id: reminderRecord.id,
        telegram_id: reminderRecord.telegramId,
        username: reminderRecord.username,
        first_name: reminderRecord.firstName,
        last_name: reminderRecord.lastName,
        project_slug: reminderRecord.projectSlug,
        project_name: reminderRecord.projectName,
        suggestion: reminderRecord.suggestion,
        notify_me: reminderRecord.notifyMe,
        status: reminderRecord.status,
        created_at: reminderRecord.createdAt,
        updated_at: reminderRecord.updatedAt,
        notified_at: reminderRecord.notifiedAt
      },
      "telegram_id,project_slug"
    );
  } catch (error) {
    console.error("Supabase reminder mirror failed:", error.message);
  }
}

async function mirrorNotification(notificationRecord) {
  try {
    await mirrorSupabase(SUPABASE_NOTIFICATIONS_TABLE, {
      id: notificationRecord.id,
      telegram_id: notificationRecord.telegramId,
      project_slug: notificationRecord.projectSlug,
      project_name: notificationRecord.projectName,
      delivery_status: notificationRecord.deliveryStatus,
      error_message: notificationRecord.errorMessage || null,
      sent_at: notificationRecord.sentAt
    });
  } catch (error) {
    console.error("Supabase notification mirror failed:", error.message);
  }
}

async function mirrorProject(projectRecord) {
  try {
    await mirrorSupabase(
      SUPABASE_PROJECTS_TABLE,
      {
        slug: projectRecord.slug,
        title: projectRecord.title,
        tagline: projectRecord.tagline,
        description: projectRecord.description,
        eta: projectRecord.eta,
        category: projectRecord.category,
        size: projectRecord.size,
        icon_key: projectRecord.iconKey,
        accent_key: projectRecord.accentKey,
        accent: projectRecord.accent,
        accent_secondary: projectRecord.accentSecondary,
        image_url: projectRecord.imageUrl,
        cta_link: projectRecord.ctaLink,
        status: projectRecord.status,
        is_visible: projectRecord.isVisible,
        sort_order: projectRecord.sortOrder,
        created_at: projectRecord.createdAt,
        updated_at: projectRecord.updatedAt,
        ready_at: projectRecord.readyAt,
        last_notification_at: projectRecord.lastNotificationAt
      },
      "slug"
    );
  } catch (error) {
    console.error("Supabase project mirror failed:", error.message);
  }
}

async function sendTelegramApi(method, payload) {
  if (!BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  return requestJson(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, "POST", payload);
}

async function sendTelegramMessage(chatId, text, replyMarkup) {
  return sendTelegramApi("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: replyMarkup
  });
}

function buildMiniAppButton(label = "Mini Appni ochish") {
  if (!APP_URL) {
    return null;
  }

  return {
    inline_keyboard: [
      [
        {
          text: label,
          web_app: {
            url: APP_URL
          }
        }
      ]
    ]
  };
}

async function notifyProjectFollowers(store, project) {
  const watchers = store.reminders.filter(
    (reminder) => reminder.projectSlug === project.slug && reminder.notifyMe && !reminder.notifiedAt
  );
  const sentAt = nowIso();

  for (const watcher of watchers) {
    let notificationRecord;

    try {
      await sendTelegramMessage(
        watcher.telegramId,
        `${project.title} loyihasi tayyor bo'ldi. Mini App ichidan ko'rib chiqishingiz mumkin.`,
        buildMiniAppButton(`${project.title} ni ochish`)
      );

      watcher.notifiedAt = sentAt;
      watcher.status = "notified";
      notificationRecord = {
        id: `nt-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
        telegramId: watcher.telegramId,
        projectSlug: project.slug,
        projectName: project.title,
        deliveryStatus: "sent",
        errorMessage: null,
        sentAt
      };
    } catch (error) {
      notificationRecord = {
        id: `nt-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
        telegramId: watcher.telegramId,
        projectSlug: project.slug,
        projectName: project.title,
        deliveryStatus: "failed",
        errorMessage: error.message,
        sentAt
      };
    }

    store.notifications.unshift(notificationRecord);
    await mirrorNotification(notificationRecord);
  }

  if (store.projects[project.slug]) {
    store.projects[project.slug].lastNotificationAt = sentAt;
  }
}

async function handleTelegramUpdate(update) {
  const store = loadStore();
  const timestamp = nowIso();
  const message = update.message || update.edited_message;
  if (!message || !message.from) {
    return;
  }

  const userRecord = upsertUser(store, mapUser(message.from), timestamp, isAdminId(message.from.id));
  let changed = Boolean(userRecord);

  if (message.contact && Number(message.contact.user_id) === Number(message.from.id)) {
    updateUserProfile(
      store,
      message.from.id,
      {
        contactPhone: message.contact.phone_number
      },
      timestamp
    );
    changed = true;
  }

  if (typeof message.text === "string" && message.text.startsWith("/start")) {
    const welcome =
      "Assalomu alaykum. Mini App tayyor. Pastdagi tugma orqali platformani ochishingiz mumkin.";
    await sendTelegramMessage(message.chat.id, welcome, buildMiniAppButton());
    const startEvent = recordEvent(
      store,
      {
        action: "bot_start",
        route: "bot",
        pageKey: "bot-start",
        metadata: {},
        user: userRecord
      },
      timestamp
    );
    await mirrorEvent(startEvent);
    changed = true;
  }

  if (changed) {
    saveStore(store);
    await mirrorUser(store.users[String(message.from.id)]);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(requestUrl.pathname);

    if (pathname === "/api/health" && req.method === "GET") {
      sendJson(res, 200, {
        ok: true,
        appUrlConfigured: Boolean(APP_URL),
        webhookConfigured: Boolean(TELEGRAM_WEBHOOK_URL),
        supabaseConfigured: Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
      });
      return;
    }

    if (pathname === "/api/projects" && req.method === "GET") {
      const store = loadStore();
      sendJson(res, 200, {
        settings: store.settings,
        projects: projectList(store, false).map(projectWithState)
      });
      return;
    }

    if (pathname === "/api/session" && req.method === "POST") {
      const store = loadStore();
      const context = resolveUserContext(req);
      const timestamp = nowIso();

      if (context.user) {
        const userRecord = upsertUser(store, context.user, timestamp, context.isAdmin);
        saveStore(store);
        await mirrorUser(userRecord);
        sendJson(res, 200, {
          user: publicUserProfile(userRecord),
          verified: context.verified,
          isAdmin: context.isAdmin,
          mode: context.mode,
          appUrlConfigured: Boolean(APP_URL)
        });
        return;
      }

      sendJson(res, 200, {
        user: null,
        verified: false,
        isAdmin: false,
        mode: "guest",
        appUrlConfigured: Boolean(APP_URL)
      });
      return;
    }

    if (pathname === "/api/profile" && req.method === "GET") {
      const store = loadStore();
      const context = resolveUserContext(req);
      if (!context.user) {
        sendJson(res, 401, { error: "Telegram user is required" });
        return;
      }

      const userRecord = upsertUser(store, context.user, nowIso(), context.isAdmin);
      saveStore(store);
      await mirrorUser(userRecord);
      sendJson(res, 200, {
        profile: publicUserProfile(userRecord),
        note: "Telefon raqami Telegram Mini App ichida avtomatik kelmaydi; foydalanuvchi uni bot orqali ulashsa saqlanadi."
      });
      return;
    }

    if (pathname === "/api/profile" && req.method === "POST") {
      const body = await readBody(req);
      const store = loadStore();
      const context = resolveUserContext(req);
      if (!context.user) {
        sendJson(res, 401, { error: "Telegram user is required" });
        return;
      }

      upsertUser(store, context.user, nowIso(), context.isAdmin);
      const updatedProfile = updateUserProfile(
        store,
        context.user.telegramId,
        {
          about: String(body.about || "").slice(0, 400),
          customAvatar: String(body.customAvatar || "").slice(0, 900000),
          contactPhone: String(body.contactPhone || "").slice(0, 40),
          location: String(body.location || "").slice(0, 120),
          theme: body.theme === "dark" ? "dark" : "light",
          language: ["uz", "ru", "en"].includes(body.language) ? body.language : "uz"
        },
        nowIso()
      );

      const eventRecord = recordEvent(
        store,
        {
          action: "profile_updated",
          route: "profile",
          pageKey: "profile",
          metadata: {
            theme: updatedProfile.preferences.theme,
            language: updatedProfile.preferences.language
          },
          user: updatedProfile
        },
        nowIso()
      );

      saveStore(store);
      await Promise.all([mirrorUser(updatedProfile), mirrorEvent(eventRecord)]);

      sendJson(res, 200, {
        ok: true,
        profile: publicUserProfile(updatedProfile)
      });
      return;
    }

    if (pathname === "/api/events" && req.method === "POST") {
      const body = await readBody(req);
      if (!body.action) {
        sendJson(res, 400, { error: "action is required" });
        return;
      }

      const store = loadStore();
      const context = resolveUserContext(req);
      const timestamp = nowIso();
      const userRecord = context.user ? upsertUser(store, context.user, timestamp, context.isAdmin) : null;
      const eventRecord = recordEvent(
        store,
        {
          action: body.action,
          route: body.route,
          pageKey: body.pageKey,
          projectSlug: body.projectSlug,
          metadata: body.metadata,
          user: userRecord
        },
        timestamp
      );

      saveStore(store);
      await Promise.all([mirrorUser(userRecord), mirrorEvent(eventRecord)]);

      sendJson(res, 201, { ok: true });
      return;
    }

    if (pathname === "/api/reminders" && req.method === "POST") {
      const body = await readBody(req);
      const store = loadStore();
      const project = validateProject(store, body.projectSlug);
      if (!project) {
        sendJson(res, 400, { error: "Unknown project" });
        return;
      }

      const context = resolveUserContext(req);
      if (!context.user) {
        sendJson(res, 401, { error: "Telegram user is required" });
        return;
      }

      const timestamp = nowIso();
      const userRecord = upsertUser(store, context.user, timestamp, context.isAdmin);
      const reminderRecord = saveReminder(
        store,
        {
          telegramId: userRecord.telegramId,
          username: userRecord.username,
          firstName: userRecord.firstName,
          lastName: userRecord.lastName,
          projectSlug: project.slug,
          projectName: project.title,
          suggestion: String(body.suggestion || "").slice(0, 1000),
          notifyMe: Boolean(body.notifyMe),
          status: "watching"
        },
        timestamp
      );

      const eventRecord = recordEvent(
        store,
        {
          action: "remind_me_requested",
          route: body.route || "detail",
          pageKey: `${body.route || "detail"}:${project.slug}`,
          projectSlug: project.slug,
          metadata: {
            suggestionLength: String(body.suggestion || "").trim().length,
            notifyMe: Boolean(body.notifyMe)
          },
          user: userRecord
        },
        timestamp
      );

      saveStore(store);
      await Promise.all([mirrorUser(userRecord), mirrorReminder(reminderRecord), mirrorEvent(eventRecord)]);

      sendJson(res, 201, {
        ok: true,
        reminder: reminderRecord
      });
      return;
    }

    if (pathname === "/api/admin/overview" && req.method === "GET") {
      const context = resolveUserContext(req);
      if (!context.isAdmin) {
        sendJson(res, 403, { error: "Admin only" });
        return;
      }

      const store = loadStore();
      const selectedUserId = requestUrl.searchParams.get("userId");
      sendJson(
        res,
        200,
        buildAdminSnapshot(store, {
          selectedUserId: selectedUserId ? Number(selectedUserId) : null
        })
      );
      return;
    }

    if (pathname === "/api/admin/project-save" && req.method === "POST") {
      const context = resolveUserContext(req);
      if (!context.isAdmin) {
        sendJson(res, 403, { error: "Admin only" });
        return;
      }

      const body = await readBody(req);
      const store = loadStore();
      const timestamp = nowIso();
      const actor = context.user ? upsertUser(store, context.user, timestamp, true) : null;

      const projectRecord = upsertProject(
        store,
        {
          slug: body.slug,
          title: String(body.title || "").slice(0, 80),
          tagline: String(body.tagline || "").slice(0, 120),
          description: String(body.description || "").slice(0, 420),
          eta: String(body.eta || "").slice(0, 40),
          category: String(body.category || "").slice(0, 60),
          size: body.size === "mini" ? "mini" : "wide",
          iconKey: String(body.iconKey || "spark").slice(0, 40),
          accentKey: String(body.accentKey || "amber").slice(0, 40),
          accent: String(body.accent || "#f5c542").slice(0, 20),
          accentSecondary: String(body.accentSecondary || "#ff8a1d").slice(0, 20),
          imageUrl: String(body.imageUrl || "").slice(0, 900000),
          ctaLink: String(body.ctaLink || "").slice(0, 240),
          status: body.status === "ready" ? "ready" : "building",
          isVisible: body.isVisible !== false,
          sortOrder: Number(body.sortOrder || 0)
        },
        timestamp
      );

      const eventRecord = recordEvent(
        store,
        {
          action: "project_saved",
          route: "admin",
          pageKey: "admin-projects",
          projectSlug: projectRecord.slug,
          metadata: {
            isVisible: projectRecord.isVisible,
            size: projectRecord.size
          },
          user: actor
        },
        timestamp
      );

      saveStore(store);
      await Promise.all([mirrorUser(actor), mirrorProject(projectRecord), mirrorEvent(eventRecord)]);

      sendJson(res, 200, {
        ok: true,
        project: projectWithState(projectRecord)
      });
      return;
    }

    if (pathname === "/api/admin/project-delete" && req.method === "POST") {
      const context = resolveUserContext(req);
      if (!context.isAdmin) {
        sendJson(res, 403, { error: "Admin only" });
        return;
      }

      const body = await readBody(req);
      const store = loadStore();
      const project = validateProject(store, body.slug);
      if (!project) {
        sendJson(res, 404, { error: "Project not found" });
        return;
      }

      removeProject(store, project.slug);
      const actor = context.user ? upsertUser(store, context.user, nowIso(), true) : null;
      const eventRecord = recordEvent(
        store,
        {
          action: "project_deleted",
          route: "admin",
          pageKey: "admin-projects",
          projectSlug: project.slug,
          metadata: {},
          user: actor
        },
        nowIso()
      );

      saveStore(store);
      await Promise.all([mirrorUser(actor), mirrorEvent(eventRecord)]);

      sendJson(res, 200, { ok: true });
      return;
    }

    if (pathname === "/api/admin/project-status" && req.method === "POST") {
      const context = resolveUserContext(req);
      if (!context.isAdmin) {
        sendJson(res, 403, { error: "Admin only" });
        return;
      }

      const body = await readBody(req);
      const store = loadStore();
      const project = validateProject(store, body.slug);
      if (!project) {
        sendJson(res, 400, { error: "Unknown project" });
        return;
      }

      const timestamp = nowIso();
      const actor = context.user ? upsertUser(store, context.user, timestamp, true) : null;
      const previousStatus = project.status;
      project.status = body.status === "ready" ? "ready" : "building";
      project.updatedAt = timestamp;
      if (body.eta) {
        project.eta = String(body.eta).slice(0, 40);
      }
      project.readyAt = project.status === "ready" ? timestamp : null;

      const eventRecord = recordEvent(
        store,
        {
          action: "project_status_changed",
          route: "admin",
          pageKey: "admin-projects",
          projectSlug: project.slug,
          metadata: {
            previousStatus,
            nextStatus: project.status
          },
          user: actor
        },
        timestamp
      );

      if (previousStatus !== "ready" && project.status === "ready") {
        await notifyProjectFollowers(store, project);
      }

      saveStore(store);
      await Promise.all([mirrorUser(actor), mirrorProject(project), mirrorEvent(eventRecord)]);

      sendJson(res, 200, {
        ok: true,
        project: projectWithState(project)
      });
      return;
    }

    if (pathname === "/api/admin/settings" && req.method === "POST") {
      const context = resolveUserContext(req);
      if (!context.isAdmin) {
        sendJson(res, 403, { error: "Admin only" });
        return;
      }

      const body = await readBody(req);
      const store = loadStore();
      store.settings = {
        ...store.settings,
        brandName: String(body.brandName || store.settings.brandName || "Orbit Hub").slice(0, 60),
        supportText: String(body.supportText || store.settings.supportText || "").slice(0, 120),
        defaultTheme: body.defaultTheme === "dark" ? "dark" : "light",
        defaultLanguage: ["uz", "ru", "en"].includes(body.defaultLanguage)
          ? body.defaultLanguage
          : "uz"
      };

      const actor = context.user ? upsertUser(store, context.user, nowIso(), true) : null;
      const eventRecord = recordEvent(
        store,
        {
          action: "admin_settings_saved",
          route: "admin",
          pageKey: "admin-settings",
          metadata: {
            brandName: store.settings.brandName
          },
          user: actor
        },
        nowIso()
      );

      saveStore(store);
      await Promise.all([mirrorUser(actor), mirrorEvent(eventRecord)]);
      sendJson(res, 200, { ok: true, settings: store.settings });
      return;
    }

    if (pathname === "/api/telegram/webhook" && req.method === "POST") {
      const body = await readBody(req);
      await handleTelegramUpdate(body);
      sendJson(res, 200, { ok: true });
      return;
    }

    let filePath = path.normalize(path.join(root, pathname === "/" ? "/index.html" : pathname));
    if (!filePath.startsWith(root)) {
      res.statusCode = 403;
      res.end("Forbidden");
      return;
    }

    if (!path.extname(filePath) && !pathname.startsWith("/api/")) {
      filePath = path.join(root, "index.html");
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.statusCode = 404;
        res.end("Not found");
        return;
      }

      res.setHeader("Content-Type", mime[path.extname(filePath).toLowerCase()] || "application/octet-stream");
      res.end(data);
    });
  } catch (error) {
    console.error("Server error:", error);
    sendJson(res, 500, { error: "Internal server error" });
  }
});

server.listen(port, () => {
  console.log(`Orbit Hub server running at http://localhost:${port}`);
});
