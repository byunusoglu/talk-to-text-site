"use strict";

/* =====================================================
   Your World — unified interactions (API story on checkout)
   - Landing: age pills → create
   - Create (both UIs supported):
       A) Stepper form (#createForm + #generateBtn)  :contentReference[oaicite:0]{index=0}
       B) Simple textarea (#storyInput + #generateBtn) :contentReference[oaicite:1]{index=1}
     -> Calls your API, stashes story in sessionStorage, then goes to checkout
   - Checkout: reads story from sessionStorage and renders into #storyContent  :contentReference[oaicite:2]{index=2}
   - Products: age-tailored carousel rendered into #productsTrack  :contentReference[oaicite:3]{index=3}
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

  // ---------- page guards ----------
  const isCreateStepperPage = () => Boolean($('#createForm'));                 // :contentReference[oaicite:4]{index=4}
  const isCreateSimplePage  = () => Boolean($('#storyInput') && $('#generateBtn')); // :contentReference[oaicite:5]{index=5}
  const isCheckoutPage      = () => Boolean($('#storyContent') && $('#productsTrack')); // :contentReference[oaicite:6]{index=6}
  const goCheckout          = () => fadeOutAnd(() => { window.location.href = "checkout.html"; });

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
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".age-btn");
      if (!btn) return;
      const raw = (btn.dataset.age || "").trim();
      setAge(raw === "0-2" || raw === "3-5" || raw === "5+" ? raw : DEFAULT_AGE);
      $$(".age-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      fadeOutAnd(() => { window.location.href = "create.html"; });
    }, { passive: false });
  }

  // ---------- Create: collect transcript (Stepper UI) ----------
  function collectTranscriptFromStepper() {
    // IDs from your stepper create.html  :contentReference[oaicite:7]{index=7}
    const fields = {
      name:   $('#kidName')?.value?.trim(),
      age:    $('#kidAge')?.value?.trim(),
      likes:  $('#kidLikes')?.value?.trim(),
      theme:  $('#theme')?.value?.trim(),
      moments:$('#moments')?.value?.trim(),
      char1:  $('#char1')?.value?.trim(),
      char2:  $('#char2')?.value?.trim(),
      extras: $('#extras')?.value?.trim()
    };
    return [
      `Child name: ${fields.name || "Unknown"}`,
      `Child age: ${fields.age || "—"}`,
      `Likes: ${fields.likes || "—"}`,
      `Theme: ${fields.theme || "—"}`,
      `Key moments: ${fields.moments || "—"}`,
      `Characters: ${[fields.char1, fields.char2].filter(Boolean).join(", ") || "—"}`,
      `Extras: ${fields.extras || "—"}`
    ].join("\n");
  }

  // ---------- Create: Stepper flow + API call ----------
  function initCreateStepper() {
    const form    = $('#createForm');
    if (!form) return;

    const panels  = $$('.step-panel', form);
    const steps   = $$('.stepper .step', form);
    const btnPrev = $('#prevStep');
    const btnNext = $('#nextStep');
    const btnGen  = $('#generateBtn');

    let current = Math.max(0, panels.findIndex(p => !p.classList.contains('hidden')));
    if (current === -1) current = 0;
    const last = panels.length - 1;

    const render = () => {
      panels.forEach((p, i) => p.classList.toggle('hidden', i !== current));
      steps.forEach((s, i) => {
        s.classList.toggle('active', i === current);
        s.classList.toggle('done',   i < current);
      });
      btnPrev.classList.toggle('hidden', current === 0);
      btnNext.classList.toggle('hidden', current === last);
      btnGen .classList.toggle('hidden', current !== last);
    };

    btnPrev.addEventListener('click', (e) => { e.preventDefault(); if (current > 0) { current--; render(); } });
    btnNext.addEventListener('click', (e) => { e.preventDefault(); if (current < last) { current++; render(); } });

    // Generate → CALL API → stash → checkout
    btnGen.addEventListener('click', async (e) => {
      e.preventDefault();
      const loading = $('#loading'); // exists under the form  :contentReference[oaicite:8]{index=8}
      const transcript = collectTranscriptFromStepper();
      try { SS.setItem(K_TRANSCRIPT, transcript); } catch (_) {}

      btnGen.disabled = true; if (loading) loading.classList.remove('hidden');
      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript })
        });
        const data = await res.json();
        const md = data.story || "";
        const html = mdToHtml(md);
        try { SS.setItem(K_STORY_MD, md); SS.setItem(K_STORY_HTML, html); } catch (_) {}
        goCheckout();
      } catch (err) {
        alert("Couldn’t generate the story right now. Please try again.");
      } finally {
        btnGen.disabled = false; if (loading) loading.classList.add('hidden');
      }
    });

    // Enter key: next, final → generate
    form.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const active = document.activeElement;
      if (active && active.tagName === 'TEXTAREA') return;
      e.preventDefault();
      if (current < last) { current++; render(); } else { btnGen.click(); }
    });

    render();
  }

  // ---------- Create: Simple textarea UI (legacy) ----------
  function initCreateSimple() {
    const input   = $('#storyInput');    // textarea  :contentReference[oaicite:9]{index=9}
    const button  = $('#generateBtn');
    const loading = $('#loading');
    if (!(input && button)) return;

    button.addEventListener('click', async () => {
      const transcript = (input.value || "").trim();
      if (!transcript) { alert("Please describe your story idea first!"); return; }
      try { SS.setItem(K_TRANSCRIPT, transcript); } catch (_) {}

      button.disabled = true; loading?.classList.remove('hidden');
      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript })
        });
        const data = await res.json();
        const md = data.story || "";
        const html = mdToHtml(md);
        try { SS.setItem(K_STORY_MD, md); SS.setItem(K_STORY_HTML, html); } catch (_) {}
        goCheckout();
      } catch {
        alert("Error connecting to the story generator.");
      } finally {
        button.disabled = false; loading?.classList.add('hidden');
      }
    });
  }

  // ---------- Checkout: show story + products ----------
  function initCheckout() {
    const storyEl = $('#storyContent');                                       // :contentReference[oaicite:10]{index=10}
    const hero    = $('#storyHero');                                          // :contentReference[oaicite:11]{index=11}
    const track   = $('#productsTrack');
    if (!storyEl || !track) return;

    // Age-based hero background (matches your CSS .bg-0-2 / .bg-3-5 / .bg-5-plus) :contentReference[oaicite:12]{index=12}
    if (hero) {
      const age = getAge();
      hero.classList.remove('bg-0-2','bg-3-5','bg-5-plus');
      hero.classList.add(age === '0-2' ? 'bg-0-2' : age === '3-5' ? 'bg-3-5' : 'bg-5-plus');
    }

    // Prefer the real story generated by API (saved on create)
    let html = "";
    try { html = SS.getItem(K_STORY_HTML) || ""; } catch (_) {}
    if (!html) {
      // Fallback: try to render markdown if present
      try {
        const md = SS.getItem(K_STORY_MD) || "";
        if (md) html = mdToHtml(md);
      } catch (_) {}
    }
    if (!html) {
      // Last resort sample (should be rare)
      html = mdToHtml(
        "# A Cozy First Story\n\nOnce upon a time, a small explorer and their family took a gentle walk where the leaves went *whoosh* and puddles went *plip-plop*. They helped each other and felt safe. **Sleep tight.**"
      );
    }
    storyEl.innerHTML = html;

    // Products: age-tailored (more relevant than generic)
    const age = getAge();
    const base = [
      { id:"starter",  title:"Starter Pack", desc:"3 personalised bedtime stories", price:"£3.99", old:"£5.99", cta:"Add to cart" },
      { id:"monthly",  title:"Monthly Plan", desc:"Unlimited stories + voice mode", price:"£6.99/mo", old:"",     cta:"Start 7-day trial" },
    ];
    const byAge = {
      "0-2": [
        { id:"picture",  title:"Picture-Book Mode", desc:"Fewer words, bigger images",    price:"£1.49", old:"", cta:"Add to cart" },
        { id:"lullaby",  title:"Calm Sounds Pack",  desc:"Soft lullaby background",       price:"£1.29", old:"", cta:"Add to cart" },
      ],
      "3-5": [
        { id:"adventure",title:"Adventure Add-ons", desc:"Extra playful scenes",          price:"£1.99", old:"£2.49", cta:"Add to cart" },
        { id:"bilingual",title:"TR/EN Bilingual",   desc:"English & Turkish versions",     price:"£1.99", old:"",     cta:"Add to cart" },
      ],
      "5+": [
        { id:"reader",   title:"Early Reader Pack", desc:"Bigger paragraphs + phonics tips", price:"£2.49", old:"",  cta:"Add to cart" },
        { id:"stem",     title:"Curious Minds",     desc:"Gentle STEM-flavoured mini facts", price:"£1.99", old:"",  cta:"Add to cart" },
      ]
    };
    const products = [...base, ...(byAge[age] || byAge["3-5"])];

    track.innerHTML = products.map(p => `
      <article class="product-card">
        <div class="product-body">
          <h3>${p.title}</h3>
          <p class="muted">${p.desc}</p>
          <div class="price-row">
            <span class="price">${p.price}</span>
            ${p.old ? `<span class="price-old">${p.old}</span>` : ""}
          </div>
          <button class="btn add-btn" data-add="${p.id}">${p.cta}</button>
        </div>
      </article>
    `).join("");

    // Carousel controls (prev/next)  :contentReference[oaicite:13]{index=13}
    const prev = $('#prevCarousel');
    const next = $('#nextCarousel');
    const scrollByPx = () => Math.max(track.clientWidth * 0.8, 240);
    prev?.addEventListener('click', () => track.scrollBy({ left: -scrollByPx(), behavior: 'smooth' }));
    next?.addEventListener('click', () => track.scrollBy({ left:  scrollByPx(), behavior: 'smooth' }));

    // Tiny cart count bump (top bar)
    const cartCount = $('#cartCount');
    track.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-add]');
      if (!btn) return;
      const n = Number(cartCount?.textContent || '0') + 1;
      if (cartCount) cartCount.textContent = String(n);
      btn.textContent = 'Added ✓';
      setTimeout(() => (btn.textContent = 'Added ✓'), 600);
    });
  }

  // ---------- Topbar + footer year (shared) ----------
  function initChrome() {
    const menuBtn = $('#menuBtn');
    const menu = $('#menu');
    menuBtn?.addEventListener('click', () => menu?.classList.toggle('hidden'));
    const yearEl = $('#year'); if (yearEl) yearEl.textContent = new Date().getFullYear();
  }

  // ---------- boot ----------
  onReady(() => {
    initChrome();
    initAgeButtons();
    if (isCreateStepperPage()) initCreateStepper();   // stepper create
    if (isCreateSimplePage())  initCreateSimple();    // simple create
    if (isCheckoutPage())      initCheckout();        // checkout rendering
  });
})();