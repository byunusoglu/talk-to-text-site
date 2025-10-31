"use strict";

/* =====================================================
   StoryBuds — unified interactions (Local-first Accounts + Existing UX)
   - Preserves: age selector, hero parallax, wizard, API call, checkout,
               testimonials, scroll morph, audio micro-demo, etc.
   - Adds:     accounts (localStorage), auth modal, signed-in routing,
               topbar hydration, real gate unlock.
===================================================== */
(() => {

  /* ---------------------------------------------
     Tiny DOM helpers + boot
  --------------------------------------------- */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const onReady = (fn) => (document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", fn, { once: true })
    : fn());
  const fadeOutAnd = (cb, delay = 150) => {
    try { document.body.classList.add("fade-out"); } catch (_) {}
    setTimeout(cb, delay);
  };
  const SS = window.sessionStorage;

   /* ===== Real Auth client (Sign Up only for now) ===== */
const YW_API_BASE = "https://imaginee-y9nk.onrender.com/api/v1"; // partner's base
const YW_JWT_KEY  = "yw_jwt";   // where we stash the token for now (localStorage)
let   YW_JWT_MEM  = "";         // in-memory copy to avoid frequent storage reads

function setJwt(token) {
  YW_JWT_MEM = token || "";
  try { localStorage.setItem(YW_JWT_KEY, YW_JWT_MEM); } catch(_) {}
}
function getJwt() {
  if (YW_JWT_MEM) return YW_JWT_MEM;
  try { YW_JWT_MEM = localStorage.getItem(YW_JWT_KEY) || ""; } catch(_) {}
  return YW_JWT_MEM;
}

// Pull child fields from our transcript if available
function deriveChildFromTranscript() {
  const SS = window.sessionStorage;
  const raw = (SS.getItem("yw_transcript") || "").toString();

  const read = (labelRx) => {
    const m = raw.match(labelRx);
    return m && m[1] ? m[1].trim() : "";
  };

  const childName = read(/Child name:\s*([^\n]+)/i);
  const genderRaw = read(/Child gender:\s*([^\n]+)/i) || read(/Gender:\s*([^\n]+)/i);
  const ageRaw    = read(/Child age:\s*([^\n]+)/i) || read(/Age:\s*([^\n]+)/i);

  let gender = (genderRaw || "").toLowerCase();
  if (["boy","male","erkek"].includes(gender)) gender = "male";
  else if (["girl","female","kız","kiz"].includes(gender)) gender = "female";
  else if (["non-binary","nonbinary"].includes(gender)) gender = "non-binary";
  else if (!gender) gender = "prefer-not-to-say";

  // Birth year from age if possible
  let birthYear = "";
  const age = parseInt((ageRaw || "").replace(/\D/g, ""), 10);
  if (!isNaN(age)) {
    const now = new Date();
    birthYear = String(now.getUTCFullYear() - Math.min(Math.max(age, 0), 12));
  }
  return { childName, birthYear, gender };
}

// Real API call
async function apiSignup({ childName, email, password, birthYear, gender }) {
  // Validate minimums; backend expects all of these.
  if (!childName || !birthYear || !gender) {
    throw new Error("MISSING_CHILD_FIELDS"); // we'll handle by asking inline
  }
  const res = await fetch(`${YW_API_BASE}/users/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ childName, email, password, birthYear: Number(birthYear), gender })
  });
  const data = await res.json().catch(()=> ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || `Signup failed (${res.status})`;
    throw new Error(msg);
  }
  const token = data?.token || "";
  if (!token) throw new Error("NO_TOKEN");
  setJwt(token);
  return data;
}


   
  /* ---------------------------------------------
     App constants
  --------------------------------------------- */
  const AGE_KEY = "yw_age_group";          // '0-2' | '3-5' | '5+'
  const DEFAULT_AGE = "0-2";
   const AGE_UI_DISABLED = true; // hide age tags, default to 0–2
  const API_URL = "https://fairytale-api.vercel.app/api/generate-story";

  // keys used on navigation to checkout
  const K_TRANSCRIPT = "yw_transcript";
  const K_STORY_MD   = "yw_story_markdown";
  const K_STORY_HTML = "yw_story_html";
   const K_PENDING   = "yw_pending_transcript";   // <— new: pass data to checkout to generate there


  // Preload hero images for fast swaps
  ["momdaughterbanner.png","childsdreambanner.png","grownbanner.png"]
    .forEach(src => { const img = new Image(); img.src = src; });

  // Try transparent cut-out first; fall back to current assets
  const HERO_BY_AGE = {
    "0-2": {
      imageCut: "momdaughter_cut.png",
      image:    "momdaughterbanner.png",
      title: "Tonight’s bedtime hero? Your kid.",
      desc:  "Turn your child’s imagination into their favourite storytime moment — every night.",
      cta:   "Create story"
    },
    "3-5": {
      imageCut: "childsdream_cut.png",
      image:    "childsdreambanner.png",
      title: "Create magical bedtime stories together.",
      desc:  "Turn your child’s imagination into their favourite storytime moment — every night.",
      cta:   "Create story"
    },
    "5+": {
      imageCut: "grownbanner_cut.png",
      image:    "grownbanner.png",
      title: "Create superhero stories together.",
      desc:  "Turn your child’s imagination into their favourite storytime moment — every night.",
      cta:   "Create story"
    }
  };

  /* ---------------------------------------------
     Local-first Accounts (email+password)
  --------------------------------------------- */
  const USERS_KEY  = "yw_users";        // { [email]: { pwHash, createdAt } }
  const AUTH_KEY   = "yw_signed_in";    // "1" or null
  const AUTH_EMAIL = "yw_user_email";   // current user email

  const isSignedIn = () => {
    try { return localStorage.getItem(AUTH_KEY) === "1"; } catch(_) { return false; }
  };
  const currentEmail = () => {
    try { return localStorage.getItem(AUTH_EMAIL) || ""; } catch(_) { return ""; }
  };
  function setSignedIn(v) { try { localStorage.setItem(AUTH_KEY, v ? "1" : "0"); } catch(_){} }

  async function sha256(text) {
    const buf = new TextEncoder().encode(text);
    const hashBuf = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,"0")).join("");
  }
  function readUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY) || "{}"); } catch(_) { return {}; }
  }
  function writeUsers(obj) {
    try { localStorage.setItem(USERS_KEY, JSON.stringify(obj)); } catch(_) {}
  }
  async function createUser(email, password) {
    const users = readUsers();
    const key = (email||"").trim().toLowerCase();
    if (!key) throw new Error("EMAIL_REQUIRED");
    if (users[key]) throw new Error("EMAIL_EXISTS");
    const pwHash = await sha256(password || "");
    users[key] = { pwHash, createdAt: Date.now() };
    writeUsers(users);
    localStorage.setItem(AUTH_KEY, "1");
    localStorage.setItem(AUTH_EMAIL, key);
    return key;
  }
  async function signIn(email, password) {
    const users = readUsers();
    const key = (email||"").trim().toLowerCase();
    const rec = users[key];
    if (!rec) throw new Error("NO_SUCH_USER");
    const pwHash = await sha256(password || "");
    if (pwHash !== rec.pwHash) throw new Error("BAD_PASSWORD");
    localStorage.setItem(AUTH_KEY, "1");
    localStorage.setItem(AUTH_EMAIL, key);
    return key;
  }
  function signOut() {
    try {
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(AUTH_EMAIL);
    } catch(_) {}
  }

  /* ---------------------------------------------
     Chrome hydration (logo + menu links)
  --------------------------------------------- */
  function hydrateTopbarAuth() {
    // Logo routing
    const logoA = document.querySelector('a.logo');
    if (logoA) logoA.setAttribute("href", isSignedIn() ? "home.html" : "index.html");

    // Hamburger / top menu (expects #menu, degrades gracefully)
    const menu = $("#menu");
    if (!menu) return;

    menu.innerHTML = "";
    if (isSignedIn()) {
      menu.insertAdjacentHTML("beforeend",
        `<a href="home.html" aria-current="page">Home</a>
         <a href="create.html">Create Stories</a>
         <a href="#" id="menuSignOut">Sign Out</a>`);
      $("#menuSignOut")?.addEventListener("click", (e) => {
        e.preventDefault();
        signOut();
        fadeOutAnd(()=>{ window.location.href = "index.html"; }, 120);
      });
    } else {
      menu.insertAdjacentHTML("beforeend",
        `<a href="index.html" aria-current="page">Home</a>
         <a href="create.html">Create Stories</a>
         <a href="#" id="menuAuth">Sign In / Up</a>`);
      $("#menuAuth")?.addEventListener("click", (e) => {
        e.preventDefault();
        openAuthModal(); // default to Sign Up
      });
    }
  }

   /* ---------------------------------------------
   Menu helpers + initChrome (auto-close on outside click)
--------------------------------------------- */

// Find your menu element robustly
function getMenuEl() {
  return document.getElementById("menu")
      || document.querySelector('[data-nav="menu"]')
      || document.querySelector(".nav-menu")
      || document.querySelector("#mobileMenu")
      || null;
}

// Close menu when clicking/touching outside or pressing Esc
function wireMenuAutoClose(menuBtn, menu) {
  if (!menuBtn || !menu) return;

  function isOpen() { return !menu.classList.contains('hidden'); }
  function close()   { menu.classList.add('hidden'); }

  const outside = (e) => {
    if (!isOpen()) return;
    const t = e.target;
    if (menu.contains(t) || menuBtn.contains(t)) return; // click inside → ignore
    close();
  };

  document.addEventListener('click', outside, { passive: true });
  document.addEventListener('touchstart', outside, { passive: true });
  document.addEventListener('keydown', (e) => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
}

// REPLACE your current initChrome() with this:
function initChrome() {
  const menuBtn = document.getElementById('menuBtn');
  const menu = getMenuEl();
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', () => {
      menu.classList.toggle('hidden');
    });
    wireMenuAutoClose(menuBtn, menu);
  }

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const cartCountEl = document.getElementById("cartCount");
  if (cartCountEl) cartCountEl.classList.add("hidden");

  // Re-hydrate once to win races with other DOM scripts
  setTimeout(hydrateTopbarAuth, 0);
}


  /* ---------------------------------------------
     Guard: signed-in users → /home.html from landing
  --------------------------------------------- */
  function guardLandingRedirect() {
    const path = (location.pathname || "").toLowerCase();
    const isIndexPath = path.endsWith("/index.html") || path.endsWith("/") || path === "";
    const hasLandingMarkers = !!document.querySelector('.age-buttons') && !!document.getElementById('heroCta');
    if ((isIndexPath || hasLandingMarkers) && isSignedIn()) {
      fadeOutAnd(()=>{ window.location.href = "home.html"; }, 80);
    }
  }

  /* ---------------------------------------------
     Auth Modal (Sign Up / Sign In) — works anywhere
  --------------------------------------------- */
  function openAuthModal(defaultMode = "signup") {
    const id = "authModal";
    let modal = document.getElementById(id);

    if (!modal) {
      modal = document.createElement("div");
      modal.id = id;
      modal.className = "modal";
      modal.innerHTML = `
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="authTitle">
          <button class="modal-close" id="authCloseBtn" aria-label="Close">✕</button>
          <h2 id="authTitle">Welcome to StoryBuds</h2>
          <div class="demo-rows" style="gap:12px">
            <div>
              <label style="font-weight:700">Email</label>
              <input id="authEmail" type="email" placeholder="you@example.com"
                style="width:100%;padding:12px;border:1px solid #e0dcec;border-radius:12px;">
            </div>
            <div>
              <label style="font-weight:700">Password</label>
              <input id="authPass" type="password" placeholder="••••••••"
                style="width:100%;padding:12px;border:1px solid #e0dcec;border-radius:12px;">
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button class="btn" id="authPrimaryBtn">Create free account</button>
              <button class="btn ghost" id="authSwitch">Have an account? Sign In</button>
            </div>
            <p class="muted" style="margin:6px 0 0">No payment needed. You’ll save your stories.</p>
          </div>
        </div>`;

      document.body.appendChild(modal);

      const close = () => modal.classList.add("hidden");
      modal.addEventListener("click", (e)=> { if (e.target === modal) close(); });
      $("#authCloseBtn")?.addEventListener("click", close);

      function setMode(mode) {
        const title   = $("#authTitle");
        const primary = $("#authPrimaryBtn");
        const switcher= $("#authSwitch");

        if (mode === "signin") {
          if (title)   title.textContent = "Welcome back";
          if (primary) primary.textContent = "Sign In";
          if (switcher) switcher.textContent = "New here? Create an account";

          if (primary) primary.onclick = async () => {
            const email = $("#authEmail")?.value.trim();
            const pass  = $("#authPass")?.value;
            try {
              await signIn(email, pass);
              close();
              fadeOutAnd(()=>{ window.location.href = "home.html"; }, 120);
            } catch (err) {
              alert(err?.message === "BAD_PASSWORD" ? "Wrong password."
                : err?.message === "NO_SUCH_USER" ? "No account with that email."
                : "Could not sign in.");
            }
          };
          if (switcher) switcher.onclick = () => setMode("signup");
        } else {
          if (title)   title.textContent = "Welcome to StoryBuds";
          if (primary) primary.textContent = "Create free account";
          if (switcher) switcher.textContent = "Have an account? Sign In";

          if (primary) primary.onclick = async () => {
            const email = $("#authEmail")?.value.trim();
            const pass  = $("#authPass")?.value;
            if (!email || !pass) { alert("Please enter email and password."); return; }
            try {
              await createUser(email, pass);
              close();
              fadeOutAnd(()=>{ window.location.href = "home.html"; }, 120);
            } catch (err) {
              alert(err?.message === "EMAIL_EXISTS" ? "That email is already registered."
                : "Could not create account.");
            }
          };
          if (switcher) switcher.onclick = () => setMode("signin");
        }
      }

      modal.classList.remove("hidden");
      setMode(defaultMode);
    } else {
      modal.classList.remove("hidden");
    }
  }

  /* ---------------------------------------------
     Age persistence + hero content
  --------------------------------------------- */
  const setAge = (val) => { try { localStorage.setItem(AGE_KEY, String(val)); } catch (_) {} };
  const getAge = () => {
    try { return localStorage.getItem(AGE_KEY) || DEFAULT_AGE; }
    catch (_) { return DEFAULT_AGE; }
  };
  const paintSelectedAge = () => {
    const current = getAge().toLowerCase();
    $$(".age-btn").forEach(b => b.classList.toggle("selected",
      (b.dataset.age || "").toLowerCase() === current));
  };

  // Pull child's first name from the transcript we already stash
  function getChildName() {
    try {
      const raw = SS.getItem(K_TRANSCRIPT) || "";
      // Expecting lines like: "Child name: Arthur"
      const m = raw.match(/Child name:\s*([^\n]+)/i);
      const name = (m && m[1] ? m[1].trim() : "").replace(/[^A-Za-zÇĞİÖŞÜçğıöşü' -]/g, "");
      return name || "";
    } catch (_) { return ""; }
  }

  // helper: prefer cut-out if it exists on the server
  async function pickBestSrc(cfg) {
    const trySrc = async (src) => {
      try {
        const res = await fetch(src, { method: "HEAD" });
        return res.ok ? src : null;
      } catch { return null; }
    };
    return (await trySrc(cfg.imageCut)) || cfg.image;
  }

  async function updateHeroForAge(ageRaw) {
    try {
      const age = (ageRaw || DEFAULT_AGE).trim();
      const cfg = HERO_BY_AGE[age] || HERO_BY_AGE[DEFAULT_AGE];

      const imgEl  = document.getElementById("heroImage");
      const title  = document.getElementById("heroTitle");
      const desc   = document.getElementById("heroDesc");
      const cta    = document.getElementById("heroCta");

      if (imgEl && cfg) {
        const src = await pickBestSrc(cfg);
        imgEl.parentElement?.setAttribute('data-parallax', 'on');
        imgEl.src = src;
        imgEl.alt = cfg.title || "StoryBuds hero";
      }
      if (title) title.textContent = cfg.title;
      if (desc)  desc.textContent  = cfg.desc;
      if (cta) {
        cta.textContent = cfg.cta;
        cta.onclick = () => fadeOutAnd(() => { window.location.href = "create.html"; });
      }
    } catch (_) {}
  }

  /* ---------------------------------------------
     Page guards
  --------------------------------------------- */
  const isCreateChatPage = () => Boolean($('#chatWizard'));
  const isCheckoutPage   = () => Boolean($('#storyContent') && $('#productsTrack'));
  const goCheckout       = () => fadeOutAnd(() => { window.location.href = "checkout.html"; });

  /* ---------------------------------------------
     Markdown → minimal HTML (safe-ish)
  --------------------------------------------- */
  const mdToHtml = (md) => {
    if (!md) return "";
    return md
      .replace(/^### (.*)$/gm, "<h3>$1</h3>")
      .replace(/^## (.*)$/gm, "<h2>$1</h2>")
      .replace(/^# (.*)$/gm,  "<h1>$1</h1>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n{2,}/g, "</p><p>")
      .replace(/(^|>)(?!<h\d|<p|<\/p>)([^\n]+)(?=\n|$)/g, "$1<p>$2</p>");
  };

  // Build ~10-line preview from Markdown (skip headings so clamp height is used by body)
  function makePreviewHtml(md, maxLines = 10) {
    if (!md) return "";

    // 1) Remove the very first H1 (title) and any immediate blank lines after it.
    let cleaned = md.replace(/^\s*# [^\n]*\n+(\s*\n)*/m, "");

    // 2) Build preview skipping H2/H3 headings
    const lines = cleaned.split(/\r?\n/);
    const out = [];
    let taken = 0;

    for (const ln of lines) {
      if (/^\s*##{1,2}\s+/.test(ln)) continue; // skip headings
      out.push(ln);
      if (ln.trim().length) taken++;
      if (taken >= maxLines) break;
    }

    // Fallback if empty
    if (!taken) {
      out.length = 0;
      taken = 0;
      for (const ln of lines) {
        out.push(ln);
        if (ln.trim().length) taken++;
        if (taken >= maxLines) break;
      }
    }

    const previewMd = out.join("\n") + "\n\n…";
    return mdToHtml(previewMd);
  }

  /* ---------------------------------------------
     Landing: age buttons + hover preview
  --------------------------------------------- */
function initAgeButtons() {
  if (AGE_UI_DISABLED) {
    // Force default selection and update hero
    setAge(DEFAULT_AGE);
    updateHeroForAge(DEFAULT_AGE);

    // Hide/remove the age bar if it exists
    const bar =
      document.querySelector('.age-buttons') ||
      document.getElementById('ageBar') ||
      document.querySelector('[data-age="buttons"]');
    if (bar) bar.classList.add('hidden');

    // Add a body marker so CSS can tighten layout spacing
    document.body.classList.add('age-no-bar');
    return; // skip wiring any age button events
  }

  // (original behavior, kept for later re-enable)
  paintSelectedAge();
  updateHeroForAge(getAge());
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".age-btn");
    if (!btn) return;
    const raw = (btn.dataset.age || "").trim();
    const val = (raw === "0-2" || raw === "3-5" || raw === "5+") ? raw : DEFAULT_AGE;
    setAge(val);
    $$(".age-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    updateHeroForAge(val);
  }, { passive: false });
}


function initAgePreview() {
  // Disable hover swaps when age UI is hidden
  if (AGE_UI_DISABLED) return;

  const isPointerFine = window.matchMedia("(pointer: fine)").matches;
  if (!isPointerFine) return;
  let restoreTimer = null;
  $$(".age-btn").forEach(btn => {
    btn.addEventListener("mouseenter", () => {
      const hoverAge = (btn.dataset.age || "").trim();
      if (!hoverAge) return;
      updateHeroForAge(hoverAge);
      if (restoreTimer) { clearTimeout(restoreTimer); restoreTimer = null; }
    });
    btn.addEventListener("mouseleave", () => {
      restoreTimer = setTimeout(() => updateHeroForAge(getAge()), 120);
    });
  });
}


  /* ---------------------------------------------
     API call + stash story + go checkout
  --------------------------------------------- */
  async function generateStoryAndNavigate(transcript) {
    if (!transcript) throw new Error("Missing transcript");
    const body = { transcript, ageGroup: getAge() };
    try {
      const btn = $('#chatGenerate') || $('#generateBtn');
      const spinner = $('#genSpinner');
      btn && (btn.disabled = true);
      spinner && spinner.classList.remove('hidden');

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);

      const data = await res.json();
      const md   = data?.markdown || data?.story || "";
      const html = mdToHtml(md);

      try { SS.setItem(K_TRANSCRIPT, transcript); } catch (_) {}
      try { SS.setItem(K_STORY_MD, md); } catch (_) {}
      try { SS.setItem(K_STORY_HTML, html); } catch (_) {}
      // ambience chosen by API (for storydetail auto-play)
      try { SS.setItem("yw_ambience", data?.ambience || "pad"); } catch (_) {}

      goCheckout();
    } catch (err) {
      console.error(err);
      alert("Sorry, we couldn't generate the story. Please try again.");
    } finally {
      const btn = $('#chatGenerate') || $('#generateBtn');
      const spinner = $('#genSpinner');
      btn && (btn.disabled = false);
      spinner && spinner.classList.add('hidden');
    }
  }

   // Generate without navigating; stash results and return
async function generateStoryInPlace(transcript) {
  const body = { transcript, ageGroup: getAge() };
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);

  const data = await res.json();
  const md   = data?.markdown || data?.story || "";
  const html = mdToHtml(md);

  const SS = window.sessionStorage;
  try { SS.setItem(K_TRANSCRIPT, transcript); } catch (_) {}
  try { SS.setItem(K_STORY_MD, md); } catch (_) {}
  try { SS.setItem(K_STORY_HTML, html); } catch (_) {}
  try { SS.setItem("yw_ambience", data?.ambience || "pad"); } catch (_) {}
}


  /* ---------------------------------------------
     Conversational Wizard
  --------------------------------------------- */
  function initCreateChatWizard() {
    const elStream = $('#chatStream');
    const elForm   = $('#chatForm');
    const elInput  = $('#chatInput');
    const btnNext  = $('#chatNext');
    const btnGen   = $('#chatGenerate');
    if (!elStream || !elForm || !elInput) return;

    const answers = { name:"", age:"", likes:"", theme:"", moments:"", chars:"", extras:"" };
    const steps = [
      { key: "name",    ask: "What’s your child’s name?" },
      { key: "age",     ask: "How old are they?" },
      { key: "likes",   ask: "What do they love these days? (toys, colours, places…)" },
      { key: "theme",   ask: "Pick a theme or setting you’d like." },
      { key: "moments", ask: "Any tiny moment to include? (e.g., sharing snacks, finding a shell)" },
      { key: "chars",   ask: "Who else should appear? (e.g., Mom Isabel, Dad Bob)" },
      { key: "extras",  ask: "Anything else? Bedtime tone, gentle humor, onomatopoeia…" }
    ];

    let idx = -1;
    const scrollToBottom = () => { elStream.scrollTop = elStream.scrollHeight; };
    const push = (who, text) => {
      const row = document.createElement('div');
      row.className = `chat-row ${who}`;
      row.innerHTML = `<div class="bubble">${text}</div>`;
      elStream.appendChild(row); scrollToBottom();
    };
    const pushBot = (t) => push('bot', t);
    const pushUser = (t) => push('user', t);

    const nextStep = () => {
      idx++;
      if (idx < steps.length) {
        pushBot(steps[idx].ask);
        elInput.value = "";
        elInput.placeholder = "Type your answer…";
        elInput.focus();
        btnNext?.classList.remove('hidden');
        btnGen?.classList.add('hidden');
      } else {
        pushBot("All set! Ready to create your story?");
        btnNext?.classList.add('hidden');
        btnGen?.classList.remove('hidden');
        elInput.blur();
      }
    };

    setTimeout(nextStep, 350);

    elForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = elInput.value.trim();
      if (!val) return;
      const key = steps[idx]?.key;
      if (key) answers[key] = val;
      pushUser(val);
      nextStep();
    });

    btnGen?.addEventListener('click', async () => {
      const transcript = [
        `Child name: ${answers.name || "Unknown"}`,
        `Child age: ${answers.age || "—"}`,
        `Likes: ${answers.likes || "—"}`,
        `Theme: ${answers.theme || "—"}`,
        `Special moments: ${answers.moments || "—"}`,
        `Characters: ${answers.chars || "—"}`,
        `Extras: ${answers.extras || "—"}`
      ].join("\n");

      pushBot("✨ Creating your story...");
      await generateStoryAndNavigate(transcript);
    });
  }

  /* ---------------------------------------------
     Gate: show overlay + handle preview vs blur
     (updated to real accounts)
  --------------------------------------------- */
  function showGate(personName) {
    const storyEl   = document.getElementById("storyContent");
    const gate      = document.getElementById("gateOverlay");
    const glow      = document.getElementById("blurGlow");
    const reader    = document.querySelector(".story-reader");
    const badge     = document.getElementById("personalBadge");
    const badgeText = document.getElementById("personalBadgeText");
    const gateTitle = document.getElementById("gateTitle");
    const gateDesc  = document.getElementById("gateDesc");

    const btnGoogle = document.getElementById("gateGoogle");
    const btnEmail  = document.getElementById("gateEmailBtn");
    const formWrap  = document.getElementById("gateEmailForm");
    const backBtn   = document.getElementById("gateBackBtn");
    const btnRow    = document.getElementById("gateButtons"); // may not exist (legacy-safe)

    // Personalised badge + copy
    if (personName && badge && badgeText) {
      badgeText.textContent = `Personalised for ${personName}`;
      badge.classList.remove("hidden");
      reader?.classList.add("has-badge");
    }
    if (personName && gateDesc) {
      gateDesc.textContent = `Create your free account to finish ${personName}’s bedtime story and save it.`;
    }
    if (gateTitle) gateTitle.textContent = "Continue reading for free";

    // Give room for the gate card
    reader?.classList.add("gated");

    // If we're showing a 10-line preview, skip extra blur/glow
    const isPreviewLines = storyEl?.dataset.preview === "lines";
    if (!isPreviewLines) {
      storyEl?.classList.add("blur-bottom");
      glow?.classList.remove("hidden");
    } else {
      storyEl?.classList.remove("blur-bottom");
      glow?.classList.add("hidden");
    }

    gate?.classList.remove("hidden");

    // Prototype Google → create throwaway alias
    if (btnGoogle) {
      btnGoogle.onclick = async (e) => {
        e.preventDefault();
        try {
          const alias = `user+${Date.now()}@storybuds.local`;
          const pw = crypto.getRandomValues(new Uint32Array(1))[0].toString(16);
          await createUser(alias, pw);
          doUnlockAfterAuth();
        } catch {
          // unlikely; fallback
          doUnlockAfterAuth();
        }
      };
    }

    // Toggle email form
    if (btnEmail) {
      btnEmail.onclick = (e) => {
        e.preventDefault();
        formWrap?.classList.remove("hidden");
        btnEmail.classList.add("hidden");
        btnRow?.classList.add("hidden");
      };
    }
    if (backBtn) {
      backBtn.onclick = (e) => {
        e.preventDefault();
        formWrap?.classList.add("hidden");
        btnEmail?.classList.remove("hidden");
        btnRow?.classList.remove("hidden");
      };
    }

    // Email form submit
    // Email form submit  (REPLACE the whole original block)
if (formWrap) {
  // Inject child fields row on demand
  let extraInjected = false;
  const ensureExtraFields = () => {
    if (extraInjected) return;
    extraInjected = true;
    const extra = document.createElement("div");
    extra.className = "gate-email";
    extra.innerHTML = `
      <label>Child’s name
        <input type="text" id="gateChildName" placeholder="Mia" />
      </label>
      <label>Birth year
        <input type="number" id="gateBirthYear" placeholder="2019" min="2008" max="${new Date().getUTCFullYear()}" />
      </label>
      <label>Gender
        <select id="gateGender">
          <option value="">Select</option>
          <option value="female">Girl</option>
          <option value="male">Boy</option>
          <option value="non-binary">Non-binary</option>
          <option value="prefer-not-to-say">Prefer not to say</option>
        </select>
      </label>
    `;
    formWrap.appendChild(extra);
  };

  formWrap.onsubmit = async (e) => {
    e.preventDefault();
    const email = $("#gateEmail")?.value.trim();
    const pass  = $("#gatePass")?.value || "";

    if (!email || !pass) { alert("Please enter email and password."); return; }

    // Grab from transcript first
    let { childName, birthYear, gender } = deriveChildFromTranscript();

    // If any required field missing, reveal extra inputs and read them
    if (!childName || !birthYear || !gender) {
      ensureExtraFields();
      childName = childName || ($("#gateChildName")?.value.trim() || "");
      birthYear = birthYear || ($("#gateBirthYear")?.value.trim() || "");
      gender    = gender    || ($("#gateGender")?.value || "");
      if (!childName || !birthYear || !gender) {
        alert("Please provide your child’s name, birth year, and gender.");
        return;
      }
    }

    try {
      // Real API call
      await apiSignup({ childName, email, password: pass, birthYear, gender });
      // Reuse your existing unlock + redirect flow
      unlockGate();
    } catch (err) {
      const msg = err?.message || String(err);
      alert(msg.includes("E11000") || msg.toLowerCase().includes("exists")
        ? "This email is already registered. Please sign in instead."
        : msg);
    }
  };
}


    function doUnlockAfterAuth() { unlockGate(); }
  }

  function unlockGate() {
    // Mark signed-in (defensive)
    setSignedIn(true);

    const storyEl = document.getElementById("storyContent");
    const reader  = document.querySelector(".story-reader");
    const gate    = document.getElementById("gateOverlay");
    const glow    = document.getElementById("blurGlow");

    // Restore full HTML if we cached it earlier
    const fullHtml = (SS && (SS.getItem(K_STORY_HTML) || SS.getItem("yw_story_html"))) || "";

    if (storyEl && fullHtml) {
      storyEl.innerHTML = fullHtml;
    }

    storyEl?.classList.remove("preview-clamp", "blur-bottom");
    if (storyEl?.dataset) delete storyEl.dataset.preview;
    reader?.classList.remove("gated");
    gate?.classList.add("hidden");
    glow?.classList.add("hidden");

    // Tiny confirmation toast
    try {
      const note = document.createElement("div");
      note.textContent = "✨ Account ready! Taking you to your home.";
      note.style.cssText =
        "position:fixed;left:50%;transform:translateX(-50%);bottom:16px;background:#1a1f2e;color:#fff;padding:10px 14px;border-radius:999px;box-shadow:0 10px 24px rgba(0,0,0,.2);z-index:999;";
      document.body.appendChild(note);
      setTimeout(() => note.remove(), 900);
    } catch (_) {}

    // Smooth transition to home
    try { document.body.classList.add("fade-out"); } catch (_) {}
    setTimeout(() => { window.location.href = "home.html"; }, 600);
  }

  /* ---------------------------------------------
     Checkout: render story + products
  --------------------------------------------- */
  let cartCount = 0;
function initCheckout() {
  const $ = (s, r=document)=>r.querySelector(s);
  const SS = window.sessionStorage;

  const storyEl = $('#storyContent');
  if (!storyEl) return;

  const html = SS.getItem(K_STORY_HTML);
  const md   = SS.getItem(K_STORY_MD);
  const pending = SS.getItem(K_PENDING);

  // If we have a pending transcript, show transition view and generate here
  if (!html && !md && pending) {
    storyEl.innerHTML = `
      <div class="wait-wrap">
        <div class="wait-dots" aria-hidden="true"><span></span><span></span><span></span></div>
        <div class="muted" style="font-weight:700;">This may take a few seconds…</div>
      </div>
    `;

    // Generate in place, then refresh DOM to reuse existing gate logic
    (async ()=>{
      try {
        await generateStoryInPlace(pending);      // new helper below
        SS.removeItem(K_PENDING);
        window.location.reload();                 // reuse existing rendering + gate
      } catch (err) {
        console.error(err);
        alert("Sorry, we couldn't create the story. Please try again.");
        SS.removeItem(K_PENDING);
      }
    })();

    return; // stop here; we'll reload after generation
  }

  // === Your existing behavior (signed-out preview/gate OR full story) ===
  if (!isSignedIn()) {
    if (md) {
      const previewHtml = makePreviewHtml(md, 10);
      storyEl.innerHTML = previewHtml || "<p>Your story will appear here after generation.</p>";
    } else {
      storyEl.innerHTML = "<p><strong>Preview</strong> — create your free account to finish this bedtime story.</p>";
    }
    storyEl.dataset.preview = "lines";
    storyEl.classList.add("preview-clamp");

    const childName = getChildName();
    if (html || md) showGate(childName);
  } else {
    storyEl.innerHTML = html || "<p>Your story will appear here after generation.</p>";
    delete storyEl.dataset.preview;
    storyEl.classList.remove("preview-clamp");
    document.getElementById("gateOverlay")?.classList.add("hidden");
    document.getElementById("blurGlow")?.classList.add("hidden");

    const childName = getChildName();
    const reader = document.querySelector(".story-reader");
    const badge = document.getElementById("personalBadge");
    const badgeText = document.getElementById("personalBadgeText");
    if (childName && badge && badgeText) {
      badgeText.textContent = `Just for ${childName}`;
      badge.classList.remove("hidden");
      reader?.classList.add("has-badge");
    }
  }

  // Optional raw markdown debug (unchanged)
  const rawMdEl = $('#storyMarkdown');
  if (rawMdEl && md) rawMdEl.textContent = md;

  // Products (unchanged)
  const productsTrack = $('#productsTrack');
  if (productsTrack) {
    const age = getAge();
    const products = getProductsForAge(age);
    renderProducts(productsTrack, products);
  }

  const cartCountEl = document.getElementById("cartCount");
  if (cartCountEl) cartCountEl.classList.add("hidden");
}


  // Products data per age
  function getProductsForAge(age) {
    const base = [
      { id: "bk1", name: "Bedtime Book", price: "£9.99" },
      { id: "st1", name: "Sticker Pack", price: "£3.50" },
      { id: "lt1", name: "Night Light", price: "£12.00" },
    ];
    if (age === "0-2") {
      return [{ id: "bb1", name: "Soft Plush Toy", price: "£8.00" }, ...base];
    } else if (age === "3-5") {
      return [{ id: "pb1", name: "Picture Book (A3)", price: "£11.00" }, ...base];
    } else {
      return [{ id: "ac1", name: "Activity Cards", price: "£7.00" }, ...base];
    }
  }

  function renderProducts(track, items) {
    track.innerHTML = "";
    for (const it of items) {
      const card = document.createElement("div");
      card.className = "product-card";
      card.innerHTML = `
        <div class="product-body">
          <h3>${it.name}</h3>
          <p class="muted">Perfect for storytime</p>
          <div class="price-row">
            <span class="price">${it.price}</span>
          </div>
          <button class="btn product-cta" data-id="${it.id}">Add</button>
        </div>
      `;
      track.appendChild(card);
    }

    track.addEventListener("click", (e) => {
      const btn = e.target.closest(".product-cta");
      if (!btn) return;
      cartCount++;
      updateCartCountDisplay();
      const cartBtn = document.getElementById("cartBtn");
      if (cartBtn) {
        cartBtn.classList.add("shake");
        setTimeout(() => cartBtn.classList.remove("shake"), 500);
      }
    }, { passive: false });
  }

  function updateCartCountDisplay() {
    const cartCountEl = document.getElementById("cartCount");
    if (!cartCountEl) return;
    if (cartCount > 0) {
      cartCountEl.textContent = String(cartCount);
      cartCountEl.classList.remove("hidden");
    } else {
      cartCountEl.classList.add("hidden");
    }
  }

  /* ---------------------------------------------
     Minor chrome
  --------------------------------------------- */
  function initChrome() {
    const menuBtn = $('#menuBtn');
    const menu = $('#menu');
    menuBtn?.addEventListener('click', () => menu?.classList.toggle('hidden'));
    const yearEl = $('#year'); if (yearEl) yearEl.textContent = new Date().getFullYear();
    const cartCountEl = document.getElementById("cartCount");
    if (cartCountEl) cartCountEl.classList.add("hidden");
  }

  function initMobileCta() {
    const cta = $("#mobileCta");
    const hero = $(".hero");
    if (!cta || !hero) return;
    function onScroll() {
      const rect = hero.getBoundingClientRect();
      const show = window.scrollY > (rect.height * 0.45);
      cta.classList.toggle("show", show);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  function initHeroParallax() {
    const wrap = document.querySelector('.hero-visual[data-parallax="on"]');
    const img = document.getElementById('heroImage');
    if (!wrap || !img) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isNarrow = window.matchMedia('(max-width: 700px)').matches;
    if (reduce || isNarrow) { wrap.removeAttribute('data-parallax'); return; }

    function onScroll() {
      const rect = wrap.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const center = vh / 2;
      const dist = Math.max(-40, Math.min(40, (rect.top + rect.height/2) - center));
      const t = (dist / center) * 6; // ±6px max
      img.style.transform = `translateY(${t.toFixed(2)}px)`;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    onScroll();
  }

  function initTestimonials() {
    const wrap = $("#testimonials");
    if (!wrap) return;
    const tpl = $("#t-pool");
    if (!tpl) return;

    const pool = Array.from(tpl.content.querySelectorAll("figure")).map(el => ({
      quote: el.querySelector("blockquote")?.textContent || "",
      by: el.querySelector("figcaption")?.innerHTML || ""
    }));
    if (!pool.length) return;

    const quoteEl = wrap.querySelector(".t-quote");
    const byEl = wrap.querySelector(".t-by");
    if (!quoteEl || !byEl) return;

    let idx = 0;
    setInterval(() => {
      idx = (idx + 1) % pool.length;
      wrap.classList.add("t-fade-exit", "t-fade-exit-active");
      setTimeout(() => {
        quoteEl.textContent = pool[idx].quote;
        byEl.innerHTML = pool[idx].by;
        wrap.classList.remove("t-fade-exit", "t-fade-exit-active");
        wrap.classList.add("t-fade-enter");
        requestAnimationFrame(() => {
          wrap.classList.add("t-fade-enter-active");
          setTimeout(() => {
            wrap.classList.remove("t-fade-enter", "t-fade-enter-active");
          }, 420);
        });
      }, 180);
    }, 6000);
  }

  // Scroll morph: Real → Animated (soft stop + center-based reveal)
  function initScrollMorph() {
    const wrap = document.getElementById('morph');
    if (!wrap) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    let holdActive = false;
    let lockedY = 0;
    let lastScrollY = window.scrollY;
    let direction = 'down';   // 'down' | 'up'
    let armed = true;         // can we trigger a hold?
    let rearmEdge = null;     // 'past' (need reveal≈1) | 'before' (need reveal≈0)
    let holdStart = 0;

    // helpers
    const stage = wrap.querySelector('.morph-stage');
    if (!stage) return;

    function setVars(reveal, parallax) {
      stage.style.setProperty('--reveal', String(reveal));
      stage.style.setProperty('--parallax', String(parallax));
    }

    function computeReveal() {
      const s = stage.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const center = vh / 2;
      const stageCenter = s.top + s.height / 2;

      const dist = Math.abs(stageCenter - center);

      // Wider radius for slower, longer transition
      const R = vh * 1.2;

      // linear map: 1 at center → 0 at/beyond radius
      let r = 1 - Math.min(1, dist / R);

      const parallax = 12 * (1 - r);
      setVars(r, parallax);
      return { reveal: r, vh };
    }

    function lockScrollAt(y) {
      if (holdActive) return;
      holdActive = true;
      lockedY = Math.max(0, Math.round(y));
      window.scrollTo(0, lockedY);

      document.documentElement.classList.add('scroll-locked');
      document.body.dataset.prevTop = document.body.style.top || '';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${lockedY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';

      wrap.classList.add('hold');
    }

    function unlockScroll() {
      if (!holdActive) return;

      wrap.classList.remove('hold');
      document.documentElement.classList.remove('scroll-locked');

      document.body.style.position = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.body.style.top = document.body.dataset.prevTop || '';
      delete document.body.dataset.prevTop;

      window.scrollTo(0, lockedY);
      holdActive = false;

      // hysteresis: only re-arm after leaving the section (direction-aware)
      rearmEdge = (direction === 'down') ? 'past' : 'before';
      armed = false;
    }

    const reengageRelease = (e) => {
      if (!holdActive) return;
      e.preventDefault();
      if (Date.now() - holdStart > 220) unlockScroll();
    };
    const onKey = (e) => {
      if (!holdActive) return;
      if (['Escape','Enter',' ','ArrowDown','ArrowUp','PageDown','PageUp','Home','End'].includes(e.key)) {
        e.preventDefault();
        unlockScroll();
      }
    };

    function startHoldCentered() {
      const s = stage.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const targetY = window.scrollY + s.top + s.height / 2 - (vh / 2);

      lockScrollAt(targetY);
      holdStart = Date.now();

      window.addEventListener('wheel', reengageRelease, { passive: false });
      window.addEventListener('touchmove', reengageRelease, { passive: false });
      window.addEventListener('keydown', onKey);

      const onVis = () => { if (document.visibilityState === 'hidden') unlockScroll(); };
      document.addEventListener('visibilitychange', onVis);
      const id = setInterval(() => {
        if (!holdActive) {
          clearInterval(id);
          window.removeEventListener('wheel', reengageRelease, { passive: false });
          window.removeEventListener('touchmove', reengageRelease, { passive: false });
          window.removeEventListener('keydown', onKey);
          document.removeEventListener('visibilitychange', onVis);
        }
      }, 200);
    }

    function update() {
      const y = window.scrollY;
      direction = (y > lastScrollY) ? 'down' : (y < lastScrollY) ? 'up' : direction;
      lastScrollY = y;

      const { reveal } = computeReveal();

      // re-arm only after clearly leaving the section
      if (!armed && !holdActive) {
        if ((rearmEdge === 'past'   && reveal >= 0.98) ||
            (rearmEdge === 'before' && reveal <= 0.02)) {
          armed = true;
          rearmEdge = null;
        }
      }

      // keep position clamped while locked (kills inertia)
      if (holdActive && Math.abs(window.scrollY - lockedY) > 0) {
        window.scrollTo(0, lockedY);
        return;
      }

      // trigger a single soft stop near center band and armed
      const centerBandPx = Math.min(60, (window.innerHeight || 1) * 0.08);
      const s = stage.getBoundingClientRect();
      const center = (window.innerHeight || 1) / 2;
      const centerDist = Math.abs((s.top + s.height / 2) - center);
      if (!holdActive && armed && reveal > 0.1 && reveal < 0.9 && centerDist < centerBandPx) {
        startHoldCentered();
      }
    }

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

   // ------------------------------------------------
// Fix: back/forward navigation sometimes shows blank page
// ------------------------------------------------
window.addEventListener('pageshow', function (e) {
  document.body.classList.remove('fade-out');
  document.documentElement.classList.remove('scroll-locked');

  // Defensive reset if scroll-lock was left active
  if (document.body.style.position === 'fixed') {
    const prevTop = document.body.dataset.prevTop || '';
    document.body.style.position = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.top = prevTop;
    delete document.body.dataset.prevTop;
    if (prevTop) {
      const y = Math.abs(parseInt(prevTop, 10)) || 0;
      window.scrollTo(0, y);
    }
  }
});

   /* ===========================
   Quick Create Overlay (index)
   =========================== */
function openQuickCreate() {
  const $ = (s, r=document)=>r.querySelector(s);

  const ov   = $('#quickCreate');
  const step = (name) => $(`.qc-step[data-step="${name}"]`, ov);

  const sPlace      = step('place');
  const sPetsYN     = step('pets-yn');
  const sPetDetails = step('pet-details');
  const sKid        = step('kid');

  if (!ov || !sPlace || !sPetsYN || !sKid) return;
  ov.classList.remove('hidden');

  // local state
  const state = { place:'', pets:'', petType:'', petName:'', kidName:'', kidGender:'', kidAge:'' };

  // reset UI
  [sPlace, sPetsYN, sPetDetails, sKid].forEach(el=>el.classList.add('hidden'));
  sPlace.classList.remove('hidden');

  // close
  $('#qcClose')?.addEventListener('click', ()=> ov.classList.add('hidden'), { once:true });

  // step: place
  sPlace.querySelectorAll('.qc-chip').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      state.place = (btn.dataset.place || '').toLowerCase();
      sPlace.classList.add('hidden'); sPetsYN.classList.remove('hidden');
    });
  });

  // step: pets yes/no
  sPetsYN.querySelectorAll('.qc-chip').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      state.pets = (btn.dataset.pets || '').toLowerCase();
      sPetsYN.classList.add('hidden');
      if (state.pets === 'yes') {
        sPetDetails.classList.remove('hidden');
      } else {
        sKid.classList.remove('hidden');
      }
    });
  });

  // step: pet details
  $('#qcPetNext')?.addEventListener('click', ()=>{
    state.petType = ($('#qcPetType')?.value || '').trim();
    state.petName = ($('#qcPetName')?.value || '').trim();
    sPetDetails.classList.add('hidden'); sKid.classList.remove('hidden');
  });

  // step: kid + create
  $('#qcCreate')?.addEventListener('click', ()=>{
    state.kidName   = ($('#qcKidName')?.value || '').trim();
    state.kidGender = ($('#qcKidGender')?.value || '').trim();
    state.kidAge    = ($('#qcKidAge')?.value || '').trim();

    // Build transcript (works with your /api/generate-story system prompt):contentReference[oaicite:7]{index=7}
    const lines = [
      `Child name: ${state.kidName || 'Unknown'}`,
      `Child gender: ${state.kidGender || '—'}`,
      `Child age: ${state.kidAge || '—'}`,
      `Place: ${state.place || 'home'}`,
    ];
    if (state.pets === 'yes') {
      lines.push(`Pet: ${state.petType || 'pet'} named ${state.petName || '—'}`);
    } else {
      lines.push(`Pet: none`);
    }
    const transcript = lines.join('\n');

    try { sessionStorage.setItem(K_PENDING, transcript); } catch (_) {}

    // Redirect immediately; checkout will show a "please wait" and generate there
    document.body.classList.add("fade-out");
    setTimeout(()=>{ window.location.href = "checkout.html"; }, 100);
  });
}

   // Force the hero CTA to open the overlay, no matter who re-binds it later
function forceHeroToOverlay() {
  const btn = document.getElementById('heroCta');
  if (!btn) return;

  // Capture-phase listener beats .onclick set by updateHeroForAge()
  const handler = (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    openQuickCreate();
  };

  // Add once in capture so downstream handlers can't redirect
  btn.addEventListener('click', handler, { capture: true });
  // Best-effort: neutralize any pre-set onclick
  try { btn.onclick = null; } catch (_) {}
}

// On the landing page, intercept any "create.html" button/link and open the overlay instead
function interceptCreateNavigationOnLanding() {
  const path = (location.pathname || "").toLowerCase();
  const isLanding = path.endsWith("/index.html") || path.endsWith("/") || path === "";

  if (!isLanding) return;

  document.addEventListener('click', (e) => {
    const t = e.target;
    const el = t.closest('a[href$="create.html"], a[href$="/create.html"], button[onclick*="create.html"]');
    if (!el) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    openQuickCreate();
  }, { capture: true });
}



  /* ---------------------------------------------
     Boot — called on every page
  --------------------------------------------- */
  onReady(() => {
    hydrateTopbarAuth();
    guardLandingRedirect();

    initChrome();
    initAgeButtons();
    initAgePreview();
    initMobileCta();

    if (isCreateChatPage()) initCreateChatWizard();
    if (isCheckoutPage())   initCheckout();

    initTestimonials();
    initScrollMorph();
    initHeroParallax(); // restore

    // If a page wants to open auth immediately (e.g., CTA), wire .js-open-auth
    $$(".js-open-auth").forEach(btn => {
      btn.addEventListener("click", (e)=> {
        e.preventDefault();
        openAuthModal("signup");
      });
    });
    // If a page has a ".js-open-signin" trigger, open in sign-in mode
    $$(".js-open-signin").forEach(btn => {
      btn.addEventListener("click", (e)=> {
        e.preventDefault();
        openAuthModal("signin");
      });
    });

     // Force hero CTA to open the overlay (override any previous handlers)
const heroCta = document.getElementById('heroCta');
if (heroCta) {
  heroCta.onclick = (e) => { e.preventDefault(); openQuickCreate(); };
}
// Optional: any element with .js-open-create opens it too
document.querySelectorAll('.js-open-create').forEach(btn=>{
  btn.addEventListener('click', (e)=>{ e.preventDefault(); openQuickCreate(); });
});
     forceHeroToOverlay();
interceptCreateNavigationOnLanding();
  });

  // Expose small API for inline handlers if needed
  window.StoryBuds = {
    openAuthModal,
    showGate,
    unlockGate,
    signOut,
    isSignedIn,
    currentEmail
  };

})();

/* =====================================================
   Landing micro-demo (voice + gentle SFX)
   (kept as-is; no auth dependency)
===================================================== */
(() => {
  const openBtn = document.getElementById('demoOpenBtn');
  const modal   = document.getElementById('demoModal');
  const closeBtn= document.getElementById('demoCloseBtn');
  const playV   = document.getElementById('demoPlayVoice');
  const playSfx = document.getElementById('demoPlaySfx');
  if (!openBtn || !modal) return;

  let ctx, master;
  function ensureCtx(){
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
  }
  function playChime(){
    ensureCtx();
    const t = ctx.currentTime;
    [784, 988, 1319].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.setValueAtTime(f, t + i*0.08);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t + i*0.08);
      g.gain.exponentialRampToValueAtTime(0.22, t + i*0.08 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i*0.08 + 0.6);
      o.connect(g).connect(master); o.start(t + i*0.08); o.stop(t + i*0.08 + 0.65);
    });
  }
  function makeNoiseBuffer(){
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i=0;i<d.length;i++) d[i] = (Math.random()*2-1) * 0.6;
    return b;
  }
  function playPlip(){
    ensureCtx();
    const t = ctx.currentTime;
    [0, 0.18].forEach((d, i) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(i ? 660 : 520, t + d);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(0.2, t + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.25);
      o.connect(g).connect(master); o.start(t + d); o.stop(t + d + 0.26);
    });
  }
  function playVoiceLine(){
    ensureCtx();
    const t = ctx.currentTime;
    const g = ctx.createGain(); g.gain.value = 0.0; g.connect(master);
    const freqs = [220, 277, 330];
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(f, t + i*0.02);
      const og = ctx.createGain(); og.gain.value = 0.06; o.connect(og).connect(g); o.start(); setTimeout(()=>o.stop(), 1800);
    });
    g.gain.linearRampToValueAtTime(0.14, t + 0.25);
    g.gain.linearRampToValueAtTime(0.0,  t + 1.8);
  }

  function open(){ modal.classList.remove('hidden'); }
  function close(){ modal.classList.add('hidden'); }

  openBtn.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  playV?.addEventListener('click', () => { playVoiceLine(); });
  playSfx?.addEventListener('click', () => { playPlip(); setTimeout(playChime, 260); });

  document.addEventListener('keydown', (e) => { if (!modal.classList.contains('hidden') && e.key === 'Escape') close(); });
})();
