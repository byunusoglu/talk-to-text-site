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

// Testimonials fade
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

// Story creation logic
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
