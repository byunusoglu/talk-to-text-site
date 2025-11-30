"use strict";

/* =====================================================
   StoryBuds — unified interactions (REAL Auth + Existing UX)
   - Preserves: age selector, hero parallax, wizard, API call, checkout,
               testimonials, scroll morph, audio micro-demo, etc.
   - Adds:     real JWT auth, auth modal (Sign Up + Sign In),
               topbar hydration, real gate unlock.
   - Updates:  story generation uses partner APIs (guest-generate + job polling),
               keeping the same visual flow.
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
     Mobile Debug Helper
  --------------------------------------------- */
  const ENABLE_MOBILE_DEBUG = true; // Mobil debug modunu açık/kapalı yap

  function mobileDebug(message, type = 'info') {
    console.log(`[DEBUG] ${message}`);

    if (!ENABLE_MOBILE_DEBUG) return;

    // Ekranda görsel mesaj göster
    const debugDiv = document.createElement('div');
    debugDiv.textContent = message;
    debugDiv.style.cssText = `
      position: fixed;
      top: ${20 + (document.querySelectorAll('.mobile-debug').length * 45)}px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'error' ? '#ff4444' : type === 'warn' ? '#ffaa00' : '#4CAF50'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      z-index: 999999;
      max-width: 90%;
      text-align: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideIn 0.3s ease;
    `;
    debugDiv.className = 'mobile-debug';
    document.body.appendChild(debugDiv);

    // 4 saniye sonra kaldır
    setTimeout(() => {
      debugDiv.style.opacity = '0';
      debugDiv.style.transition = 'opacity 0.3s';
      setTimeout(() => debugDiv.remove(), 300);
    }, 4000);
  }

  /* ---------------------------------------------
     REAL Auth client (JWT)
  --------------------------------------------- */
  const API_BASE = "https://storyai-backend-production.up.railway.app/api/v1";
  // Partner story generation endpoints
  const API_GUEST_GENERATE = `${API_BASE}/stories/generate`;
  const API_AUTH_GENERATE = `${API_BASE}/stories/generate`; // For authenticated users
  const API_JOB = (jobId) => `${API_BASE}/jobs/${jobId}`; // Use authenticated endpoint
  const API_GUEST_JOB = (jobId) => `${API_BASE}/jobs/guest/${jobId}`; // Keep for backward compatibility

  // Session model for cookie-based auth
  let SESSION_READY = false;
  let SESSION_USER  = null;

  // Yardımcı fonksiyon: API çağrıları için header hazırlama
  // Cookie yoksa localStorage'dan JWT token'ı alır ve Authorization header'ına ekler
  function getAuthHeaders(additionalHeaders = {}) {
    const headers = { ...additionalHeaders };
    try {
      const token = localStorage.getItem('yw_jwt_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log('[getAuthHeaders] Token eklendi, uzunluk:', token.length);
      } else {
        console.log('[getAuthHeaders] Token bulunamadı');
        mobileDebug('⚠️ Token bulunamadı!', 'warn');
      }
    } catch (e) {
      console.error('[getAuthHeaders] localStorage hatası:', e);
      mobileDebug('❌ localStorage hatası', 'error');
    }
    return headers;
  }

  async function refreshSession() {
    try {
      const res = await fetch(`${API_BASE}/users/me`, {
        headers: getAuthHeaders(),
        credentials: "include"
      });
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

   function isProbablySignedIn() {
  if (isSignedIn()) return true;
  try { return localStorage.getItem('yw_signed_in') === '1'; } catch (_) { return false; }
}


  // ---- API wrappers ----
  async function apiSignup({ childName, email, password, birthYear, gender }) {
    // Check for pending story jobId and include it in signup
    let pendingStoryJobId = null;
    try {
      pendingStoryJobId = sessionStorage.getItem('yw_pending_story_jobid');
    } catch(_) {}
    
    const payload = { childName, email, password, birthYear, gender };
    if (pendingStoryJobId) {
      payload.pendingStoryJobId = pendingStoryJobId;
      console.log('[apiSignup] Including pendingStoryJobId:', pendingStoryJobId);
    }
    
    console.log('[apiSignup] Sending signup request:', payload);
    
    const res = await fetch(`${API_BASE}/users/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include"
    });
    
    const data = await res.json().catch(()=>({}));
    console.log('[apiSignup] Response:', res.status, data);
    console.log('[apiSignup] Errors:', JSON.stringify(data?.errors, null, 2));
    
    if (!res.ok) {
      const errorMsg = data?.errors?.[0]?.msg || data?.message || data?.error || `Signup failed (${res.status})`;
      throw new Error(errorMsg);
    }
    const token = data?.token || "";
    const user  = data?.data?.user || {};

    // Token'ı localStorage'a kaydet (mobil cihazlar için fallback)
    if (token) {
      try {
        localStorage.setItem('yw_jwt_token', token);
        console.log('[apiSignup] Token localStorage\'a kaydedildi, uzunluk:', token.length);
        mobileDebug('✅ Signup başarılı!');
      } catch (e) {
        console.error('[apiSignup] Token kaydetme hatası:', e);
        mobileDebug('❌ Token kaydetme hatası', 'error');
      }
    } else {
      console.warn('[apiSignup] Token response\'da yok!');
      mobileDebug('⚠️ Token gelmedi!', 'warn');
    }

    return { token, user };
  }

  async function apiLogin({ email, password }) {
    const res = await fetch(`${API_BASE}/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include"
    });
    const data = await res.json().catch(()=>({}));
    if (!res.ok) {
      const msg = data?.message || data?.error || `Login failed (${res.status})`;
      throw new Error(msg);
    }
    const token = data?.token || "";
    const user  = data?.data?.user || {};

    // Token'ı localStorage'a kaydet (mobil cihazlar için fallback)
    if (token) {
      try {
        localStorage.setItem('yw_jwt_token', token);
        console.log('[apiLogin] Token localStorage\'a kaydedildi, uzunluk:', token.length);
        mobileDebug('✅ Login başarılı!');
      } catch (e) {
        console.error('[apiLogin] Token kaydetme hatası:', e);
        mobileDebug('❌ Token kaydetme hatası', 'error');
      }
    } else {
      console.warn('[apiLogin] Token response\'da yok!');
      mobileDebug('⚠️ Token gelmedi!', 'warn');
    }

    return { token, user };
  }

  // simplified version for cookie-based auth
  async function apiGetMe() {
    const res = await fetch(`${API_BASE}/users/me`, {
      method: "GET",
      headers: getAuthHeaders(),
      credentials: "include", // always include cookies
    });
    if (!res.ok) throw new Error("API 401");
    return res.json();
  }

  async function signOut() {
  mobileDebug('🔄 Çıkış yapılıyor...');

  // Önce local state'i temizle (backend hatası olsa bile logout olsun)
  SESSION_USER = null;
  try {
    localStorage.removeItem('yw_signed_in');
    localStorage.removeItem('yw_jwt_token');
    mobileDebug('🗑️ Local data temizlendi');
  } catch (e) {
    console.warn('[signOut] localStorage temizleme hatası:', e);
    mobileDebug('⚠️ Local temizleme hatası', 'warn');
  }

  // Sonra backend'e logout isteği gönder
  try {
    mobileDebug('📡 Backend\'e istek gönderiliyor...');
    const response = await fetch(`${API_BASE}/users/logout`, {
      method: "POST",
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: "include"
    });
    console.log('[signOut] Backend response:', response.status);
    mobileDebug(`✅ Backend: ${response.status}`);
    if (!response.ok) {
      console.warn('[signOut] Backend logout başarısız:', response.status);
      mobileDebug(`⚠️ Backend: ${response.status}`, 'warn');
    }
  } catch (e) {
    console.error('[signOut] Backend isteği başarısız:', e);
    mobileDebug(`❌ Backend hatası: ${e.message}`, 'error');
    // Hata olsa bile devam et, local state zaten temizlendi
  }
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

  // keys used on navigation to checkout
  const K_TRANSCRIPT = "yw_transcript";
  const K_STORY_MD   = "yw_story_markdown";
  const K_STORY_HTML = "yw_story_html";
  const K_PENDING    = "yw_pending_transcript";   // pass data to checkout to generate there
  const K_GUEST_PAYLOAD = "yw_guest_payload";     // structured payload for partner API

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
    if (logoA) logoA.setAttribute("href", isProbablySignedIn() ? "home.html" : "index.html");

    // Hamburger / top menu (expects #menu, degrades gracefully)
    const menu = $("#menu");
    if (!menu) return;

    menu.innerHTML = "";
    if (isProbablySignedIn()) {
      menu.insertAdjacentHTML("beforeend",
        `<a href="home.html" aria-current="page">Home</a>
         <a href="create.html">Create Stories</a>
         <a href="#" id="menuSignOut">Sign Out</a>`);
      $("#menuSignOut")?.addEventListener("click", async (e) => {
        e.preventDefault();
        mobileDebug('🖱️ Sign Out tıklandı');
        console.log('[Menu] Sign Out tıklandı');
        try {
          await signOut();
          console.log('[Menu] Sign Out başarılı, yönlendiriliyor...');
          mobileDebug('✅ Çıkış başarılı, yönlendiriliyor...');
        } catch (err) {
          console.error('[Menu] Sign Out hatası:', err);
          mobileDebug(`❌ Hata: ${err.message}`, 'error');
        }
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

       // ---------------------------------------------
  // ✅ Defensive bind for hamburger menu toggle
  // ---------------------------------------------
  const toggle = () => {
    menu.classList.toggle('hidden');
  };

  // Remove any stale listeners to avoid duplicates
  menuBtn.removeEventListener('click', toggle);
  menuBtn.addEventListener('click', toggle);

  // Auto-close menu when clicking outside or selecting a link
  wireMenuAutoClose(menuBtn, menu);

    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    const cartCountEl = document.getElementById("cartCount");
    if (cartCountEl) cartCountEl.classList.add("hidden");

    // Re-hydrate once to win races with other DOM scripts
    setTimeout(hydrateTopbarAuth, 0);
  }

function wireLogoSmartRouting() {
  const logo = document.querySelector('a.logo');
  if (!logo) return;

  // Default-safe: assume guest until session proves otherwise
  logo.setAttribute('href', 'index.html');

  const hardNav = (url) => {
    try { document.body.classList.add('fade-out'); } catch (_) {}
    setTimeout(() => { window.location.href = url; }, 80);
  };

  logo.addEventListener('click', (e) => {
    // Decide at click using the current session snapshot only
    const signed = isProbablySignedIn(); // tolerant: allows fresh mobile sessions
    const target = signed ? 'home.html' : 'index.html';

    // If hydration hasn’t updated href yet or is wrong, hard-nav
    if ((logo.getAttribute('href') || '') !== target) {
      e.preventDefault();
      hardNav(target);
    }
    // else let the normal link work
  }, { passive: false });
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
   function guardHomeOnlyForSignedIn() {
  const isHome = /(?:^|\/)home\.html(?:$|\?)/i.test(location.pathname + location.search);
  if (!isHome) return;
      // Allow the very first load after auth even if /me hasn't confirmed yet
const justAuthed = (() => {
  try { return sessionStorage.getItem('yw_postauth') === '1'; } catch (_) { return false; }
})();
if (justAuthed) {
  try { sessionStorage.removeItem('yw_postauth'); } catch (_){}
  return; // skip redirect once
}

  if (!isSignedIn()) {
    // If session isn’t ready yet we’ll be conservative; refresh & re-check
    const doRedirect = () => {
      try { document.body.classList.add('fade-out'); } catch (_) {}
      setTimeout(() => { window.location.href = 'index.html'; }, 80);
    };
    // We might already have SESSION_READY from refreshSession(); if not, route safely
    if (typeof window.StoryBuds === 'object') {
      // no-op; keep public API clean
    }
    doRedirect();
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
        <p class="muted" style="font-size:12px;margin-top:4px;">Must include uppercase, lowercase, and a number</p>
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

          primary.onclick = async () => {
  const email = $("#authEmail")?.value.trim();
  const pass  = $("#authPass")?.value;
  if (!email || !pass) { alert("Please enter email and password."); return; }
  try {
    await apiLogin({ email, password: pass });
    try { await apiGetMe(); } catch(_){}
    try { localStorage.setItem('yw_signed_in', '1'); } catch (_) {}
    try { sessionStorage.setItem('yw_postauth', '1'); } catch (_) {}
    close();
    fadeOutAnd(() => { window.location.href = "home.html"; }, 120);
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
            const birthYearRaw = $("#authBirthYear")?.value?.trim() || guess.birthYear;
            const birthYear = parseInt(birthYearRaw, 10);
            const gender    = $("#authGender")?.value || guess.gender;
            const email     = $("#authEmail")?.value?.trim();
            const password  = $("#authPass")?.value;

            if (!childName || !birthYear || isNaN(birthYear) || !gender || !email || !password) {
              alert("Please fill all fields.");
              return;
            }

            try {
              await apiSignup({ childName, email, password, birthYear, gender });
              try { await apiGetMe(); } catch(_) {}
              try { localStorage.setItem('yw_signed_in', '1'); } catch (_) {}
              try { sessionStorage.setItem('yw_postauth', '1'); } catch (_) {}
              close();

              // Check if there's a pending story from pre-signup generation
              const hasPendingStory = (() => {
                try { 
                  return !!sessionStorage.getItem('yw_pending_story_jobid'); 
                } catch(_) { 
                  return false; 
                }
              })();

              // If user signed up from checkout with a pending story, go to storydetail
              // Otherwise, seed a first story and decide based on that
              if (hasPendingStory) {
                fadeOutAnd(() => { window.location.href = "storydetail.html"; }, 120);
              } else {
                const seeded = seedFirstStoryIfNeeded();
                fadeOutAnd(() => { window.location.href = seeded ? "storydetail.html" : "home.html"; }, 120);
              }

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
  cta.onclick = (e) => { e.preventDefault(); openQuickCreate(); };
}
    } catch (_) {}
  }

  /* ---------------------------------------------
     Page guards
  --------------------------------------------- */
  const isCreateChatPage = () => Boolean($('#chatWizard'));
  const isCheckoutPage   = () => Boolean($('#storyContent') && $('#productsTrack'));
  const isStoryDetailPage = () => Boolean($('#storybook'));
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


   // --- TEMP: Seed a first story for brand-new users (reversible) ---
function seedFirstStoryIfNeeded() {
  try {
    const seeded = localStorage.getItem('yw_first_story_seeded') === '1';
    if (seeded) return false;

    const SS = window.sessionStorage;
    const kid = (function getChildNameFromTranscript(){
      try {
        const raw = SS.getItem('yw_transcript') || SS.getItem('yw_pending_transcript') || '';
        const m = raw.match(/Child name:\s*([^\n]+)/i);
        return (m && m[1] ? m[1].trim() : '').replace(/[^A-Za-zÇĞİÖŞÜçğıöşü' -]/g,'');
      } catch(_) { return ''; }
    })();

    const title = kid ? `${kid}'s Moonlight Puddle` : `A Little Moonlight Puddle`;
    const seededHtml = `
      <h1>${title}</h1>
      <h2>The Soft Night</h2>
      <p>It was a calm, cozy evening. The moon peeked through the window with a gentle glow—whoosh…</p>

      <h2>The Tiny Idea</h2>
      <p>“Plip-plop,” went a small, friendly puddle outside. It looked like a mirror for the stars.</p>

      <h2>A Brave Step</h2>
      <p>${kid || 'Our friend'} tiptoed to the door, holding a snuggly blanket. The night breeze whispered hello—whooo…</p>

      <h2>Moonbeam Helpers</h2>
      <p>Silver moonbeams danced across the floor, showing a safe path, one soft step at a time.</p>

      <h2>Snuggle Ending</h2>
      <p>Back in bed, the room felt warm again. “Good night,” murmured the moon. “Good night,” said ${kid || 'our friend'}. Zzzz…</p>
    `.trim();

    SS.setItem('yw_story_html', seededHtml);
    SS.removeItem('yw_story_markdown'); // be explicit: HTML is the source for detail page
    SS.setItem('yw_ambience', 'night'); // gentle ambience default for detail page

    localStorage.setItem('yw_first_story_seeded', '1');
    return true;
  } catch(_) { return false; }
}


   
  /* ---------------------------------------------
     Partner Story Generation Helpers (guest)
  --------------------------------------------- */

function paintFirstPage({ title, firstPageText }) {
  const storyEl = document.getElementById("storyContent");
  if (!storyEl) return;

  const safeTitle = title ? `<h1>${title}</h1>` : '';
  let safePreview = '';

  if (firstPageText) {
    // Split text into lines and take first 4–5 sentences
    const parts = firstPageText
      .split(/(?<=[.!?])\s+/)
      .filter(Boolean)
      .slice(0, 5); // show ~5 sentences
    safePreview = parts.map(p => `<p>${p}</p>`).join('');
  } else {
    safePreview = `<p class="muted">Your story is warming up…</p>`;
  }

  storyEl.innerHTML = `${safeTitle}${safePreview}`;

   try { sessionStorage.setItem("yw_story_teaser", storyEl.innerHTML); } catch (_) {}
}

  async function startGuestGeneration(guestPayload) {
    // Check if user is authenticated - use proper endpoint
    const isAuth = isSignedIn() || isProbablySignedIn();
    const endpoint = isAuth ? API_AUTH_GENERATE : API_GUEST_GENERATE;
    
    console.log('[startGuestGeneration] Using endpoint:', endpoint, 'isAuth:', isAuth);
    
    // For authenticated users, convert payload to match /stories/generate format
    let payload = guestPayload;
    if (isAuth) {
      // Build transcript from guest payload
      const child = guestPayload.child || {};
      const transcript = `Child name: ${child.name || 'Friend'}\nChild age: ${child.age || 4}\nChild gender: ${child.gender || 'unspecified'}\nPlace: ${guestPayload.location || 'forest'}`;
      
      payload = {
        transcript: transcript,
        language: guestPayload.language || 'en',
        childImageUrl: guestPayload.childImageUrl || null
      };
      console.log('[startGuestGeneration] Converted to auth payload:', payload);
    }
    
    const res = await fetch(endpoint, {
      method: "POST",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
      credentials: "include",
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(()=> ({}));
    if (!res.ok || !data?.ok || !data?.jobId) {
      console.error('[startGuestGeneration] Failed:', data);
      throw new Error(data?.message || `Story generation failed (${res.status})`);
    }
    console.log('[startGuestGeneration] Job created:', data.jobId);
    return data.jobId;
  }

  async function fetchJob(jobId) {
    // Use authenticated endpoint if user is signed in
    const isAuth = isSignedIn() || isProbablySignedIn();
    const endpoint = isAuth ? API_JOB(jobId) : API_GUEST_JOB(jobId);
    
    console.log('[fetchJob] Fetching job:', jobId, 'endpoint:', endpoint, 'isAuth:', isAuth);
    
    const res = await fetch(endpoint, {
      method: "GET",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
      credentials: "include"
    });
    if (!res.ok) {
      console.error('[fetchJob] Failed:', res.status);
      throw new Error(`Job ${res.status}`);
    }
    const data = await res.json();
    console.log('[fetchJob] Job data received:', data?.data?.job?.status || data?.status);
    return data;
  }

  // Poll every ~5s until completed
  function pollForFirstPage(jobId, { onTick, onDone, onError, intervalMs = 5000 }) {
    let timer = null;
    const tick = async () => {
      try {
        const data = await fetchJob(jobId);
        const s = data?.data?.status || data?.status;
        const first = data?.data?.firstPageText;
        const title = data?.data?.title;
        if (typeof onTick === 'function') onTick({ status: s });

        if (s === 'completed' && first) {
          clearInterval(timer);
          if (typeof onDone === 'function') onDone({ title, firstPageText: first });
        }
        // else keep polling while s is processing
      } catch (err) {
        clearInterval(timer);
        if (typeof onError === 'function') onError(err);
      }
    };
    timer = setInterval(tick, intervalMs);
    tick(); // immediate check
    return () => clearInterval(timer);
  }

  /* ---------------------------------------------
     Authenticated Story Generation (for logged-in users)
  --------------------------------------------- */
  
  /**
   * Generate a story for authenticated users
   * @param {Object} params - Story generation parameters
   * @param {string} params.transcript - The story transcript/prompt
   * @param {string} params.language - Language code (e.g., 'en-GB')
   * @param {string} [params.childImageUrl] - Optional child image URL
   * @returns {Promise<string>} - Returns jobId
   */
  async function generateAuthenticatedStory({ transcript, language = 'en-GB', childImageUrl = null }) {
    if (!isSignedIn() && !isProbablySignedIn()) {
      throw new Error('User must be signed in to generate stories');
    }

    const payload = { transcript, language };
    if (childImageUrl) payload.childImageUrl = childImageUrl;

    console.log('[generateAuthenticatedStory] Starting generation:', payload);
    
    const res = await fetch(API_AUTH_GENERATE, {
      method: "POST",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
      credentials: "include",
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    
    if (!res.ok || !data?.ok || !data?.jobId) {
      console.error('[generateAuthenticatedStory] Failed:', data);
      throw new Error(data?.message || `Story generation failed (${res.status})`);
    }

    console.log('[generateAuthenticatedStory] Job created:', data.jobId);
    return data.jobId;
  }

  /**
   * Poll job status until completion and return full story data
   * @param {string} jobId - The job ID to poll
   * @param {Object} callbacks - Callback functions
   * @param {Function} callbacks.onProgress - Called on each poll with status update
   * @param {Function} callbacks.onComplete - Called when job completes with full story data
   * @param {Function} callbacks.onError - Called on error
   * @param {number} [intervalMs=5000] - Polling interval in milliseconds
   * @returns {Function} - Cleanup function to stop polling
   */
  function pollJobUntilComplete(jobId, { onProgress, onComplete, onError, intervalMs = 5000 }) {
    let timer = null;
    let pollCount = 0;
    const maxPolls = 120; // 10 minutes max (120 * 5 seconds)

    const tick = async () => {
      pollCount++;
      
      if (pollCount > maxPolls) {
        clearInterval(timer);
        if (typeof onError === 'function') {
          onError(new Error('Story generation timeout - please try again'));
        }
        return;
      }

      try {
        const data = await fetchJob(jobId);
        const job = data?.data?.job || data?.data;
        const status = job?.status;
        const outputData = job?.outputData || {};
        
        console.log(`[pollJobUntilComplete] Poll #${pollCount}, Status: ${status}`);
        
        // Send progress update
        if (typeof onProgress === 'function') {
          const logs = job?.processingLogs || [];
          const lastLog = logs[logs.length - 1]?.msg || '';
          onProgress({ 
            status, 
            message: lastLog,
            pollCount 
          });
        }

        // Check if completed
        if (status === 'completed') {
          clearInterval(timer);
          
          // Extract full story data
          const storyData = {
            storyId: outputData.storyId,
            title: outputData.title,
            pages: outputData.pages || []
          };
          
          console.log('[pollJobUntilComplete] Story complete:', storyData.title);
          
          if (typeof onComplete === 'function') {
            onComplete(storyData);
          }
        } else if (status === 'failed') {
          clearInterval(timer);
          
          // Extract error message from job logs or errorMessage field
          const logs = job?.processingLogs || [];
          const errorLog = logs.find(log => log.msg && (log.msg.includes('Failed') || log.msg.includes('Error')));
          const errorMessage = job?.errorMessage || errorLog?.msg || 'Story generation failed';
          
          console.error('[pollJobUntilComplete] Job failed:', errorMessage);
          
          if (typeof onError === 'function') {
            onError(new Error(errorMessage));
          }
        }
        // else keep polling (status is 'pending' or 'processing')
        
      } catch (err) {
        console.error('[pollJobUntilComplete] Error:', err);
        clearInterval(timer);
        if (typeof onError === 'function') {
          onError(err);
        }
      }
    };

    timer = setInterval(tick, intervalMs);
    tick(); // immediate first check

    // Return cleanup function
    return () => {
      if (timer) {
        clearInterval(timer);
        console.log('[pollJobUntilComplete] Polling stopped');
      }
    };
  }

  /* ---------------------------------------------
     API call + stash story + go checkout
     (Updated: For authenticated users, generate story directly.
               For guests, navigate to checkout with pending data)
  --------------------------------------------- */

  // For authenticated users: generate story and navigate to home.html with loading UI
  // For guests: stash transcript and navigate to checkout
  async function generateStoryAndNavigate(transcript) {
    if (!transcript) throw new Error("Missing transcript");
    
    const btn = $('#chatGenerate') || $('#generateBtn');
    const spinner = $('#genSpinner');
    
    try {
      btn && (btn.disabled = true);
      spinner && spinner.classList.remove('hidden');

      try { SS.setItem(K_TRANSCRIPT, transcript); } catch (_) {}

      // Check if user is signed in
      const signedIn = isSignedIn() || isProbablySignedIn();
      
      if (signedIn) {
        // ===== AUTHENTICATED USER FLOW =====
        console.log('[generateStoryAndNavigate] User is signed in, using authenticated flow');
        
        // Show a loading message in the chat
        const elStream = $('#chatStream');
        if (elStream) {
          const loadingRow = document.createElement('div');
          loadingRow.className = 'chat-row bot';
          loadingRow.innerHTML = `
            <div class="bubble">
              <div class="wait-wrap" style="margin: 0;">
                <div class="wait-dots" aria-hidden="true"><span></span><span></span><span></span></div>
                <div class="muted" style="font-size: 14px; margin-top: 8px;">Generating your story...</div>
              </div>
            </div>
          `;
          elStream.appendChild(loadingRow);
          elStream.scrollTop = elStream.scrollHeight;
        }

        // Start authenticated story generation
        const jobId = await generateAuthenticatedStory({
          transcript,
          language: 'en-GB'
        });

        console.log('[generateStoryAndNavigate] Job started:', jobId);
        
        // Store jobId for tracking
        try { SS.setItem('yw_current_jobid', jobId); } catch (_) {}
        
        // Navigate to home.html with jobId parameter
        // home.html will show a loading UI and poll the job
        fadeOutAnd(() => {
          window.location.href = `home.html?generating=${jobId}`;
        }, 150);
        
      } else {
        // ===== GUEST USER FLOW (existing behavior) =====
        console.log('[generateStoryAndNavigate] User is guest, using checkout flow');
        
        try { SS.setItem(K_PENDING, transcript); } catch (_) {}

        // If a guest payload hasn't been set yet, try best-effort fallback from transcript
        const raw = SS.getItem(K_GUEST_PAYLOAD);
        if (!raw) {
          // derive minimal payload
          const name = (transcript.match(/Child name:\s*([^\n]+)/i)?.[1] || 'Friend').trim();
          const ageVal  = parseInt((transcript.match(/Child age:\s*([^\n]+)/i)?.[1] || '4'), 10);
          const genderRaw = (transcript.match(/Child gender:\s*([^\n]+)/i)?.[1] || '').toLowerCase();
          const place = (transcript.match(/Place:\s*([^\n]+)/i)?.[1] || 'forest').toLowerCase();
          const guestPayload = {
            language: 'en',
            location: place,
            child: { name, age: (isNaN(ageVal) ? 4 : Math.max(0, Math.min(12, ageVal))), gender: /girl|female/.test(genderRaw) ? 'female' : /boy|male/.test(genderRaw) ? 'male' : 'unspecified' },
            pet: null
          };
          try { SS.setItem(K_GUEST_PAYLOAD, JSON.stringify(guestPayload)); } catch (_) {}
        }

        goCheckout();
      }
      
    } catch (err) {
      console.error('[generateStoryAndNavigate] Error:', err);
      alert(`Sorry, we couldn't start the story: ${err.message}`);
      
      btn && (btn.disabled = false);
      spinner && spinner.classList.add('hidden');
    }
  }

  // Kept for compatibility; not used in checkout path anymore.
  async function generateStoryInPlace(/* transcript */) {
    throw new Error("Deprecated: generateStoryInPlace is replaced by guest job flow.");
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

      // Build a structured guest payload now (better mapping than transcript-only)
      const ageNum = parseInt(answers.age || "4", 10);
      const guestPayload = {
        language: "en",
        location: (answers.theme || "forest").toLowerCase(),
        child: {
          name: answers.name || "Friend",
          age: isNaN(ageNum) ? 4 : Math.max(0, Math.min(12, ageNum)),
          gender: "unspecified"
        },
        pet: null
      };
      try { SS.setItem(K_GUEST_PAYLOAD, JSON.stringify(guestPayload)); } catch (_) {}

      pushBot("✨ Creating your story...");
      await generateStoryAndNavigate(transcript);
    });
  }

function showGate(personName = "") {
  const storyEl = document.getElementById("storyContent");
  const gate = document.getElementById("gateOverlay");
  if (!storyEl || !gate) return;

  // Simplified gate design — single unified CTA
  gate.classList.remove("hidden");
  gate.innerHTML = `
    <div class="gate-card gate-card--brand">
      <h3>Continue reading for free</h3>
      <p class="muted">
        ${personName ? `Create your free account to finish ${personName}’s bedtime story.` 
                     : `Create your free account to finish this bedtime story.`}
      </p>
      <button type="button" class="btn" id="gateSignupBtn">Sign Up for Free</button>
      <div class="trust-row" aria-hidden="true">
        <span>🛡️ No payment needed</span>
        <span>·</span>
        <span>Free forever for your first story</span>
      </div>
    </div>
  `;

  // CTA opens main signup modal
  const btn = document.getElementById("gateSignupBtn");
  if (btn) btn.addEventListener("click", (e) => {
    e.preventDefault();
    openAuthModal("signup");
  });
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

       // 🧹 Clear temporary teaser once the account is created
  try { sessionStorage.removeItem("yw_story_teaser"); } catch (_) {}
     
    try {
      const note = document.createElement("div");
      note.textContent = "✨ Account ready! Taking you to your home.";
      note.style.cssText =
        "position:fixed;left:50%;transform:translateX(-50%);bottom:16px;background:#1a1f2e;color:#fff;padding:10px 14px;border-radius:999px;box-shadow:0 10px 24px rgba(0,0,0,.2);z-index:999;";
      document.body.appendChild(note);
      setTimeout(() => note.remove(), 900);
    } catch (_) {}

    const hasSeededStory = !!(SS && (SS.getItem("yw_story_html") || SS.getItem("yw_story_teaser")));
try { document.body.classList.add("fade-out"); } catch (_) {}
setTimeout(() => {
  window.location.href = hasSeededStory ? "storydetail.html" : "home.html";
}, 600);

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

     // 🧠 Restore story teaser on refresh (if generation already completed once)
const teaser = SS.getItem("yw_story_teaser");
if (!html && !md && !pending && teaser) {
  storyEl.innerHTML = teaser;
  storyEl.dataset.preview = "lines";
  storyEl.classList.add("preview-clamp");
  showGate(getChildName());
  return;
}

     
    // If we arrive with a pending transcript, kick off guest generation + poller
    if (!html && !md && pending) {
      storyEl.innerHTML = `
        <div class="wait-wrap">
          <div class="wait-dots" aria-hidden="true"><span></span><span></span><span></span></div>
          <div class="muted" style="font-weight:700;">This may take a few seconds…</div>
        </div>
      `;

       // Show the signup gate right away for guests, then keep the existing onDone gate call.
       try { showGate(getChildName()); } catch (_) {}

      (async () => {
        try {
          // Prefer the structured payload if present (from Quick Create or Chat Wizard)
          const raw = SS.getItem(K_GUEST_PAYLOAD);
          let payload = null;
          try { payload = raw ? JSON.parse(raw) : null; } catch(_) {}

          // Fallback: minimum viable payload from transcript
          if (!payload) {
            const name = (pending.match(/Child name:\s*([^\n]+)/i)?.[1] || 'Friend').trim();
            const age  = parseInt((pending.match(/Child age:\s*([^\n]+)/i)?.[1] || '4'), 10);
            const genderRaw = (pending.match(/Child gender:\s*([^\n]+)/i)?.[1] || '').toLowerCase();
            const place = (pending.match(/Place:\s*([^\n]+)/i)?.[1] || 'forest').toLowerCase();
            payload = {
              language: 'en',
              location: place,
              child: { name, age: (isNaN(age) ? 4 : Math.max(0, Math.min(12, age))), gender: /girl|female/.test(genderRaw) ? 'female' : /boy|male/.test(genderRaw) ? 'male' : 'unspecified' },
              pet: null
            };
          }

          // 1) Start job
          const jobId = await startGuestGeneration(payload);
          
          // Store jobId for post-signup story retrieval
          try { SS.setItem('yw_pending_story_jobid', jobId); } catch(_) {}

          // 2) Poll until we get firstPageText, then paint the preview
          pollForFirstPage(jobId, {
            onTick: () => {}, // keep loader animating
            onDone: ({ title, firstPageText }) => {
              try { SS.removeItem(K_PENDING); } catch(_) {}
              // Paint the opening on checkout
              paintFirstPage({ title, firstPageText });

              // Preview UX for guests (clamped lines)
              const sc = document.getElementById("storyContent");
              if (sc) {
                sc.dataset.preview = "lines";
                sc.classList.add("preview-clamp");
              }

              // Keep gate behavior
              const childName = getChildName();
              if (childName) showGate(childName);
            },
            onError: (err) => {
              console.error(err);
              alert("Sorry, we couldn't create the story. Please try again.");
              try { SS.removeItem(K_PENDING); } catch(_) {}
            }
          });
        } catch (err) {
          console.error(err);
          alert("Sorry, we couldn't create the story. Please try again.");
          try { SS.removeItem(K_PENDING); } catch(_) {}
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
     Story Detail: Load pending story after signup
  --------------------------------------------- */
  async function initStoryDetail() {
    if (!isSignedIn()) {
      // If not signed in, redirect to home
      console.log('[initStoryDetail] User not signed in, redirecting to home');
      fadeOutAnd(() => { window.location.href = "home.html"; }, 300);
      return;
    }

    // Check if there's a pending story jobId from pre-signup generation
    let pendingJobId = null;
    try {
      pendingJobId = sessionStorage.getItem('yw_pending_story_jobid');
    } catch(_) {}

    if (!pendingJobId) {
      // No pending story, check if we have a regular story to display
      console.log('[initStoryDetail] No pending jobId, checking for existing story');
      return; // Let existing storydetail logic handle it
    }

    console.log('[initStoryDetail] Found pending jobId:', pendingJobId);
    mobileDebug('📖 Loading your story...');

    // Show loading state in storybook
    const storybook = $('#storybook');
    if (storybook) {
      const stage = storybook.querySelector('.sb-stage');
      if (stage) {
        stage.innerHTML = `
          <div class="sb-page" style="display:flex;align-items:center;justify-content:center;flex-direction:column;padding:20px;text-align:center;">
            <div class="wait-wrap">
              <div class="wait-dots" aria-hidden="true"><span></span><span></span><span></span></div>
              <p style="margin-top:20px;font-weight:700;color:#3a3450;">Preparing your story...</p>
              <p class="muted" style="margin-top:8px;font-size:14px;">This may take a few moments</p>
            </div>
          </div>
        `;
      }
    }

    // Poll for the story completion using authenticated endpoint
    try {
      const pollAuthenticatedStory = async (storyJobId) => {
        let attempts = 0;
        const maxAttempts = 60; // Poll for up to 5 minutes (60 * 5s)
        
        const poll = async () => {
          attempts++;
          
          try {
            // Use authenticated job endpoint to get full story
            const res = await fetch(`${API_BASE}/jobs/${storyJobId}`, {
              method: "GET",
              headers: getAuthHeaders({ "Content-Type": "application/json" }),
              credentials: "include"
            });
            
            if (!res.ok) {
              // Job might not be available anymore (expired or not found)
              // Fall back to fetching user's stories instead
              console.log('[pollAuthenticatedStory] Job not found, fetching user stories instead');
              
              try {
                const storiesRes = await fetch(`${API_BASE}/stories/my`, {
                  method: "GET",
                  headers: getAuthHeaders({ "Content-Type": "application/json" }),
                  credentials: "include"
                });
                
                if (storiesRes.ok) {
                  const storiesData = await storiesRes.json();
                  const stories = storiesData?.data?.stories || [];
                  
                  if (stories.length > 0) {
                    // Get the most recent story
                    const latestStory = stories[0];
                    console.log('[pollAuthenticatedStory] Using most recent story:', latestStory._id);
                    
                    // Clear pending state
                    try { 
                      sessionStorage.removeItem('yw_pending_story_jobid'); 
                      sessionStorage.removeItem(K_PENDING);
                    } catch(_) {}
                    
                    // Fetch this story
                    const storyRes = await fetch(`${API_BASE}/stories/${latestStory._id}`, {
                      method: "GET",
                      headers: getAuthHeaders({ "Content-Type": "application/json" }),
                      credentials: "include"
                    });
                    
                    if (storyRes.ok) {
                      const storyData = await storyRes.json();
                      const story = storyData?.data?.story;
                      
                      if (story && story.pages) {
                        // Convert to HTML and store
                        let storyHtml = '';
                        if (story.title) {
                          storyHtml += `<h1>${story.title}</h1>\n`;
                        }
                        
                        story.pages.forEach((page, idx) => {
                          if (story.pages.length > 1) {
                            storyHtml += `<h2>Page ${page.pageNumber || idx + 1}</h2>\n`;
                          }
                          storyHtml += `<p>${page.text}</p>\n`;
                        });
                        
                        try {
                          sessionStorage.setItem('yw_story_html', storyHtml);
                          sessionStorage.setItem('yw_current_story', JSON.stringify(story));
                        } catch(_) {}
                        
                        mobileDebug('🎉 Displaying your story!');
                        setTimeout(() => {
                          window.location.reload();
                        }, 500);
                        return;
                      }
                    }
                  }
                }
              } catch (err) {
                console.error('[pollAuthenticatedStory] Error fetching stories list:', err);
              }
              
              throw new Error(`Failed to fetch job: ${res.status}`);
            }
            
            const data = await res.json();
            
            // Handle different response formats
            const jobData = data?.data?.job || data?.data || {};
            const status = jobData.status || data?.status;
            const outputData = jobData.outputData || {};
            const guestData = jobData.guestData || {};
            
            console.log('[pollAuthenticatedStory] Status:', status, 'Attempt:', attempts);
            console.log('[pollAuthenticatedStory] Full response:', JSON.stringify(data, null, 2));
            console.log('[pollAuthenticatedStory] JobData:', JSON.stringify(jobData, null, 2));
            console.log('[pollAuthenticatedStory] OutputData:', JSON.stringify(outputData, null, 2));
            console.log('[pollAuthenticatedStory] GuestData:', JSON.stringify(guestData, null, 2));
            
            // Check for storyId in multiple possible locations
            const storyId = outputData.storyId || outputData.id || jobData.storyId || jobData._id || data?.data?.storyId;
            console.log('[pollAuthenticatedStory] Looking for storyId... Found:', storyId);
            
            // Check if we have guest story data (story not yet saved to DB)
            const hasGuestStory = guestData.storyJson && guestData.storyJson.pages;
            
            // Check if we have the simplified guest response with title and firstPageText
            const hasSimpleGuestData = jobData.title && jobData.firstPageText;
            
            if (status === 'completed' && (storyId || hasGuestStory || hasSimpleGuestData)) {
              console.log('[pollAuthenticatedStory] Story completed!');
              
              // Clear the pending jobId
              try { 
                sessionStorage.removeItem('yw_pending_story_jobid'); 
                sessionStorage.removeItem(K_PENDING);
              } catch(_) {}
              
              let story = null;
              
              // If we have a storyId, fetch from the stories API
              if (storyId) {
                console.log('[pollAuthenticatedStory] Fetching story by ID:', storyId);
                mobileDebug('✨ Loading story...');
                
                const storyRes = await fetch(`${API_BASE}/stories/${storyId}`, {
                  method: "GET",
                  headers: getAuthHeaders({ "Content-Type": "application/json" }),
                  credentials: "include"
                });
                
                if (storyRes.ok) {
                  const storyData = await storyRes.json();
                  story = storyData?.data?.story;
                }
              } 
              
              // If no storyId or fetch failed, use guest story data directly
              if (!story && hasGuestStory) {
                console.log('[pollAuthenticatedStory] Using guest story data from job');
                mobileDebug('✨ Loading guest story...');
                
                // Convert guest story format to expected format
                story = {
                  title: guestData.title || guestData.storyJson.title || 'Your Story',
                  pages: guestData.storyJson.pages.map(page => ({
                    pageNumber: page.pageNumber,
                    text: page.text,
                    imageUrl: page.imageUrl || null,
                    audioUrl: page.audioUrl || null
                  })),
                  createdAt: guestData.generatedAt || new Date().toISOString()
                };
              }
              
              // If no story yet, try the simple guest format (title + firstPageText)
              // But this is just a preview - try to fetch the full story from /stories/my
              if (!story && hasSimpleGuestData) {
                console.log('[pollAuthenticatedStory] Guest job completed, fetching full story from /stories/my');
                mobileDebug('✨ Fetching full story...');
                
                // The guest job is complete, so the story should now be in the user's account
                // Try to fetch it from /stories/my
                try {
                  const storiesRes = await fetch(`${API_BASE}/stories/my`, {
                    method: "GET",
                    headers: getAuthHeaders({ "Content-Type": "application/json" }),
                    credentials: "include"
                  });
                  
                  if (storiesRes.ok) {
                    const storiesData = await storiesRes.json();
                    const stories = storiesData?.data?.stories || [];
                    
                    console.log('[pollAuthenticatedStory] Found', stories.length, 'stories');
                    
                    if (stories.length > 0) {
                      // Find the story that matches the current job title, or use the most recent
                      const matchingStory = stories.find(s => s.title === jobData.title) || stories[0];
                      console.log('[pollAuthenticatedStory] Fetching story:', matchingStory._id);
                      
                      // Fetch the full story
                      const storyRes = await fetch(`${API_BASE}/stories/${matchingStory._id}`, {
                        method: "GET",
                        headers: getAuthHeaders({ "Content-Type": "application/json" }),
                        credentials: "include"
                      });
                      
                      if (storyRes.ok) {
                        const storyData = await storyRes.json();
                        story = storyData?.data?.story;
                        console.log('[pollAuthenticatedStory] Fetched full story with', story?.pages?.length, 'pages');
                      }
                    }
                  }
                } catch (err) {
                  console.error('[pollAuthenticatedStory] Error fetching full story:', err);
                }
                
                // If we couldn't get the full story, fall back to the preview
                if (!story) {
                  console.log('[pollAuthenticatedStory] Using preview (first page only)');
                  mobileDebug('⚠️ Showing preview only', 'warn');
                  
                  story = {
                    title: jobData.title,
                    pages: [{
                      pageNumber: 1,
                      text: jobData.firstPageText,
                      imageUrl: null,
                      audioUrl: null
                    }],
                    createdAt: new Date().toISOString()
                  };
                }
              }
              
              if (story && story.pages) {
                // Convert story to HTML format for storydetail page
                console.log('[pollAuthenticatedStory] Converting story to HTML');
                console.log('[pollAuthenticatedStory] Story title:', story.title);
                console.log('[pollAuthenticatedStory] Number of pages:', story.pages.length);
                console.log('[pollAuthenticatedStory] Story pages:', JSON.stringify(story.pages, null, 2));
                
                let storyHtml = '';
                if (story.title) {
                  storyHtml += `<h1>${story.title}</h1>\n`;
                }
                
                story.pages.forEach((page, idx) => {
                  console.log('[pollAuthenticatedStory] Processing page', idx + 1, ':', page.text?.substring(0, 50) + '...');
                  // Add page number as heading if there are multiple pages
                  if (story.pages.length > 1) {
                    storyHtml += `<h2>Page ${page.pageNumber || idx + 1}</h2>\n`;
                  }
                  storyHtml += `<p>${page.text}</p>\n`;
                });
                
                console.log('[pollAuthenticatedStory] Final HTML length:', storyHtml.length, 'characters');
                console.log('[pollAuthenticatedStory] HTML preview:', storyHtml.substring(0, 200) + '...');
                
                // Store story data in the format storydetail.html expects
                try {
                  sessionStorage.setItem('yw_story_html', storyHtml);
                  sessionStorage.setItem('yw_current_story', JSON.stringify(story));
                } catch(_) {}
                
                // Directly inject the story HTML instead of reloading
                mobileDebug('🎉 Displaying your story!');
                
                // Find the story content container
                const storyContent = document.getElementById('storyContent');
                const storyTitle = document.getElementById('storyTitle');
                
                if (storyContent) {
                  // Inject the story HTML
                  storyContent.innerHTML = storyHtml;
                  
                  // Update the title if available
                  if (storyTitle && story.title) {
                    storyTitle.textContent = story.title;
                    storyTitle.classList.remove('sr-only');
                  }
                  
                  // Hide any loading messages
                  const loadingMsg = document.querySelector('.loading-message');
                  if (loadingMsg) {
                    loadingMsg.remove();
                  }
                  
                  console.log('[pollAuthenticatedStory] Story displayed successfully!');
                } else {
                  console.warn('[pollAuthenticatedStory] Could not find #storyContent, will reload page');
                  setTimeout(() => {
                    window.location.reload();
                  }, 500);
                }
                
                return; // Stop polling
              } else {
                console.error('[pollAuthenticatedStory] Could not get story data');
                mobileDebug('❌ Could not load story', 'error');
              }
              
            } else if (status === 'failed' || status === 'error') {
              console.error('[pollAuthenticatedStory] Story generation failed');
              mobileDebug('❌ Story generation failed', 'error');
              
              // Clear pending state
              try { 
                sessionStorage.removeItem('yw_pending_story_jobid'); 
              } catch(_) {}
              
              // Show error in storybook
              const stage = storybook?.querySelector('.sb-stage');
              if (stage) {
                stage.innerHTML = `
                  <div class="sb-page" style="display:flex;align-items:center;justify-content:center;flex-direction:column;padding:20px;text-align:center;">
                    <p style="font-weight:700;color:#e63946;margin-bottom:12px;">Story generation failed</p>
                    <p class="muted" style="margin-bottom:20px;">Please try creating a new story.</p>
                    <button class="btn" onclick="window.location.href='create.html'">Create New Story</button>
                  </div>
                `;
              }
            } else if (attempts < maxAttempts) {
              // Still processing, poll again
              setTimeout(poll, 5000); // Poll every 5 seconds
            } else {
              // Max attempts reached
              console.error('[pollAuthenticatedStory] Max polling attempts reached');
              mobileDebug('⏱️ Taking longer than expected...', 'warn');
            }
          } catch (err) {
            console.error('[pollAuthenticatedStory] Error:', err);
            
            if (attempts < maxAttempts) {
              // Retry on error
              setTimeout(poll, 5000);
            } else {
              mobileDebug('❌ Error loading story', 'error');
            }
          }
        };
        
        // Start polling
        poll();
      };
      
      await pollAuthenticatedStory(pendingJobId);
      
    } catch (err) {
      console.error('[initStoryDetail] Error:', err);
      mobileDebug('❌ Error loading story', 'error');
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
    console.log('[openQuickCreate] Fonksiyon çağrıldı');
    mobileDebug('🚀 Quick Create açılıyor...', 'info');
    
    const $ = (s, r=document)=>r.querySelector(s);

    const ov   = $('#quickCreate');
    const step = (name) => $(`.qc-step[data-step="${name}"]`, ov);
    
    console.log('[openQuickCreate] Overlay element:', ov);
    if (!ov) {
      console.error('[openQuickCreate] #quickCreate bulunamadı!');
      mobileDebug('❌ quickCreate bulunamadı!', 'error');
    }

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

      // Build partner's payload and save it for checkout
      const kidAgeNum = parseInt(state.kidAge || "4", 10);
      const guestPayload = {
        language: 'en',
        location: (state.place || 'forest').toLowerCase(),
        child: {
          name: state.kidName || 'Friend',
          age: isNaN(kidAgeNum) ? 4 : Math.max(0, Math.min(12, kidAgeNum)),
          gender: /girl|female/.test((state.kidGender||'').toLowerCase()) ? 'female'
                : /boy|male/.test((state.kidGender||'').toLowerCase())    ? 'male'
                : 'unspecified'
        },
        pet: (state.pets === 'yes') ? {
          species: state.petType || 'pet',
          name: state.petName || 'Buddy'
        } : null
      };
      try { sessionStorage.setItem(K_GUEST_PAYLOAD, JSON.stringify(guestPayload)); } catch (_) {}

      document.body.classList.add("fade-out");
      setTimeout(()=>{ window.location.href = "checkout.html"; }, 100);
    });
  }

   // --- Restore missing helpers so boot doesn't crash ---
function initAgeButtons() {
  const btns = $$(".age-btn");
  if (!btns.length) return;
  btns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const age = (btn.dataset.age || "").toLowerCase();
      setAge(age);
      paintSelectedAge();
      // Open the Quick Create overlay on landing instead of hard-nav
      openQuickCreate();
    });
  });
}

function initAgePreview() {
  // Paint selected state + hero image/text for stored age
  paintSelectedAge();
  updateHeroForAge(getAge());
}

  /* ---------------------------------------------
     Boot — called on every page
  --------------------------------------------- */
  onReady(async () => {
    wireLogoSmartRouting();
     await refreshSession();
    hydrateTopbarAuth();
    guardLandingRedirect();
     guardHomeOnlyForSignedIn();

    initChrome();
    initAgeButtons();
    initAgePreview();
    initMobileCta();

    if (isCreateChatPage()) initCreateChatWizard();
    if (isCheckoutPage())   initCheckout();
    if (isStoryDetailPage()) initStoryDetail();

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

     // Always open Quick Create for any "create" CTA (button or link)
/* ---------------------------------------------
   Quick Create interceptor — SAFE VERSION
--------------------------------------------- */
document.addEventListener('click', (e) => {
  // Only intercept on the landing page (which has the hero-simple)
  const onLanding = !!document.querySelector('.hero-simple');
  if (!onLanding) return;

  const el = e.target.closest('#heroCta, .js-open-create, [data-open-create]');
  if (!el) return;

  // Don’t interfere with the hamburger/menu
  if (e.target.closest('#menuBtn') || e.target.closest('#menu')) return;

  e.preventDefault();
  openQuickCreate();
});

     // ---------------------------------------------
// Hero CTA fallback — ensure "Create your free story" always responds
// ---------------------------------------------
const heroCta = document.getElementById('heroCta');
if (heroCta && !heroCta.dataset.wired) {
  heroCta.addEventListener('click', (e) => {
    e.preventDefault();
    openQuickCreate();
  }, { once: true });
  heroCta.dataset.wired = '1';
}


  });

  // Expose small API for inline handlers if needed
  window.StoryBuds = {
    openAuthModal,
    showGate,
    unlockGate,
    signOut,
    isSignedIn
  };

  // Expose story generation functions for home.html
  window.pollJobUntilComplete = pollJobUntilComplete;
  window.generateAuthenticatedStory = generateAuthenticatedStory;
  window.fetchJob = fetchJob;

   // ===== Story Detail — Voice picker + Play (frontend-only for now) =====
(() => {
  const SS = window.sessionStorage;
  const $  = (s, r=document)=>r.querySelector(s);

  const elPlay  = $('#toggleMic'); // sticky CTA
  const elVoice = $('#voiceBtn');  // pill above CTA
  const storyEl = $('#storyContent');
  if (!elPlay || !elVoice || !storyEl) return;

  // Persisted defaults
  const K_DEFAULT_VOICE = 'yw_voice_default';
  const voicesBuiltin = [
    { id:'warm_en_gb', name:'StoryBuds Warm (en-GB)' },
    { id:'calm_en_gb', name:'StoryBuds Calm (en-GB)' },
    { id:'tr_tr',      name:'StoryBuds Turkish (tr-TR)' }
  ];
  const getDefaultVoice = () => { try { return localStorage.getItem(K_DEFAULT_VOICE) || 'warm_en_gb'; } catch { return 'warm_en_gb'; } };
  const setDefaultVoice = (v) => { try { localStorage.setItem(K_DEFAULT_VOICE, v); } catch {} };

  // Tiny toast
  const toast = (msg) => {
    const n = document.createElement('div');
    n.textContent = msg;
    n.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:110px;background:#1a1f2e;color:#fff;padding:10px 14px;border-radius:999px;box-shadow:0 10px 24px rgba(0,0,0,.2);z-index:999';
    document.body.appendChild(n); setTimeout(()=>n.remove(),1200);
  };

function openVoicePicker() {
  const bar = document.getElementById('stickyCtas');
  const btnPlay  = document.getElementById('toggleMic');
  const btnVoice = document.getElementById('voiceBtn');

  // --- Scroll lock helpers (no layout jump) ---
  let scrollY = 0;
  const lockScroll = () => {
    scrollY = window.scrollY || window.pageYOffset || 0;
    document.documentElement.classList.add('modal-open');
    document.body.classList.add('modal-open');
    // iOS-safe lock
    document.body.style.position = 'fixed';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.top = `-${scrollY}px`;
  };
  const unlockScroll = () => {
    document.documentElement.classList.remove('modal-open');
    document.body.classList.remove('modal-open');
    document.body.style.position = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    const prevTop = document.body.style.top || '0px';
    document.body.style.top = '';
    const y = Math.abs(parseInt(prevTop, 10)) || 0;
    window.scrollTo(0, y);
  };

  const hideCTAs = () => {
    if (bar) bar.classList.add('is-hidden');
    else { btnPlay?.classList.add('is-hidden'); btnVoice?.classList.add('is-hidden'); }
  };
  const showCTAs = () => {
    if (bar) bar.classList.remove('is-hidden');
    else { btnPlay?.classList.remove('is-hidden'); btnVoice?.classList.remove('is-hidden'); }
  };

  // Build overlay + sheet
  const ov = document.createElement('div');
  ov.className = 'v-overlay';
  ov.id = 'vOverlay';

  const sheet = document.createElement('div');
  sheet.className = 'v-sheet';
  sheet.innerHTML = `
    <div class="v-grip" aria-hidden="true"></div>
    <h3 style="margin:0 0 10px;">Choose voice</h3>
    <div id="vlist" style="display:grid;gap:8px"></div>
    <div class="muted" style="margin-top:10px;font-size:13px">
      Want your own voice?
      <button id="cloneBtn" class="btn ghost" style="margin-left:6px">Clone voice (Beta)</button>
    </div>
    <div style="margin-top:12px;text-align:right">
      <button class="btn" id="closeV">Done</button>
    </div>
  `;
  ov.appendChild(sheet);
  document.body.appendChild(ov);

  // Populate voices (same as before)
  const voicesBuiltin = [
    { id:'warm_en_gb', name:'StoryBuds Warm (en-GB)' },
    { id:'calm_en_gb', name:'StoryBuds Calm (en-GB)' },
    { id:'tr_tr',      name:'StoryBuds Turkish (tr-TR)' }
  ];
  const current = (() => { try { return localStorage.getItem('yw_voice_default') || 'warm_en_gb'; } catch { return 'warm_en_gb'; } })();
  const vlist = sheet.querySelector('#vlist');
  [...voicesBuiltin, { id:'user_voice', name:'My voice (Beta)', disabled:true }].forEach(v=>{
    const b = document.createElement('button');
    b.className = 'btn' + (v.id===current ? '' : ' ghost');
    b.disabled = !!v.disabled;
    b.textContent = v.name + (v.disabled ? ' — coming soon' : (v.id===current?'  ✓':''));
    b.style.textAlign = 'left';
    b.addEventListener('click', () => {
      try { localStorage.setItem('yw_voice_default', v.id); } catch {}
      ;[...vlist.children].forEach(x => x.className = 'btn ghost');
      b.className = 'btn';
    });
    vlist.appendChild(b);
  });

  // Open: lock scroll + hide CTAs + reveal
  lockScroll();
  requestAnimationFrame(() => { ov.classList.add('show'); hideCTAs(); });

  // Close helpers
  const teardown = () => {
    ov.classList.remove('show');
    setTimeout(() => {
      ov.remove();
      showCTAs();
      unlockScroll();
      detachBlockers();
    }, 200);
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape') teardown(); };

  // Close on Done / outside click
  sheet.querySelector('#closeV')?.addEventListener('click', teardown);
  ov.addEventListener('click', (e) => { if (e.target === ov) teardown(); });

  // Prevent background scroll while open (wheel/touchmove)
  const block = (e) => { e.preventDefault(); };
  const attachBlockers = () => {
    ov.addEventListener('wheel', block, { passive: false });
    ov.addEventListener('touchmove', block, { passive: false });
    sheet.addEventListener('wheel', block, { passive: false });       // avoid scroll chaining
    sheet.addEventListener('touchmove', block, { passive: false });
  };
  const detachBlockers = () => {
    ov.removeEventListener('wheel', block, { passive: false });
    ov.removeEventListener('touchmove', block, { passive: false });
    sheet.removeEventListener('wheel', block, { passive: false });
    sheet.removeEventListener('touchmove', block, { passive: false });
  };
  attachBlockers();

  // Drag-to-dismiss (prevents scroll while dragging)
  let startY = null, curY = null, dragging = false;
  const THRESHOLD = 80, MAX_PULL = 160;

  const onStart = (y, rawEvent) => {
    dragging = true; startY = y; curY = y;
    sheet.style.transition = 'none';
    rawEvent?.preventDefault();   // stop native scroll start
  };
  const onMove = (y, rawEvent) => {
    if (!dragging) return;
    rawEvent?.preventDefault();   // keep page frozen during drag
    curY = y;
    const dy = Math.max(0, Math.min(MAX_PULL, curY - startY));
    sheet.style.transform = `translateY(${dy}px)`;
    ov.style.opacity = String(Math.max(0.5, 1 - dy / 400));
  };
  const onEnd = () => {
    if (!dragging) return;
    const dy = Math.max(0, curY - startY);
    sheet.style.transition = '';
    ov.style.opacity = '';
    if (dy > THRESHOLD) teardown();
    else sheet.style.transform = ''; // snap back
    dragging = false; startY = curY = null;
  };

  // Mouse
  sheet.addEventListener('mousedown', (e) => onStart(e.clientY, e), { passive: false });
  window.addEventListener('mousemove', (e) => onMove(e.clientY, e), { passive: false });
  window.addEventListener('mouseup', onEnd, { passive: true });

  // Touch
  sheet.addEventListener('touchstart', (e) => onStart(e.changedTouches[0].clientY, e), { passive: false });
  window.addEventListener('touchmove',  (e) => onMove(e.changedTouches[0].clientY, e),  { passive: false });
  window.addEventListener('touchend', onEnd, { passive: true });

  // Keyboard + clone button
  document.addEventListener('keydown', onKey);
  sheet.querySelector('#cloneBtn')?.addEventListener('click', () => {
    alert('🎙️ Voice cloning is nearly ready.\nYou’ll read three 20-second prompts, then we’ll create your voice.');
  });
}



  // Audio playback manager
  let audioPlayback = {
    audioElements: [],
    currentAudioIndex: -1,
    isPlaying: false,
    isPaused: false,
    audioUrls: [],
    playButton: elPlay,
    
    init: function() {
      // Get story data
      const storyData = window.currentStoryData;
      if (!storyData || !storyData.pages) {
        toast('No story available to play');
        return false;
      }
      
      // Extract audio URLs from pages
      this.audioUrls = storyData.pages
        .map(page => page?.audioUrl)
        .filter(url => url && url.trim() !== ''); // Filter out null/undefined/empty URLs
      
      if (this.audioUrls.length === 0) {
        toast('No audio available for this story');
        return false;
      }
      
      // Create audio elements for each URL
      this.audioElements = this.audioUrls.map(url => {
        const audio = new Audio(url);
        audio.preload = 'auto';
        return audio;
      });
      
      return true;
    },
    
    reset: function() {
      // Stop all audio
      this.isPlaying = false;
      this.isPaused = false;
      
      // Stop all audio elements
      this.audioElements.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
      });
      
      // Reset to first page
      if (window.storybookGoToPage) {
        window.storybookGoToPage(0);
      }
      
      // Reset state
      this.currentAudioIndex = -1;
      
      // Update button
      this.updateButton();
    },
    
    play: function() {
      // If paused, resume from where we left off
      if (this.isPaused && this.currentAudioIndex >= 0) {
        this.resume();
        return;
      }
      
      // First play: reset to beginning
      if (this.currentAudioIndex === -1) {
        // Initialize if needed
        if (this.audioElements.length === 0) {
          if (!this.init()) {
            return;
          }
        }
        
        // Reset to first page
        if (window.storybookGoToPage) {
          window.storybookGoToPage(0);
        }
        
        // Reset state but keep audio elements
        this.currentAudioIndex = -1;
      }
      
      this.isPlaying = true;
      this.isPaused = false;
      this.updateButton();
      
      // Start playing from the beginning or continue
      this.playNext();
    },
    
    playNext: function() {
      // Move to next audio
      this.currentAudioIndex++;
      
      // Check if we've finished all audio (after incrementing)
      if (this.currentAudioIndex >= this.audioElements.length) {
        // Finished all audio
        this.onComplete();
        return;
      }
      
      // Update page display - each audio corresponds to one page image
      // Since storybook uses spreads (2 images per spread), we calculate the spread index
      // Audio index 0 = page 0 (spread 0, left)
      // Audio index 1 = page 1 (spread 0, right)  
      // Audio index 2 = page 2 (spread 1, left)
      // Audio index 3 = page 3 (spread 1, right)
      // So: spread = floor(audioIndex / 2)
      const targetPage = Math.floor(this.currentAudioIndex / 2);
      
      // Turn to the appropriate page before playing audio
      if (window.storybookGoToPage && typeof window.storybookGetTotalPages === 'function') {
        const totalPages = window.storybookGetTotalPages();
        if (targetPage < totalPages) {
          window.storybookGoToPage(targetPage);
        }
      }
      
      const audio = this.audioElements[this.currentAudioIndex];
      if (!audio) {
        // Skip if audio doesn't exist and try next
        if (this.currentAudioIndex < this.audioElements.length - 1) {
          this.playNext();
        } else {
          this.onComplete();
        }
        return;
      }
      
      // Set up event listeners for this audio (only once)
      if (!audio.hasListener) {
        audio.onended = () => {
          // Move to next audio when current one ends
          if (this.isPlaying) {
            this.playNext();
          }
        };
        
        audio.onerror = (e) => {
          console.error('Audio playback error:', e);
          // Skip to next on error
          if (this.isPlaying) {
            toast('Error playing audio. Skipping to next...');
            this.playNext();
          }
        };
        
        audio.hasListener = true;
      }
      
      // Play the audio
      if (this.isPlaying) {
        // Small delay to ensure page turn completes
        setTimeout(() => {
          if (this.isPlaying) {
            audio.play().catch(err => {
              console.error('Error playing audio:', err);
              // Skip to next on error
              if (this.isPlaying) {
                toast('Error playing audio. Skipping to next...');
                this.playNext();
              }
            });
          }
        }, 200);
      }
    },
    
    pause: function() {
      if (!this.isPlaying) return;
      
      this.isPaused = true;
      this.isPlaying = false;
      
      // Pause current audio if playing
      if (this.currentAudioIndex >= 0 && this.audioElements[this.currentAudioIndex]) {
        this.audioElements[this.currentAudioIndex].pause();
      }
      
      this.updateButton();
    },
    
    resume: function() {
      if (!this.isPaused) return;
      
      this.isPlaying = true;
      this.isPaused = false;
      
      // Resume current audio
      if (this.currentAudioIndex >= 0 && this.audioElements[this.currentAudioIndex]) {
        this.audioElements[this.currentAudioIndex].play().catch(err => {
          console.error('Error resuming audio:', err);
          this.playNext(); // If resume fails, try next
        });
      } else {
        // If no current audio, start from beginning
        this.playNext();
      }
      
      this.updateButton();
    },
    
    stop: function() {
      this.isPlaying = false;
      this.isPaused = false;
      
      // Stop all audio elements
      this.audioElements.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
        audio.onended = null;
        audio.onerror = null;
      });
      
      this.updateButton();
    },
    
    onComplete: function() {
      this.isPlaying = false;
      this.isPaused = false;
      this.updateButton();
      
      toast('✨ Story finished! Click play to listen again.');
      
      // Reset after a short delay
      setTimeout(() => {
        this.reset();
      }, 1000);
    },
    
    updateButton: function() {
      if (!this.playButton) return;
      
      if (this.isPlaying) {
        this.playButton.textContent = '⏸️ Pause story';
      } else if (this.isPaused) {
        this.playButton.textContent = '▶️ Resume story';
      } else {
        this.playButton.textContent = '▶️ Play story';
      }
    },
    
    toggle: function() {
      if (this.isPlaying) {
        this.pause();
      } else {
        this.play();
      }
    }
  };

  // One-tap Play
  async function playStoryNow() {
    audioPlayback.toggle();
  }

  elVoice.addEventListener('click', openVoicePicker);
  elPlay.addEventListener('click', playStoryNow);
})();

   
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

/* =====================================================
   Real Book Page-Turning Animation
===================================================== */
(() => {
  const storybook = document.getElementById('storybook');
  if (!storybook) return;

  let bookContainer = storybook.querySelector('.sb-book');
  const prevBtn = document.getElementById('sbPrev');
  const nextBtn = document.getElementById('sbNext');
  const dotsContainer = document.getElementById('sbDots');
  
  if (!bookContainer) {
    const stage = storybook.querySelector('.sb-stage');
    if (stage) {
      stage.innerHTML = '<div class="sb-book"></div>';
      bookContainer = stage.querySelector('.sb-book');
    }
  }
  
  if (!bookContainer || !prevBtn || !nextBtn || !dotsContainer) return;

  let currentPage = 0;
  let pages = [];
  let isAnimating = false;
  
  // Expose goToPage globally for audio playback control
  window.storybookGoToPage = function(targetIndex) {
    goToPage(targetIndex);
  };
  
  // Expose getCurrentPage for audio playback
  window.storybookGetCurrentPage = function() {
    return currentPage;
  };
  
  // Expose getTotalPages for audio playback
  window.storybookGetTotalPages = function() {
    return pages.length;
  };

  // Initialize with demo book pages
  function initStorybook() {
    const demoPages = [
      { 
        leftBg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        rightBg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        leftText: '📖 Page 1',
        rightText: '📖 Page 2'
      },
      {
        leftBg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        rightBg: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        leftText: '📖 Page 3',
        rightText: '📖 Page 4'
      },
      {
        leftBg: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
        rightBg: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
        leftText: '📖 Page 5',
        rightText: '📖 Page 6'
      }
    ];

    bookContainer.innerHTML = '';
    bookContainer.classList.add('breathing');
    pages = [];

    demoPages.forEach((pageData, idx) => {
      const pageSpread = document.createElement('div');
      pageSpread.className = 'sb-page';
      if (idx === 0) pageSpread.classList.add('active');
      pageSpread.setAttribute('data-idx', idx);

      const leftPage = document.createElement('div');
      leftPage.className = 'sb-page-left';
      leftPage.style.background = pageData.leftBg;
      leftPage.innerHTML = `<div style="font-size: 28px; font-weight: 700; color: white; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">${pageData.leftText}</div>`;

      const rightPage = document.createElement('div');
      rightPage.className = 'sb-page-right';
      rightPage.style.background = pageData.rightBg;
      rightPage.innerHTML = `<div style="font-size: 28px; font-weight: 700; color: white; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">${pageData.rightText}</div>`;

      pageSpread.appendChild(leftPage);
      pageSpread.appendChild(rightPage);
      bookContainer.appendChild(pageSpread);
      pages.push(pageSpread);
    });

    dotsContainer.innerHTML = '';
    demoPages.forEach((_, idx) => {
      const dot = document.createElement('button');
      dot.setAttribute('aria-current', idx === 0 ? 'true' : 'false');
      dot.setAttribute('aria-label', `Go to spread ${idx + 1}`);
      dot.addEventListener('click', () => goToPage(idx));
      dotsContainer.appendChild(dot);
    });

    updateNavigationState();
  }

  // Navigate to spread
  function goToPage(targetIndex) {
    if (isAnimating || targetIndex === currentPage || targetIndex < 0 || targetIndex >= pages.length) {
      return;
    }

    bookContainer.classList.remove('breathing');
    isAnimating = true;
    
    const direction = targetIndex > currentPage ? 'forward' : 'backward';
    const oldPageIndex = currentPage;
    
    // Prepare target page first (before removing classes from current page)
    // This ensures the target page is ready to be visible
    const targetPageEl = pages[targetIndex];
    if (targetPageEl) {
      targetPageEl.classList.remove('turning', 'turning-back', 'flipped');
      targetPageEl.classList.add('active');
      targetPageEl.style.zIndex = '15'; // Behind turning page but visible
    }
    
    // Set other pages to their states
    pages.forEach((page, idx) => {
      if (idx === targetIndex) return; // Already handled above
      
      page.classList.remove('active', 'turning', 'turning-back');
      
      if (idx < targetIndex) {
        page.classList.add('flipped');
        page.style.zIndex = '1';
      } else {
        page.style.zIndex = '1';
      }
    });

    // Remove turning class from old page if it exists (clean slate)
    const oldPageEl = pages[oldPageIndex];
    if (oldPageEl) {
      oldPageEl.classList.remove('turning', 'turning-back');
    }
    
    // Force a synchronous reflow to ensure all DOM updates are applied
    void bookContainer.offsetHeight;
    
    // Start animation IMMEDIATELY after reflow
    if (direction === 'forward') {
      // Turn forward: animate the current (old) page's right side
      if (oldPageEl) {
        oldPageEl.style.zIndex = '200'; // Turning page on top
        oldPageEl.classList.add('turning');
      }
    } else {
      // Turn backward: animate the previous page back
      if (oldPageIndex > 0 && pages[oldPageIndex - 1]) {
        pages[oldPageIndex - 1].style.zIndex = '200';
        pages[oldPageIndex - 1].classList.add('turning-back');
      }
    }

    currentPage = targetIndex;

    setTimeout(() => {
      // Clean up z-index overrides and finalize states
      pages.forEach((page, idx) => {
        page.style.zIndex = '';
        
        if (idx < targetIndex) {
          if (!page.classList.contains('flipped')) {
            page.classList.add('flipped');
          }
        } else if (idx === targetIndex) {
          if (!page.classList.contains('active')) {
            page.classList.add('active');
          }
        } else {
          page.classList.remove('turning', 'turning-back');
        }
      });
      
      updateNavigationState();
      isAnimating = false;
      bookContainer.classList.add('breathing');
    }, 850);
  }

  function updateNavigationState() {
    prevBtn.disabled = currentPage === 0;
    nextBtn.disabled = currentPage === pages.length - 1;

    const dots = dotsContainer.querySelectorAll('button');
    dots.forEach((dot, idx) => {
      dot.setAttribute('aria-current', idx === currentPage ? 'true' : 'false');
    });
  }

  // Event listeners
  prevBtn.addEventListener('click', () => goToPage(currentPage - 1));
  nextBtn.addEventListener('click', () => goToPage(currentPage + 1));

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') goToPage(currentPage - 1);
    else if (e.key === 'ArrowRight') goToPage(currentPage + 1);
  });

  // Touch swipe
  let touchStartX = 0;
  bookContainer.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  bookContainer.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].screenX;
    const diff = touchStartX - touchEndX;
    const swipeThreshold = 50;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) goToPage(currentPage + 1);
      else goToPage(currentPage - 1);
    }
  }, { passive: true });

  // Preload images to ensure smooth animations
  function preloadImage(url) {
    if (!url) return;
    const img = new Image();
    img.src = url;
  }

  // API to update with real story images
  window.updateStorybookPages = function(imageUrls) {
    if (!Array.isArray(imageUrls) || imageUrls.length === 0) return;

    // Preload all images immediately for smooth page turning
    imageUrls.forEach(url => {
      if (url) preloadImage(url);
    });

    bookContainer.innerHTML = '';
    pages = [];
    currentPage = 0;

    // Convert single images into spreads (2 images per spread)
    for (let i = 0; i < imageUrls.length; i += 2) {
      const pageSpread = document.createElement('div');
      pageSpread.className = 'sb-page';
      if (i === 0) pageSpread.classList.add('active');
      pageSpread.setAttribute('data-idx', i / 2);

      const leftPage = document.createElement('div');
      leftPage.className = 'sb-page-left';
      leftPage.style.backgroundImage = `url(${imageUrls[i]})`;
      leftPage.style.backgroundSize = 'cover';
      leftPage.style.backgroundPosition = 'center';

      const rightPage = document.createElement('div');
      rightPage.className = 'sb-page-right';
      if (imageUrls[i + 1]) {
        rightPage.style.backgroundImage = `url(${imageUrls[i + 1]})`;
        rightPage.style.backgroundSize = 'cover';
        rightPage.style.backgroundPosition = 'center';
      }

      pageSpread.appendChild(leftPage);
      pageSpread.appendChild(rightPage);
      bookContainer.appendChild(pageSpread);
      pages.push(pageSpread);
    }

    dotsContainer.innerHTML = '';
    pages.forEach((_, idx) => {
      const dot = document.createElement('button');
      dot.setAttribute('aria-current', idx === 0 ? 'true' : 'false');
      dot.setAttribute('aria-label', `Go to spread ${idx + 1}`);
      dot.addEventListener('click', () => goToPage(idx));
      dotsContainer.appendChild(dot);
    });

    updateNavigationState();
  };

  initStorybook();
})();
