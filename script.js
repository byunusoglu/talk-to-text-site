"use strict";

/* =====================================================
   Your World — unified interactions (API story on checkout)
   (Legacy stepper/simple UIs removed)
===================================================== */
(() => {
  const AGE_KEY = "yw_age_group";          // '0-2' | '3-5' | '5+'
  const DEFAULT_AGE = "0-2";
  const API_URL = "https://fairytale-api.vercel.app/api/generate-story";
  const SS = window.sessionStorage;

  // keys used on navigation to checkout
  const K_TRANSCRIPT = "yw_transcript";
  const K_STORY_MD   = "yw_story_markdown";
  const K_STORY_HTML = "yw_story_html";

  // ---------- tiny DOM helpers ----------
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const onReady = (fn) => (document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", fn, { once: true })
    : fn());
  const fadeOutAnd = (cb, delay = 150) => {
    try { document.body.classList.add("fade-out"); } catch (_) {}
    setTimeout(cb, delay);
  };

  // ---------- age persistence ----------
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

  // Preload hero images for fast swaps
  ["momdaughterbanner.png","childsdreambanner.png","grownbanner.png"]
    .forEach(src => { const img = new Image(); img.src = src; });

   // Try transparent cut-out first; fall back to current assets
const HERO_BY_AGE = {
  "0-2": {
    imageCut: "momdaughter_cut.png",
    image:    "momdaughterbanner.png",
    title: "Create magical fairytales together.",
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

  
  // ---------- page guards ----------
  const isCreateChatPage = () => Boolean($('#chatWizard'));
  const isCheckoutPage   = () => Boolean($('#storyContent') && $('#productsTrack'));
  const goCheckout       = () => fadeOutAnd(() => { window.location.href = "checkout.html"; });

  // ---------- markdown → minimal HTML (safe-ish) ----------
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

  // ---------- Landing: age buttons ----------
  function initAgeButtons() {
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

  // Hover preview (kept)
  function initAgePreview() {
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

  // ---------- API call + stash story + go checkout ----------
  async function generateStoryAndNavigate(transcript) {
    if (!transcript) throw new Error("Missing transcript");
    const body = {
      transcript,
      ageGroup: getAge()
    };
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

  // ---------- Conversational Wizard ----------
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

  // ---------- Checkout: render story + products ----------
  let cartCount = 0;
  function initCheckout() {
    const storyEl = $('#storyContent');
    if (!storyEl) return;

    const html = SS.getItem(K_STORY_HTML);
    const md   = SS.getItem(K_STORY_MD);
    storyEl.innerHTML = html || "<p>Your story will appear here after generation.</p>";

    const rawMdEl = $('#storyMarkdown');
    if (rawMdEl && md) rawMdEl.textContent = md;

    const productsTrack = $('#productsTrack');
    if (productsTrack) {
      const age = getAge();
      const products = getProductsForAge(age);
      renderProducts(productsTrack, products);
    }
  }

  // ---------- Products data per age ----------
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

  // ---------- minor chrome ----------
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
  const hero = $(".hero"); // anchor to split hero root
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

 // --- Scroll morph: Real → Animated (soft stop + center-based reveal)
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

  // ---------- helpers ----------
  const stage = wrap.querySelector('.morph-stage');
  if (!stage) return;

  function setVars(reveal, parallax) {
    // set on stage so descendants reliably inherit during sticky/lock
    stage.style.setProperty('--reveal', String(reveal));
    stage.style.setProperty('--parallax', String(parallax));
  }

function computeReveal() {
  const s = stage.getBoundingClientRect();
  const vh = window.innerHeight || 1;
  const center = vh / 2;
  const stageCenter = s.top + s.height / 2;

  const dist = Math.abs(stageCenter - center);

  // WIDER radius → fade spans more scroll distance
  // was vh * 0.5; now vh * 0.9 for a slower, longer transition
const R = vh * 1.2;

  // linear map: 1 at center → 0 at/beyond radius
  let r = 1 - Math.min(1, dist / R);

  // optional tiny easing for smoothness (uncomment to taste)
  // r = Math.pow(r, 0.9);

  const parallax = 12 * (1 - r);
  setVars(r, parallax);
  return { reveal: r, vh };
}

  // ---------- lock mechanics (unchanged: single soft stop per pass) ----------
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

  // ---------- main loop ----------
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

    // trigger a single soft stop when near the center band and armed
    // only while we're meaningfully inside the section (reveal ~ [0.1, 0.9])
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


  // ---------- boot ----------
onReady(() => {
  initChrome();
  initAgeButtons();
  initAgePreview();
  initMobileCta();
  if (isCreateChatPage()) initCreateChatWizard();
  if (isCheckoutPage())   initCheckout();
  initTestimonials();
  initScrollMorph();
  initHeroParallax(); // restore
});
})();
