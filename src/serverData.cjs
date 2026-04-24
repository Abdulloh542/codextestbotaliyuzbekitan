function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function normalizeProject(project, index = 0) {
  const slug = slugify(project.slug || project.title || `project-${index + 1}`);
  return {
    slug,
    title: project.title || "Yangi loyiha",
    tagline: project.tagline || "",
    description: project.description || "",
    eta: project.eta || "3-5 kun",
    category: project.category || "Service",
    size: project.size === "mini" ? "mini" : "wide",
    iconKey: project.iconKey || "spark",
    accentKey: project.accentKey || "amber",
    accent: project.accent || "#f5c542",
    accentSecondary: project.accentSecondary || "#ff8a1d",
    imageUrl: project.imageUrl || "",
    ctaLink: project.ctaLink || "",
    status: project.status === "ready" ? "ready" : "building",
    isVisible: project.isVisible !== false,
    sortOrder: Number.isFinite(Number(project.sortOrder)) ? Number(project.sortOrder) : index,
    updatedAt: project.updatedAt || null,
    createdAt: project.createdAt || null,
    readyAt: project.readyAt || null,
    lastNotificationAt: project.lastNotificationAt || null
  };
}

function createStore(projectCatalog = []) {
  const projects = {};

  projectCatalog.forEach((project, index) => {
    const normalized = normalizeProject(project, index);
    projects[normalized.slug] = normalized;
  });

  return {
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
    projects
  };
}

function ensureStoreShape(raw, projectCatalog = []) {
  const seeded = createStore(projectCatalog);
  const candidate = raw && typeof raw === "object" ? raw : {};
  const store = {
    settings:
      candidate.settings && typeof candidate.settings === "object" && !Array.isArray(candidate.settings)
        ? { ...seeded.settings, ...candidate.settings }
        : seeded.settings,
    users:
      candidate.users && typeof candidate.users === "object" && !Array.isArray(candidate.users)
        ? candidate.users
        : {},
    events: Array.isArray(candidate.events) ? candidate.events : [],
    reminders: Array.isArray(candidate.reminders) ? candidate.reminders : [],
    notifications: Array.isArray(candidate.notifications) ? candidate.notifications : [],
    projects:
      candidate.projects && typeof candidate.projects === "object" && !Array.isArray(candidate.projects)
        ? candidate.projects
        : {}
  };

  projectCatalog.forEach((project, index) => {
    const normalized = normalizeProject(project, index);
    store.projects[normalized.slug] = {
      ...normalized,
      ...(store.projects[normalized.slug] || {})
    };
  });

  Object.keys(store.projects).forEach((slug, index) => {
    store.projects[slug] = normalizeProject(store.projects[slug], index);
  });

  return store;
}

function displayName(user) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return fullName || user.username || `User ${user.telegramId}`;
}

function ensureUserShape(previous, nextUser = {}, nowIso, isAdmin = false) {
  const telegramId = Number(nextUser.telegramId || previous.telegramId);
  const profile = {
    about: nextUser.profile?.about ?? previous.profile?.about ?? "",
    customAvatar: nextUser.profile?.customAvatar ?? previous.profile?.customAvatar ?? "",
    contactPhone: nextUser.profile?.contactPhone ?? previous.profile?.contactPhone ?? "",
    location: nextUser.profile?.location ?? previous.profile?.location ?? ""
  };
  const preferences = {
    theme: nextUser.preferences?.theme ?? previous.preferences?.theme ?? "light",
    language: nextUser.preferences?.language ?? previous.preferences?.language ?? "uz"
  };

  return {
    telegramId,
    username: nextUser.username || previous.username || "",
    firstName: nextUser.firstName || previous.firstName || "",
    lastName: nextUser.lastName || previous.lastName || "",
    languageCode: nextUser.languageCode || previous.languageCode || "",
    isPremium: Boolean(nextUser.isPremium ?? previous.isPremium ?? false),
    allowsWriteToPm: Boolean(nextUser.allowsWriteToPm ?? previous.allowsWriteToPm ?? false),
    photoUrl: nextUser.photoUrl || previous.photoUrl || "",
    role: isAdmin ? "admin" : previous.role || "user",
    profile,
    preferences,
    lastSeenAt: nowIso,
    createdAt: previous.createdAt || nowIso,
    displayName: displayName({
      ...previous,
      ...nextUser,
      telegramId
    })
  };
}

function upsertUser(store, user, nowIso, isAdmin = false) {
  if (!user || !user.telegramId) {
    return null;
  }

  const key = String(user.telegramId);
  const previous = store.users[key] || {};
  const record = ensureUserShape(previous, user, nowIso, isAdmin);
  store.users[key] = record;
  return record;
}

function updateUserProfile(store, telegramId, payload, nowIso) {
  const key = String(telegramId);
  const previous = store.users[key];
  if (!previous) {
    return null;
  }

  const next = ensureUserShape(
    previous,
    {
      telegramId,
      profile: {
        about: payload.about,
        customAvatar: payload.customAvatar,
        contactPhone: payload.contactPhone,
        location: payload.location
      },
      preferences: {
        theme: payload.theme,
        language: payload.language
      }
    },
    nowIso,
    previous.role === "admin"
  );

  store.users[key] = next;
  return next;
}

function recordEvent(store, payload, nowIso) {
  const entry = {
    id: payload.id || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    action: payload.action,
    route: payload.route || "dashboard",
    pageKey: payload.pageKey || payload.route || "dashboard",
    projectSlug: payload.projectSlug || null,
    metadata: payload.metadata || {},
    timestamp: nowIso,
    user: payload.user
      ? {
          telegramId: Number(payload.user.telegramId),
          displayName: payload.user.displayName || displayName(payload.user),
          username: payload.user.username || ""
        }
      : null
  };

  store.events.unshift(entry);
  if (store.events.length > 5000) {
    store.events.length = 5000;
  }

  return entry;
}

