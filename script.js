"use strict";

/* =====================================================
   Your World — stable interactions (no regex)
   - Landing: age pills (persist in localStorage)
   - Create: stepper (Next/Back) + Generate → checkout
   - Testimonials scroller (if present)
===================================================== */
(() => {
  const AGE_KEY = "yw_age_group";
  const DEFAULT_AGE = "0-2";

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const onReady = (fn) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  };

  const fadeOutAnd = (cb, delay = 200) => {
    try { document.body.classList.add("fade-out"); } catch (_) {}
    window.setTimeout(cb, delay);
  };

  // -------- Age persistence --------
  const setAge = (val) => { try { localStorage.setItem(AGE_KEY, String(val)); } catch (_) {} };
  const getAge = () => {
    try { return localStorage.getItem(AGE_KEY) || DEFAULT_AGE; } catch (_) { return DEFAULT_AGE; }
  };

  const paintSelectedAge = () => {
    const current = getAge();
    const buttons = $$(".age-btn");
    if (!buttons.length) return;
    buttons.forEach((b) => b.classList.remove("selected"));
    const match = buttons.find((b) => (b.dataset.age || "").toLowerCase() === current.toLowerCase());
    (match || buttons[0]).classList.add("selected");
  };

  const isCreatePage = () =>
    Boolean($('#generateBtn') || $('#nextStep') || $('#prevStep') || $('form#createForm'));

  const goCheckout = () => fadeOutAnd(() => { window.location.href = "checkout.html"; });

  // -------- Create page stepper --------
  function initStepper() {
    const form = $('#createForm');
    if (!form) return;

    const panels = $$('.step-panel', form);       // sections with data-step
    const steps  = $$('.stepper .step');          // dots
    const btnPrev = $('#prevStep');
    const btnNext = $('#nextStep');
    const btnGen  = $('#generateBtn');

    if (!panels.length || !steps.length || !btnPrev || !btnNext || !btnGen) return;

    let current = 0;
    const last = panels.length - 1;

    const render = () => {
      panels.forEach((p, i) => p.classList.toggle('hidden', i !== current));
      steps.forEach((s, i) => {
        s.classList.toggle('active', i === current);
        s.classList.toggle('done',   i < current);
      });
      // Nav button visibility
      btnPrev.disabled = current === 0;
      btnPrev.classList.toggle('hidden', current === 0);     // optional UX
      btnNext.classList.toggle('hidden', current === last);
      btnGen.classList.toggle('hidden',  current !== last);
    };

    // Click handlers
    btnPrev.addEventListener('click', (e) => {
      e.preventDefault();
      if (current > 0) current -= 1;
      render();
    });

    btnNext.addEventListener('click', (e) => {
      e.preventDefault();
      if (current < last) current += 1;
      render();
    });

    // Optional: click on step dots to jump
    steps.forEach((s) => {
      s.addEventListener('click', () => {
        const idx = Number(s.getAttribute('data-step') || '0');
        if (!Number.isNaN(idx)) {
          current = Math.min(Math.max(idx, 0), last);
          render();
        }
      });
    });

    // Generate → checkout
    btnGen.addEventListener('click', (e) => {
      e.preventDefault();
      goCheckout();
    });

    render(); // initial
  }

  onReady(() => {
    // Landing age pills
    paintSelectedAge();

    // Sync any age radios (if you add them later)
    const createAgeRadios = $$('input[name="age-group"]');
    if (createAgeRadios.length) {
      const current = getAge().toLowerCase();
      let matched = false;
      createAgeRadios.forEach((r) => {
        const v = (r.value || "").toLowerCase();
        if (v === current) { r.checked = true; matched = true; }
      });
      if (!matched) createAgeRadios[0].checked = true;
    }

    // Age pill selection + navigate to create
    document.addEventListener("click", (e) => {
      const t = e.target;
      const ageBtn = t.closest(".age-btn");
      if (ageBtn) {
        const raw = (ageBtn.dataset.age || "").trim();
        const safe = raw === "0-2" || raw === "3-5" || raw === "5+" ? raw : DEFAULT_AGE;
        setAge(safe);
        $$(".age-btn").forEach((b) => b.classList.remove("selected"));
        ageBtn.classList.add("selected");
        const next = ageBtn.dataset.target || "create.html";
        fadeOutAnd(() => { window.location.href = next; });
        return;
      }
    }, { passive: false });

    // Create page features
    if (isCreatePage()) {
      initStepper();
    }

    // Testimonials scroller (if present)
    const viewport = $(".testimonials-viewport");
    const track = $(".testimonials-track");
    if (viewport && track) {
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
      ["mouseleave", "mouseup"].forEach((evt) =>
        track.addEventListener(evt, () => { isDown = false; })
      );
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
  });
})();
