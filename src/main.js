const app = document.getElementById("app");
const toastRoot = document.getElementById("toast-root");

const ICON_MAP = {
  burger: "🍔",
  delivery: "🚚",
  market: "🛍️",
  taxi: "🚕",
  scooter: "🛴",
  bus: "🚌",
  pin: "📍",
  battery: "🔋",
  spark: "✨"
};

const state = {
  loading: true,
  route: parseRoute(),
  settings: {
    brandName: "Orbit Hub",
    supportText: "Premium Telegram Mini App",
    defaultTheme: "light",
    defaultLanguage: "uz"
  },
  projects: [],
  search: "",
  feedbackDrafts: {},
  feedbackTouched: {},
  remindPending: false,
  sliderIndex: 0,
  adminLoading: false,
  adminData: null,
  adminLoadedAt: 0,
  profileSaving: false,
  adminProjectSaving: false,
  adminSettingsSaving: false,
  session: {
    initData: "",
    hasTelegram: false,
    verified: false,
    mode: "guest",
    user: null,
    isAdmin: false,
    appUrlConfigured: false,
    devAdmin: false
  },
  profileDraft: createEmptyProfileDraft(),
  adminProjectDraft: createEmptyProjectDraft(0),
  adminSettingsDraft: {
    brandName: "Orbit Hub",
    supportText: "Premium Telegram Mini App",
    defaultTheme: "light",
    defaultLanguage: "uz"
  }
};

const dateFormatter = new Intl.DateTimeFormat("uz-UZ", {
  dateStyle: "medium",
  timeStyle: "short"
});

let toastTimer = null;
let searchTimer = null;

init();

window.addEventListener("hashchange", () => {
  applyRoute();
});

document.addEventListener("click", async (event) => {
  const projectButton = event.target.closest("[data-open-project]");
  if (projectButton) {
    const slug = projectButton.dataset.openProject;
    await trackEvent("project_card_clicked", {
      route: "dashboard",
      pageKey: "dashboard-grid",
      projectSlug: slug
    });
    navigate({ name: "project", slug });
    return;
  }

  const navButton = event.target.closest("[data-nav]");
  if (navButton) {
    const nav = navButton.dataset.nav;
    if (nav === "dashboard") {
      navigate({ name: "dashboard" });
    }
    if (nav === "profile") {
      navigate({ name: "profile" });
    }
    if (nav === "admin") {
      navigate({ name: "admin" });
    }
    return;
  }

  const focusSearchButton = event.target.closest("[data-focus-search]");
  if (focusSearchButton) {
    navigate({ name: "dashboard" });
    window.setTimeout(() => {
      document.getElementById("project-search")?.focus();
    }, 50);
    return;
  }

  const sliderButton = event.target.closest("[data-slider]");
  if (sliderButton) {
    moveSlider(sliderButton.dataset.slider);
    return;
  }

  const refreshButton = event.target.closest("[data-admin-refresh]");
  if (refreshButton) {
    await ensureAdminData(true);
    return;
  }

  const editProjectButton = event.target.closest("[data-edit-project]");
  if (editProjectButton) {
    const project = findProject(editProjectButton.dataset.editProject);
    if (project) {
      state.adminProjectDraft = { ...project };
      render();
    }
    return;
  }

  const newProjectButton = event.target.closest("[data-new-project]");
  if (newProjectButton) {
    state.adminProjectDraft = createEmptyProjectDraft(state.projects.length);
    render();
    return;
  }

  const deleteProjectButton = event.target.closest("[data-delete-project]");
  if (deleteProjectButton) {
    await deleteProject(deleteProjectButton.dataset.deleteProject);
    return;
  }

  const statusButton = event.target.closest("[data-admin-status]");
  if (statusButton) {
    await updateProjectStatus(statusButton.dataset.slug, statusButton.dataset.adminStatus);
    return;
  }

  const userButton = event.target.closest("[data-open-user]");
  if (userButton) {
    navigate({ name: "adminUser", userId: Number(userButton.dataset.openUser) });
    return;
  }

  const closeUserButton = event.target.closest("[data-close-user]");
  if (closeUserButton) {
    navigate({ name: "admin" });
  }
});

document.addEventListener("submit", async (event) => {
  if (event.target.matches("[data-reminder-form]")) {
    event.preventDefault();
    await submitReminder();
    return;
  }

  if (event.target.matches("#profile-form")) {
    event.preventDefault();
    await saveProfile();
    return;
  }

  if (event.target.matches("#admin-project-form")) {
    event.preventDefault();
    await saveProject();
    return;
  }

  if (event.target.matches("#admin-settings-form")) {
    event.preventDefault();
    await saveAdminSettings();
    return;
  }

  if (event.target.matches("#search-form")) {
    event.preventDefault();
    navigate({ name: "dashboard" });
  }
});

document.addEventListener("input", (event) => {
  if (event.target.matches("#project-search")) {
    state.search = event.target.value;
    if (state.route.name !== "dashboard") {
      navigate({ name: "dashboard" });
      return;
    }
    render();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      if (state.search.trim()) {
        trackEvent("search_used", {
          route: "dashboard",
          pageKey: "dashboard-search",
          query: state.search.trim().slice(0, 80),
          resultCount: filteredProjects().length
        });
      }
    }, 350);
    return;
  }

  if (event.target.matches("[data-feedback-textarea]")) {
    const slug = event.target.dataset.projectSlug;
    state.feedbackDrafts[slug] = event.target.value;
    if (!state.feedbackTouched[slug]) {
      state.feedbackTouched[slug] = true;
      trackEvent("feedback_started", {
        route: "project",
        pageKey: `project:${slug}`,
        projectSlug: slug
      });
    }
    return;
  }

  if (event.target.matches("[data-profile-field]")) {
    state.profileDraft[event.target.dataset.profileField] = event.target.value;
    return;
  }

  if (event.target.matches("[data-project-field]")) {
    const key = event.target.dataset.projectField;
    state.adminProjectDraft[key] =
      event.target.type === "checkbox" ? event.target.checked : event.target.value;
    return;
  }

  if (event.target.matches("[data-settings-field]")) {
    state.adminSettingsDraft[event.target.dataset.settingsField] = event.target.value;
  }
});

