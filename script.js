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

      ["momdaughterbanner.png","childsdreambanner.png","grownbanner.png"]
  .forEach(src => { const img = new Image(); img.src = src; });

  // ---------- Hero per age (live-swap on landing) ----------
  const HERO_BY_AGE = {
    "0-2": {
      image: "momdaughterbanner.png",
      title: "Create magical fairytales together.",
      desc:  "Turn your child’s imagination into their favourite storytime moment — every night.",
      cta:   "Create story"
    },
    "3-5": {
      image: "childsdreambanner.png",
      title: "Create magical bedtime stories together.",
      desc:  "Turn your child’s imagination into their favourite storytime moment — every night.",
      cta:   "Create story"
    },
    "5+": {
      image: "grownbanner.png",
      title: "Create superhero stories together.",
      desc:  "Turn your child’s imagination into their favourite storytime moment — every night.",
      cta:   "Create story"
    }
  };


  function updateHeroForAge(ageRaw) {
    try {
      const age = (ageRaw || DEFAULT_AGE).trim();
      const cfg = HERO_BY_AGE[age] || HERO_BY_AGE[DEFAULT_AGE];
      const banner = document.querySelector(".hero-banner");
      const title  = document.getElementById("heroTitle");
      const desc   = document.getElementById("heroDesc");
      const cta    = document.getElementById("heroCta");
      if (banner && cfg.image) banner.style.backgroundImage = `url('${cfg.image}')`;
      if (title) title.textContent = cfg.title;
      if (desc)  desc.textContent  = cfg.desc;
      if (cta) {
        cta.textContent = cfg.cta;
        cta.onclick = () => fadeOutAnd(() => { window.location.href = "create.html"; });
      }
    } catch (_) {}
  }

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
    // Ensure hero matches current selection on load
    updateHeroForAge(getAge());
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".age-btn");
      if (!btn) return;
      const raw = (btn.dataset.age || "").trim();
      const val = (raw === "0-2" || raw === "3-5" || raw === "5+") ? raw : DEFAULT_AGE;
      setAge(val);
      $$(".age-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      // Live update hero (image + overlay + CTA label). No navigation here.
      updateHeroForAge(val);
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
      `Special moments: ${fields.moments || "—"}`,
      `Characters: ${fields.char1 || "—"} ${fields.char2 ? " & " + fields.char2 : ""}`,
      `Extras: ${fields.extras || "—"}`
    ].join("\n");
  }

  // ---------- Create: collect transcript (Simple UI) ----------
  function collectTranscriptFromSimple() {
    const txt = $('#storyInput')?.value?.trim() || "";
    return txt || "No parent–child conversation transcript provided.";
  }

  // ---------- API call + stash story + go checkout ----------
  async function generateStoryAndNavigate(transcript) {
    if (!transcript) throw new Error("Missing transcript");
    const body = {
      transcript,
      ageGroup: getAge(),
      childName: ($('#kidName')?.value || "").trim()
    };
    // optimistic UI
    const btn = $('#generateBtn');
    const spinner = $('#genSpinner');
    try {
      btn && (btn.disabled = true);
      spinner && spinner.classList.remove('hidden');

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);

      const data = await res.json();
      const md   = data?.markdown || "";
      const html = mdToHtml(md);

      try { SS.setItem(K_TRANSCRIPT, transcript); } catch (_) {}
      try { SS.setItem(K_STORY_MD, md); } catch (_) {}
      try { SS.setItem(K_STORY_HTML, html); } catch (_) {}

      goCheckout();
    } catch (err) {
      console.error(err);
      alert("Sorry, we couldn't generate the story. Please try again.");
    } finally {
      btn && (btn.disabled = false);
      spinner && spinner.classList.add('hidden');
    }
  }

  // ---------- Create: Stepper UI wiring ----------
  function initCreateStepper() {
    const form = $('#createForm');
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
        s.classList.toggle('done', i < current);
      });
      btnPrev?.classList.toggle('hidden', current === 0);
      btnNext?.classList.toggle('hidden', current === last);
      btnGen?.classList.toggle('hidden', current !== last);
    };

    btnPrev?.addEventListener('click', () => { if (current > 0) { current--; render(); }});
    btnNext?.addEventListener('click', () => { if (current < last) { current++; render(); }});
    btnGen?.addEventListener('click', async (e) => {
      e.preventDefault();
      const transcript = collectTranscriptFromStepper();
      await generateStoryAndNavigate(transcript);
    });

    render();
  }

  // ---------- Create: Simple UI wiring ----------
  function initCreateSimple() {
    const input = $('#storyInput');
    const btn   = $('#generateBtn');
    if (!input || !btn) return;

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const transcript = collectTranscriptFromSimple();
      await generateStoryAndNavigate(transcript);
    });
  }

  // ---------- Checkout: render story + products ----------
  function initCheckout() {
    const storyEl = $('#storyContent');
    if (!storyEl) return;

    const html = SS.getItem(K_STORY_HTML);
    const md   = SS.getItem(K_STORY_MD);
    storyEl.innerHTML = html || "<p>Your story will appear here after generation.</p>";

    // Optional: show raw markdown if needed
    const rawMdEl = $('#storyMarkdown');
    if (rawMdEl && md) rawMdEl.textContent = md;

    // Products carousel (age-based)
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
      return [
        { id: "bb1", name: "Soft Plush Toy", price: "£8.00" },
        ...base
      ];
    } else if (age === "3-5") {
      return [
        { id: "pb1", name: "Picture Book (A3)", price: "£11.00" },
        ...base
      ];
    } else {
      return [
        { id: "ac1", name: "Activity Cards", price: "£7.00" },
        ...base
      ];
    }
  }

  function renderProducts(track, items) {
    track.innerHTML = "";
    for (const it of items) {
      const card = document.createElement("div");
      card.className = "product-card";
      card.innerHTML = `
        <div class="product-name">${it.name}</div>
        <div class="product-price">${it.price}</div>
        <button class="btn product-cta" data-id="${it.id}">Add</button>
      `;
      track.appendChild(card);
    }
    track.addEventListener("click", (e) => {
      const btn = e.target.closest(".product-cta");
      if (!btn) return;
      let cartCount = 0;
const cartCountEl = document.getElementById("cartCount");

function updateCartCountDisplay() {
  if (!cartCountEl) return;
  if (cartCount > 0) {
    cartCountEl.textContent = cartCount;
    cartCountEl.classList.remove("hidden");
  } else {
    cartCountEl.classList.add("hidden");
  }
}

track.addEventListener("click", (e) => {
  const btn = e.target.closest(".product-cta");
  if (!btn) return;
  cartCount++;
  updateCartCountDisplay();

  // Optional subtle feedback
  const cartBtn = document.getElementById("cartBtn");
  if (cartBtn) {
    cartBtn.classList.add("shake");
    setTimeout(() => cartBtn.classList.remove("shake"), 500);
  }
});
    }, { passive: false });
  }

  // ---------- minor chrome ----------
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
