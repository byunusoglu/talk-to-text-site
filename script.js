"use strict";

/* =====================================================
   Your World — unified front-end interactions
   - Menu, footer year, testimonials (home)
   - Landing: age pills → create
   - Create: stepper (Next/Back/Generate → checkout)
   - Checkout: story render + products carousel + age-based hero
===================================================== */
(() => {
  const AGE_KEY = "yw_age_group";         // '0-2' | '3-5' | '5+'
  const DEFAULT_AGE = "0-2";
  const STORY_KEY = "yw_story";           // sessionStorage payload for preview story

  // ---------- tiny DOM helpers ----------
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const onReady = (fn) => (document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", fn, { once: true })
    : fn()
  );
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
    const buttons = $$(".age-btn");
    if (!buttons.length) return;
    buttons.forEach((b) => b.classList.remove("selected"));
    const match = buttons.find((b) => (b.dataset.age || "").toLowerCase() === current);
    (match || buttons[0]).classList.add("selected");
  };

  // ---------- page guards ----------
  const isCreatePage = () =>
    Boolean($('#nextStep') || $('#prevStep') || $('#generateBtn') || $('.create-step') || $('#createForm'));
  const isCheckoutPage = () =>
    Boolean($('#storyContent') || $('#productsTrack') || $('#storyHero')); // all exist on checkout page
  const goCheckout = () => fadeOutAnd(() => { window.location.href = "checkout.html"; });

  // ---------- global header/footer bits ----------
  function initChrome() {
    const menuBtn = $('#menuBtn');
    const menu = $('#menu');
    if (menuBtn && menu) menuBtn.addEventListener('click', () => menu.classList.toggle('hidden'));

    const yearEl = $('#year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  }

  // ---------- homepage testimonials ----------
  function initHomepageTestimonials() {
    const tEl = $('#testimonialText');
    if (!tEl) return;
    const testimonials = [
      "“Our 4-year-old asks for ‘dino kitty’ every night now. It feels like she’s writing it with us.” — <b>Elif</b>",
      "“Finally a screen-free wind-down that works. He loves hearing his own ideas show up.” — <b>James</b>",
      "“A calm five-minute story that’s always gentle. Instant favourite.” — <b>Priya</b>"
    ];
    let i = 0;
    setInterval(() => {
      i = (i + 1) % testimonials.length;
      tEl.style.opacity = 0;
      setTimeout(() => { tEl.innerHTML = testimonials[i]; tEl.style.opacity = 1; }, 400);
    }, 6000);
  }

  // ---------- landing age buttons ----------
  function initAgeButtons() {
    paintSelectedAge();
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".age-btn");
      if (!btn) return;
      const raw = (btn.dataset.age || "").trim();
      const safe = raw === "0-2" || raw === "3-5" || raw === "5+" ? raw : DEFAULT_AGE;
      setAge(safe);
      $$(".age-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      const next = btn.dataset.target || "create.html";
      fadeOutAnd(() => { window.location.href = next; });
    }, { passive: false });
  }

  // ---------- Create stepper ----------
  function initCreateStepper() {
    const form    = $('#createForm') || document;
    const panels  = $$('.step-panel', form);
    const steps   = $$('.stepper .step', form);
    const btnPrev = $('#prevStep');
    const btnNext = $('#nextStep');
    const btnGen  = $('#generateBtn');

    if (!panels.length) return;

    let current = Math.max(0, panels.findIndex(p => !p.classList.contains('hidden')));
    if (current === -1) current = 0;
    const last = panels.length - 1;

    const render = () => {
      panels.forEach((p, i) => p.classList.toggle('hidden', i !== current));
      steps.forEach((s, i) => {
        s.classList.toggle('active', i === current);
        s.classList.toggle('done',   i < current);
      });
      if (btnPrev) {
        btnPrev.disabled = current === 0;
        btnPrev.classList.toggle('hidden', current === 0);
      }
      if (btnNext) btnNext.classList.toggle('hidden', current === last);
      if (btnGen)  btnGen.classList.toggle('hidden',  current !== last);
    };

    btnPrev?.addEventListener('click', (e) => { e.preventDefault(); if (current > 0) { current--; render(); } });
    btnNext?.addEventListener('click', (e) => { e.preventDefault(); if (current < last) { current++; render(); } });

    // “Generate” on last step → stash a simple composed prompt for the preview story and go to checkout
    btnGen?.addEventListener('click', (e) => {
      e.preventDefault();
      // Grab a few fields if present (best-effort)
      const name = ($('#kidName')?.value || 'Arthur').trim();
      const likes = ($('#kidLikes')?.value || 'trains, purple, the park').trim();
      const theme = ($('#theme')?.value || 'friendly dinosaurs at the beach').trim();
      const moments = ($('#moments')?.value || 'building a sandcastle, sharing snacks').trim();
      const transcript = `Child name: ${name}\nLikes: ${likes}\nTheme: ${theme}\nKey moments: ${moments}`;
      try { sessionStorage.setItem(STORY_KEY, transcript); } catch (_) {}
      goCheckout();
    });

    // Enter key acts like Next (except final → Generate)
    form.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const activeEl = document.activeElement;
      if (activeEl && activeEl.tagName === 'TEXTAREA') return; // allow newline
      e.preventDefault();
      if (current < last) { current++; render(); }
      else { btnGen?.click(); }
    });

    render();
  }

  // ---------- Checkout logic ----------
  function initCheckout() {
    // 1) Hero background by age
    const hero = $('#storyHero');
    if (hero) {
      const age = getAge();
      hero.classList.remove('bg-0-2', 'bg-3-5', 'bg-5-plus');
      if (age === '0-2') hero.classList.add('bg-0-2');
      else if (age === '3-5') hero.classList.add('bg-3-5');
      else hero.classList.add('bg-5-plus');
      // (class names match your CSS like .story-hero.bg-0-2 / bg-3-5 / bg-5-plus) :contentReference[oaicite:4]{index=4}
    }

    // 2) Story content
    const storyEl = $('#storyContent');
    if (storyEl) {
      // If we have a “transcript” from create, show a nice first story derived from it.
      const seed = (() => { try { return sessionStorage.getItem(STORY_KEY) || ""; } catch (_) { return ""; } })();
      const pretty = seed
        ? `# A Day of Gentle Wonders\n\n**Based on your ideas**\n\n${seed}\n\n---\n\n**Once upon a time**, a kind little hero set off to explore. The sun made the waves go *plip-plop*, and a friendly breeze went *whoosh* past curious toes. They shared, they giggled, and they discovered tiny treasures together. As the sky turned rosy, everyone cuddled close, breathing slow and feeling safe. **Good night, little star.**`
        : `# A Cozy First Story\n\nOnce upon a time, a small explorer and their family took a gentle walk where the leaves went *whoosh* and puddles went *plip-plop*. They helped each other, shared snacks, and found a tiny shiny pebble. When the moon peeked out, they snuggled up, warm and calm. **Sleep tight.**`;

      // Render markdown-lite (very small transform: #, **, line breaks)
      const html = pretty
        .replace(/^### (.*)$/gm, '<h3>$1</h3>')
        .replace(/^## (.*)$/gm, '<h2>$1</h2>')
        .replace(/^# (.*)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/^(?!<h\d|<p|<\/p>)/gm, '<p>$&'); // wrap loose lines
      storyEl.innerHTML = html;
    }

    // 3) Products carousel
    const track = $('#productsTrack');
    if (track) {
      const products = [
        {
          id: 'starter',
          title: 'Starter Pack',
          desc: '3 personalised bedtime stories',
          price: '£3.99',
          old: '£5.99',
          cta: 'Add to cart'
        },
        {
          id: 'monthly',
          title: 'Monthly Plan',
          desc: 'Unlimited stories + voice mode',
          price: '£6.99/mo',
          old: '',
          cta: 'Start 7-day trial'
        },
        {
          id: 'characters',
          title: 'Character Pack',
          desc: 'Custom characters & stickers',
          price: '£2.99',
          old: '£3.99',
          cta: 'Add to cart'
        },
        {
          id: 'languages',
          title: 'Language Pack',
          desc: 'English & Turkish versions',
          price: '£1.99',
          old: '',
          cta: 'Add to cart'
        },
        {
          id: 'soundpack',
          title: 'Sound Pack',
          desc: 'Soft background sounds',
          price: '£1.49',
          old: '',
          cta: 'Add to cart'
        }
      ];

      track.innerHTML = products.map(p => `
        <article class="product-card">
          <div class="product-body">
            <h3>${p.title}</h3>
            <p class="muted">${p.desc}</p>
            <div class="price-row">
              <span class="price">${p.price}</span>
              ${p.old ? `<span class="price-old">${p.old}</span>` : ''}
            </div>
            <button class="btn add-btn" data-add="${p.id}">${p.cta}</button>
          </div>
        </article>
      `).join('');

      // Scroll controls (‹ / › buttons)
      const prev = $('#prevCarousel');
      const next = $('#nextCarousel');
      const scrollBy = () => Math.max(track.clientWidth * 0.8, 240);

      prev?.addEventListener('click', () => track.scrollBy({ left: -scrollBy(), behavior: 'smooth' }));
      next?.addEventListener('click', () => track.scrollBy({ left:  scrollBy(), behavior: 'smooth' }));

      // Simple cart count bump
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
  }

  // ---------- Testimonials scroller (optional legacy) ----------
  function initTestimonialsScroller() {
    const viewport = $(".testimonials-viewport");
    const track = $(".testimonials-track");
    if (!(viewport && track)) return;

    let isDown = false, startX = 0, scrollLeft = 0;
    viewport.style.overflow = "hidden";
    track.style.display = "flex";
    track.style.overflowX = "auto";
    track.style.scrollSnapType = "x mandatory";
    track.style.scrollBehavior = "smooth";
    track.style.webkitOverflowScrolling = "touch";
    if (!track.style.gap) track.style.gap = "16px";
    if (!track.style.padding) track.style.padding = "0 32px";

    track.addEventListener("mousedown", (ev) => {
      isDown = true; startX = ev.pageX - track.offsetLeft; scrollLeft = track.scrollLeft;
    });
    ["mouseleave", "mouseup"].forEach((evt) => track.addEventListener(evt, () => { isDown = false; }));
    track.addEventListener("mousemove", (ev) => {
      if (!isDown) return; ev.preventDefault();
      const x = ev.pageX - track.offsetLeft; const walk = (x - startX) * 1.2;
      track.scrollLeft = scrollLeft - walk;
    });

    let touchStartX = 0, touchStartScroll = 0;
    track.addEventListener("touchstart", (t) => {
      const e = t.touches[0]; touchStartX = e.clientX; touchStartScroll = track.scrollLeft;
    }, { passive: true });
    track.addEventListener("touchmove", (t) => {
      const e = t.touches[0]; const dx = e.clientX - touchStartX;
      track.scrollLeft = touchStartScroll - dx;
    }, { passive: true });

    track.addEventListener("wheel", (ev) => {
      if (ev.shiftKey) return;
      if (Math.abs(ev.deltaY) > Math.abs(ev.deltaX)) {
        ev.preventDefault();
        track.scrollLeft += ev.deltaY;
      }
    }, { passive: false });
  }

  // ---------- boot ----------
  onReady(() => {
    initChrome();
    initHomepageTestimonials();
    initAgeButtons();

    if (isCreatePage()) {
      initCreateStepper();
    }

    if (isCheckoutPage()) {
      initCheckout(); // fills story + products, sets hero
    }

    initTestimonialsScroller();
  });
})();