document.addEventListener("change", async (event) => {
  if (event.target.matches("#profile-avatar-input")) {
    const dataUrl = await fileToDataUrl(event.target.files?.[0]);
    if (dataUrl) {
      state.profileDraft.customAvatar = dataUrl;
      render();
    }
    return;
  }

  if (event.target.matches("#project-image-input")) {
    const dataUrl = await fileToDataUrl(event.target.files?.[0]);
    if (dataUrl) {
      state.adminProjectDraft.imageUrl = dataUrl;
      render();
    }
  }
});

async function init() {
  initTelegramSession();
  render();

  try {
    const [sessionPayload, projectsPayload, profilePayload] = await Promise.all([
      request("/api/session", { method: "POST" }),
      request("/api/projects"),
      request("/api/profile").catch(() => ({ profile: state.session.user, note: "" }))
    ]);

    state.session.user = sessionPayload.user || state.session.user;
    state.session.isAdmin = Boolean(sessionPayload.isAdmin);
    state.session.verified = Boolean(sessionPayload.verified);
    state.session.mode = sessionPayload.mode || state.session.mode;
    state.session.appUrlConfigured = Boolean(sessionPayload.appUrlConfigured);
    state.settings = projectsPayload.settings || state.settings;
    state.projects = Array.isArray(projectsPayload.projects) ? projectsPayload.projects : [];
    syncProfileDraft(profilePayload.profile || state.session.user);
    syncAdminSettingsDraft();
  } catch (error) {
    showToast(error.message || "Mini Appni yuklab bo'lmadi.");
  } finally {
    state.loading = false;
    applyTheme();
    applyRoute(true);
    render();
    await trackEvent("app_opened", {
      route: "dashboard",
      pageKey: "app-opened",
      mode: state.session.mode
    });
  }
}

function initTelegramSession() {
  const tg = window.Telegram?.WebApp;
  const query = new URLSearchParams(window.location.search);
  state.session.hasTelegram = Boolean(tg?.initDataUnsafe?.user);
  state.session.devAdmin = query.get("admin") === "1";

  if (tg) {
    tg.ready?.();
    tg.expand?.();
    tg.setHeaderColor?.("#f4efe3");
    tg.setBackgroundColor?.("#f4efe3");
    state.session.initData = tg.initData || "";
    state.session.user = mapTelegramUser(tg.initDataUnsafe.user);
  } else {
    state.session.user = {
      telegramId: Number(query.get("devUser") || (state.session.devAdmin ? 5980483689 : 2026001)),
      username: query.get("username") || "demo_user",
      firstName: query.get("name") || "Demo",
      lastName: query.get("lastName") || "User",
      displayName: `${query.get("name") || "Demo"} ${query.get("lastName") || "User"}`.trim(),
      photoUrl: "",
      role: state.session.devAdmin ? "admin" : "user",
      profile: {
        about: "",
        customAvatar: "",
        contactPhone: "",
        location: ""
      },
      preferences: {
        theme: "light",
        language: "uz"
      },
      languageCode: "uz",
      isPremium: false
    };
  }
}

function parseRoute() {
  const hash = window.location.hash || "#/";
  if (hash.startsWith("#/project/")) {
    return { name: "project", slug: decodeURIComponent(hash.replace("#/project/", "")) };
  }
  if (hash === "#/profile") {
    return { name: "profile" };
  }
  if (hash.startsWith("#/admin/user/")) {
    return {
      name: "adminUser",
      userId: Number(hash.replace("#/admin/user/", ""))
    };
  }
  if (hash === "#/admin") {
    return { name: "admin" };
  }
  return { name: "dashboard" };
}

function navigate(route) {
  let nextHash = "#/";
  if (route.name === "project") {
    nextHash = `#/project/${encodeURIComponent(route.slug)}`;
  }
  if (route.name === "profile") {
    nextHash = "#/profile";
  }
  if (route.name === "admin") {
    nextHash = "#/admin";
  }
  if (route.name === "adminUser") {
    nextHash = `#/admin/user/${route.userId}`;
  }

  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash;
  } else {
    applyRoute();
  }
}

function applyRoute(initial = false) {
  const nextRoute = parseRoute();

  if (nextRoute.name === "project" && !findProject(nextRoute.slug) && !state.loading) {
    navigate({ name: "dashboard" });
    return;
  }

  if ((nextRoute.name === "admin" || nextRoute.name === "adminUser") && !state.session.isAdmin && !state.loading) {
    navigate({ name: "dashboard" });
    showToast("Admin panel faqat sizga ko'rinadi.");
    return;
  }

  const changed = JSON.stringify(nextRoute) !== JSON.stringify(state.route);
  state.route = nextRoute;

  if (!state.loading && (state.route.name === "admin" || state.route.name === "adminUser")) {
    ensureAdminData(true);
  }

  render();

  if (!initial && changed && !state.loading) {
    const pageKey =
      state.route.name === "project"
        ? `project:${state.route.slug}`
        : state.route.name === "adminUser"
          ? `admin-user:${state.route.userId}`
          : state.route.name;

    trackEvent("screen_viewed", {
      route: state.route.name,
      pageKey
    });
  }
}

