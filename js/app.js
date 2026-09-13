/* ==========================================================================
   SĀLFA — application shell.
   A tiny hash router, five views, and no framework. Each render* function
   returns an HTML string; wire* functions attach the behaviour afterwards.
   ========================================================================== */

import { configured, supabase } from "./supabase.js";
import { initLang, t, num, formatDate, getLang, toggleLang, onLangChange } from "./i18n.js";
import { signUp, logIn, logOut, getSession, onAuthChange, displayName, friendlyAuthError, resendConfirmation } from "./auth.js";
import { listLogs, createLog, updateLog, deleteLog, computeStats, computeInsights, withCoordinates } from "./logs.js";
import { dallahArt, finjanArt, icedCoffeeArt } from "./art.js";
import { loadLeaflet, createBaseMap, salfaMarker, fitToPoints, searchPlaces, DEFAULT_CENTER } from "./map.js";
import { computeRewards, listClaims, claimReward } from "./rewards.js";

const viewEl = document.getElementById("view");
const topbarAuthEl = document.getElementById("topbarAuth");
const langBtn = document.getElementById("langBtn");
const footerTagEl = document.getElementById("footerTag");
const sheetEl = document.getElementById("sheet");
const sheetPanelEl = document.getElementById("sheetPanel");
const toasterEl = document.getElementById("toaster");

const state = {
  session: null,
  logs: null,        // null = not loaded yet, [] = loaded and empty
  loadingLogs: false,
  lastFocused: null,
  notice: null,      // { kind, message, offerResend } shown on the auth screens
  query: "",         // dashboard search text
  filter: "all",     // "all" | "favourites" | "top"
  claims: null,      // Set of collected reward keys, null until loaded
};

/** Teardown for the hero's WebGL scene, so leaving the landing page frees it. */
let heroDallahDispose = null;

/** Live Leaflet instances, torn down when their view goes away. */
let collectionMap = null;
let pickerMap = null;

/** Coordinates chosen on the Add form, or null when no place was pinned. */
let pickedPoint = null;

/**
 * Snapshot of any auth callback in the URL, read synchronously at module load.
 *
 * This has to happen before supabase-js finishes its own URL detection, because
 * that strips the parameters from the address bar. Confirmation links land as
 * `#access_token=…&type=signup` on success, or `#error=…&error_code=otp_expired`
 * when the link is stale — without this snapshot the second case is invisible
 * and the user just lands on the marketing page with no explanation.
 */
const AUTH_CALLBACK = (() => {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(location.search);
  const get = (key) => hash.get(key) ?? query.get(key);

  const hasTokens = Boolean(hash.get("access_token"));
  const error = get("error");
  const errorCode = get("error_code");
  const type = get("type");

  return {
    isCallback: hasTokens || Boolean(error) || type === "signup" || type === "recovery",
    hasTokens,
    error,
    errorCode,
    type,
  };
})();

/** Drop callback params so a reload doesn't replay them and the URL stays clean. */
function stripCallbackFromUrl() {
  history.replaceState({}, "", location.pathname);
}

/* ------------------------------ helpers ------------------------------ */

/** Escape user-entered text before it goes anywhere near innerHTML. */
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function starsMarkup(rating) {
  const on = "★".repeat(rating);
  const off = "☆".repeat(5 - rating);
  return `<span class="stars" role="img" aria-label="${rating}/5">${on}<span class="stars__off">${off}</span></span>`;
}

function go(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

function toast(message, kind = "ok") {
  const el = document.createElement("div");
  el.className = `toast${kind === "error" ? " toast--error" : ""}`;
  el.innerHTML = `<span class="toast__dot"></span><span>${esc(message)}</span>`;
  toasterEl.append(el);
  setTimeout(() => {
    el.style.transition = "opacity .3s, transform .3s";
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    setTimeout(() => el.remove(), 320);
  }, 3600);
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return t("greetMorning");
  if (h < 18) return t("greetAfternoon");
  return t("greetEvening");
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function setFieldError(fieldEl, message) {
  fieldEl.dataset.invalid = message ? "true" : "false";
  const slot = fieldEl.querySelector(".field__error");
  if (slot) slot.textContent = message || "";
}

function busy(button, on, labelWhenBusy) {
  button.disabled = on;
  if (on) {
    button.dataset.label = button.textContent;
    button.innerHTML = `<span class="btn__spinner"></span><span>${esc(labelWhenBusy)}</span>`;
  } else if (button.dataset.label) {
    button.textContent = button.dataset.label;
  }
}

/* ------------------------------ chrome ------------------------------ */

function renderChrome() {
  langBtn.textContent = t("langLabel");
  langBtn.setAttribute("aria-label", getLang() === "en" ? "Switch to Arabic" : "التبديل إلى الإنجليزية");
  footerTagEl.textContent = t("footerTag");

  if (state.session) {
    topbarAuthEl.innerHTML = `<button class="btn btn--quiet" id="logoutBtn" type="button">${esc(t("logout"))}</button>`;
    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await logOut();
      state.logs = null;
      state.claims = null;
      go("#/");
    });
  } else {
    topbarAuthEl.innerHTML = `
      <a class="btn btn--quiet" href="#/login">${esc(t("login"))}</a>
      <a class="btn" href="#/signup">${esc(t("signup"))}</a>`;
  }
}

/* ------------------------------ landing ------------------------------ */

