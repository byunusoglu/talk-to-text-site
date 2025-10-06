/* =====================================================
   Your World — Robust front-end interactions
   - Event delegation for reliability across page changes
   - Age group selection persisted via localStorage
   - Next/Generate → checkout.html (create page)
===================================================== */
(() => {
  const AGE_KEY = 'yw_age_group';
  const DEFAULT_AGE = '0-2';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const onReady = (fn) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  };

  const fadeOutAnd = (cb, delay = 200) => {
    try { document.body.classList.add('fade-out'); } catch (_) {}
    window.setTimeout(cb, delay);
  };

  // Persist + retrieve age
  const setAge = (val) => {
    try { localStorage.setItem(AGE_KEY, val); } catch (_) {}
  };
  const getAge = () => {
    try { return localStorage.getItem(AGE_KEY) || DEFAULT_AGE; } catch (_) { return DEFAULT_AGE; }
  };

  // Helper: mark UI selection on age pills if present
  const paintSelectedAge = () => {
    const current = getAge();
    const buttons = $$('.age-btn');
    if (!buttons.length) return;

    // Clear then select the matching text
    buttons.forEach(b => b.classList.remove('selected'));
    const match =
      buttons.find(b => (b.dataset.age || b.textContent).toLowerCase().includes(current)) ||
      buttons[0]; // fallback
    if (match) match.classList.add('selected');
  };

  onReady(() => {
    // 1) Initialize default age if nothing stored
    if (!getAge()) setAge(DEFAULT_AGE);

    // 2) Paint current selection on landing if pills exist
    paintSelectedAge();

    // 3) If create page has radio inputs, sync them with stored age
    const createAgeRadios = $$('input[name="age-group"]');
    if (createAgeRadios.length) {
      const current = getAge();
      let found = false;
      createAgeRadios.forEach(r => {
        const v = (r.value || '').toLowerCase();
        if (v.includes(current)) { r.checked = true; found = true; }
      });
      if (!found) {
        // default to first
        createAgeRadios[0].checked = true;
      }
    }

    // 4) EVENT DELEGATION — catch clicks globally
    document.addEventListener('click', (e) => {
      const target = e.target;

      // (a) Age group pill clicked?
      const ageBtn = target.closest('.age-btn');
      if (ageBtn) {
        // Determine age label (prefer data-age, else text)
        const label = (ageBtn.dataset.age || ageBtn.textContent || '').trim().toLowerCase();
        if (label.includes('0') && label.includes('2')) setAge('0-2');
        else if (label.includes('3') && label.includes('5')) setAge('3-5');
        else if (label.includes('5')) setAge('5+');

        // Update selected state visually
        $$('.age-btn').forEach(b => b.classList.remove('selected'));
        ageBtn.classList.add('selected');

        // Optional: navigate to create.html when user picks an age on landing
        // Comment this out if you want selection without navigation.
        const next = ageBtn.dataset.target || 'create.html';
        fadeOutAnd(() => { window.location.href = next; });
        return;
      }

      // (b) Next/Generate clicked? (create page)
      const nextBtn = target.closest('#generateStoryBtn, [data-action="generate-story"], #nextButton, .next-btn');
      if (nextBtn) {
        e.preventDefault();

        // If there’s a form, you could validate here (optional)
        // const form = nextBtn.closest('form');
        // if (form && !form.checkValidity()) { form.reportValidity(); return; }

        // Carry age via query if desired:
        // const url = new URL('checkout.html', window.location.href);
        // url.searchParams.set('age', getAge());
        // fadeOutAnd(() => (window.location.href = url.toString()));

        fadeOutAnd(() => (window.location.href = 'checkout.html'));
        return;
      }
    }, { passive: false });

    // 5) Testimonials scroller (if present)
    const viewport = $('.testimonials-viewport');
    const track = $('.testimonials-track');
    if (viewport && track) {
      let isDown = false;
      let startX = 0;
      let scrollLeft = 0;

      viewport.style.overflow = 'hidden';
      track.style.display = 'flex';
      track.style.overflowX = 'auto';
      track.style.scrollSnapType = 'x mandatory';
      track.style.scrollBehavior = 'smooth';
      track.style.webkitOverflowScrolling = 'touch';
      if (!track.style.gap) track.style.gap = '16px';
      if (!track.style.padding) track.style.padding = '0 32px';

      track.addEventListener('mousedown', (ev) => {
        isDown = true;
        startX = ev.pageX - track.offsetLeft;
        scrollLeft = track.scrollLeft;
      });

      ['mouseleave', 'mouseup'].forEach(evt =>
        track.addEventListener(evt, () => { isDown = false; })
      );

      track.addEventListener('mousemove', (ev) => {
        if (!isDown) return;
        ev.preventDefault();
        const x = ev.pageX - track.offsetLeft;
        const walk = (x - startX) * 1.2;
        track.scrollLeft = scrollLeft - walk;
      });

      // Touch
      let touchStartX = 0;
      let touchStartScroll = 0;
      track.addEventListener('touchstart', (t) => {
        const e = t.touches[0];
        touchStartX = e.clientX;
        touchStartScroll = track.scrollLeft;
      }, { passive: true });
      track.addEventListener('touchmove', (t) => {
        const e = t.touches[0];
        const dx = e.clientX - touchStartX;
        track.scrollLeft = touchStartScroll - dx;
      }, { passive: true });

      // Wheel: vertical → horizontal
      track.addEventListener('wheel', (ev) => {
        if (ev.shiftKey) return;
        if (Math.abs(ev.deltaY) > Math.abs(ev.deltaX)) {
          ev.preventDefault();
          track.scrollLeft += ev.deltaY;
        }
      }, { passive: false });
    }

    // 6) Optional smooth-scroll for anchor links
    $$('a[data-smooth][href^="#"]').forEach((a) => {
      a.addEventListener('click', (ev) => {
        const id = a.getAttribute('href');
        const el = $(id);
        if (!el) return;
        ev.preventDefault();
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  });
})();

