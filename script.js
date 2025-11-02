"use strict";

/* =====================================================
   StoryBuds — unified interactions (REAL Auth + Existing UX)
   - Preserves: age selector, hero parallax, wizard, API call, checkout,
               testimonials, scroll morph, audio micro-demo, etc.
   - Adds:     real JWT auth, auth modal (Sign Up + Sign In),
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

  /* ---------------------------------------------
     REAL Auth client (JWT)
  --------------------------------------------- */
  const API_BASE = "https://imaginee-y9nk.onrender.com/api/v1";

   // Session model for cookie-based auth
let SESSION_READY = false;
let SESSION_USER  = null;

async function refreshSession() {
  try {
    const res = await fetch(`${API_BASE}/users/me`, { credentials: "include" });
    if (!res.ok) throw new Error();
    const data = await res.json();
    SESSION_USER = data?.data?.user || null;
    SESSION_READY = true;
    return true;
  } catch {
    SESSION_USER = null;
    SESSION_READY = true;
    return false;
  }
}

function isSignedIn() { return !!SESSION_USER; }
function getUser()    { return SESSION_USER;  }

  // ---- API wrappers ----
  async function apiSignup({ childName, email, password, birthYear, gender }) {
    const res = await fetch(`${API_BASE}/users/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childName, email, password, birthYear, gender }),
       credentials: "include"
    });
    const data = await res.json().catch(()=>({}));
    if (!res.ok) {
      const msg = data?.message || data?.error || `Signup failed (${res.status})`;
      throw new Error(msg);
    }
    const token = data?.token || "";
    const user  = data?.data?.user || {};
    if (!token) throw new Error("No token returned by signup");
    return { token, user };
  }

  async function apiLogin({ email, password }) {
    const res = await fetch(`${API_BASE}/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
       credentials: "include"
    });
    // console.log("res":res);
    const data = await res.json().catch(()=>({}));
   //  console.log("data":data);
    if (!res.ok) {
      const msg = data?.message || data?.error || `Login failed (${res.status})`;
      throw new Error(msg);
    }
    const token = data?.token || "";
    const user  = data?.data?.user || {};
    if (!token) throw new Error("No token returned by login");
    return { token, user };
  }

// simplified version for cookie-based auth
async function apiGetMe() {
  const res = await fetch(`${API_BASE}/users/me`, {
    method: "GET",
    credentials: "include", // always include cookies
  });
  if (!res.ok) throw new Error("API 401");
  return res.json();
}