function renderLanding() {
  viewEl.innerHTML = `
    <section class="shell hero">
      <div>
        <p class="eyebrow">${esc(t("heroEyebrow"))}</p>
        <h1 class="hero__title">${esc(t("heroTitleA"))}<br /><em>${esc(t("heroTitleB"))}</em></h1>
        <p class="hero__ar">${esc(t("heroArabic"))}</p>
        <p class="hero__lede">${esc(t("heroLede"))}</p>
        <div class="hero__cta">
          <a class="btn" href="#/signup">${esc(t("heroCtaPrimary"))}</a>
          <a class="btn btn--ghost" href="#/login">${esc(t("heroCtaSecondary"))}</a>
        </div>
      </div>
      <div class="hero__art" id="heroArt" aria-hidden="true">
        <div class="hero__stage" id="heroStage"></div>
        <div class="cupcard"><span class="cupcard__label">${esc(t("cup2"))}</span><span class="cupcard__meta">${esc(t("cupMeta2"))}</span></div>
        <div class="cupcard"><span class="cupcard__label">${esc(t("cup3"))}</span><span class="cupcard__meta">${esc(t("cupMeta3"))}</span></div>
        <div class="cupcard">
          <span class="cupcard__glyph">${dallahArt({ size: 54, stroke: 3.4 })}</span>
          <span class="cupcard__label">${esc(t("cup1"))}</span>
          <span class="cupcard__meta">${esc(t("cupMeta1"))}</span>
          ${starsMarkup(5)}
        </div>
      </div>
    </section>

    <section class="shell section">
      <div class="pillars">
        ${[
          // The dallah's viewBox is twice as wide, so it needs double the stroke
          // weight and a little extra size to sit optically level with the others.
          { n: 1, glyph: dallahArt({ size: 62, stroke: 4.2 }) },
          { n: 2, glyph: finjanArt({ size: 50 }) },
          { n: 3, glyph: icedCoffeeArt({ size: 50 }) },
        ]
          .map(
            ({ n, glyph }) => `
          <div class="pillar">
            <div class="pillar__glyph">${glyph}</div>
            <h3>${esc(t(`pillar${n}Title`))}</h3>
            <p>${esc(t(`pillar${n}Body`))}</p>
          </div>`
          )
          .join("")}
      </div>
    </section>`;

  mountHeroDallah();
}

/**
 * Brings up the rotating dallah behind the hero, if this visitor should get it.
 * The CSS cards stay in the markup and simply fade out once WebGL is running,
 * so a decline (mobile, reduced motion, no WebGL, CDN down) is invisible.
 */
async function mountHeroDallah() {
  disposeHeroDallah();

  const stage = document.getElementById("heroStage");
  const art = document.getElementById("heroArt");
  if (!stage || !art) return;

  try {
    const { mountHeroScene } = await import("./scene3d.js");
    const dispose = await mountHeroScene(stage);
    if (!dispose) return;

    // The route may have changed while three.js was downloading.
    if (!document.body.contains(stage)) {
      dispose();
      return;
    }
    heroDallahDispose = dispose;
    art.dataset.mode = "3d";
  } catch (error) {
    console.warn("[salfa] hero dallah skipped:", error);
  }
}

function disposeHeroDallah() {
  if (heroDallahDispose) {
    heroDallahDispose();
    heroDallahDispose = null;
  }
}

/* ------------------------------ auth views ------------------------------ */

/** Renders state.notice, plus a resend button when a fresh link would help. */
function noticeMarkup() {
  if (!state.notice) return "";
  const { kind, message, offerResend } = state.notice;
  return `
    <div class="alert alert--${kind === "error" ? "error" : "ok"}">${esc(message)}</div>
    ${offerResend ? `<button class="btn btn--quiet btn--block" type="button" id="resendBtn">${esc(t("resendCta"))}</button>` : ""}`;
}

function renderAuthView(mode) {
  const isSignup = mode === "signup";

  viewEl.innerHTML = `
    <div class="shell authwrap">
      <div class="authcard">
        <p class="eyebrow">SĀLFA</p>
        <h1 class="authcard__title">${esc(isSignup ? t("signupTitle") : t("loginTitle"))}</h1>
        <p class="authcard__sub">${esc(isSignup ? t("signupSub") : t("loginSub"))}</p>

        <form class="form" id="authForm" novalidate>
          <div id="authAlert">${noticeMarkup()}</div>

          ${
            isSignup
              ? `<div class="field" id="fName">
                   <label class="field__label" for="name">${esc(t("fieldName"))}</label>
                   <input class="input" id="name" name="name" type="text" autocomplete="name"
                          placeholder="${esc(t("fieldNamePh"))}" />
                   <p class="field__error"></p>
                 </div>`
              : ""
          }

          <div class="field" id="fEmail">
            <label class="field__label" for="email">${esc(t("fieldEmail"))}</label>
            <input class="input" id="email" name="email" type="email" autocomplete="email"
                   placeholder="${esc(t("fieldEmailPh"))}" />
            <p class="field__error"></p>
          </div>

          <div class="field" id="fPass">
            <label class="field__label" for="password">${esc(t("fieldPassword"))}</label>
            <input class="input" id="password" name="password" type="password"
                   autocomplete="${isSignup ? "new-password" : "current-password"}"
                   placeholder="${esc(t("fieldPasswordPh"))}" />
            <p class="field__error"></p>
          </div>

          <button class="btn btn--block" type="submit" id="authSubmit">
            ${esc(isSignup ? t("doSignup") : t("doLogin"))}
          </button>
        </form>

        <p class="authcard__foot">
          ${esc(isSignup ? t("haveAccount") : t("noAccount"))}
          <a href="${isSignup ? "#/login" : "#/signup"}">${esc(isSignup ? t("login") : t("signup"))}</a>
        </p>
      </div>
    </div>`;

  wireAuthForm(isSignup);
}

