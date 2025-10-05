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
   Markup expected in index.html:
   - .testimonial-slider with .ts-prev, .ts-next
   - .ts-viewport wrapping #tsTrack
   - #tsDots for pagination dots
-------------------------------------------------------------------*/
(function initTestimonialSlider() {
  const track = document.getElementById('tsTrack');
  const viewport = document.getElementById('tsViewport');
  const prevBtn = document.querySelector('.ts-prev');
  const nextBtn = document.querySelector('.ts-next');
  const dotsWrap = document.getElementById('tsDots');

  if (!track || !viewport || !prevBtn || !nextBtn || !dotsWrap) return;

  const cards = Array.from(track.children);
  const total = cards.length;

  // How many cards are visible based on actual layout
  function visibleCount() {
    const firstCard = cards[0];
    if (!firstCard) return 1;
    const cardWidth = firstCard.getBoundingClientRect().width || 1;
    const viewWidth = viewport.getBoundingClientRect().width || 1;
    return Math.max(1, Math.round(viewWidth / cardWidth));
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
    perView = visibleCount();
    const maxPage = pageCount() - 1;
    page = Math.min(page, maxPage);

    const firstLeft = cards[0].offsetLeft;
    const targetIndex = Math.min(page * perView, total - 1);
    const targetLeft = cards[targetIndex].offsetLeft - firstLeft;

    track.style.transform = `translateX(-${targetLeft}px)`;

    prevBtn.disabled = page <= 0;
    nextBtn.disabled = page >= maxPage;

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
  let startX = 0,
    dragging = false,
    startMatrixX = 0;

  function currentTranslateX() {
    const m = track.style.transform.match(/translateX\((-?\d+(\.\d+)?)px\)/);
    return m ? parseFloat(m[1]) : 0;
  }

  viewport.addEventListener('pointerdown', (e) => {
    dragging = true;
    startX = e.clientX;
    startMatrixX = currentTranslateX();
    viewport.setPointerCapture(e.pointerId);
    track.style.transition = 'none';
  });

  viewport.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    track.style.transform = `translateX(${startMatrixX + dx}px)`;
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

  // Init
  buildDots();
  update();
})();

/* ------------------------------------------------------------------
   Story creation logic (Create page)
   (unchanged; posts transcript to your Vercel API)
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