function saveReminder(store, payload, nowIso) {
  const existingIndex = store.reminders.findIndex(
    (reminder) =>
      Number(reminder.telegramId) === Number(payload.telegramId) &&
      reminder.projectSlug === payload.projectSlug
  );

  const nextRecord = {
    id:
      existingIndex >= 0
        ? store.reminders[existingIndex].id
        : `rm-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    telegramId: Number(payload.telegramId),
    username: payload.username || "",
    firstName: payload.firstName || "",
    lastName: payload.lastName || "",
    projectSlug: payload.projectSlug,
    projectName: payload.projectName,
    suggestion: payload.suggestion || "",
    notifyMe: Boolean(payload.notifyMe),
    status: payload.status || "watching",
    createdAt: existingIndex >= 0 ? store.reminders[existingIndex].createdAt : nowIso,
    updatedAt: nowIso,
    notifiedAt: existingIndex >= 0 ? store.reminders[existingIndex].notifiedAt || null : null
  };

  if (existingIndex >= 0) {
    store.reminders[existingIndex] = nextRecord;
  } else {
    store.reminders.unshift(nextRecord);
  }

  return nextRecord;
}

function upsertProject(store, payload, nowIso) {
  const previous = store.projects[payload.slug] || {};
  const next = normalizeProject(
    {
      ...previous,
      ...payload,
      slug: payload.slug || previous.slug,
      updatedAt: nowIso,
      createdAt: previous.createdAt || nowIso
    },
    Object.keys(store.projects).length
  );

  store.projects[next.slug] = next;
  return next;
}

function removeProject(store, slug) {
  if (!store.projects[slug]) {
    return false;
  }

  delete store.projects[slug];
  return true;
}

function projectList(store, includeHidden = false) {
  return Object.values(store.projects)
    .filter((project) => includeHidden || project.isVisible)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title));
}

function aggregateUserDetail(store, telegramId) {
  const user = store.users[String(telegramId)];
  if (!user) {
    return null;
  }

  const actions = store.events.filter((entry) => Number(entry.user?.telegramId) === Number(telegramId));
  const pageCounts = {};
  const projectClicks = {};

  actions.forEach((entry) => {
    const key = entry.pageKey || entry.route || "dashboard";
    pageCounts[key] = (pageCounts[key] || 0) + 1;
    if (entry.projectSlug) {
      projectClicks[entry.projectSlug] = (projectClicks[entry.projectSlug] || 0) + 1;
    }
  });

  return {
    profile: user,
    totalActions: actions.length,
    pageStats: Object.entries(pageCounts)
      .map(([key, count]) => ({ key, count }))
      .sort((left, right) => right.count - left.count),
    projectStats: Object.entries(projectClicks)
      .map(([slug, count]) => ({ slug, count }))
      .sort((left, right) => right.count - left.count),
    timeline: actions.slice(0, 120)
  };
}

function buildAdminSnapshot(store, options = {}) {
  const includeHidden = true;
  const users = Object.values(store.users).sort((left, right) =>
    String(right.lastSeenAt || "").localeCompare(String(left.lastSeenAt || ""))
  );
  const reminders = [...store.reminders].sort((left, right) =>
    String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""))
  );
  const events = [...store.events].sort((left, right) =>
    String(right.timestamp || "").localeCompare(String(left.timestamp || ""))
  );
  const notifications = [...store.notifications].sort((left, right) =>
    String(right.sentAt || "").localeCompare(String(left.sentAt || ""))
  );
  const projects = projectList(store, includeHidden).map((project) => {
    const clicks = events.filter((entry) => entry.projectSlug === project.slug).length;
    const reminderCount = reminders.filter((entry) => entry.projectSlug === project.slug && entry.notifyMe).length;
    return {
      ...project,
      clicks,
      reminderCount
    };
  });

  const userStats = users.map((user) => {
    const actions = events.filter((entry) => Number(entry.user?.telegramId) === Number(user.telegramId));
    return {
      telegramId: user.telegramId,
      displayName: user.displayName || displayName(user),
      username: user.username || "",
      photoUrl: user.profile?.customAvatar || user.photoUrl || "",
      role: user.role || "user",
      language: user.preferences?.language || user.languageCode || "uz",
      theme: user.preferences?.theme || "light",
      contactPhone: user.profile?.contactPhone || "",
      lastSeenAt: user.lastSeenAt,
      totalActions: actions.length,
      totalClicks: actions.filter((entry) => entry.action === "project_card_clicked").length,
      lastAction: actions[0]?.action || null
    };
  });

  const topProject = [...projects].sort((left, right) => right.clicks - left.clicks)[0] || null;
  const selectedUser =
    options.selectedUserId || options.selectedUserId === 0
      ? aggregateUserDetail(store, Number(options.selectedUserId))
      : null;

  return {
    settings: store.settings,
    summary: {
      totalUsers: users.length,
      totalActions: events.length,
      totalReminders: reminders.length,
      totalNotifications: notifications.length,
      topProjectTitle: topProject ? topProject.title : "Hozircha yo'q"
    },
    users: userStats,
    reminders,
    projects,
    recentEvents: events.slice(0, 80),
    notifications: notifications.slice(0, 40),
    selectedUser
  };
}

module.exports = {
  aggregateUserDetail,
  buildAdminSnapshot,
  createStore,
  displayName,
  ensureStoreShape,
  normalizeProject,
  projectList,
  recordEvent,
  removeProject,
  saveReminder,
  slugify,
  updateUserProfile,
  upsertProject,
  upsertUser
};