function wireAuthForm(isSignup) {
  const form = document.getElementById("authForm");
  const alertSlot = document.getElementById("authAlert");
  const submit = document.getElementById("authSubmit");

  wireResendButton();

  /** The resend control appears wherever a stale/unconfirmed link left the user. */
  function wireResendButton() {
    const btn = document.getElementById("resendBtn");
    if (!btn) return;

    btn.addEventListener("click", async () => {
      const email = document.getElementById("email").value.trim();
      if (!email || !isEmail(email)) {
        setFieldError(document.getElementById("fEmail"), t("resendNeedEmail"));
        document.getElementById("email").focus();
        return;
      }
      setFieldError(document.getElementById("fEmail"), "");

      busy(btn, true, t("resending"));
      try {
        await resendConfirmation(email);
        state.notice = null;
        alertSlot.innerHTML = `<div class="alert alert--ok">${esc(t("resendSent"))}</div>`;
      } catch (error) {
        busy(btn, false);
        alertSlot.innerHTML = `<div class="alert alert--error">${esc(friendlyAuthError(error))}</div>`;
      }
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    alertSlot.innerHTML = "";

    const nameField = document.getElementById("fName");
    const emailField = document.getElementById("fEmail");
    const passField = document.getElementById("fPass");

    const name = isSignup ? document.getElementById("name").value.trim() : "";
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    let ok = true;
    if (isSignup) {
      const msg = !name ? t("errNameReq") : "";
      setFieldError(nameField, msg);
      if (msg) ok = false;
    }
    const emailMsg = !email ? t("errEmailReq") : !isEmail(email) ? t("errEmailBad") : "";
    setFieldError(emailField, emailMsg);
    if (emailMsg) ok = false;

    const passMsg = !password ? t("errPassReq") : password.length < 6 ? t("errPassShort") : "";
    setFieldError(passField, passMsg);
    if (passMsg) ok = false;

    if (!ok) {
      form.querySelector('[data-invalid="true"] .input')?.focus();
      return;
    }

    busy(submit, true, t("saving"));
    try {
      if (isSignup) {
        const { needsConfirmation } = await signUp({ name, email, password });
        if (needsConfirmation) {
          busy(submit, false);
          alertSlot.innerHTML = `<div class="alert alert--ok">${esc(t("checkEmail"))}</div>`;
          form.reset();
          return;
        }
      } else {
        await logIn({ email, password });
      }
      state.logs = null;
      go("#/dashboard");
    } catch (error) {
      busy(submit, false);
      // An unconfirmed account is a dead end without a way to get a fresh link.
      const unconfirmed = error?.code === "email_not_confirmed";
      state.notice = {
        kind: "error",
        message: friendlyAuthError(error),
        offerResend: unconfirmed,
      };
      alertSlot.innerHTML = noticeMarkup();
      wireResendButton();
    }
  });
}

/* ------------------------------ dashboard ------------------------------ */

function renderDashboard() {
  const name = displayName(state.session.user);
  const logs = state.logs;
  const stats = computeStats(logs ?? []);

  viewEl.innerHTML = `
    <div class="shell">
      <header class="dash__head">
        <div>
          <p class="eyebrow">SĀLFA</p>
          <h1 class="dash__greet">${esc(greeting())}${getLang() === "ar" ? "، " : ", "}<span>${esc(name)}</span></h1>
          <p class="dash__sub">${esc(t("dashSub"))}</p>
        </div>
        <div class="dash__actions">
          <a class="btn btn--ghost" href="#/rewards">${esc(t("viewRewards"))}${rewardBadgeMarkup()}</a>
          <a class="btn btn--ghost" href="#/map">${esc(t("viewMap"))}</a>
          <a class="btn btn--desktop-add" href="#/add">${esc(t("addGahwa"))}</a>
        </div>
      </header>

      <section class="stats" aria-label="${esc(t("collectionTitle"))}">
        <div class="stat"><p class="stat__n">${esc(num(stats.total))}</p><p class="stat__label">${esc(t("statTotal"))}</p></div>
        <div class="stat"><p class="stat__n stat__n--sand">${esc(num(stats.favourites))}</p><p class="stat__label">${esc(t("statFavs"))}</p></div>
        <div class="stat"><p class="stat__n">${stats.best ? esc(num(stats.best)) + `<small style="font-size:.5em;opacity:.5">/${esc(num(5))}</small>` : "—"}</p><p class="stat__label">${esc(t("statBest"))}</p></div>
      </section>

      ${renderLoyaltyStrip()}

      ${renderInsights(logs ?? [])}

      <section>
        <div class="collection__bar">
          <h2 class="collection__title">${esc(t("collectionTitle"))}</h2>
          ${
            logs?.length
              ? `<span class="collection__count">${esc(logs.length === 1 ? t("countOne") : t("countMany", { n: num(logs.length) }))}</span>`
              : ""
          }
        </div>

        ${
          logs?.length
            ? `<div class="finder">
                 <input class="input" id="logSearch" type="search" autocomplete="off"
                        value="${esc(state.query)}"
                        placeholder="${esc(t("searchLogsPh"))}" aria-label="${esc(t("searchLogs"))}" />
                 <div class="chips" role="group" aria-label="${esc(t("filterBy"))}">
                   ${[
                     ["all", t("filterAll")],
                     ["favourites", t("filterFavourites")],
                     ["top", t("filterTop")],
                   ]
                     .map(
                       ([key, label]) => `
                     <button class="chip" type="button" data-filter="${key}"
                             aria-pressed="${state.filter === key}">${esc(label)}</button>`
                     )
                     .join("")}
                 </div>
               </div>`
            : ""
        }

        <div id="collection">${renderCollection()}</div>
      </section>
    </div>

    <div class="mobilebar">
      <a class="btn btn--block" href="#/add">${esc(t("addGahwa"))}</a>
    </div>`;

  wireCollection();
}

/**
 * Insights over the user's own logs. Total and favourites already have tiles
 * in the stats row above, so this section carries the four that don't.
 */
function renderInsights(logs) {
  const insights = computeInsights(logs);
  if (!insights) return "";

  const cell = (label, value, sub = "") => `
    <div class="insight">
      <p class="insight__label">${esc(label)}</p>
      <p class="insight__value">${esc(value)}</p>
      ${sub ? `<p class="insight__sub">${esc(sub)}</p>` : ""}
    </div>`;

  const none = t("insightNone");

  return `
    <section class="insights" aria-label="${esc(t("insightsTitle"))}">
      <h2 class="insights__title">${esc(t("insightsTitle"))}</h2>
      <div class="insights__grid">
        ${cell(t("insightAverage"), `${num(insights.average)} / ${num(5)}`)}
        ${cell(
          t("insightBest"),
          insights.bestCup ? insights.bestCup.name : none,
          insights.bestCup ? `${"★".repeat(insights.bestCup.rating)}` : ""
        )}
        ${cell(
          t("insightPlace"),
          insights.topPlace ? insights.topPlace.value : none,
          insights.topPlace ? t("insightTimes", { n: num(insights.topPlace.count) }) : ""
        )}
        ${cell(
          t("insightCompany"),
          insights.topCompany ? insights.topCompany.value : none,
          insights.topCompany ? t("insightTimes", { n: num(insights.topCompany.count) }) : ""
        )}
      </div>
    </section>`;
}

/** The user's own logs, narrowed by the search box and the active filter. */
function visibleLogs() {
  const all = state.logs ?? [];
  const q = state.query.trim().toLowerCase();

  let rows = all.filter((log) => {
    if (state.filter === "favourites" && !log.is_favorite) return false;
    if (!q) return true;
    return [log.name, log.place, log.with_who, log.notes]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  // "Highest rated" reorders rather than hides, so nothing disappears silently.
  if (state.filter === "top") {
    rows = [...rows].sort(
      (a, b) => b.rating - a.rating || new Date(b.created_at) - new Date(a.created_at)
    );
  }
  return rows;
}

function renderCollection() {
  if (state.logs === null) {
    return `<div class="grid">${Array.from({ length: 3 })
      .map(
        () => `<div class="skel">
                 <div class="skel__line skel__line--lg"></div>
                 <div class="skel__line"></div>
                 <div class="skel__line skel__line--sm"></div>
               </div>`
      )
      .join("")}</div>`;
  }

  if (state.logs.length === 0) {
    return `
      <div class="empty">
        <div class="empty__art">${dallahArt({ size: 108 })}</div>
        <h3>${esc(t("emptyTitle"))}</h3>
        <p>${esc(t("emptyBody"))}</p>
        <a class="btn" href="#/add">${esc(t("emptyCta"))}</a>
      </div>`;
  }

  const rows = visibleLogs();

  // Nothing matched the search or filter — distinct from having no logs at all.
  if (rows.length === 0) {
    return `
      <div class="empty">
        <div class="empty__art">${finjanArt({ size: 84, steam: false })}</div>
        <h3>${esc(t("noMatchTitle"))}</h3>
        <p>${esc(t("noMatchBody"))}</p>
        <button class="btn btn--ghost" type="button" id="clearFilters">${esc(t("clearFilters"))}</button>
      </div>`;
  }

  return `<div class="grid">${rows.map(logCard).join("")}</div>`;
}

function logCard(log) {
  return `
    <button class="logcard" type="button" data-log-id="${esc(log.id)}">
      <div class="logcard__top">
        <span class="logcard__name">${esc(log.name)}</span>
        ${log.is_favorite ? `<span class="logcard__fav" title="${esc(t("favourite"))}" role="img" aria-label="${esc(t("favourite"))}">●</span>` : ""}
      </div>

      <div class="logcard__meta">
        ${log.place ? `<span><i>${esc(t("labelPlace"))}</i>${esc(log.place)}</span>` : ""}
        ${log.with_who ? `<span><i>${esc(t("labelWith"))}</i>${esc(log.with_who)}</span>` : ""}
      </div>

      ${log.notes ? `<p class="logcard__notes">${esc(log.notes)}</p>` : ""}

      <div class="logcard__foot">
        ${starsMarkup(log.rating)}
        <span class="logcard__date">${esc(formatDate(log.created_at))}</span>
      </div>
    </button>`;
}

function wireCollection() {
  viewEl.querySelectorAll("[data-log-id]").forEach((card) => {
    card.addEventListener("click", () => {
      const log = state.logs.find((l) => l.id === card.dataset.logId);
      if (log) openSheet(log, card);
    });
  });

  // Only the collection is re-rendered as you search or filter, so the input
  // keeps focus and the caret position while you type.
  const redrawCollection = () => {
    const host = document.getElementById("collection");
    if (!host) return;
    host.innerHTML = renderCollection();
    wireCollection();
  };

  const search = document.getElementById("logSearch");
  if (search && !search.dataset.wired) {
    search.dataset.wired = "true";
    search.addEventListener("input", () => {
      state.query = search.value;
      redrawCollection();
    });
  }

  viewEl.querySelectorAll("[data-filter]").forEach((chip) => {
    if (chip.dataset.wired) return;
    chip.dataset.wired = "true";
    chip.addEventListener("click", () => {
      state.filter = chip.dataset.filter;
      viewEl.querySelectorAll("[data-filter]").forEach((c) => {
        c.setAttribute("aria-pressed", String(c.dataset.filter === state.filter));
      });
      redrawCollection();
    });
  });

  document.getElementById("clearFilters")?.addEventListener("click", () => {
    state.query = "";
    state.filter = "all";
    renderDashboard();
  });
}

async function loadLogs() {
  if (state.loadingLogs) return;
  state.loadingLogs = true;
  try {
    state.logs = await listLogs();
  } catch (error) {
    state.logs = [];
    toast(t("errGeneric"), "error");
    console.error("[salfa] failed to load logs:", error);
  } finally {
    state.loadingLogs = false;
    if (location.hash === "#/dashboard") renderDashboard();
    else if (location.hash === "#/map") renderMapView();
    else if (location.hash === "#/rewards") renderRewardsView();
    else if (location.hash.startsWith("#/edit/")) route();
  }
}

/* ------------------------------ rewards ------------------------------ */

/** Everything the rewards UI needs, from the logs and claims already loaded. */
function rewardState() {
  return computeRewards(state.logs ?? [], state.claims ?? new Set());
}

/** A count on the Rewards button when something is waiting to be collected. */
function rewardBadgeMarkup() {
  if (state.logs === null || state.claims === null) return "";
  const { readyToClaim } = rewardState();
  return readyToClaim ? `<span class="pip">${esc(num(readyToClaim))}</span>` : "";
}

const REWARD_ART = {
  dallah: (size) => dallahArt({ size, stroke: 4.2 }),
  finjan: (size) => finjanArt({ size, steam: false }),
  iced: (size) => icedCoffeeArt({ size }),
};

/** The tier + points strip shown on the dashboard. */
function renderLoyaltyStrip() {
  if (state.logs === null || state.claims === null) return "";
  const r = rewardState();

  return `
    <a class="loyalty" href="#/rewards">
      <div class="loyalty__art" aria-hidden="true">${REWARD_ART.dallah(44)}</div>
      <div class="loyalty__body">
        <p class="loyalty__tier">${esc(t(`tier_${r.tier.key}`))}</p>
        <p class="loyalty__points">${esc(t("pointsCount", { n: num(r.points) }))}</p>
        <div class="bar" role="img" aria-label="${esc(
          r.nextTier ? t("toNextTier", { n: num(r.pointsToNext), tier: t(`tier_${r.nextTier.key}`) }) : t("topTier")
        )}">
          <span style="width:${Math.round(r.tierProgress * 100)}%"></span>
        </div>
        <p class="loyalty__next">${esc(
          r.nextTier ? t("toNextTier", { n: num(r.pointsToNext), tier: t(`tier_${r.nextTier.key}`) }) : t("topTier")
        )}</p>
      </div>
      ${r.readyToClaim ? `<span class="loyalty__ready">${esc(t("readyToClaim", { n: num(r.readyToClaim) }))}</span>` : ""}
    </a>`;
}

function renderRewardsView() {
  if (state.logs === null || state.claims === null) {
    viewEl.innerHTML = `<div class="shell section"><p class="dash__sub">${esc(t("loading"))}</p></div>`;
    return;
  }

  const r = rewardState();

  viewEl.innerHTML = `
    <div class="shell">
      <header class="dash__head">
        <div>
          <p class="eyebrow">SĀLFA</p>
          <h1 class="dash__greet">${esc(t("rewardsTitle"))}</h1>
          <p class="dash__sub">${esc(t("rewardsSub"))}</p>
        </div>
        <a class="btn btn--ghost" href="#/dashboard">${esc(t("backToDash"))}</a>
      </header>

      <section class="stats" aria-label="${esc(t("rewardsTitle"))}">
        <div class="stat"><p class="stat__n">${esc(num(r.points))}</p><p class="stat__label">${esc(t("statPoints"))}</p></div>
        <div class="stat"><p class="stat__n stat__n--sand">${esc(num(r.collected))}<small style="font-size:.5em;opacity:.5">/${esc(num(r.rewards.length))}</small></p><p class="stat__label">${esc(t("statCollected"))}</p></div>
        <div class="stat"><p class="stat__n" style="font-family:var(--display);font-size:clamp(1.3rem,4vw,1.9rem)">${esc(t(`tier_${r.tier.key}`))}</p><p class="stat__label">${esc(t("statTier"))}</p></div>
      </section>

      <section class="insights">
        <h2 class="insights__title">${esc(t("rewardsShelf"))}</h2>
        <div class="rewards">
          ${r.rewards.map(rewardCard).join("")}
        </div>
      </section>

      <p class="rewards__note">${esc(t("rewardsNote"))}</p>
    </div>

    <div class="mobilebar">
      <a class="btn btn--block" href="#/add">${esc(t("addGahwa"))}</a>
    </div>`;

  wireRewards();
}

function rewardCard(reward) {
  const state_ = reward.claimed ? "claimed" : reward.earned ? "ready" : "locked";
  const pct = Math.round((reward.have / reward.need) * 100);

  return `
    <div class="reward reward--${state_}">
      <div class="reward__art" aria-hidden="true">${REWARD_ART[reward.art](46)}</div>
      <h3 class="reward__name">${esc(t(`reward_${reward.key}`))}</h3>
      <p class="reward__desc">${esc(t(`rewardDesc_${reward.key}`))}</p>

      ${
        reward.claimed
          ? `<p class="reward__status">✓ ${esc(t("rewardCollected"))}</p>`
          : reward.earned
            ? `<button class="btn btn--sand reward__claim" type="button" data-claim="${esc(reward.key)}">${esc(t("claimGift"))}</button>`
            : `<div class="bar bar--small"><span style="width:${pct}%"></span></div>
               <p class="reward__progress">${esc(t("rewardProgress", { have: num(reward.have), need: num(reward.need) }))}</p>`
      }
      <p class="reward__points">+${esc(num(reward.points))} ${esc(t("pointsWord"))}</p>
    </div>`;
}

function wireRewards() {
  viewEl.querySelectorAll("[data-claim]").forEach((button) => {
    button.addEventListener("click", async () => {
      const key = button.dataset.claim;
      busy(button, true, t("claiming"));
      try {
        await claimReward(key);
        state.claims = new Set([...(state.claims ?? []), key]);
        renderRewardsView();
        toast(t("claimedToast", { name: t(`reward_${key}`) }));
      } catch (error) {
        busy(button, false);
        toast(t("errGeneric"), "error");
        console.error("[salfa] claim failed:", error);
      }
    });
  });
}

async function loadClaims() {
  try {
    state.claims = await listClaims();
  } catch (error) {
    state.claims = new Set();
    console.error("[salfa] failed to load reward claims:", error);
  }
  if (location.hash === "#/rewards") renderRewardsView();
  else if (location.hash === "#/dashboard") renderDashboard();
}

/* ------------------------------ map view ------------------------------ */

function renderMapView() {
  const mapped = withCoordinates(state.logs ?? []);

  viewEl.innerHTML = `
    <div class="shell">
      <header class="dash__head">
        <div>
          <p class="eyebrow">SĀLFA</p>
          <h1 class="dash__greet">${esc(t("mapTitle"))}</h1>
          <p class="dash__sub">${esc(
            mapped.length === 0
              ? t("mapEmptySub")
              : mapped.length === 1
                ? t("mapSubOne")
                : t("mapSub", { n: num(mapped.length) })
          )}</p>
        </div>
        <a class="btn btn--ghost" href="#/dashboard">${esc(t("backToDash"))}</a>
      </header>

      ${
        mapped.length
          ? `<div class="mapsearch">
               <input class="input" id="mapFilter" type="search" autocomplete="off"
                      placeholder="${esc(t("filterPh"))}" aria-label="${esc(t("filterLabel"))}" />
               <span class="mapsearch__count" id="mapFilterCount"></span>
             </div>
             <div class="mapwrap"><div id="collectionMap" class="mapcanvas"></div></div>`
          : `<div class="empty">
               <div class="empty__art">${dallahArt({ size: 96 })}</div>
               <h3>${esc(t("mapEmptyTitle"))}</h3>
               <p>${esc(t("mapEmptyBody"))}</p>
               <a class="btn" href="#/add">${esc(t("addGahwa"))}</a>
             </div>`
      }
    </div>

    <div class="mobilebar">
      <a class="btn btn--block" href="#/add">${esc(t("addGahwa"))}</a>
    </div>`;

  if (mapped.length) mountCollectionMap(mapped);
}

async function mountCollectionMap(mapped) {
  const el = document.getElementById("collectionMap");
  if (!el) return;

  let L;
  try {
    L = await loadLeaflet();
  } catch (error) {
    el.innerHTML = `<p class="mapfail">${esc(t("mapFailed"))}</p>`;
    console.warn("[salfa] map unavailable:", error);
    return;
  }
  if (!document.body.contains(el)) return; // navigated away mid-load

  collectionMap?.remove();
  collectionMap = createBaseMap(L, el);

  // One marker per log, kept alongside its log so filtering can add and remove
  // them without rebuilding the map.
  const markers = mapped.map((log) => ({
    log,
    marker: L.marker([log.latitude, log.longitude], {
      icon: salfaMarker(L, { favourite: log.is_favorite }),
      title: log.name,
    }).on("click", () => openSheet(log, null)),
  }));

  const countEl = document.getElementById("mapFilterCount");

  /** Shows only the cups matching `query`, and reframes around them. */
  const applyFilter = (query) => {
    const q = query.trim().toLowerCase();
    const shown = [];

    for (const { log, marker } of markers) {
      const haystack = [log.name, log.place, log.with_who, log.notes]
        .filter(Boolean).join(" ").toLowerCase();
      const match = !q || haystack.includes(q);

      if (match) {
        marker.addTo(collectionMap);
        shown.push([log.latitude, log.longitude]);
      } else {
        marker.remove();
      }
    }

    if (countEl) {
      countEl.textContent = q
        ? t("filterCount", { shown: num(shown.length), total: num(markers.length) })
        : "";
    }
    if (shown.length) fitToPoints(collectionMap, shown);
  };

  applyFilter("");

  const filterEl = document.getElementById("mapFilter");
  // Filtering is local, so it can run freely as you type.
  filterEl?.addEventListener("input", () => applyFilter(filterEl.value));
}

/* ------------------------------ detail sheet ------------------------------ */

function openSheet(log, trigger) {
  state.lastFocused = trigger || document.activeElement;

  sheetPanelEl.innerHTML = `
    <div class="sheet__kicker">
      ${log.is_favorite ? `<span class="sheet__badge">● ${esc(t("favourite"))}</span>` : "<span></span>"}
      <button class="sheet__close" type="button" data-close-sheet aria-label="${esc(t("close"))}">✕</button>
    </div>

    <h2 class="sheet__title" id="sheetTitle">${esc(log.name)}</h2>
    <div class="sheet__stars">${starsMarkup(log.rating)}</div>

    <dl class="dl">
      <div><dt>${esc(t("labelPlace"))}</dt><dd>${log.place ? esc(log.place) : esc(t("noPlace"))}</dd></div>
      <div><dt>${esc(t("labelWith"))}</dt><dd>${log.with_who ? esc(log.with_who) : esc(t("noPlace"))}</dd></div>
      <div><dt>${esc(t("labelLogged"))}</dt><dd>${esc(formatDate(log.created_at))}</dd></div>
    </dl>

    ${
      log.notes
        ? `<div><dt class="dl" style="display:block;margin-bottom:.5rem;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;opacity:.6">${esc(t("labelNotes"))}</dt>
             <p class="notes">${esc(log.notes)}</p></div>`
        : ""
    }

    <div class="sheet__actions">
      <a class="btn btn--ghost" href="#/edit/${encodeURIComponent(log.id)}">${esc(t("editStory"))}</a>
      <button class="btn btn--quiet btn--danger" type="button" id="deleteBtn">${esc(t("deleteStory"))}</button>
    </div>`;

  sheetEl.hidden = false;
  document.body.style.overflow = "hidden";
  sheetPanelEl.querySelector("[data-close-sheet]")?.focus();

  document.getElementById("deleteBtn")?.addEventListener("click", () => confirmDelete(log));
}

/** Swaps the sheet for a confirmation, so deleting always takes two decisions. */
function confirmDelete(log) {
  sheetPanelEl.innerHTML = `
    <div class="sheet__kicker">
      <span></span>
      <button class="sheet__close" type="button" data-close-sheet aria-label="${esc(t("close"))}">✕</button>
    </div>
    <h2 class="sheet__title" id="sheetTitle">${esc(t("deleteConfirmTitle"))}</h2>
    <p class="confirm__body">${esc(t("deleteConfirmBody", { name: log.name }))}</p>
    <div id="deleteAlert"></div>
    <div class="sheet__actions">
      <button class="btn btn--ghost" type="button" id="cancelDelete">${esc(t("cancel"))}</button>
      <button class="btn btn--danger-solid" type="button" id="confirmDelete">${esc(t("deleteConfirmCta"))}</button>
    </div>`;

  document.getElementById("cancelDelete").addEventListener("click", () => openSheet(log, null));
  document.getElementById("confirmDelete").focus();

  document.getElementById("confirmDelete").addEventListener("click", async () => {
    const button = document.getElementById("confirmDelete");
    busy(button, true, t("deleting"));
    try {
      await deleteLog(log.id);
      state.logs = (state.logs ?? []).filter((l) => l.id !== log.id);
      closeSheet();
      toast(t("deletedToast"));
      if (location.hash === "#/map") renderMapView();
      else renderDashboard();
    } catch (error) {
      busy(button, false);
      document.getElementById("deleteAlert").innerHTML =
        `<div class="alert alert--error">${esc(t("errGeneric"))}</div>`;
      console.error("[salfa] delete failed:", error);
    }
  });
}

function closeSheet() {
  sheetEl.hidden = true;
  document.body.style.overflow = "";
  state.lastFocused?.focus?.();
  state.lastFocused = null;
}

sheetEl.addEventListener("click", (event) => {
  if (event.target.closest("[data-close-sheet]")) closeSheet();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !sheetEl.hidden) closeSheet();
});

/* ------------------------------ add gahwa ------------------------------ */

/**
 * The same form serves adding and editing. In edit mode the location picker is
 * left out entirely: coordinates are not among the editable fields, and leaving
 * the picker out means an edit cannot disturb a pin that is already set.
 */
function renderAddView(editing = null) {
  viewEl.innerHTML = `
    <div class="shell authwrap">
      <div class="authcard" style="max-width:560px">
        <p class="eyebrow">${esc(editing ? t("editGahwa") : t("addGahwa"))}</p>
        <h1 class="authcard__title">${esc(editing ? t("editTitle") : t("addTitle"))}</h1>
        <p class="authcard__sub">${esc(editing ? t("editSub") : t("addSub"))}</p>

        <form class="form" id="addForm" novalidate>
          <div id="addAlert"></div>

          <div class="field" id="gName">
            <label class="field__label" for="gname">${esc(t("fName"))}</label>
            <input class="input" id="gname" type="text" maxlength="120" value="${esc(editing?.name ?? "")}" placeholder="${esc(t("fNamePh"))}" />
            <p class="field__error"></p>
          </div>

          <div class="field" id="gPlace">
            <label class="field__label" for="gplace">${esc(t("fPlace"))}</label>
            <input class="input" id="gplace" type="text" maxlength="120" value="${esc(editing?.place ?? "")}" placeholder="${esc(t("fPlacePh"))}" />
          </div>

          <div class="field" id="gWith">
            <label class="field__label" for="gwith">${esc(t("fWith"))}</label>
            <input class="input" id="gwith" type="text" maxlength="120" value="${esc(editing?.with_who ?? "")}" placeholder="${esc(t("fWithPh"))}" />
          </div>

          <div class="field" id="gRating">
            <span class="field__label">${esc(t("fRating"))}</span>
            <div class="rating" id="rating">
              ${[1, 2, 3, 4, 5]
                .map(
                  (n) => `<input type="radio" name="rating" id="r${n}" value="${n}" ${editing?.rating === n ? "checked" : ""} />
                          <label for="r${n}" data-value="${n}" title="${n}/5"><span aria-hidden="true">★</span><span class="sr" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">${n}</span></label>`
                )
                .join("")}
            </div>
            <p class="field__hint">${esc(t("fRatingHint"))}</p>
            <p class="field__error"></p>
          </div>

          <label class="toggle">
            <span class="toggle__text">
              <span class="toggle__title">${esc(t("fFav"))}</span>
              <span class="toggle__sub">${esc(t("fFavSub"))}</span>
            </span>
            <input type="checkbox" id="gfav" ${editing?.is_favorite ? "checked" : ""} />
            <span class="toggle__track" aria-hidden="true"></span>
          </label>

          <div class="field" id="gNotes">
            <label class="field__label" for="gnotes">${esc(t("fNotes"))}</label>
            <textarea class="textarea" id="gnotes" maxlength="2000" placeholder="${esc(t("fNotesPh"))}">${esc(editing?.notes ?? "")}</textarea>
          </div>

          ${editing ? "" : `
          <div class="field" id="gPin">
            <span class="field__label">${esc(t("fPin"))}</span>
            <p class="field__hint">${esc(t("fPinHint"))}</p>
            <div class="picker">
              <div class="picker__search">
                <input class="input" id="placeSearch" type="search" autocomplete="off"
                       placeholder="${esc(t("searchPlacePh"))}" aria-label="${esc(t("searchPlace"))}" />
                <button class="btn btn--quiet" type="button" id="placeSearchBtn">${esc(t("search"))}</button>
              </div>
              <p class="picker__result" id="placeSearchResult" hidden></p>
              <div id="pickerMap" class="picker__map"></div>
              <div class="picker__bar">
                <button class="btn btn--quiet" type="button" id="locateBtn">${esc(t("useMyLocation"))}</button>
                <span class="picker__value" id="pickerValue">${esc(t("noPinYet"))}</span>
                <button class="btn btn--quiet" type="button" id="clearPinBtn" hidden>${esc(t("clearPin"))}</button>
              </div>
            </div>
          </div>`}

          <button class="btn btn--block" type="submit" id="addSubmit">${esc(editing ? t("saveChanges") : t("save"))}</button>
          <a class="btn btn--quiet btn--block" href="#/dashboard">${esc(t("cancel"))}</a>
        </form>
      </div>
    </div>`;

  wireAddForm(editing);
}

/**
 * The optional location picker. Click the map to drop a pin, or let the browser
 * offer the current position. Leaving it alone stores no coordinates at all —
 * a cup without a place is still a valid cup.
 */
async function wireLocationPicker() {
  pickedPoint = null;

  const el = document.getElementById("pickerMap");
  const valueEl = document.getElementById("pickerValue");
  const clearBtn = document.getElementById("clearPinBtn");
  const locateBtn = document.getElementById("locateBtn");
  if (!el) return;

  let L;
  try {
    L = await loadLeaflet();
  } catch (error) {
    document.getElementById("gPin")?.remove(); // no map, no picker — the rest of the form still works
    console.warn("[salfa] location picker unavailable:", error);
    return;
  }
  if (!document.body.contains(el)) return;

  pickerMap?.remove();
  pickerMap = createBaseMap(L, el, { zoom: 10 });

  let marker = null;
  const setPoint = (lat, lng, zoom) => {
    pickedPoint = { latitude: lat, longitude: lng };
    if (marker) marker.setLatLng([lat, lng]);
    else marker = L.marker([lat, lng], { icon: salfaMarker(L) }).addTo(pickerMap);
    if (zoom) pickerMap.setView([lat, lng], zoom);
    valueEl.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    clearBtn.hidden = false;
  };

  pickerMap.on("click", (e) => setPoint(e.latlng.lat, e.latlng.lng));

  // Place lookup. Only fires on submit — Nominatim's policy forbids
  // autocomplete-style querying on every keystroke.
  const searchInput = document.getElementById("placeSearch");
  const searchBtn = document.getElementById("placeSearchBtn");
  const resultEl = document.getElementById("placeSearchResult");

  const runSearch = async () => {
    const query = searchInput.value.trim();
    if (!query) return;

    busy(searchBtn, true, t("searching"));
    resultEl.hidden = true;
    try {
      const [first] = await searchPlaces(query, { limit: 1 });
      if (!first) {
        resultEl.textContent = t("searchNoPlace");
        resultEl.hidden = false;
        return;
      }
      setPoint(first.latitude, first.longitude, 15);
      resultEl.textContent = first.label;
      resultEl.hidden = false;
    } catch (error) {
      resultEl.textContent = t("searchFailed");
      resultEl.hidden = false;
      console.warn("[salfa] place search failed:", error);
    } finally {
      busy(searchBtn, false);
    }
  };

  searchBtn.addEventListener("click", runSearch);
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault(); // never submit the whole log form from this field
      runSearch();
    }
  });

  clearBtn.addEventListener("click", () => {
    pickedPoint = null;
    if (marker) { marker.remove(); marker = null; }
    valueEl.textContent = t("noPinYet");
    clearBtn.hidden = true;
  });

  locateBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      valueEl.textContent = t("locateUnsupported");
      return;
    }
    busy(locateBtn, true, t("locating"));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        busy(locateBtn, false);
        setPoint(pos.coords.latitude, pos.coords.longitude, 15);
      },
      () => {
        busy(locateBtn, false);
        valueEl.textContent = t("locateDenied");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

function wireAddForm(editing = null) {
  // No picker in edit mode — the form does not render one.
  if (!editing) wireLocationPicker();

  const ratingEl = document.getElementById("rating");
  const labels = [...ratingEl.querySelectorAll("label")];

  const paint = (upTo, attr) => labels.forEach((l) => (l.dataset[attr] = Number(l.dataset.value) <= upTo ? "true" : "false"));

  ratingEl.addEventListener("change", () => {
    const value = Number(ratingEl.querySelector("input:checked")?.value || 0);
    paint(value, "on");
    setFieldError(document.getElementById("gRating"), "");
  });
  labels.forEach((label) => {
    label.addEventListener("mouseenter", () => paint(Number(label.dataset.value), "hover"));
  });
  ratingEl.addEventListener("mouseleave", () => paint(0, "hover"));

  const form = document.getElementById("addForm");
  const submit = document.getElementById("addSubmit");
  const alertSlot = document.getElementById("addAlert");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    alertSlot.innerHTML = "";

    const nameField = document.getElementById("gName");
    const ratingField = document.getElementById("gRating");
    const name = document.getElementById("gname").value.trim();
    const rating = Number(ratingEl.querySelector("input:checked")?.value || 0);

    let ok = true;
    const nameMsg = name ? "" : t("errNameReq");
    setFieldError(nameField, nameMsg);
    if (nameMsg) ok = false;

    const ratingMsg = rating >= 1 && rating <= 5 ? "" : t("errRatingReq");
    setFieldError(ratingField, ratingMsg);
    if (ratingMsg) ok = false;

    if (!ok) {
      if (nameMsg) document.getElementById("gname").focus();
      return;
    }

    busy(submit, true, t("saving"));
    const fields = {
      name,
      place: document.getElementById("gplace").value,
      with_who: document.getElementById("gwith").value,
      rating,
      is_favorite: document.getElementById("gfav").checked,
      notes: document.getElementById("gnotes").value,
    };

    try {
      if (editing) {
        const saved = await updateLog(editing.id, fields);
        // Swap the row in place so the collection keeps its order.
        state.logs = (state.logs ?? []).map((l) => (l.id === saved.id ? saved : l));
        toast(t("updatedToast"));
      } else {
        const saved = await createLog({
          ...fields,
          latitude: pickedPoint?.latitude,
          longitude: pickedPoint?.longitude,
        });
        state.logs = state.logs ? [saved, ...state.logs] : [saved];
        toast(t("savedToast"));
      }
      go("#/dashboard");
    } catch (error) {
      busy(submit, false);
      alertSlot.innerHTML = `<div class="alert alert--error">${esc(t("errGeneric"))}</div>`;
      console.error(editing ? "[salfa] update failed:" : "[salfa] insert failed:", error);
    }
  });
}

/* ------------------------------ config guard ------------------------------ */

function renderConfigMissing() {
  viewEl.innerHTML = `
    <div class="shell authwrap">
      <div class="authcard">
        <h1 class="authcard__title">${esc(t("configMissing"))}</h1>
        <p class="authcard__sub">${esc(t("configMissingBody"))}</p>
      </div>
    </div>`;
}

/* ------------------------------ router ------------------------------ */

function route() {
  if (!sheetEl.hidden) closeSheet();

  if (!configured) {
    renderConfigMissing();
    return;
  }

  const hash = location.hash || "#/";
  const signedIn = Boolean(state.session);
  const editId = hash.startsWith("#/edit/") ? decodeURIComponent(hash.slice("#/edit/".length)) : null;

  // The notice belongs to the auth screens; don't carry it anywhere else.
  if (hash !== "#/login" && hash !== "#/signup") state.notice = null;

  // The hero only exists on the landing page; never leave its WebGL context running.
  if (hash !== "#/") disposeHeroDallah();
  if (hash !== "#/map") { collectionMap?.remove(); collectionMap = null; }
  if (hash !== "#/add") { pickerMap?.remove(); pickerMap = null; }

  // Guests never reach the app; members never see the marketing pages.
  if (!signedIn && (hash === "#/dashboard" || hash === "#/add" || hash === "#/map" || hash === "#/rewards" || editId)) return go("#/login");
  if (signedIn && (hash === "#/" || hash === "#/login" || hash === "#/signup")) return go("#/dashboard");

  renderChrome();

  // Editing reuses the add form, prefilled. The row comes from the logs already
  // loaded for this user; if they are not loaded yet, fetch then re-route.
  if (editId) {
    if (state.logs === null) {
      viewEl.innerHTML = `<div class="shell section"><p class="dash__sub">${esc(t("loading"))}</p></div>`;
      loadLogs();
      return;
    }
    const log = state.logs.find((l) => l.id === editId);
    if (!log) return go("#/dashboard");
    renderAddView(log);
    window.scrollTo({ top: 0, behavior: "instant" });
    return;
  }

  switch (hash) {
    case "#/login":
      renderAuthView("login");
      break;
    case "#/signup":
      renderAuthView("signup");
      break;
    case "#/dashboard":
      renderDashboard();
      if (state.logs === null) loadLogs();
      if (state.claims === null) loadClaims();
      break;
    case "#/add":
      renderAddView();
      break;
    case "#/map":
      renderMapView();
      if (state.logs === null) loadLogs();
      break;
    case "#/rewards":
      renderRewardsView();
      if (state.logs === null) loadLogs();
      if (state.claims === null) loadClaims();
      break;
    default:
      renderLanding();
  }

  // scrollTo, not scrollIntoView — the latter aligns <main> with the viewport
  // top, which tucks the first heading under the sticky header.
  window.scrollTo({ top: 0, behavior: "instant" });
}

/* ------------------------------ boot ------------------------------ */

initLang();

langBtn.addEventListener("click", () => toggleLang());
onLangChange(() => route());
window.addEventListener("hashchange", route);

(async function boot() {
  if (!configured) {
    renderChrome();
    renderConfigMissing();
    console.warn("[salfa] Missing config — copy js/config.example.js to js/config.js.");
    return;
  }

  // Restore an existing session before the first paint so a reload on
  // #/dashboard doesn't bounce the user to the login screen. When the user has
  // just arrived from a confirmation link, this is also what consumes it:
  // getSession() waits for supabase-js to finish reading the URL.
  state.session = await getSession();

  let confirmedToast = null;

  if (AUTH_CALLBACK.isCallback) {
    stripCallbackFromUrl();

    if (AUTH_CALLBACK.error) {
      state.notice = {
        kind: "error",
        message: AUTH_CALLBACK.errorCode === "otp_expired" ? t("linkExpired") : t("linkInvalid"),
        offerResend: true,
      };
    } else if (state.session) {
      confirmedToast = t("confirmedToast");
    } else {
      // Tokens were present but no session came out of them.
      state.notice = { kind: "error", message: t("linkInvalid"), offerResend: true };
    }
  }

  onAuthChange((session) => {
    const changed = session?.user?.id !== state.session?.user?.id;
    state.session = session;
    if (changed) { state.logs = null; state.claims = null; }
    route();
  });

  // A failed confirmation belongs on the login screen, where the notice and the
  // resend button live. A successful one falls through to the signed-in guard,
  // which sends the user to their dashboard.
  if (state.notice) go("#/login");
  else route();

  if (confirmedToast) toast(confirmedToast);
})();
