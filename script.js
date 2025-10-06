"use strict";

/* =====================================================
   Your World — stable interactions (no regex)
   - Landing: age pills (persist in localStorage)
   - Create: stepper (Next/Back) + Generate → checkout
   - Fallback: legacy Generate buttons still work
   - Testimonials scroller (if present)
===================================================== */
(() => {
  const AGE_KEY = "yw_age_group";
  const DEFAULT_AGE = "0-2";

  // ---------- tiny DOM helpers ----------
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const onReady = (fn) => {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  };
  const fadeOutAnd = (cb, delay = 150) => {
    try { document.body.classList.add("fade-out"); } catch (_) {}
    setTimeout(cb, delay);
  };

  // ---------- age persistence ----------
  const setAge = (val) => { try { localStorage.setItem(AGE_KEY, String(val)); } catch (_) {} };
  const getAge = () => {
    try { return localStorage.getItem(AGE_KEY) || DEFAULT_AGE; } catch (_) { return DEFAULT_AGE; }
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

  const goCheckout = () => fadeOutAnd(() => { window.location.href = "checkout.html"; });

  // ---------- Create stepper ----------
  function initStepper() {
    // Expect: #createForm (optional), .step-panel (required), #nextStep, #prevStep, #generateBtn
    const form    = $('#createForm') || document;     // tolerate absence
    const panels  = $$('.step-panel', form);
    const steps   = $$('.stepper .step', form);       // dots optional
    const btnPrev = $('#prevStep');
    const btnNext = $('#nextStep');
    const btnGen  = $('#generateBtn');

    if (!panels.length) return; // nothing to step through

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
    btnGen ?.addEventListener('click', (e) => { e.preventDefault(); goCheckout(); });

    // Optional: click on dots to jump
    steps.forEach((s) => {
      s.addEventListener('click', () => {
        const idx = Number(s.getAttribute('data-step') || '0');
        if (!Number.isNaN(idx)) {
          current = Math.min(Math.max(idx, 0), last);
          render();
        }
      });
    });

    // Pressing Enter acts like Next (except on last step → Generate)
    form.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const activeEl = document.activeElement;
      // Allow multiline inputs to keep newline
      if (activeEl && (activeEl.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      if (current < last) { current++; render(); }
      else { goCheckout(); }
    });

    render();
  }

  // ---------- Fallback Generate handlers (legacy IDs/classes) ----------
  function initLegacyGenerateFallback() {
    // Only attach if we are NOT running the stepper (no .step-panel)
    if ($('.step-panel')) return;

    const selectors = [
      '#generateBtn',
      '#generateStoryBtn',
      "[data-action='generate-story']",
      '#nextButton',
      '.next-btn',
      "a[href='checkout.html']",
      "[data-next='checkout']",
    ].join(', ');

    const wire = () => {
      $$(selectors).forEach((btn) => {
        // Replace with clone to clear stale handlers
        const cloned = btn.cloneNode(true);
        btn.replaceWith(cloned);
      });
      $$(selectors).forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          goCheckout();
        }, { capture: true });
      });
    };

    wire();
  }

  // ---------- Testimonials scroller ----------
  function initTestimonials() {
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

  // ---------- Landing age buttons + navigation ----------
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

  // ---------- boot ----------
  onReady(() => {
    initAgeButtons();
    if (isCreatePage()) initStepper();
    else initLegacyGenerateFallback();
    initTestimonials();
  });
})();
