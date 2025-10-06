// ---------- Shared topbar ----------

// Toggle menu
const menuBtn = document.getElementById('menuBtn');
const menu = document.getElementById('menu');
if (menuBtn) menuBtn.addEventListener('click', () => menu.classList.toggle('hidden'));

// Footer year
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Cart: localStorage helpers
const CART_KEY = 'sb_cart_items';
function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch { return []; }
}
function setCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  updateCartCount();
}
function updateCartCount() {
  const countEl = document.getElementById('cartCount');
  if (!countEl) return;
  const items = getCart();
  const count = items.reduce((sum, it) => sum + (it.qty || 1), 0);
  countEl.textContent = String(count);
}
updateCartCount();

const cartBtn = document.getElementById('cartBtn');
if (cartBtn) cartBtn.addEventListener('click', () => {
  // Placeholder — later this can navigate to /cart or open a drawer
  alert('Cart preview coming in the signup/checkout flow.');
});

// ---------- Home page (testimonials / age cards) ----------
document.querySelectorAll('.age-card').forEach(card => {
  card.addEventListener('click', () => {
    const target = card.dataset.target;
    document.body.classList.add('fade-out');
    setTimeout(() => (window.location.href = target), 200);
  });
});

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

// ---------- Create journey (3-step wizard) ----------
const stepper = document.getElementById('stepper');
const panels = Array.from(document.querySelectorAll('.step-panel'));
const prevBtn = document.getElementById('prevStep');
const nextBtn = document.getElementById('nextStep');
const generateBtn = document.getElementById('generateBtn');
const loading = document.getElementById('loading');

let currentStep = 0;

function updateStepperUI() {
  if (!stepper) return;
  const steps = Array.from(stepper.querySelectorAll('.step'));
  steps.forEach((li, idx) => {
    li.classList.toggle('active', idx === currentStep);
    li.classList.toggle('done', idx < currentStep);
  });
  panels.forEach(p => p.classList.toggle('hidden', Number(p.dataset.step) !== currentStep));
  if (prevBtn) prevBtn.disabled = currentStep === 0;
  if (nextBtn) nextBtn.classList.toggle('hidden', currentStep === panels.length - 1);
  if (generateBtn) generateBtn.classList.toggle('hidden', currentStep !== panels.length - 1);
}

function canProceed(stepIdx) {
  if (stepIdx === 0) {
    const name = document.getElementById('kidName')?.value.trim();
    const age = document.getElementById('kidAge')?.value.trim();
    return !!name || !!age;
  }
  return true;
}

if (nextBtn) {
  nextBtn.addEventListener('click', () => {
    if (!canProceed(currentStep)) {
      alert("Please add at least your child’s name or age to continue.");
      return;
    }
    currentStep = Math.min(currentStep + 1, panels.length - 1);
    updateStepperUI();
  });
}
if (prevBtn) {
  prevBtn.addEventListener('click', () => {
    currentStep = Math.max(currentStep - 1, 0);
    updateStepperUI();
  });
}

if (stepper) {
  stepper.addEventListener('click', (e) => {
    const li = e.target.closest('.step');
    if (!li) return;
    const target = Number(li.dataset.step);
    if (target <= currentStep || canProceed(currentStep)) {
      currentStep = target;
      updateStepperUI();
    } else {
      alert("Please complete the current step first.");
    }
  });
}

// Minimal Markdown → HTML
function mdToHTML(md) {
  if (!md) return '';
  let html = md;
  html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/\n{2,}/g, '</p><p>');
  html = `<p>${html}</p>`;
  return html;
}

