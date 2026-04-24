const assert = require("node:assert/strict");

const {
  buildAdminSnapshot,
  ensureStoreShape,
  recordEvent,
  saveReminder,
  updateUserProfile,
  upsertProject,
  upsertUser
} = require("../src/serverData.cjs");

const catalog = [
  { slug: "taomlar", title: "Taomlar", eta: "3-5 kun", iconKey: "burger" },
  { slug: "taksi", title: "Taksi", eta: "2-4 daq", iconKey: "taxi" }
];

function run(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

run("ensureStoreShape seeds settings and projects", () => {
  const store = ensureStoreShape({}, catalog);
  assert.equal(store.settings.defaultTheme, "light");
  assert.equal(store.projects.taomlar.iconKey, "burger");
});

run("upsertUser stores admin role and preferences", () => {
  const store = ensureStoreShape({}, catalog);
  const user = upsertUser(
    store,
    {
      telegramId: 42,
      firstName: "Ali",
      lastName: "Valiyev",
      username: "ali"
    },
    "2026-04-24T10:00:00.000Z",
    true
  );

  assert.equal(user.role, "admin");
  assert.equal(store.users["42"].displayName, "Ali Valiyev");
  assert.equal(store.users["42"].preferences.theme, "light");
});

run("updateUserProfile keeps theme and custom avatar", () => {
  const store = ensureStoreShape({}, catalog);
  upsertUser(
    store,
    {
      telegramId: 7,
      firstName: "Laylo",
      username: "laylo"
    },
    "2026-04-24T09:00:00.000Z"
  );

  const updated = updateUserProfile(
    store,
    7,
    {
      about: "Premium user",
      customAvatar: "data:image/png;base64,abc",
      theme: "dark",
      language: "en"
    },
    "2026-04-24T09:01:00.000Z"
  );

  assert.equal(updated.profile.about, "Premium user");
  assert.equal(updated.preferences.theme, "dark");
  assert.equal(updated.preferences.language, "en");
});

run("upsertProject adds editable project entry", () => {
  const store = ensureStoreShape({}, catalog);
  const project = upsertProject(
    store,
    {
      slug: "market",
      title: "Market",
      sortOrder: 3,
      iconKey: "market",
      category: "Retail"
    },
    "2026-04-24T11:00:00.000Z"
  );

  assert.equal(project.slug, "market");
  assert.equal(store.projects.market.category, "Retail");
});

run("buildAdminSnapshot aggregates projects and selected user stats", () => {
  const store = ensureStoreShape({}, catalog);
  const user = upsertUser(
    store,
    {
      telegramId: 7,
      firstName: "Laylo",
      username: "laylo"
    },
    "2026-04-24T09:00:00.000Z"
  );

  recordEvent(
    store,
    {
      action: "project_card_clicked",
      route: "dashboard",
      pageKey: "dashboard-grid",
      projectSlug: "taomlar",
      metadata: {},
      user
    },
    "2026-04-24T09:01:00.000Z"
  );

  saveReminder(
    store,
    {
      telegramId: 7,
      username: "laylo",
      firstName: "Laylo",
      projectSlug: "taomlar",
      projectName: "Taomlar",
      suggestion: "Dark mode kerak",
      notifyMe: true
    },
    "2026-04-24T09:02:00.000Z"
  );

  const snapshot = buildAdminSnapshot(store, { selectedUserId: 7 });

  assert.equal(snapshot.summary.totalUsers, 1);
  assert.equal(snapshot.summary.totalActions, 1);
  assert.equal(snapshot.projects[0].clicks, 1);
  assert.equal(snapshot.selectedUser.projectStats[0].slug, "taomlar");
});

if (!process.exitCode) {
  console.log("All tests passed.");
}