async function signOut() {
  await fetch(`${API_BASE}/users/logout`, { method: "POST", credentials: "include" });
  SESSION_USER = null;
}

  // Helper: try to derive child fields from transcript if present
  function deriveChildFromTranscript() {
    const raw = (SS.getItem("yw_transcript") || "").toString();
    const read = (rx) => { const m = raw.match(rx); return m && m[1] ? m[1].trim() : ""; };

    const childName = read(/Child name:\s*([^\n]+)/i);
    const genderRaw = read(/Child gender:\s*([^\n]+)/i) || read(/Gender:\s*([^\n]+)/i);
    const ageRaw    = read(/Child age:\s*([^\n]+)/i) || read(/Age:\s*([^\n]+)/i);

    let gender = (genderRaw || "").toLowerCase();
    if (["boy","male","erkek"].includes(gender)) gender = "male";
    else if (["girl","female","kız","kiz"].includes(gender)) gender = "female";
    else if (["non-binary","nonbinary"].includes(gender)) gender = "non-binary";
    else if (!gender) gender = "prefer-not-to-say";

    let birthYear = "";
    const age = parseInt((ageRaw || "").replace(/\D/g, ""), 10);
    if (!isNaN(age)) {
      const now = new Date();
      birthYear = String(now.getUTCFullYear() - Math.min(Math.max(age, 0), 12));
    }
    return { childName, birthYear, gender };
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
  const K_PENDING    = "yw_pending_transcript";   // pass data to checkout to generate there

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
  function getMenuEl() {
    return document.getElementById("menu")
        || document.querySelector('[data-nav="menu"]')
        || document.querySelector(".nav-menu")
        || document.querySelector("#mobileMenu")
        || null;
  }

  function wireMenuAutoClose(menuBtn, menu) {
    if (!menuBtn || !menu) return;

    function isOpen() { return !menu.classList.contains('hidden'); }
    function close()   { menu.classList.add('hidden'); }

    const outside = (e) => {
      if (!isOpen()) return;
      const t = e.target;
      if (menu.contains(t) || menuBtn.contains(t)) return;
      close();
    };

    document.addEventListener('click', outside, { passive: true });
    document.addEventListener('touchstart', outside, { passive: true });
    document.addEventListener('keydown', (e) => {
      if (!isOpen()) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
  }

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
    <h2 id="authTitle">Create your free account</h2>

    <div class="demo-rows" style="gap:12px">
      <!-- SIGN UP extra fields -->
      <div data-auth="signup-fields">
        <label style="font-weight:700">Child's name</label>
        <input id="authChildName" type="text" placeholder="e.g., Mia"
          style="width:100%;padding:12px;border:1px solid #e0dcec;border-radius:12px;">
        <div class="field-grid" style="grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
          <div>
            <label style="font-weight:700">Birth year</label>
            <input id="authBirthYear" type="number" min="2010" max="2025" placeholder="2019"
              style="width:100%;padding:12px;border:1px solid #e0dcec;border-radius:12px;">
          </div>
          <div>
            <label style="font-weight:700">Gender</label>
            <select id="authGender" style="width:100%;padding:12px;border:1px solid #e0dcec;border-radius:12px;">
              <option value="" disabled selected>Select</option>
              <option value="female">Girl</option>
              <option value="male">Boy</option>
              <option value="other">Non-binary</option>
              <option value="prefer-not-to-say">Prefer not to say</option>
            </select>
          </div>
        </div>
        <hr style="border:none;border-top:1px solid #eee9fb;margin:8px 0">
      </div>

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
        const signupFields = modal.querySelector('[data-auth="signup-fields"]');

        if (mode === "signin") {
          if (title)   title.textContent = "Welcome back";
          if (primary) primary.textContent = "Sign In";
          if (switcher) switcher.textContent = "New here? Create an account";
          if (signupFields) signupFields.style.display = "none";

          if (primary) primary.onclick = async () => {
            const email = $("#authEmail")?.value.trim();
            const pass  = $("#authPass")?.value;
            if (!email || !pass) { alert("Please enter email and password."); return; }
            try {
              await apiLogin({ email, password: pass });
              try { await apiGetMe(); } catch(_){}
              close();
              fadeOutAnd(()=>{ window.location.href = "home.html"; }, 120);
            } catch (err) {
              alert(err?.message || "Could not sign in.");
            }
          };
          if (switcher) switcher.onclick = () => setMode("signup");
        } else {
          if (title)   title.textContent = "Create your free account";
          if (primary) primary.textContent = "Create free account";
          if (switcher) switcher.textContent = "Have an account? Sign In";
          if (signupFields) signupFields.style.display = "";

          if (primary) primary.onclick = async () => {
            // Try to auto-fill from transcript; allow user to override via fields
            const guess = deriveChildFromTranscript();
            const childName = $("#authChildName")?.value?.trim() || guess.childName;
            const birthYear = $("#authBirthYear")?.value?.trim() || guess.birthYear;
            const gender    = $("#authGender")?.value || guess.gender;
            const email     = $("#authEmail")?.value?.trim();
            const password  = $("#authPass")?.value;

            if (!childName || !birthYear || !gender || !email || !password) {
              alert("Please fill all fields.");
              return;
            }

            try {
              await apiSignup({ childName, email, password, birthYear, gender });
              try { await apiGetMe(); } catch(_){}
              close();
              fadeOutAnd(()=>{ window.location.href = "home.html"; }, 120);
            } catch (err) {
              const msg = err?.message || "Could not create account.";
              alert(
                /already|exists/i.test(msg)
                  ? "This email is already registered. Please sign in instead."
                  : msg
              );
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

  // Pull child's first name from transcript (for badges)
  function getChildName() {
    try {
      const raw = SS.getItem(K_TRANSCRIPT) || "";
      const m = raw.match(/Child name:\s*([^\n]+)/i);
      const name = (m && m[1] ? m[1].trim() : "").replace(/[^A-Za-zÇĞİÖŞÜçğıöşü' -]/g, "");
      return name || "";
    } catch (_) { return ""; }
  }

  // prefer cut-out if it exists
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

  function makePreviewHtml(md, maxLines = 10) {
    if (!md) return "";
    let cleaned = md.replace(/^\s*# [^\n]*\n+(\s*\n)*/m, "");
    const lines = cleaned.split(/\r?\n/);
    const out = [];
    let taken = 0;

    for (const ln of lines) {
      if (/^\s*##{1,2}\s+/.test(ln)) continue;
      out.push(ln);
      if (ln.trim().length) taken++;
      if (taken >= maxLines) break;
    }
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
      setAge(DEFAULT_AGE);
      updateHeroForAge(DEFAULT_AGE);

      const bar =
        document.querySelector('.age-buttons') ||
        document.getElementById('ageBar') ||
        document.querySelector('[data-age="buttons"]');
      if (bar) bar.classList.add('hidden');

      document.body.classList.add('age-no-bar');
      return;
    }

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
     Gate overlay (checkout preview → auth)
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

    const btnEmail  = document.getElementById("gateEmailBtn");
    const formWrap  = document.getElementById("gateEmailForm");
    const backBtn   = document.getElementById("gateBackBtn");
    const btnRow    = document.getElementById("gateButtons");

    if (personName && badge && badgeText) {
      badgeText.textContent = `Personalised for ${personName}`;
      badge.classList.remove("hidden");
      reader?.classList.add("has-badge");
    }
    if (personName && gateDesc) {
      gateDesc.textContent = `Create your free account to finish ${personName}’s bedtime story and save it.`;
    }
    if (gateTitle) gateTitle.textContent = "Continue reading for free";

    reader?.classList.add("gated");

    const isPreviewLines = storyEl?.dataset.preview === "lines";
    if (!isPreviewLines) {
      storyEl?.classList.add("blur-bottom");
      glow?.classList.remove("hidden");
    } else {
      storyEl?.classList.remove("blur-bottom");
      glow?.classList.add("hidden");
    }

    gate?.classList.remove("hidden");

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

    // Email form submit (real signup)
    if (formWrap) {
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
              <option value="other">Non-binary</option>
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

        let { childName, birthYear, gender } = deriveChildFromTranscript();
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
          await apiSignup({ childName, email, password: pass, birthYear, gender });
          unlockGate();
        } catch (err) {
          const msg = err?.message || String(err);
          alert(/already|exists|e11000/i.test(msg)
            ? "This email is already registered. Please sign in instead."
            : msg);
        }
      };
    }
  }

  function unlockGate() {
    const storyEl = document.getElementById("storyContent");
    const reader  = document.querySelector(".story-reader");
    const gate    = document.getElementById("gateOverlay");
    const glow    = document.getElementById("blurGlow");

    const fullHtml = (SS && (SS.getItem(K_STORY_HTML) || SS.getItem("yw_story_html"))) || "";
    if (storyEl && fullHtml) {
      storyEl.innerHTML = fullHtml;
    }

    storyEl?.classList.remove("preview-clamp", "blur-bottom");
    if (storyEl?.dataset) delete storyEl.dataset.preview;
    reader?.classList.remove("gated");
    gate?.classList.add("hidden");
    glow?.classList.add("hidden");

    try {
      const note = document.createElement("div");
      note.textContent = "✨ Account ready! Taking you to your home.";
      note.style.cssText =
        "position:fixed;left:50%;transform:translateX(-50%);bottom:16px;background:#1a1f2e;color:#fff;padding:10px 14px;border-radius:999px;box-shadow:0 10px 24px rgba(0,0,0,.2);z-index:999;";
      document.body.appendChild(note);
      setTimeout(() => note.remove(), 900);
    } catch (_) {}

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

    if (!html && !md && pending) {
      storyEl.innerHTML = `
        <div class="wait-wrap">
          <div class="wait-dots" aria-hidden="true"><span></span><span></span><span></span></div>
          <div class="muted" style="font-weight:700;">This may take a few seconds…</div>
        </div>
      `;

      (async ()=>{
        try {
          await generateStoryInPlace(pending);
          SS.removeItem(K_PENDING);
          window.location.reload();
        } catch (err) {
          console.error(err);
          alert("Sorry, we couldn't create the story. Please try again.");
          SS.removeItem(K_PENDING);
        }
      })();

      return;
    }

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

    const rawMdEl = $('#storyMarkdown');
    if (rawMdEl && md) rawMdEl.textContent = md;

    const productsTrack = $('#productsTrack');
    if (productsTrack) {
      const age = getAge();
      const products = getProductsForAge(age);
      renderProducts(productsTrack, products);
    }

    const cartCountEl = document.getElementById("cartCount");
    if (cartCountEl) cartCountEl.classList.add("hidden");
  }

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
    let direction = 'down';
    let armed = true;
    let rearmEdge = null;
    let holdStart = 0;

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
      const R = vh * 1.2;
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

      if (!armed && !holdActive) {
        if ((rearmEdge === 'past'   && reveal >= 0.98) ||
            (rearmEdge === 'before' && reveal <= 0.02)) {
          armed = true;
          rearmEdge = null;
        }
      }

      if (holdActive && Math.abs(window.scrollY - lockedY) > 0) {
        window.scrollTo(0, lockedY);
        return;
      }

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

  // Fix: back/forward sometimes shows blank page
  window.addEventListener('pageshow', function () {
    document.body.classList.remove('fade-out');
    document.documentElement.classList.remove('scroll-locked');

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

    const state = { place:'', pets:'', petType:'', petName:'', kidName:'', kidGender:'', kidAge:'' };

    [sPlace, sPetsYN, sPetDetails, sKid].forEach(el=>el.classList.add('hidden'));
    sPlace.classList.remove('hidden');

    $('#qcClose')?.addEventListener('click', ()=> ov.classList.add('hidden'), { once:true });

    sPlace.querySelectorAll('.qc-chip').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        state.place = (btn.dataset.place || '').toLowerCase();
        sPlace.classList.add('hidden'); sPetsYN.classList.remove('hidden');
      });
    });

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

    $('#qcPetNext')?.addEventListener('click', ()=>{
      state.petType = ($('#qcPetType')?.value || '').trim();
      state.petName = ($('#qcPetName')?.value || '').trim();
      sPetDetails.classList.add('hidden'); sKid.classList.remove('hidden');
    });

    $('#qcCreate')?.addEventListener('click', ()=>{
      state.kidName   = ($('#qcKidName')?.value || '').trim();
      state.kidGender = ($('#qcKidGender')?.value || '').trim();
      state.kidAge    = ($('#qcKidAge')?.value || '').trim();

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

      document.body.classList.add("fade-out");
      setTimeout(()=>{ window.location.href = "checkout.html"; }, 100);
    });
  }

  function forceHeroToOverlay() {
    const btn = document.getElementById('heroCta');
    if (!btn) return;
    const handler = (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      openQuickCreate();
    };
    btn.addEventListener('click', handler, { capture: true });
    try { btn.onclick = null; } catch (_) {}
  }

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
  onReady(async () => {
     await refreshSession();
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
    initHeroParallax();

    $$(".js-open-auth").forEach(btn => {
      btn.addEventListener("click", (e)=> {
        e.preventDefault();
        openAuthModal("signup");
      });
    });
    $$(".js-open-signin").forEach(btn => {
      btn.addEventListener("click", (e)=> {
        e.preventDefault();
        openAuthModal("signin");
      });
    });

    // Force hero CTA to open Quick Create overlay
    const heroCta = document.getElementById('heroCta');
    if (heroCta) {
      heroCta.onclick = (e) => { e.preventDefault(); openQuickCreate(); };
    }
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
    isSignedIn
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
