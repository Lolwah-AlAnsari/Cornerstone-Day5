/* ==========================================================================
   SĀLFA — application shell.
   A tiny hash router, five views, and no framework. Each render* function
   returns an HTML string; wire* functions attach the behaviour afterwards.
   ========================================================================== */

import { configured, supabase } from "./supabase.js";
import { initLang, t, num, formatDate, getLang, toggleLang, onLangChange } from "./i18n.js";
import { signUp, logIn, logOut, getSession, onAuthChange, displayName, friendlyAuthError, resendConfirmation } from "./auth.js";
import { listLogs, createLog, computeStats } from "./logs.js";

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
};

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
      <div class="hero__art" aria-hidden="true">
        <div class="cupcard"><span class="cupcard__label">${esc(t("cup2"))}</span><span class="cupcard__meta">${esc(t("cupMeta2"))}</span></div>
        <div class="cupcard"><span class="cupcard__label">${esc(t("cup3"))}</span><span class="cupcard__meta">${esc(t("cupMeta3"))}</span></div>
        <div class="cupcard">
          <span class="cupcard__label">${esc(t("cup1"))}</span>
          <span class="cupcard__meta">${esc(t("cupMeta1"))}</span>
          ${starsMarkup(5)}
        </div>
      </div>
    </section>

    <section class="shell section">
      <div class="pillars">
        ${[1, 2, 3]
          .map(
            (n) => `
          <div class="pillar">
            <p class="pillar__n">${esc(num(`0${n}`))}</p>
            <h3>${esc(t(`pillar${n}Title`))}</h3>
            <p>${esc(t(`pillar${n}Body`))}</p>
          </div>`
          )
          .join("")}
      </div>
    </section>`;
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
        <a class="btn btn--desktop-add" href="#/add">${esc(t("addGahwa"))}</a>
      </header>

      <section class="stats" aria-label="${esc(t("collectionTitle"))}">
        <div class="stat"><p class="stat__n">${esc(num(stats.total))}</p><p class="stat__label">${esc(t("statTotal"))}</p></div>
        <div class="stat"><p class="stat__n stat__n--sand">${esc(num(stats.favourites))}</p><p class="stat__label">${esc(t("statFavs"))}</p></div>
        <div class="stat"><p class="stat__n">${stats.best ? esc(num(stats.best)) + `<small style="font-size:.5em;opacity:.5">/${esc(num(5))}</small>` : "—"}</p><p class="stat__label">${esc(t("statBest"))}</p></div>
      </section>

      <section>
        <div class="collection__bar">
          <h2 class="collection__title">${esc(t("collectionTitle"))}</h2>
          ${
            logs?.length
              ? `<span class="collection__count">${esc(logs.length === 1 ? t("countOne") : t("countMany", { n: num(logs.length) }))}</span>`
              : ""
          }
        </div>
        <div id="collection">${renderCollection()}</div>
      </section>
    </div>

    <div class="mobilebar">
      <a class="btn btn--block" href="#/add">${esc(t("addGahwa"))}</a>
    </div>`;

  wireCollection();
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
        <div class="empty__cup" aria-hidden="true"><span></span></div>
        <h3>${esc(t("emptyTitle"))}</h3>
        <p>${esc(t("emptyBody"))}</p>
        <a class="btn" href="#/add">${esc(t("emptyCta"))}</a>
      </div>`;
  }

  return `<div class="grid">${state.logs.map(logCard).join("")}</div>`;
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
  }
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
    }`;

  sheetEl.hidden = false;
  document.body.style.overflow = "hidden";
  sheetPanelEl.querySelector("[data-close-sheet]")?.focus();
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

function renderAddView() {
  viewEl.innerHTML = `
    <div class="shell authwrap">
      <div class="authcard" style="max-width:560px">
        <p class="eyebrow">${esc(t("addGahwa"))}</p>
        <h1 class="authcard__title">${esc(t("addTitle"))}</h1>
        <p class="authcard__sub">${esc(t("addSub"))}</p>

        <form class="form" id="addForm" novalidate>
          <div id="addAlert"></div>

          <div class="field" id="gName">
            <label class="field__label" for="gname">${esc(t("fName"))}</label>
            <input class="input" id="gname" type="text" maxlength="120" placeholder="${esc(t("fNamePh"))}" />
            <p class="field__error"></p>
          </div>

          <div class="field" id="gPlace">
            <label class="field__label" for="gplace">${esc(t("fPlace"))}</label>
            <input class="input" id="gplace" type="text" maxlength="120" placeholder="${esc(t("fPlacePh"))}" />
          </div>

          <div class="field" id="gWith">
            <label class="field__label" for="gwith">${esc(t("fWith"))}</label>
            <input class="input" id="gwith" type="text" maxlength="120" placeholder="${esc(t("fWithPh"))}" />
          </div>

          <div class="field" id="gRating">
            <span class="field__label">${esc(t("fRating"))}</span>
            <div class="rating" id="rating">
              ${[1, 2, 3, 4, 5]
                .map(
                  (n) => `<input type="radio" name="rating" id="r${n}" value="${n}" />
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
            <input type="checkbox" id="gfav" />
            <span class="toggle__track" aria-hidden="true"></span>
          </label>

          <div class="field" id="gNotes">
            <label class="field__label" for="gnotes">${esc(t("fNotes"))}</label>
            <textarea class="textarea" id="gnotes" maxlength="2000" placeholder="${esc(t("fNotesPh"))}"></textarea>
          </div>

          <button class="btn btn--block" type="submit" id="addSubmit">${esc(t("save"))}</button>
          <a class="btn btn--quiet btn--block" href="#/dashboard">${esc(t("cancel"))}</a>
        </form>
      </div>
    </div>`;

  wireAddForm();
}

function wireAddForm() {
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
    try {
      const saved = await createLog({
        name,
        place: document.getElementById("gplace").value,
        with_who: document.getElementById("gwith").value,
        rating,
        is_favorite: document.getElementById("gfav").checked,
        notes: document.getElementById("gnotes").value,
      });

      state.logs = state.logs ? [saved, ...state.logs] : [saved];
      toast(t("savedToast"));
      go("#/dashboard");
    } catch (error) {
      busy(submit, false);
      alertSlot.innerHTML = `<div class="alert alert--error">${esc(t("errGeneric"))}</div>`;
      console.error("[salfa] insert failed:", error);
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

  // The notice belongs to the auth screens; don't carry it anywhere else.
  if (hash !== "#/login" && hash !== "#/signup") state.notice = null;

  // Guests never reach the app; members never see the marketing pages.
  if (!signedIn && (hash === "#/dashboard" || hash === "#/add")) return go("#/login");
  if (signedIn && (hash === "#/" || hash === "#/login" || hash === "#/signup")) return go("#/dashboard");

  renderChrome();

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
      break;
    case "#/add":
      renderAddView();
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
    if (changed) state.logs = null;
    route();
  });

  // A failed confirmation belongs on the login screen, where the notice and the
  // resend button live. A successful one falls through to the signed-in guard,
  // which sends the user to their dashboard.
  if (state.notice) go("#/login");
  else route();

  if (confirmedToast) toast(confirmedToast);
})();
