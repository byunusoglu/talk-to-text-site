"use strict";

/* =====================================================
   Your World — stable interactions (no regex)
   - Age group pills (persist in localStorage)
   - Create step: Next/Generate works (click or submit)
   - Testimonial scroller
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

  // ---- Age value persistence ----
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

  // ---- Detect if we are on the create page (best-effort) ----
  const isCreatePage = () => {
    return Boolean(
      $('#generateBtn') ||                         // <-- added
      $('#generateStoryBtn') ||
      $('[data-action="generate-story"]') ||
      $('#nextButton') ||
      $('.next-btn') ||
      $('.create-step') ||
      $('form#createForm') ||
      $('form[data-flow="create-step"]')
    );
  };

  // ---- Force create step to go to checkout ----
  const goCheckout = () => fadeOutAnd(() => { window.location.href = "checkout.html"; });

  onReady(() => {
    // Ensure painted selection on landing (and default age set)
    paintSelectedAge();

    // Sync radios on create page (if present)
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

    // --------- GLOBAL CLICK DELEGATION ----------
    document.addEventListener("click", (e) => {
      const t = e.target;

      // A) Age pill (landing)
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

      // B) NEXT / GENERATE (create step)
      const nextSel =
        "#generateBtn, #generateStoryBtn, [data-action='generate-story'], " + // <-- #generateBtn added
        "#nextButton, .next-btn, button[type='submit'], a[href='checkout.html'], [data-next='checkout']";

      const nextBtn = t.closest(nextSel);
      if (nextBtn && isCreatePage()) {
        e.preventDefault();
        // If inside a form, neutralize native validation blocking for this step
        const form = nextBtn.closest("form");
        if (form) form.noValidate = true;
        goCheckout();
        return;
      }
    }, { passive: false });

    // --------- FORM SUBMIT INTERCEPT (create step) ----------
    document.addEventListener("submit", (e) => {
      const form = e.target;
      if (form.matches("form#createForm, form[data-flow='create-step'], .create-step form, form[action*='create']")) {
        e.preventDefault();
        form.noValidate = true;
        goCheckout();
      }
    });

    // --------- ENTER KEY (create step fields) ----------
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      if (!isCreatePage()) return;
      const el = document.activeElement;
      if (el && (el.closest("form#createForm") || el.closest("form[data-flow='create-step']") || el.closest(".create-step"))) {
        e.preventDefault();
        goCheckout();
      }
    });

    // --------- Testimonials scroller (optional) ----------
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

      // Touch
      let touchStartX = 0, touchStartScroll = 0;
      track.addEventListener("touchstart", (t) => {
        const e = t.touches[0]; touchStartX = e.clientX; touchStartScroll = track.scrollLeft;
      }, { passive: true });
      track.addEventListener("touchmove", (t) => {
        const e = t.touches[0]; const dx = e.clientX - touchStartX;
        track.scrollLeft = touchStartScroll - dx;
      }, { passive: true });

      // Wheel: vertical → horizontal
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
