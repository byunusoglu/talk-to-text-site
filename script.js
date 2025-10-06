// ===== Topbar menu =====
const menuBtn = document.getElementById('menuBtn');
const menu = document.getElementById('menu');
if (menuBtn) menuBtn.addEventListener('click', () => menu.classList.toggle('hidden'));

// ===== Footer year =====
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ===== Testimonials fade (home only if present) =====
const testimonials = [
  "“Our 4-year-old asks for ‘dino kitty’ every night now. It feels like she’s writing it with us.” — Elif",
  "“Finally a screen-free wind-down that works. He loves hearing his own ideas show up.” — James",
  "“A calm five-minute story that’s always gentle. Instant favourite.” — Priya"
];
let tIndex = 0;
const tEl = document.getElementById('testimonialText');
if (tEl) {
  setInterval(() => {
    tIndex = (tIndex + 1) % testimonials.length;
    tEl.style.opacity = 0;
    setTimeout(() => {
      tEl.innerHTML = testimonials[tIndex];
      tEl.style.opacity = 1;
    }, 400);
  }, 6000);
}

/* =========================================================================
   Create page logic — kept as before (no changes to behavior) :contentReference[oaicite:5]{index=5}
   ========================================================================= */
const generateBtn = document.getElementById('generateBtn');
if (generateBtn) {
  const input = document.getElementById('storyInput');
  const output = document.getElementById('storyOutput');
  const loading = document.getElementById('loading');

  generateBtn.addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) return alert("Please describe your story idea first!");
    output.textContent = "";
    loading.classList.remove('hidden');

    try {
      const res = await fetch('https://fairytale-api.vercel.app/api/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text })
      });
      const data = await res.json();
      output.innerHTML = data.story
        ? data.story.replace(/\n/g, '<br/>')
        : "Sorry, something went wrong.";
    } catch {
      output.textContent = "Error connecting to the story generator.";
    } finally {
      loading.classList.add('hidden');
    }
  });
}

/* =========================================================================
   HERO CAROUSEL — robust, jitter-free, consistent 3s loop
   - No setInterval drift: uses a single setTimeout scheduled per step
   - Seamless loop from last->first using a no-transition jump then resume
   - Pauses on hover; dots clickable; guards so it only runs on index
   ========================================================================= */
(() => {
  const track = document.getElementById('heroTrack');
  const dotsWrap = document.getElementById('heroDots');
  if (!track || !dotsWrap) return; // only on homepage

  const slides = Array.from(track.children);
  const dots = Array.from(dotsWrap.querySelectorAll('.dot'));
  const total = slides.length;

  // Ensure each slide occupies 100% width (prevents layout jumps)
  slides.forEach(s => (s.style.flex = '0 0 100%'));

  let idx = 0;         // current visible index
  let timer = null;    // single timer (no stacking)

  const setDot = (i) => {
    const n = ((i % total) + total) % total;
    dots.forEach((d, k) => d.classList.toggle('is-active', k === n));
  };

  const apply = () => {
    track.style.transform = `translateX(-${idx * 100}%)`;
    setDot(idx);
  };

  const stop = () => { if (timer) { clearTimeout(timer); timer = null; } };
  const schedule = () => { timer = setTimeout(next, 3000); };

  const next = () => {
    // normal step
    if (idx < total - 1) {
      idx += 1;
      apply();
      schedule();
      return;
    }

    // seamless loop: jump to 0 without transition, then animate to 1
    stop();
    track.classList.add('no-trans');
    idx = 0;
    apply();                   // instant jump to first
    // force reflow so browser applies the no-transition state
    void track.offsetWidth;
    track.classList.remove('no-trans');

    idx = 1;                   // move to second as the next visible slide
    apply();
    schedule();
  };

  const go = (i) => {
    stop();
    idx = ((i % total) + total) % total;
    apply();
    schedule();
  };

  dots.forEach(d => d.addEventListener('click', () => go(+d.dataset.index)));

  // Pause on hover
  ['mouseenter', 'mouseleave'].forEach(evt => {
    [track, dotsWrap].forEach(el => el.addEventListener(evt, () => {
      if (evt === 'mouseenter') stop(); else schedule();
    }));
  });

  // Start
  apply();
  schedule();

  // Optional: pause when tab hidden, resume when visible (keeps 3s feel)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else schedule();
  });
})();
