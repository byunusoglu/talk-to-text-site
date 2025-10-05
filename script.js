// Toggle menu
const menuBtn = document.getElementById('menuBtn');
const menu = document.getElementById('menu');
if (menuBtn) menuBtn.addEventListener('click', () => menu.classList.toggle('hidden'));

// Age group navigation
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

/* ------------------------------------------------------------------
   Testimonials slider (manual; no auto-advance)
   Expected markup in index.html:
   - .testimonial-slider with .ts-prev, .ts-next
   - .ts-viewport.edge-mask wrapping #tsTrack
   - #tsDots for pagination dots
-------------------------------------------------------------------*/
(function initTestimonialSlider() {
  const track = document.getElementById('tsTrack');
  const viewport = document.getElementById('tsViewport');
  const prevBtn = document.querySelector('.ts-prev');
  const nextBtn = document.querySelector('.ts-next');
  const dotsWrap = document.getElementById('tsDots');
  if (!track || !viewport || !prevBtn || !nextBtn || !dotsWrap) return; // not on this page

  const cards = Array.from(track.children);
  const total = cards.length;

  function getGapPx() {
    const cs = window.getComputedStyle(track);
    // CSS may expose gap via 'column-gap' or 'gap'
    const gapStr = cs.getPropertyValue('column-gap') || cs.getPropertyValue('gap') || '0px';
    const n = parseFloat(gapStr);
    return Number.isFinite(n) ? n : 0;
  }

  // How many cards are visible based on actual layout
  function visibleCount() {
    const first = cards[0];
    if (!first) return 1;
    const cardW = first.getBoundingClientRect().width || 1;
    const viewW = viewport.getBoundingClientRect().width || 1;
    // Use floor to avoid overestimating, which can collapse pages
    return Math.max(1, Math.floor((viewW + getGapPx()) / (cardW + getGapPx())));
  }

  let perView = visibleCount();
  let page = 0;

  function pageCount() {
    return Math.max(1, Math.ceil(total / perView));
  }

  function buildDots() {
    dotsWrap.innerHTML = '';
    for (let i = 0; i < pageCount(); i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Go to slide ${i + 1}`);
      b.addEventListener('click', () => goToPage(i));
      dotsWrap.appendChild(b);
    }
  }

  function update() {
    // Recompute perView each time to react to resizes
    perView = visibleCount();
    const maxPage = pageCount() - 1;
    page = Math.min(page, maxPage);

    // Calculate translateX using (cardWidth + gap) * index
    const first = cards[0];
    const cardW = first.getBoundingClientRect().width || 1;
    const gap = getGapPx();
    const targetIndex = Math.min(page * perView, total - 1);
    const targetLeft = (cardW + gap) * targetIndex;

    track.style.transform = `translateX(-${targetLeft}px)`;

    prevBtn.disabled = page <= 0;
    nextBtn.disabled = page >= maxPage;

    // update dots
    const dots = Array.from(dotsWrap.children);
    dots.forEach((d, i) =>
      d.setAttribute('aria-current', i === page ? 'true' : 'false')
    );
  }

  function goToPage(i) {
    page = i;
    update();
  }

  prevBtn.addEventListener('click', () => {
    if (page > 0) {
      page--;
      update();
    }
  });

  nextBtn.addEventListener('click', () => {
    if (page < pageCount() - 1) {
      page++;
      update();
    }
  });

  // Drag / swipe interactions
  let startX = 0, dragging = false, startPage = 0, startTx = 0;

  function currentTranslateX() {
    const m = track.style.transform.match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : 0;
  }

  viewport.addEventListener('pointerdown', (e) => {
    dragging = true;
    startX = e.clientX;
    startPage = page;
    startTx = currentTranslateX();
    viewport.setPointerCapture(e.pointerId);
    track.style.transition = 'none';
  });

  viewport.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    track.style.transform = `translateX(${startTx + dx}px)`;
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    const dx = e.clientX - startX;
    const threshold = viewport.clientWidth * 0.15;
    track.style.transition = ''; // restore CSS transition
    if (dx < -threshold && page < pageCount() - 1) page++;
    if (dx > threshold && page > 0) page--;
    update();
  }

  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);
  viewport.addEventListener('pointerleave', () => {
    if (dragging) {
      dragging = false;
      update();
    }
  });

  // Keyboard support
  viewport.setAttribute('tabindex', '0');
  viewport.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') nextBtn.click();
    if (e.key === 'ArrowLeft') prevBtn.click();
  });

  // Recalculate on resize
  window.addEventListener('resize', () => {
    buildDots();
    update();
  });

  // Initialize after images load (avatars can affect width)
  if (document.readyState === 'complete') {
    buildDots(); update();
  } else {
    window.addEventListener('load', () => { buildDots(); update(); });
  }
})();

/* ------------------------------------------------------------------
   Story creation logic (Create page)
-------------------------------------------------------------------*/
const generateBtn = document.getElementById('generateBtn');
if (generateBtn) {
  const input = document.getElementById('storyInput');
  const output = document.getElementById('storyOutput');
  const loading = document.getElementById('loading');

  generateBtn.addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) return alert('Please describe your story idea first!');
    output.textContent = '';
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
        : 'Sorry, something went wrong.';
    } catch {
      output.textContent = 'Error connecting to the story generator.';
    } finally {
      loading.classList.add('hidden');
    }
  });
}