function createEmptyProfileDraft() {
  return {
    about: "",
    customAvatar: "",
    contactPhone: "",
    location: "",
    theme: "light",
    language: "uz"
  };
}

function createEmptyProjectDraft(projectCount = 0) {
  return {
    slug: "",
    title: "",
    tagline: "",
    description: "",
    eta: "3-5 kun",
    category: "",
    size: "wide",
    iconKey: "spark",
    accentKey: "amber",
    accent: "#f5c542",
    accentSecondary: "#ff8a1d",
    imageUrl: "",
    ctaLink: "",
    isVisible: true,
    sortOrder: projectCount,
    status: "building"
  };
}

function syncProfileDraft(profile) {
  const source = profile || {};
  state.profileDraft = {
    about: source.profile?.about || "",
    customAvatar: source.profile?.customAvatar || "",
    contactPhone: source.profile?.contactPhone || "",
    location: source.profile?.location || "",
    theme: source.preferences?.theme || state.settings.defaultTheme || "light",
    language: source.preferences?.language || state.settings.defaultLanguage || "uz"
  };
  applyTheme();
}

function syncAdminSettingsDraft() {
  state.adminSettingsDraft = {
    brandName: state.settings.brandName || "Orbit Hub",
    supportText: state.settings.supportText || "",
    defaultTheme: state.settings.defaultTheme || "light",
    defaultLanguage: state.settings.defaultLanguage || "uz"
  };
}

function applyTheme() {
  const theme = state.profileDraft.theme || state.settings.defaultTheme || "light";
  document.body.dataset.theme = theme;
}

function filteredProjects() {
  const query = state.search.trim().toLowerCase();
  if (!query) {
    return state.projects;
  }
  return state.projects.filter((project) => {
    const haystack = `${project.title} ${project.tagline} ${project.description} ${project.category}`.toLowerCase();
    return haystack.includes(query);
  });
}

function featuredProjects() {
  return filteredProjects().filter((project) => project.size === "wide").slice(0, 4);
}

function sliderProjects() {
  return filteredProjects().filter((project) => project.size !== "wide" || !featuredProjects().some((item) => item.slug === project.slug));
}

function findProject(slug) {
  return state.projects.find((project) => project.slug === slug) || null;
}

function moveSlider(direction) {
  const items = sliderProjects();
  if (!items.length) {
    return;
  }
  if (direction === "next") {
    state.sliderIndex = (state.sliderIndex + 1) % items.length;
  } else {
    state.sliderIndex = (state.sliderIndex - 1 + items.length) % items.length;
  }
  render();
}

async function ensureAdminData(force = false) {
  if (!state.session.isAdmin) {
    return;
  }
  if (!force && state.adminData && Date.now() - state.adminLoadedAt < 15000) {
    return;
  }

  state.adminLoading = true;
  render();

  try {
    const userId = state.route.name === "adminUser" ? `?userId=${state.route.userId}` : "";
    state.adminData = await request(`/api/admin/overview${userId}`);
    state.adminLoadedAt = Date.now();
  } catch (error) {
    showToast(error.message || "Admin ma'lumotlarini olib bo'lmadi.");
  } finally {
    state.adminLoading = false;
    render();
  }
}

async function updateProjectStatus(slug, status) {
  try {
    await request("/api/admin/project-status", {
      method: "POST",
      body: { slug, status }
    });
    await refreshProjectsAndAdmin();
    showToast(status === "ready" ? "Loyiha ready qilindi va xabar oqimi ishga tushdi." : "Loyiha build holatiga qaytdi.");
  } catch (error) {
    showToast(error.message || "Statusni o'zgartirib bo'lmadi.");
  }
}

async function saveProject() {
  state.adminProjectSaving = true;
  render();

  try {
    await request("/api/admin/project-save", {
      method: "POST",
      body: {
        ...state.adminProjectDraft,
        sortOrder: Number(state.adminProjectDraft.sortOrder || 0)
      }
    });
    await refreshProjectsAndAdmin();
    state.adminProjectDraft = createEmptyProjectDraft(state.projects.length);
    showToast("Kategoriya saqlandi.");
  } catch (error) {
    showToast(error.message || "Kategoriya saqlanmadi.");
  } finally {
    state.adminProjectSaving = false;
    render();
  }
}

async function deleteProject(slug) {
  try {
    await request("/api/admin/project-delete", {
      method: "POST",
      body: { slug }
    });
    await refreshProjectsAndAdmin();
    if (state.adminProjectDraft.slug === slug) {
      state.adminProjectDraft = createEmptyProjectDraft(state.projects.length);
    }
    showToast("Kategoriya o'chirildi.");
  } catch (error) {
    showToast(error.message || "Kategoriya o'chirilmadi.");
  }
}

async function saveAdminSettings() {
  state.adminSettingsSaving = true;
  render();

  try {
    const payload = await request("/api/admin/settings", {
      method: "POST",
      body: state.adminSettingsDraft
    });
    state.settings = payload.settings || state.settings;
    syncAdminSettingsDraft();
    applyTheme();
    await ensureAdminData(true);
    showToast("Admin sozlamalari saqlandi.");
  } catch (error) {
    showToast(error.message || "Admin sozlamalari saqlanmadi.");
  } finally {
    state.adminSettingsSaving = false;
    render();
  }
}

