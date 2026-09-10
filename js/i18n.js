/* ==========================================================================
   Bilingual layer. Every piece of interface copy lives here — add a key to
   both objects and it is available everywhere as t("key").
   User-entered content (names, places, notes) is never translated.
   ========================================================================== */

const STORE_KEY = "salfa.lang";

const DICT = {
  en: {
    /* chrome */
    langLabel: "العربية",
    login: "Log in",
    signup: "Sign up",
    logout: "Log out",
    footerTag: "Every cup has a story",

    /* landing */
    heroEyebrow: "Personal gahwa log",
    heroTitleA: "Every cup",
    heroTitleB: "has a story",
    heroArabic: "كل فنجال وراه سالفة",
    heroLede:
      "SĀLFA is your private record of the gahwa you drink — what it was, where you were, who you were with, and the story worth keeping.",
    heroCtaPrimary: "Start your log",
    heroCtaSecondary: "Log in",
    cup1: "Qahwa",
    cup2: "Iced",
    cup3: "Saada",
    cupMeta1: "with Mama",
    cupMeta2: "Salmiya",
    cupMeta3: "Morning",
    pillar1Title: "Record the cup",
    pillar1Body: "Name it, place it, rate it. Ten seconds and the memory is kept.",
    pillar2Title: "Keep the company",
    pillar2Body: "Gahwa is rarely alone. Note who was across the table from you.",
    pillar3Title: "Yours only",
    pillar3Body: "Your collection is private by design. Nobody else can read a single line.",

    /* auth */
    signupTitle: "Create your log",
    signupSub: "A private collection, starting with one cup.",
    loginTitle: "Welcome back",
    loginSub: "Your collection is where you left it.",
    fieldName: "Your name",
    fieldNamePh: "e.g. Lolwah",
    fieldEmail: "Email",
    fieldEmailPh: "you@example.com",
    fieldPassword: "Password",
    fieldPasswordPh: "At least 6 characters",
    doSignup: "Create account",
    doLogin: "Log in",
    haveAccount: "Already have an account?",
    noAccount: "New to SĀLFA?",
    checkEmail: "Almost there — check your inbox to confirm your email, then log in.",
    confirmedToast: "Email confirmed — welcome to SĀLFA.",
    linkExpired: "That confirmation link has expired or was already used. Send yourself a new one.",
    linkInvalid: "We couldn't confirm your email with that link. Send yourself a new one.",
    resendCta: "Resend confirmation email",
    resending: "Sending…",
    resendSent: "Sent. Check your inbox for a fresh link.",
    resendNeedEmail: "Enter your email above first.",

    /* validation + auth errors */
    errNameReq: "Please tell us your name.",
    errEmailReq: "Email is required.",
    errEmailBad: "That doesn't look like an email address.",
    errPassReq: "Password is required.",
    errPassShort: "Use at least 6 characters.",
    errBadCreds: "That email and password don't match. Try again.",
    errEmailTaken: "There is already an account with this email. Try logging in.",
    errEmailInvalid: "That email address isn't accepted. Try a different one.",
    errEmailSendLimit: "Too many confirmation emails just went out. Wait a few minutes and try again.",
    errUnconfirmed: "Please confirm your email first — check your inbox.",
    errRate: "Too many attempts. Give it a minute and try again.",
    errNetwork: "Can't reach the server. Check your connection and try again.",
    errGeneric: "Something went wrong. Please try again.",

    /* dashboard */
    greetMorning: "Good morning",
    greetAfternoon: "Good afternoon",
    greetEvening: "Good evening",
    dashSub: "Here is everything you've been drinking.",
    addGahwa: "Add gahwa",
    statTotal: "Cups logged",
    statFavs: "Favourites",
    statBest: "Highest rating",
    collectionTitle: "Your collection",
    countOne: "1 cup",
    countMany: "{n} cups",
    loading: "Loading your collection…",

    /* card + detail */
    labelPlace: "Place",
    labelWith: "With",
    labelRating: "Rating",
    labelNotes: "Notes",
    labelLogged: "Logged",
    favourite: "Favourite",
    noPlace: "—",
    close: "Close",

    /* empty */
    emptyTitle: "No cups yet",
    emptyBody:
      "Your collection starts with a single gahwa. Log the one in your hand right now — where you are, who's with you, and how it tastes.",
    emptyCta: "Log your first gahwa",

    /* add form */
    addTitle: "Add a gahwa",
    addSub: "Only the name and a rating are required. The rest is the story.",
    fName: "What did you have?",
    fNamePh: "Qahwa saada, Turkish, cortado…",
    fPlace: "Where were you?",
    fPlacePh: "Home, Salmiya, a friend's diwaniya…",
    fWith: "Who were you with?",
    fWithPh: "Alone, Mama, the cousins…",
    fRating: "How was it?",
    fRatingHint: "1 is forgettable, 5 is the one you'll talk about.",
    fFav: "Mark as favourite",
    fFavSub: "The cups worth returning to.",
    fNotes: "Your notes",
    fNotesPh: "The cardamom was heavy, the company was better…",
    save: "Save this cup",
    saving: "Saving…",
    cancel: "Cancel",
    backToDash: "Back to collection",
    errRatingReq: "Pick a rating from 1 to 5.",
    savedToast: "Cup saved to your collection.",

    /* misc */
    configMissing: "Supabase is not configured",
    configMissingBody:
      "Copy js/config.example.js to js/config.js and add your project URL and publishable key.",
  },

  ar: {
    /* chrome */
    langLabel: "English",
    login: "تسجيل الدخول",
    signup: "حساب جديد",
    logout: "تسجيل الخروج",
    footerTag: "كل فنجال وراه سالفة",

    /* landing */
    heroEyebrow: "سجل قهوتك الخاص",
    heroTitleA: "كل فنجال",
    heroTitleB: "وراه سالفة",
    heroArabic: "Every cup has a story",
    heroLede:
      "سالفة هو سجلك الخاص للقهوة التي تشربها — ماذا كانت، وأين كنت، ومع من، والسالفة التي تستحق أن تُحفظ.",
    heroCtaPrimary: "ابدأ سجلك",
    heroCtaSecondary: "تسجيل الدخول",
    cup1: "قهوة",
    cup2: "مثلجة",
    cup3: "سادة",
    cupMeta1: "مع ماما",
    cupMeta2: "السالمية",
    cupMeta3: "الصباح",
    pillar1Title: "سجّل الفنجال",
    pillar1Body: "اسمه، مكانه، تقييمه. عشر ثوانٍ وتبقى الذكرى محفوظة.",
    pillar2Title: "احفظ الرفقة",
    pillar2Body: "القهوة نادراً ما تكون وحدك. سجّل من كان معك على الطاولة.",
    pillar3Title: "لك وحدك",
    pillar3Body: "مجموعتك خاصة بطبيعتها. لا أحد غيرك يستطيع قراءة سطر واحد.",

    /* auth */
    signupTitle: "أنشئ سجلك",
    signupSub: "مجموعة خاصة، تبدأ بفنجال واحد.",
    loginTitle: "أهلاً بعودتك",
    loginSub: "مجموعتك في مكانها كما تركتها.",
    fieldName: "اسمك",
    fieldNamePh: "مثال: لولوة",
    fieldEmail: "البريد الإلكتروني",
    fieldEmailPh: "you@example.com",
    fieldPassword: "كلمة المرور",
    fieldPasswordPh: "٦ أحرف على الأقل",
    doSignup: "إنشاء الحساب",
    doLogin: "تسجيل الدخول",
    haveAccount: "لديك حساب بالفعل؟",
    noAccount: "جديد على سالفة؟",
    checkEmail: "خطوة أخيرة — تحقق من بريدك لتأكيد الحساب، ثم سجّل الدخول.",
    confirmedToast: "تم تأكيد بريدك — أهلاً بك في سالفة.",
    linkExpired: "انتهت صلاحية رابط التأكيد أو تم استخدامه من قبل. أرسل رابطاً جديداً.",
    linkInvalid: "تعذّر تأكيد بريدك بهذا الرابط. أرسل رابطاً جديداً.",
    resendCta: "إعادة إرسال رسالة التأكيد",
    resending: "جارٍ الإرسال…",
    resendSent: "تم الإرسال. تحقق من بريدك للحصول على رابط جديد.",
    resendNeedEmail: "أدخل بريدك الإلكتروني أولاً.",

    /* validation + auth errors */
    errNameReq: "من فضلك أدخل اسمك.",
    errEmailReq: "البريد الإلكتروني مطلوب.",
    errEmailBad: "هذا لا يبدو بريداً إلكترونياً صحيحاً.",
    errPassReq: "كلمة المرور مطلوبة.",
    errPassShort: "استخدم ٦ أحرف على الأقل.",
    errBadCreds: "البريد الإلكتروني أو كلمة المرور غير صحيحة. حاول مرة أخرى.",
    errEmailTaken: "يوجد حساب بهذا البريد بالفعل. جرّب تسجيل الدخول.",
    errEmailInvalid: "هذا البريد الإلكتروني غير مقبول. جرّب بريداً آخر.",
    errEmailSendLimit: "تم إرسال رسائل تأكيد كثيرة. انتظر بضع دقائق ثم حاول مجدداً.",
    errUnconfirmed: "يرجى تأكيد بريدك الإلكتروني أولاً — تحقق من صندوق الوارد.",
    errRate: "محاولات كثيرة. انتظر دقيقة وحاول مجدداً.",
    errNetwork: "لا يمكن الوصول للخادم. تحقق من اتصالك وحاول مجدداً.",
    errGeneric: "حدث خطأ ما. حاول مرة أخرى.",

    /* dashboard */
    greetMorning: "صباح الخير",
    greetAfternoon: "طاب يومك",
    greetEvening: "مساء الخير",
    dashSub: "هذا كل ما شربته حتى الآن.",
    addGahwa: "أضف قهوة",
    statTotal: "عدد الفناجيل",
    statFavs: "المفضلة",
    statBest: "أعلى تقييم",
    collectionTitle: "مجموعتك",
    countOne: "فنجال واحد",
    countMany: "{n} فنجال",
    loading: "جارٍ تحميل مجموعتك…",

    /* card + detail */
    labelPlace: "المكان",
    labelWith: "مع",
    labelRating: "التقييم",
    labelNotes: "الملاحظات",
    labelLogged: "التاريخ",
    favourite: "مفضلة",
    noPlace: "—",
    close: "إغلاق",

    /* empty */
    emptyTitle: "لا توجد فناجيل بعد",
    emptyBody:
      "مجموعتك تبدأ بفنجال واحد. سجّل الذي بين يديك الآن — أين أنت، ومن معك، وكيف طعمه.",
    emptyCta: "سجّل أول فنجال",

    /* add form */
    addTitle: "أضف قهوة",
    addSub: "الاسم والتقييم فقط مطلوبان. الباقي هو السالفة.",
    fName: "ماذا شربت؟",
    fNamePh: "قهوة سادة، تركية، كورتادو…",
    fPlace: "أين كنت؟",
    fPlacePh: "البيت، السالمية، ديوانية صديق…",
    fWith: "مع من كنت؟",
    fWithPh: "وحدي، ماما، الكزنات…",
    fRating: "كيف كانت؟",
    fRatingHint: "١ تُنسى، و٥ هي التي ستحكي عنها.",
    fFav: "أضفها للمفضلة",
    fFavSub: "الفناجيل التي تستحق العودة إليها.",
    fNotes: "ملاحظاتك",
    fNotesPh: "الهيل كان ثقيلاً، والرفقة كانت أطيب…",
    save: "احفظ هذا الفنجال",
    saving: "جارٍ الحفظ…",
    cancel: "إلغاء",
    backToDash: "العودة للمجموعة",
    errRatingReq: "اختر تقييماً من ١ إلى ٥.",
    savedToast: "تم حفظ الفنجال في مجموعتك.",

    /* misc */
    configMissing: "لم يتم إعداد Supabase",
    configMissingBody:
      "انسخ js/config.example.js إلى js/config.js وأضف رابط المشروع والمفتاح العام.",
  },
};

let lang = "en";
const listeners = new Set();

export function initLang() {
  const saved = localStorage.getItem(STORE_KEY);
  setLang(saved === "ar" || saved === "en" ? saved : "en", { silent: true });
}

export function getLang() {
  return lang;
}

export function isRTL() {
  return lang === "ar";
}

export function setLang(next, { silent = false } = {}) {
  lang = next === "ar" ? "ar" : "en";
  localStorage.setItem(STORE_KEY, lang);

  const html = document.documentElement;
  html.lang = lang;
  html.dir = lang === "ar" ? "rtl" : "ltr";

  if (!silent) listeners.forEach((fn) => fn(lang));
}

export function toggleLang() {
  setLang(lang === "en" ? "ar" : "en");
}

export function onLangChange(fn) {
  listeners.add(fn);
}

/** t("countMany", { n: 4 }) */
export function t(key, vars) {
  let str = DICT[lang][key] ?? DICT.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) str = str.replaceAll(`{${k}}`, v);
  }
  return str;
}

/** Arabic-Indic digits in Arabic, Western digits in English. */
export function num(value) {
  const s = String(value);
  if (lang !== "ar") return s;
  return s.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
}

/** Locale-aware, human-readable date. */
export function formatDate(iso) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-KW" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}