// Generate, save, redirect to checkout
async function handleGenerate() {
  const kidName = document.getElementById('kidName')?.value.trim();
  const kidAgeRaw = document.getElementById('kidAge')?.value.trim();
  const kidAge = Number.isFinite(Number(kidAgeRaw)) ? Number(kidAgeRaw) : null;
  const kidLikes = document.getElementById('kidLikes')?.value.trim();
  const theme = document.getElementById('theme')?.value.trim();
  const moments = document.getElementById('moments')?.value.trim();
  const char1 = document.getElementById('char1')?.value.trim();
  const char2 = document.getElementById('char2')?.value.trim();
  const extras = document.getElementById('extras')?.value.trim();

  const transcriptParts = [
    kidName ? `Child name: ${kidName}` : "",
    kidAgeRaw ? `Age: ${kidAgeRaw}` : "",
    kidLikes ? `Likes: ${kidLikes}` : "",
    theme ? `Theme: ${theme}` : "",
    moments ? `Key moments: ${moments}` : "",
    char1 ? `Supporting character: ${char1}` : "",
    char2 ? `Supporting character: ${char2}` : "",
    extras ? `Extras: ${extras}` : ""
  ].filter(Boolean);

  if (!transcriptParts.length) {
    alert("Please add at least one detail before generating.");
    return;
  }

  loading?.classList.remove('hidden');

  try {
    // Keep the same API & payload as your current setup:contentReference[oaicite:6]{index=6}:contentReference[oaicite:7]{index=7}
    const res = await fetch('https://fairytale-api.vercel.app/api/generate-story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: transcriptParts.join('\n') })
    });
    const data = await res.json();

    const storyMD = data.story || '';
    sessionStorage.setItem('sb_story_md', storyMD);
    sessionStorage.setItem('sb_child_age', String(kidAge ?? ''));

    // Redirect to checkout page after generation
    window.location.href = 'checkout.html';
  } catch (e) {
    alert('Error connecting to the story generator.');
  } finally {
    loading?.classList.add('hidden');
  }
}

if (generateBtn) generateBtn.addEventListener('click', handleGenerate);

// Initialize wizard UI if present
if (panels.length) updateStepperUI();

// ---------- Checkout page logic ----------
const storyContentEl = document.getElementById('storyContent');
const storyHeroEl = document.getElementById('storyHero');
const productsTrack = document.getElementById('productsTrack');

if (storyContentEl && storyHeroEl) {
  // Load story
  const md = sessionStorage.getItem('sb_story_md') || '';
  if (!md) {
    storyContentEl.innerHTML = '<p>We couldn’t find your story. <a href="create.html">Create one now</a>.</p>';
  } else {
    storyContentEl.innerHTML = mdToHTML(md);
  }

  // Age-based background
  const ageRaw = sessionStorage.getItem('sb_child_age');
  const age = Number.isFinite(Number(ageRaw)) ? Number(ageRaw) : null;

  let bgClass = 'bg-3-5'; // default middle
  if (age !== null) {
    if (age <= 2) bgClass = 'bg-0-2';
    else if (age >= 5) bgClass = 'bg-5-plus';
  }
  storyHeroEl.classList.add(bgClass);
}

// Products data (as requested)
const PRODUCTS = [
  {
    id: 'series',
    title: 'Make it a series',
    desc: 'Continue this tale across 4 chapters.',
    price: 4.99,
    original: 7.99
  },
  {
    id: 'book',
    title: 'Get the book',
    desc: 'Turn your story into a keepsake book.',
    price: 12.99,
    original: 16.50
  },
  {
    id: 'film',
    title: 'Film it!',
    desc: 'Create a short animation of the story.',
    price: 15.99,
    original: 22.00
  }
];

function renderProducts() {
  if (!productsTrack) return;
  productsTrack.innerHTML = '';
  PRODUCTS.forEach(p => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="product-body">
        <h3>${p.title}</h3>
        <p class="muted">${p.desc}</p>
        <div class="price-row">
          <span class="price">£${p.price.toFixed(2)}</span>
          <span class="price-old">£${p.original.toFixed(2)}</span>
        </div>
        <button class="btn add-btn" data-id="${p.id}">Add to cart</button>
      </div>
    `;
    productsTrack.appendChild(card);
  });

  productsTrack.addEventListener('click', (e) => {
    const btn = e.target.closest('.add-btn');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const product = PRODUCTS.find(p => p.id === id);
    if (!product) return;
    const items = getCart();
    const existing = items.find(i => i.id === id);
    if (existing) existing.qty = (existing.qty || 1) + 1;
    else items.push({ id, title: product.title, price: product.price, qty: 1 });
    setCart(items);
    btn.textContent = 'Added ✓';
    setTimeout(() => (btn.textContent = 'Add to cart'), 1000);
  });
}

if (productsTrack) renderProducts();

// Carousel controls (smooth scroll)
const prevCarousel = document.getElementById('prevCarousel');
const nextCarousel = document.getElementById('nextCarousel');
if (prevCarousel && nextCarousel && productsTrack) {
  prevCarousel.addEventListener('click', () => {
    productsTrack.parentElement.scrollBy({ left: -300, behavior: 'smooth' });
  });
  nextCarousel.addEventListener('click', () => {
    productsTrack.parentElement.scrollBy({ left: 300, behavior: 'smooth' });
  });
}