async function saveProfile() {
  state.profileSaving = true;
  render();

  try {
    const payload = await request("/api/profile", {
      method: "POST",
      body: state.profileDraft
    });
    state.session.user = payload.profile || state.session.user;
    syncProfileDraft(payload.profile);
    showToast("Profil saqlandi.");
  } catch (error) {
    showToast(error.message || "Profil saqlanmadi.");
  } finally {
    state.profileSaving = false;
    render();
  }
}

async function refreshProjectsAndAdmin() {
  const projectsPayload = await request("/api/projects");
  state.settings = projectsPayload.settings || state.settings;
  state.projects = projectsPayload.projects || state.projects;
  syncAdminSettingsDraft();
  if (state.session.isAdmin) {
    await ensureAdminData(true);
  }
}

async function submitReminder() {
  const project = findProject(state.route.slug);
  if (!project || state.remindPending) {
    return;
  }

  state.remindPending = true;
  render();

  try {
    await request("/api/reminders", {
      method: "POST",
      body: {
        projectSlug: project.slug,
        suggestion: state.feedbackDrafts[project.slug] || "",
        notifyMe: true,
        route: "project"
      }
    });
    await trackEvent("remind_button_pressed", {
      route: "project",
      pageKey: `project:${project.slug}`,
      projectSlug: project.slug
    });
    showToast("Eslatma saqlandi. Loyiha tayyor bo'lsa bot xabar yuboradi.");
  } catch (error) {
    showToast(error.message || "Eslatma saqlanmadi.");
  } finally {
    state.remindPending = false;
    render();
  }
}

async function trackEvent(action, meta = {}) {
  try {
    await request("/api/events", {
      method: "POST",
      body: {
        action,
        route: meta.route || state.route.name,
        pageKey: meta.pageKey || state.route.name,
        projectSlug: meta.projectSlug || null,
        metadata: meta
      }
    });
  } catch (error) {
    console.warn("Tracking failed:", error.message);
  }
}

async function request(url, options = {}) {
  const headers = {
    Accept: "application/json"
  };
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  if (state.session.initData) {
    headers["x-telegram-init-data"] = state.session.initData;
  } else if (state.session.user) {
    headers["x-dev-user-id"] = String(state.session.user.telegramId);
    headers["x-dev-first-name"] = encodeURIComponent(state.session.user.firstName || "");
    headers["x-dev-last-name"] = encodeURIComponent(state.session.user.lastName || "");
    headers["x-dev-username"] = encodeURIComponent(state.session.user.username || "");
    headers["x-dev-language"] = encodeURIComponent(state.session.user.languageCode || "uz");
    headers["x-dev-photo-url"] = encodeURIComponent(state.session.user.photoUrl || "");
    headers["x-dev-premium"] = state.session.user.isPremium ? "1" : "0";
    if (state.session.devAdmin) {
      headers["x-dev-admin"] = "1";
    }
  }

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const raw = await response.text();
  const payload = raw ? JSON.parse(raw) : {};
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return payload;
}

function render() {
  applyTheme();

  if (state.loading) {
    app.innerHTML = `${renderLoading()}${renderDock()}`;
    return;
  }

  let screen = renderDashboard();
  if (state.route.name === "project") {
    screen = renderProject();
  }
  if (state.route.name === "profile") {
    screen = renderProfile();
  }
  if (state.route.name === "admin" || state.route.name === "adminUser") {
    screen = renderAdmin();
  }

  app.innerHTML = `${screen}${renderDock()}`;
}

function renderLoading() {
  return `
    <section class="screen">
      <div class="headline">
        <span class="eyebrow">Telegram Mini App</span>
        <h1>Dashboard yuklanmoqda</h1>
        <p>Profil, analytics va admin boshqaruvi bir joyga tayyorlanyapti.</p>
      </div>
      <div class="loading-state">
        <strong>Bir necha soniya</strong>
        <p class="muted-copy">Telegram user, kategoriyalar va settings olinmoqda.</p>
        <div class="loading-bar"></div>
      </div>
    </section>
  `;
}

function renderDashboard() {
  const featured = featuredProjects();
  const slider = sliderProjects();
  const visibleSlider = slider.length
    ? [slider[state.sliderIndex], slider[(state.sliderIndex + 1) % slider.length], slider[(state.sliderIndex + 2) % slider.length]].filter(Boolean)
    : [];

  return `
    <section class="screen">
      <div class="topbar">
        <div class="headline">
          <span class="eyebrow">${escapeHtml(state.settings.supportText || "Premium Telegram Mini App")}</span>
          <h1>${escapeHtml(state.settings.brandName || "Orbit Hub")}</h1>
          <p>Yandex Go uslubidagi premium light dashboard. Har bir karta, klik va forma analytics bilan kuzatiladi.</p>
        </div>
      </div>

      <section class="profile-card">
        <div class="profile-card-main">
          ${renderAvatar(state.session.user, "profile-card-avatar")}
          <div>
            <strong>${escapeHtml(state.session.user?.displayName || "Telegram user")}</strong>
            <span>${state.session.user?.username ? `@${escapeHtml(state.session.user.username)}` : `ID ${state.session.user?.telegramId || ""}`}</span>
          </div>
        </div>
        <div class="profile-card-actions">
          <button class="pill" type="button" data-nav="profile">Profil</button>
          ${state.session.isAdmin ? `<button class="pill" type="button" data-nav="admin">Admin panel</button>` : ""}
        </div>
      </section>

      <section class="dashboard-grid compact">
        ${featured.map((project) => renderProjectCard(project, true)).join("")}
      </section>

      <section class="service-slider">
        <div class="section-head">
          <div>
            <h2>Boshqa xizmatlar</h2>
            <p class="muted-copy">Silliq slider ichida qolgan servislar.</p>
          </div>
          ${
            slider.length > 1
              ? `<div class="slider-actions">
                  <button class="icon-pill" type="button" data-slider="prev">${iconChevronLeft()}</button>
                  <button class="icon-pill" type="button" data-slider="next">${iconChevronRight()}</button>
                </div>`
              : ""
          }
        </div>
        ${
          visibleSlider.length
            ? `<div class="slider-track">${visibleSlider.map((project) => renderProjectCard(project, false)).join("")}</div>`
            : `<div class="empty-state"><strong>Qolgan servislar yo'q</strong><p>Admin panel orqali yangilarini qo'shishingiz mumkin.</p></div>`
        }
      </section>
    </section>
  `;
}

