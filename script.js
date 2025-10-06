"use strict";

/* =====================================================
   Your World — Stable front-end interactions (no regex)
   - Age group selection via data-age (0-2, 3-5, 5+)
   - Persist age in localStorage
   - Next/Generate → checkout.html
   - Testimonial scroller (optional)
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

  const setAge = (val) => {
    try { localStorage.setItem(AGE_KEY, String(val)); } catch (_) {}
  };
  const getAge = () => {
    try {
      const v = localStorage.getItem(AGE_KEY);
      return v ? String(v) : DEFAULT_AGE;
    } catch (_) {
      return DEFAULT_AGE;
    }
  };

  const paintSelectedAge = () => {
    const current = getAge();
    const buttons = $$(".age-btn");
    if (!buttons.length) return;

    buttons.forEach((b) => b.classList.remove("selected"));
    const match = buttons.find((b) => (b.dataset.age || "").toLowerCase() === current.toLowerCase());
    (match || buttons[0]).classList.add("selected");
  };

  onReady(() => {
    // Ensure a default age exists
    if (!getAge()) setAge(DEFAULT_AGE);

    // Paint selected pill on landing
    paintSelectedAge();

    // Sync radios on create page (if they exist) using their value attribute
    const createAgeRadios = $$('input[name="age-group"]');
    if (createAgeRadios.length) {
      const current = getAge().toLowerCase();
      let matched = false;
      createAgeRadios.forEach((r) => {
        const v = (r.value || "").toLowerCase();
        if (v === current) {
          r.checked = true;
          matched = true;
        }
      });
      if (!matched) createAgeRadios[0].checked = true;
    }

    // Global click delegation
    document.addEventListener("click", (e) => {
      const target = e.target;

      // Age pill
      const ageBtn = target.closest(".age-btn");
      if (ageBtn) {
        // Read from data-age ONLY to avoid parsing issues (e.g., "5+")
        const raw = (ageBtn.dataset.age || "").trim();
        // Allow only expected values; fallback to default
        const safe = raw === "0-2" || raw === "3-5" || raw === "5+" ? raw : DEFAULT_AGE;

        setAge(safe);

        // Visual selection
        $$(".age-btn").forEach((b) => b.classList.remove("selected"));
        ageBtn.classList.add("selected");

        // Navigate (landing → create)
        const next = ageBtn.dataset.target || "create.html";
        fadeOutAnd(() => { window.location.href = next; });
        return;
      }

      // Next / Generate on create page
      const nextBtn = target.closest("#generateStoryBtn, [data-action='generate-story'], #nextButton, .next-btn");
      if (nextBtn) {
        e.preventDefault();

        // Optionally carry age to checkout via query:
        // const url = new URL("checkout.html", window.location.href);
        // url.searchParams.set("age", getAge());
        // fadeOutAnd(() => (window.location.href = url.toString()));

        fadeOutAnd(() => (window.location.href = "checkout.html"));
        return;
      }
    }, { passive: false });

    // Testimonials scroller (optional)
    const viewport = $(".testimonials-viewport");
    const track = $(".testimonials-track");
    if (viewport && track) {
      let isDown = false;
      let startX = 0;
      let scrollLeft = 0;

      viewport.style.overflow = "hidden";
      track.style.display = "flex";
      track.style.overflowX = "auto";
      track.style.scrollSnapType = "x mandatory";
      track.style.scrollBehavior = "smooth";
      track.style.webkitOverflowScrolling = "touch";
      if (!track.style.gap) track.style.gap = "16px";
      if (!track.style.padding) track.style.padding = "0 32px";

      track.addEventListener("mousedown", (ev) => {
        isDown = true;
        startX = ev.pageX - track.offsetLeft;
        scrollLeft = track.scrollLeft;
      });

      ["mouseleave", "mouseup"].forEach((evt) =>
        track.addEventListener(evt, () => { isDown = false; })
      );

      track.addEventListener("mousemove", (ev) => {
        if (!isDown) return;
        ev.preventDefault();
        const x = ev.pageX - track.offsetLeft;
        const walk = (x - startX) * 1.2;
        track.scrollLeft = scrollLeft - walk;
      });

      // Touch
      let touchStartX = 0;
      let touchStartScroll = 0;
      track.addEventListener("touchstart", (t) => {
        const e = t.touches[0];
        touchStartX = e.clientX;
        touchStartScroll = track.scrollLeft;
      }, { passive: true });

      track.addEventListener("touchmove", (t) => {
        const e = t.touches[0];
        const dx = e.clientX - touchStartX;
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

    // Smooth anchors (if used)
    $$("a[data-smooth][href^='#']").forEach((a) => {
      a.addEventListener("click", (ev) => {
        const id = a.getAttribute("href");
        const el = $(id);
        if (!el) return;
        ev.preventDefault();
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  });
})();
