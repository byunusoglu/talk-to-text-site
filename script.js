// --- Scroll morph: Real → Animated (soft stop, one-per-pass with hysteresis)
function initScrollMorph() {
  const wrap = document.getElementById('morph');
  if (!wrap) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  // State
  let holdActive = false;
  let lockedY = 0;
  let lastScrollY = window.scrollY;
  let direction = 'down';         // 'down' | 'up'
  let armed = true;               // can we trigger a hold?
  let rearmEdge = null;           // 'past' (need t>=0.95) | 'before' (need t<=0.05)
  let holdStart = 0;

  // Reveal helpers (we compute t each frame)
  function computeRevealAndRects() {
    const rect = wrap.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const start = vh * 0.15;
    const totalScrollable = rect.height - vh * 0.30;
    let t = (start - rect.top) / totalScrollable;
    t = Math.max(0, Math.min(1, t));
    wrap.style.setProperty('--reveal', String(t));
    wrap.style.setProperty('--parallax', String(12 * (1 - t)));
    return { t, vh };
  }

  // ------------- Scroll lock mechanics -------------
  function lockScrollAt(y) {
    if (holdActive) return;
    holdActive = true;
    lockedY = Math.max(0, Math.round(y));
    window.scrollTo(0, lockedY);

    document.documentElement.classList.add('scroll-locked');
    document.body.dataset.prevTop = document.body.style.top || '';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${lockedY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';

    wrap.classList.add('hold');
  }

  function unlockScroll() {
    if (!holdActive) return;

    wrap.classList.remove('hold');
    document.documentElement.classList.remove('scroll-locked');

    document.body.style.position = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.top = document.body.dataset.prevTop || '';
    delete document.body.dataset.prevTop;

    window.scrollTo(0, lockedY);
    holdActive = false;

    // Hysteresis: do not re-trigger until user leaves the section
    // If we were going down, require t >= 0.95. If up, require t <= 0.05.
    rearmEdge = (direction === 'down') ? 'past' : 'before';
    armed = false; // disarm now; rearm only after clearing the threshold
  }

  // Intercept while locked; release on first deliberate gesture after 220ms
  const reengageRelease = (e) => {
    if (!holdActive) return;
    e.preventDefault();
    if (Date.now() - holdStart > 220) unlockScroll();
  };
  const onKey = (e) => {
    if (!holdActive) return;
    // any navigation key releases
    if (['Escape','Enter',' ' ,'ArrowDown','ArrowUp','PageDown','PageUp','Home','End'].includes(e.key)) {
      e.preventDefault();
      unlockScroll();
    }
  };

  function startHoldCentered() {
    // Center on screen and lock
    const stage = wrap.querySelector('.morph-stage');
    if (!stage) return;
    const s = stage.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const targetY = window.scrollY + s.top + s.height / 2 - (vh / 2);

    lockScrollAt(targetY);
    holdStart = Date.now();

    // Hook listeners to detect user's next intent
    window.addEventListener('wheel', reengageRelease, { passive: false });
    window.addEventListener('touchmove', reengageRelease, { passive: false });
    window.addEventListener('keydown', onKey);

    // Cleanup when unlocked
    const cleanup = () => {
      if (!holdActive) {
        window.removeEventListener('wheel', reengageRelease, { passive: false });
        window.removeEventListener('touchmove', reengageRelease, { passive: false });
        window.removeEventListener('keydown', onKey);
        document.removeEventListener('visibilitychange', onVis);
      }
    };
    const onVis = () => { if (document.visibilityState === 'hidden') unlockScroll(); };
    document.addEventListener('visibilitychange', onVis);
    const id = setInterval(() => { if (!holdActive) { clearInterval(id); cleanup(); } }, 200);
  }

  // ------------- Main update loop -------------
  function update() {
    // Track direction
    const y = window.scrollY;
    direction = (y > lastScrollY) ? 'down' : (y < lastScrollY) ? 'up' : direction;
    lastScrollY = y;

    const { t, vh } = computeRevealAndRects();

    // Rearm logic: once user passes the appropriate edge, allow a new hold next pass
    if (!armed && !holdActive) {
      if ((rearmEdge === 'past'   && t >= 0.95) ||
          (rearmEdge === 'before' && t <= 0.05)) {
        armed = true;
        rearmEdge = null;
      }
    }

    // If we’re locked, keep clamped (defeat inertial drift)
    if (holdActive && Math.abs(window.scrollY - lockedY) > 0) {
      window.scrollTo(0, lockedY);
      return;
    }

    // Trigger condition (single soft stop per pass):
    // - not holding
    // - armed
    // - near center band (with some hysteresis)
    // - only while actually inside the section (t in [0.1, 0.9])
    if (!holdActive && armed && t > 0.1 && t < 0.9) {
      const stage = wrap.querySelector('.morph-stage');
      if (stage) {
        const s = stage.getBoundingClientRect();
        const centerDist = Math.abs((s.top + s.height / 2) - (vh / 2));
        const centerBand = Math.min(60, s.height * 0.08); // ~8% band, max 60px
        if (centerDist < centerBand) {
          startHoldCentered();
          return;
        }
      }
    }
  }

  // Kick off
  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
}