function renderProjectCard(project, compact) {
  return `
    <button
      class="project-card ${compact ? "compact-card" : "slider-card"}"
      type="button"
      data-size="${escapeAttr(project.size)}"
      data-open-project="${escapeAttr(project.slug)}"
      style="--accent-local:${escapeAttr(project.accent)};--accent-local-2:${escapeAttr(project.accentSecondary)}"
      aria-label="${escapeAttr(project.title)}"
    >
      <div class="card-topline">
        <span class="card-tag">${escapeHtml(project.category)}</span>
        <span class="card-eta">${escapeHtml(project.eta)}</span>
      </div>
      <div class="card-visual">
        ${project.imageUrl ? `<img class="card-image" src="${escapeAttr(project.imageUrl)}" alt="${escapeAttr(project.title)}" />` : ""}
        <span class="card-orb"></span>
        <span class="card-cube"></span>
        <span class="card-chip"></span>
        <span class="card-emoji">${escapeHtml(ICON_MAP[project.iconKey] || ICON_MAP.spark)}</span>
      </div>
      <div class="card-copy">
        <span class="card-title small">${escapeHtml(project.title)}</span>
        <span class="card-subtitle">${escapeHtml(project.tagline)}</span>
      </div>
    </button>
  `;
}

function renderProject() {
  const project = findProject(state.route.slug);
  if (!project) {
    return `<section class="screen"><div class="empty-state"><strong>Loyiha topilmadi</strong></div></section>`;
  }
  const draft = state.feedbackDrafts[project.slug] || "";

  return `
    <section class="screen">
      <article class="detail-shell">
        <div class="detail-header">
          <div class="detail-header-top">
            <button class="icon-pill" type="button" data-nav="dashboard">${iconChevronLeft()}</button>
            <span class="status-chip ${project.status === "ready" ? "ready" : ""}">
              ${project.status === "ready" ? "READY" : "IN PROGRESS"}
            </span>
          </div>
          <h1>${escapeHtml(project.title)}</h1>
          <p>${escapeHtml(project.description)}</p>
        </div>

        <div class="detail-grid">
          <section class="status-banner">
            <strong>Status xabari</strong>
            <p>${escapeHtml(project.statusMessage)}</p>
          </section>

          <section class="glass-panel">
            <h2>Qisqa info</h2>
            <div class="status-list">
              <div class="status-list-item">
                <div>
                  <strong>Kategoriya</strong>
                  <span>${escapeHtml(project.category)}</span>
                </div>
                <span>${escapeHtml(project.eta)}</span>
              </div>
              <div class="status-list-item">
                <div>
                  <strong>Analytics</strong>
                  <span>Karta kliklari, reminderlar va user harakatlari admin panelga tushadi.</span>
                </div>
              </div>
            </div>
          </section>

          <form class="composer-card" data-reminder-form>
            <h2>Ushbu loyihada qanday funksiyalar bo'lishini xohlaysiz?</h2>
            <div class="textarea-wrap">
              <textarea
                data-feedback-textarea
                data-project-slug="${escapeAttr(project.slug)}"
                placeholder="Masalan: order history, live map, promo, bonus, favorite addresses..."
              >${escapeHtml(draft)}</textarea>
            </div>
            <button class="primary-button" type="submit" ${state.remindPending ? "disabled" : ""}>
              ${state.remindPending ? "Saqlanmoqda..." : "Menga eslat"}
            </button>
          </form>
        </div>
      </article>
    </section>
  `;
}

