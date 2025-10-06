// Toggle menu
const menuBtn = document.getElementById('menuBtn');
const menu = document.getElementById('menu');
if (menuBtn) menuBtn.addEventListener('click', () => menu.classList.toggle('hidden'));

// Age group navigation (home page)
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

// Testimonials fade (home page)
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

/* -----------------------------
   Create Journey — 3-step wizard
   Steps: 0) About the kid
          1) Theme
          2) Supporting characters
------------------------------*/
const stepper = document.getElementById('stepper');
const panels = Array.from(document.querySelectorAll('.step-panel'));
const prevBtn = document.getElementById('prevStep');
const nextBtn = document.getElementById('nextStep');
const generateBtn = document.getElementById('generateBtn');
const loading = document.getElementById('loading');
const output = document.getElementById('storyOutput');

let currentStep = 0;

function updateStepperUI() {
  if (!stepper) return;
  const steps = Array.from(stepper.querySelectorAll('.step'));
  steps.forEach((li, idx) => {
    li.classList.toggle('active', idx === currentStep);
    li.classList.toggle('done', idx < currentStep);
  });

  panels.forEach(p => p.classList.toggle('hidden', Number(p.dataset.step) !== currentStep));

  // Nav buttons
  if (prevBtn) prevBtn.disabled = currentStep === 0;
  if (nextBtn) nextBtn.classList.toggle('hidden', currentStep === panels.length - 1);
  if (generateBtn) generateBtn.classList.toggle('hidden', currentStep !== panels.length - 1);
}

function canProceed(stepIdx) {
  // Simple, friendly validation mirroring existing logic:
  // Only require minimal info on step 0 to proceed.
  if (stepIdx === 0) {
    const name = document.getElementById('kidName')?.value.trim();
    const age = document.getElementById('kidAge')?.value.trim();
    return !!name || !!age; // at least one provided
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

// Allow clicking steps directly (keep existing components/logic, just re-labeled)
if (stepper) {
  stepper.addEventListener('click', (e) => {
    const li = e.target.closest('.step');
    if (!li) return;
    const target = Number(li.dataset.step);
    // Can always go back; can go forward if previous valid.
    if (target <= currentStep || canProceed(currentStep)) {
      currentStep = target;
      updateStepperUI();
    } else {
      alert("Please complete the current step first.");
    }
  });
}

// Compose transcript from all 3 steps and call the same API as before.
async function generateStory() {
  // Gather fields
  const kidName = document.getElementById('kidName')?.value.trim();
  const kidAge = document.getElementById('kidAge')?.value.trim();
  const kidLikes = document.getElementById('kidLikes')?.value.trim();
  const theme = document.getElementById('theme')?.value.trim();
  const moments = document.getElementById('moments')?.value.trim();
  const char1 = document.getElementById('char1')?.value.trim();
  const char2 = document.getElementById('char2')?.value.trim();
  const extras = document.getElementById('extras')?.value.trim();

  // Build a natural transcript string so backend behaviour stays identical
  // to your existing create page which sends { transcript }:contentReference[oaicite:4]{index=4}.
  const transcriptParts = [
    kidName ? `Child name: ${kidName}` : "",
    kidAge ? `Age: ${kidAge}` : "",
    kidLikes ? `Likes: ${kidLikes}` : "",
    theme ? `Theme: ${theme}` : "",
    moments ? `Key moments: ${moments}` : "",
    char1 ? `Supporting character: ${char1}` : "",
    char2 ? `Supporting character: ${char2}` : "",
    extras ? `Extras: ${extras}` : ""
  ].filter(Boolean);

  if (transcriptParts.length === 0) {
    alert("Please add at least one detail before generating.");
    return;
  }

  output.textContent = "";
  loading?.classList.remove('hidden');

  try {
    const res = await fetch('https://fairytale-api.vercel.app/api/generate-story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: transcriptParts.join('\n') })
    });
    const data = await res.json();
    output.innerHTML = data.story
      ? data.story.replace(/\n/g, '<br/>')
      : "Sorry, something went wrong.";
  } catch {
    output.textContent = "Error connecting to the story generator.";
  } finally {
    loading?.classList.add('hidden');
  }
}

// Hook up Generate button (final step)
if (generateBtn) {
  generateBtn.addEventListener('click', generateStory);
}

// Initialize wizard UI at load
if (panels.length) updateStepperUI();
