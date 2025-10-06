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
    const hero = $(".hero-banner");
    if (!cta || !hero) return;
    function onScroll() {
      const rect = hero.getBoundingClientRect();
      if (window.scrollY > rect.height * 0.5) cta.classList.add("show");
      else cta.classList.remove("show");
    }
    window.addEventListener("scroll", onScroll, { passive: true });
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

  // ---------- boot ----------
  onReady(() => {
    initChrome();
    initAgeButtons();
    initAgePreview();
    initMobileCta();
    if (isCreateChatPage()) initCreateChatWizard();  // ← only create UI now
    if (isCheckoutPage())   initCheckout();
    initTestimonials();
  });
})();