function renderProfile() {
  const user = state.session.user || {};
  const avatarSource = state.profileDraft.customAvatar || user.profile?.customAvatar || user.photoUrl || "";

  return `
    <section class="screen">
      <article class="profile-shell">
        <div class="detail-header">
          <div class="detail-header-top">
            <button class="icon-pill" type="button" data-nav="dashboard">${iconChevronLeft()}</button>
            <span class="status-chip ${state.session.isAdmin ? "ready" : ""}">
              ${state.session.isAdmin ? "ADMIN" : "PROFILE"}
            </span>
          </div>
          <h1>Profil</h1>
          <p>Telegram auth orqali avtomatik yaratilgan profil. Telefon raqami Telegram Mini App ichida avtomatik kelmaydi, lekin bot orqali kontakt ulashilsa saqlanadi.</p>
        </div>

        <section class="profile-summary-card">
          ${avatarSource ? `<img class="profile-summary-avatar" src="${escapeAttr(avatarSource)}" alt="${escapeAttr(user.displayName || "User")}" />` : renderAvatar(user, "profile-summary-avatar")}
          <div class="profile-summary-copy">
            <strong>${escapeHtml(user.displayName || "Telegram user")}</strong>
            <span>${user.username ? `@${escapeHtml(user.username)}` : `ID ${user.telegramId || ""}`}</span>
            <small>${escapeHtml(user.languageCode || "uz")} • ${state.session.verified ? "Telegram verified" : "Auto profile"}</small>
          </div>
        </section>

        <form id="profile-form" class="profile-form-card">
          <div class="form-grid">
            ${renderInputField("Joylashuv", "location", state.profileDraft.location)}
            ${renderSelectField("Til", "language", state.profileDraft.language, [
              ["uz", "O'zbekcha"],
              ["ru", "Русский"],
              ["en", "English"]
            ])}
            ${renderSelectField("Theme", "theme", state.profileDraft.theme, [
              ["light", "Light"],
              ["dark", "Dark"]
            ])}
            ${renderInputField("Telefon", "contactPhone", state.profileDraft.contactPhone, "Bot orqali kontakt yuborilganda to'ladi")}
          </div>
          <label class="field-block">
            <span>Qisqa bio</span>
            <textarea class="settings-textarea" data-profile-field="about" placeholder="O'zingiz haqingizda qisqacha yozing">${escapeHtml(state.profileDraft.about)}</textarea>
          </label>
          <label class="field-block upload-block">
            <span>Profil rasmi</span>
            <input id="profile-avatar-input" type="file" accept="image/*" />
          </label>
          <button class="primary-button" type="submit" ${state.profileSaving ? "disabled" : ""}>
            ${state.profileSaving ? "Saqlanmoqda..." : "Profilni saqlash"}
          </button>
        </form>
      </article>
    </section>
  `;
}

function renderAdmin() {
  const data = state.adminData;
  const selectedUser = data?.selectedUser;

  return `
    <section class="screen">
      <article class="admin-shell">
        <div class="admin-header">
          <div class="detail-header-top">
            <button class="icon-pill" type="button" data-nav="dashboard">${iconChevronLeft()}</button>
            <button class="pill" type="button" data-admin-refresh>Yangilash</button>
          </div>
          <h1>Admin panel</h1>
          <p>Faqat admin ID lar uchun ochiladi. Userlar, kliklar, category CRUD, profil sozlamalari va loyiha notification oqimi shu yerdan boshqariladi.</p>
        </div>

        ${
          state.adminLoading || !data
            ? `<div class="loading-state"><strong>Analytics yuklanmoqda</strong><div class="loading-bar"></div></div>`
            : `
              <section class="metric-grid">
                ${renderMetric("Foydalanuvchi", data.summary.totalUsers, "Kirilgan Telegram userlar")}
                ${renderMetric("Harakatlar", data.summary.totalActions, "Klik, open, save va view")}
                ${renderMetric("Reminderlar", data.summary.totalReminders, "Menga eslat yozuvlari")}
                ${renderMetric("Top loyiha", data.summary.topProjectTitle, "Eng ko'p bosilgan servis")}
              </section>

              <section class="admin-split">
                <div class="admin-column">
                  <section class="table-card">
                    <div class="section-head">
                      <div>
                        <h2>Foydalanuvchilar</h2>
                        <p class="muted-copy">Bir foydalanuvchini bossangiz individual statistika ochiladi.</p>
                      </div>
                    </div>
                    <div class="table-list">
                      ${data.users.length ? data.users.map(renderAdminUserRow).join("") : `<div class="empty-state"><strong>User yo'q</strong></div>`}
                    </div>
                  </section>

                  ${
                    selectedUser
                      ? `
                        <section class="table-card highlight-card">
                          <div class="section-head">
                            <div>
                              <h2>User statistikasi</h2>
                              <p class="muted-copy">${escapeHtml(selectedUser.profile.displayName || "User")} bo'yicha barcha klik va page analytics.</p>
                            </div>
                            <button class="pill" type="button" data-close-user>Yopish</button>
                          </div>
                          <div class="user-stat-grid">
                            <div class="mini-stat-card">
                              <strong>${selectedUser.totalActions}</strong>
                              <span>Jami action</span>
                            </div>
                            <div class="mini-stat-card">
                              <strong>${selectedUser.pageStats.length}</strong>
                              <span>Activity page</span>
                            </div>
                          </div>
                          <div class="table-list compact-list">
                            ${selectedUser.pageStats.map((item) => `<div class="table-row"><div class="table-row-top"><strong>${escapeHtml(item.key)}</strong><span>${item.count}</span></div></div>`).join("")}
                          </div>
                        </section>
                      `
                      : ""
                  }

                  <section class="table-card">
                    <div class="section-head">
                      <div>
                        <h2>Kategoriyalar</h2>
                        <p class="muted-copy">Qo'shish, tahrirlash, yashirish yoki o'chirish shu yerdan.</p>
                      </div>
                      <button class="pill" type="button" data-new-project>Yangi</button>
                    </div>
                    <div class="table-list">
                      ${data.projects.map(renderAdminProjectRow).join("")}
                    </div>
                  </section>
                </div>

                <div class="admin-column">
                  <form id="admin-project-form" class="table-card form-card">
                    <h2>Category editor</h2>
                    <div class="form-grid">
                      ${renderProjectInput("Slug", "slug", state.adminProjectDraft.slug)}
                      ${renderProjectInput("Title", "title", state.adminProjectDraft.title)}
                      ${renderProjectInput("Tagline", "tagline", state.adminProjectDraft.tagline)}
                      ${renderProjectInput("ETA", "eta", state.adminProjectDraft.eta)}
                      ${renderProjectInput("Category", "category", state.adminProjectDraft.category)}
                      ${renderProjectSelect("Size", "size", state.adminProjectDraft.size, [
                        ["wide", "Wide"],
                        ["mini", "Mini"]
                      ])}
                      ${renderProjectSelect("Icon", "iconKey", state.adminProjectDraft.iconKey, Object.keys(ICON_MAP).map((key) => [key, key]))}
                      ${renderProjectInput("Accent", "accent", state.adminProjectDraft.accent)}
                      ${renderProjectInput("Accent secondary", "accentSecondary", state.adminProjectDraft.accentSecondary)}
                      ${renderProjectInput("Sort", "sortOrder", state.adminProjectDraft.sortOrder)}
                      ${renderProjectInput("Link", "ctaLink", state.adminProjectDraft.ctaLink)}
                      ${renderProjectSelect("Status", "status", state.adminProjectDraft.status, [
                        ["building", "Building"],
                        ["ready", "Ready"]
                      ])}
                    </div>
                    <label class="field-block">
                      <span>Tavsif</span>
                      <textarea class="settings-textarea" data-project-field="description">${escapeHtml(state.adminProjectDraft.description || "")}</textarea>
                    </label>
                    <label class="field-block upload-block">
                      <span>Rasm (gallery)</span>
                      <input id="project-image-input" type="file" accept="image/*" />
                    </label>
                    <label class="checkbox-row">
                      <input type="checkbox" data-project-field="isVisible" ${state.adminProjectDraft.isVisible ? "checked" : ""} />
                      <span>Asosiy ekranda ko'rinsin</span>
                    </label>
                    <button class="primary-button" type="submit" ${state.adminProjectSaving ? "disabled" : ""}>
                      ${state.adminProjectSaving ? "Saqlanmoqda..." : "Kategoriyani saqlash"}
                    </button>
                  </form>

                  <form id="admin-settings-form" class="table-card form-card">
                    <h2>Platform settings</h2>
                    <div class="form-grid">
                      <label class="field-block">
                        <span>Brand name</span>
                        <input class="input-shell" data-settings-field="brandName" value="${escapeAttr(state.adminSettingsDraft.brandName)}" />
                      </label>
                      <label class="field-block">
                        <span>Support text</span>
                        <input class="input-shell" data-settings-field="supportText" value="${escapeAttr(state.adminSettingsDraft.supportText)}" />
                      </label>
                      ${renderSettingsSelect("Default language", "defaultLanguage", state.adminSettingsDraft.defaultLanguage, [
                        ["uz", "O'zbekcha"],
                        ["ru", "Русский"],
                        ["en", "English"]
                      ])}
                      ${renderSettingsSelect("Default theme", "defaultTheme", state.adminSettingsDraft.defaultTheme, [
                        ["light", "Light"],
                        ["dark", "Dark"]
                      ])}
                    </div>
                    <button class="primary-button" type="submit" ${state.adminSettingsSaving ? "disabled" : ""}>
                      ${state.adminSettingsSaving ? "Saqlanmoqda..." : "Sozlamalarni saqlash"}
                    </button>
                  </form>

                  <section class="table-card">
                    <h2>Recent events</h2>
                    <div class="table-list compact-list">
                      ${data.recentEvents.slice(0, 18).map(renderEventRow).join("")}
                    </div>
                  </section>
                </div>
              </section>
            `
        }
      </article>
    </section>
  `;
}

