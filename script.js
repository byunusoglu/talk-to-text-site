// Toggle menu
const menuBtn = document.getElementById('menuBtn');
const menu = document.getElementById('menu');
if (menuBtn) {
  menuBtn.addEventListener('click', () => menu.classList.toggle('hidden'));
}

// (Legacy) Age-card navigation (safe if not present on page)
document.querySelectorAll('.age-card').forEach(card => {
  card.addEventListener('click', () => {
    const target = card.dataset.target;
    document.body.classList.add('fade-out');
    setTimeout(() => (window.location.href = target), 200);
  });
});

// Footer year
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Testimonials fade (existing)
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

// Story creation logic (create.html)
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

/* ===== HERO auto slider (4 slides, 3s, loops) ===== */
(() => {
  const track = document.getElementById('heroTrack');
  const dotsWrap = document.getElementById('heroDots');
  if (!track || !dotsWrap) return;

  const dots = Array.from(dotsWrap.querySelectorAll('.dot'));
  const total = dots.length; // 4
  let idx = 0;
  let timer;

  function go(i, user = false) {
    idx = (i + total) % total;
    track.style.transform = `translateX(-${idx * 100}%)`;
    dots.forEach((d, k) => d.classList.toggle('is-active', k === idx));
    if (user) restart();
  }

  function next() { go(idx + 1); }
  function start() { timer = setInterval(next, 3000); }
  function stop() { clearInterval(timer); }
  function restart() { stop(); start(); }

  dots.forEach(d => d.addEventListener('click', () => go(+d.dataset.index, true)));
  track.addEventListener('mouseenter', stop);
  track.addEventListener('mouseleave', start);
  dotsWrap.addEventListener('mouseenter', stop);
  dotsWrap.addEventListener('mouseleave', start);

  start();
})();

/* ===== Age tabs (default 0–2 selected) ===== */
(() => {
  const container = document.querySelector('.age-tabs');
  if (!container) return;

  const tabs = Array.from(container.querySelectorAll('.tab'));
  const panels = {
    '0-2': document.getElementById('panel-0-2'),
    '3-5': document.getElementById('panel-3-5'),
    '5-plus': document.getElementById('panel-5-plus')
  };

  function activate(key) {
    tabs.forEach(t => {
      const active = t.dataset.age === key;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    Object.entries(panels).forEach(([k, el]) => el.classList.toggle('is-active', k === key));
  }

  tabs.forEach(t => t.addEventListener('click', () => activate(t.dataset.age)));

  // Default: 0–2 (selected)
  activate('0-2');
})();
