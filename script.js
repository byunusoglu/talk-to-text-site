/* ===========================
   Global helpers
=========================== */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Small fade-out utility (expects a .fade-out CSS that lowers opacity)
  const fadeOutAnd = (cb, delay = 200) => {
    document.body.classList.add('fade-out');
    window.setTimeout(cb, delay);
  };

  // Attach once DOM is ready
  const onReady = (fn) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  };

  onReady(() => {
    /* ===========================
       1) Age group buttons
       - No title, three side-by-side pills
       - "0–2 years" visually selected by default via HTML
       - Click selects & navigates to create.html (can later add ?age= param)
    =========================== */
    const ageButtons = $$('.age-btn');
    if (ageButtons.length) {
      ageButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          // Visual selection swap
          ageButtons.forEach((b) => b.classList.remove('selected'));
          btn.classList.add('selected');

          // Navigate (extend to carry query if needed)
          const target = btn.dataset.target || 'create.html';
          fadeOutAnd(() => (window.location.href = target));
        });
      });
    }

    /* ===========================
       2) Testimonial horizontal scroller (no arrows)
       - Works with a container having .testimonials-viewport and an inner .testimonials-track
       - Drag/Swipe to scroll + wheel converts to horizontal
       - Adds subtle "peek" by padding; CSS should set snap-type
    =========================== */
    const viewport = $('.testimonials-viewport');
    const track = $('.testimonials-track');
    if (viewport && track) {
      let isDown = false;
      let startX = 0;
      let scrollLeft = 0;

      // Enable smooth scroll snapping via CSS, but JS enhances interactions
      viewport.style.overflow = 'hidden';            // hides native scrollbar
      track.style.display = 'flex';
      track.style.gap = track.style.gap || '16px';
      track.style.scrollSnapType = 'x mandatory';
      track.style.overflowX = 'auto';
      track.style.scrollBehavior = 'smooth';
      track.style.padding = track.style.padding || '0 32px'; // creates the "peek" edges
      track.style.webkitOverflowScrolling = 'touch';

      // Mouse drag
      track.addEventListener('mousedown', (e) => {
        isDown = true;
        track.classList.add('dragging');
        startX = e.pageX - track.offsetLeft;
        scrollLeft = track.scrollLeft;
      });

      track.addEventListener('mouseleave', () => {
        isDown = false;
        track.classList.remove('dragging');
      });

      track.addEventListener('mouseup', () => {
        isDown = false;
        track.classList.remove('dragging');
      });

      track.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - track.offsetLeft;
        const walk = (x - startX) * 1.2; // drag speed
        track.scrollLeft = scrollLeft - walk;
      });

      // Touch swipe (mobile)
      let touchStartX = 0;
      let touchStartScroll = 0;
      track.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        touchStartX = t.clientX;
        touchStartScroll = track.scrollLeft;
      }, { passive: true });

      track.addEventListener('touchmove', (e) => {
        const t = e.touches[0];
        const dx = t.clientX - touchStartX;
        track.scrollLeft = touchStartScroll - dx;
      }, { passive: true });

      // Convert vertical wheel to horizontal scroll
      track.addEventListener('wheel', (e) => {
        // If shift is held, let browser handle it
        if (e.shiftKey) return;
        // Prevent vertical page scroll for smoother horizontal experience
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();
          track.scrollLeft += e.deltaY;
        }
      }, { passive: false });
    }

    /* ===========================
       3) “Generate Story” → checkout.html
       - On the create page, clicking the main CTA should move the user to checkout
       - This does NOT call the API here (as per your latest request)
    =========================== */
    const generateBtn = $('#generateStoryBtn') || $('[data-action="generate-story"]');
    if (generateBtn) {
      generateBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // Optional: collect current form selections, carry them over via querystring
        // Example:
        // const age = ($('.age-picker input:checked') || {}).value || '0-2';
        // const url = new URL('checkout.html', window.location.href);
        // url.searchParams.set('age', age);
        // fadeOutAnd(() => (window.location.href = url.toString()));
        fadeOutAnd(() => (window.location.href = 'checkout.html'));
      });
    }

    /* ===========================
       4) Lightweight nav behaviors (optional)
       - Smooth scroll for on-page anchors with [data-smooth]
       - Close mobile menu on link click (if you added one)
    =========================== */
    const smoothLinks = $$('a[data-smooth][href^="#"]');
    smoothLinks.forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        const el = $(id);
        if (!el) return;
        e.preventDefault();
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    // If you have a hamburger menu:
    const burger = $('.burger');
    const mobileNav = $('.mobile-nav');
    if (burger && mobileNav) {
      burger.addEventListener('click', () => {
        mobileNav.classList.toggle('open');
        document.body.classList.toggle('nav-open');
      });
      $$('a', mobileNav).forEach((link) => {
        link.addEventListener('click', () => {
          mobileNav.classList.remove('open');
          document.body.classList.remove('nav-open');
        });
      });
    }

    /* ===========================
       5) Defensive no-op handlers to avoid duplicate declarations
       - If other scripts add #apiStatusEl etc., we won't re-declare or crash
    =========================== */
    // Example: safely reference optional elements
    const apiStatusEl = $('#apiStatusEl'); // may or may not exist on current page
    if (apiStatusEl) {
      // Keep this lightweight; actual API code removed per latest flow
      apiStatusEl.textContent = apiStatusEl.textContent || '';
    }
  });
})();