function renderMetric(label, value, foot) {
  return `
    <article class="metric-card">
      <span class="metric-label">${escapeHtml(label)}</span>
      <strong class="metric-value">${escapeHtml(String(value))}</strong>
      <span class="metric-foot">${escapeHtml(foot)}</span>
    </article>
  `;
}

function renderAdminUserRow(user) {
  return `
    <button class="table-row user-row-button" type="button" data-open-user="${user.telegramId}">
      <div class="table-row-top">
        <div class="table-user">
          ${user.photoUrl ? `<img class="mini-avatar" src="${escapeAttr(user.photoUrl)}" alt="${escapeAttr(user.displayName)}" />` : `<span class="mini-avatar fallback">${escapeHtml(initials(user.displayName))}</span>`}
          <div>
            <strong>${escapeHtml(user.displayName)}</strong>
            <small>${user.username ? `@${escapeHtml(user.username)}` : `ID ${user.telegramId}`}</small>
          </div>
        </div>
        <span class="status-chip ${user.role === "admin" ? "ready" : ""}">${escapeHtml(user.role)}</span>
      </div>
      <div class="table-row-meta">
        <span>${user.totalActions} action • ${user.totalClicks} klik</span>
        <span>${formatDate(user.lastSeenAt)}</span>
      </div>
    </button>
  `;
}

function renderAdminProjectRow(project) {
  return `
    <div class="table-row">
      <div class="table-row-top">
        <div>
          <strong>${escapeHtml(project.title)}</strong>
          <small>${escapeHtml(project.category)} • ${project.clicks} klik</small>
        </div>
        <span class="status-chip ${project.status === "ready" ? "ready" : ""}">
          ${project.status === "ready" ? "READY" : "BUILDING"}
        </span>
      </div>
      <div class="table-row-meta">
        <span>${project.reminderCount} reminder • sort ${project.sortOrder}</span>
        <span>${project.isVisible ? "Visible" : "Hidden"}</span>
      </div>
      <div class="row-actions">
        <button class="pill" type="button" data-edit-project="${escapeAttr(project.slug)}">Edit</button>
        <button class="pill" type="button" data-admin-status="ready" data-slug="${escapeAttr(project.slug)}">Ready</button>
        <button class="pill" type="button" data-admin-status="building" data-slug="${escapeAttr(project.slug)}">Build</button>
        <button class="pill danger" type="button" data-delete-project="${escapeAttr(project.slug)}">Delete</button>
      </div>
    </div>
  `;
}

function renderEventRow(event) {
  return `
    <div class="table-row">
      <div class="table-row-top">
        <strong>${escapeHtml(event.action)}</strong>
        <span class="status-chip">${escapeHtml(event.route)}</span>
      </div>
      <div class="table-row-meta">
        <span>${escapeHtml(event.user?.displayName || "Guest")} • ${escapeHtml(event.projectSlug || event.pageKey || "-")}</span>
        <span>${formatDate(event.timestamp)}</span>
      </div>
    </div>
  `;
}

function renderAvatar(user, className) {
  const source = user?.profile?.customAvatar || user?.photoUrl || "";
  if (source) {
    return `<img class="${className}" src="${escapeAttr(source)}" alt="${escapeAttr(user?.displayName || "User")}" />`;
  }
  return `<span class="${className} avatar-fallback">${escapeHtml(initials(user?.displayName || user?.firstName || "U"))}</span>`;
}

function renderInputField(label, key, value, placeholder = "") {
  return `
    <label class="field-block">
      <span>${escapeHtml(label)}</span>
      <input class="input-shell" data-profile-field="${escapeAttr(key)}" value="${escapeAttr(value || "")}" placeholder="${escapeAttr(placeholder)}" />
    </label>
  `;
}

function renderSelectField(label, key, value, options) {
  return `
    <label class="field-block">
      <span>${escapeHtml(label)}</span>
      <select class="input-shell" data-profile-field="${escapeAttr(key)}">
        ${options.map(([optionValue, optionLabel]) => `<option value="${escapeAttr(optionValue)}" ${value === optionValue ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`).join("")}
      </select>
    </label>
  `;
}

function renderProjectInput(label, key, value) {
  return `
    <label class="field-block">
      <span>${escapeHtml(label)}</span>
      <input class="input-shell" data-project-field="${escapeAttr(key)}" value="${escapeAttr(value ?? "")}" />
    </label>
  `;
}

function renderProjectSelect(label, key, value, options) {
  return `
    <label class="field-block">
      <span>${escapeHtml(label)}</span>
      <select class="input-shell" data-project-field="${escapeAttr(key)}">
        ${options.map(([optionValue, optionLabel]) => `<option value="${escapeAttr(optionValue)}" ${value === optionValue ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`).join("")}
      </select>
    </label>
  `;
}

function renderSettingsSelect(label, key, value, options) {
  return `
    <label class="field-block">
      <span>${escapeHtml(label)}</span>
      <select class="input-shell" data-settings-field="${escapeAttr(key)}">
        ${options.map(([optionValue, optionLabel]) => `<option value="${escapeAttr(optionValue)}" ${value === optionValue ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`).join("")}
      </select>
    </label>
  `;
}

function renderDock() {
  return `
    <aside class="search-dock">
      <form id="search-form">
        <label class="search-field">
          ${iconSearch()}
          <input
            id="project-search"
            type="search"
            placeholder="Nima qidiryapsiz?"
            value="${escapeAttr(state.search)}"
          />
        </label>
        ${
          state.route.name === "dashboard" && state.session.isAdmin
            ? `<button class="quick-button" type="button" data-nav="admin">${iconSpark()}</button>`
            : `<button class="quick-button" type="button" data-focus-search>${iconTarget()}</button>`
        }
      </form>
      <div class="search-meta">
        <span>${filteredProjects().length} ta loyiha</span>
        <span>${state.session.verified ? "Telegram verified" : "Telegram auto profile"}</span>
      </div>
    </aside>
  `;
}

function mapTelegramUser(user) {
  return {
    telegramId: Number(user.id),
    username: user.username || "",
    firstName: user.first_name || "",
    lastName: user.last_name || "",
    displayName: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || `User ${user.id}`,
    photoUrl: user.photo_url || "",
    role: "user",
    profile: {
      about: "",
      customAvatar: "",
      contactPhone: "",
      location: ""
    },
    preferences: {
      theme: "light",
      language: user.language_code || "uz"
    },
    languageCode: user.language_code || "uz",
    isPremium: Boolean(user.is_premium)
  };
}

function formatDate(value) {
  if (!value) {
    return "Hozir";
  }
  try {
    return dateFormatter.format(new Date(value));
  } catch (error) {
    return value;
  }
}

function initials(value) {
  return String(value || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "U";
}

async function fileToDataUrl(file) {
  if (!file) {
    return "";
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Faylni o'qib bo'lmadi."));
    reader.readAsDataURL(file);
  });
}

function showToast(message) {
  clearTimeout(toastTimer);
  toastRoot.innerHTML = `<div class="toast">${escapeHtml(message)}</div>`;
  toastTimer = window.setTimeout(() => {
    toastRoot.innerHTML = "";
  }, 3200);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

function iconSearch() {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M10.75 4.75a6 6 0 1 0 0 12a6 6 0 0 0 0-12Z" stroke="currentColor" stroke-width="2"></path><path d="m15.5 15.5 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>`;
}

function iconTarget() {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="2"></circle><circle cx="12" cy="12" r="2.5" stroke="currentColor" stroke-width="2"></circle><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>`;
}

function iconSpark() {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 3 14.6 9.4 21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6L12 3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path></svg>`;
}

function iconChevronLeft() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="m15 5-7 7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
}

function iconChevronRight() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="m9 5 7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
}
