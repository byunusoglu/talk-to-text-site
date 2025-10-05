// Toggle menu
const menuBtn = document.getElementById('menuBtn');
const menu = document.getElementById('menu');
if (menuBtn) menuBtn.addEventListener('click', () => menu.classList.toggle('hidden'));

// Age cards on home
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

// Testimonials fade (home)
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

/* ===========================
   CREATE PAGE — Stepper + Forms
   =========================== */
const stepper = document.querySelector('.stepper');
const isCreatePage = !!document.getElementById('step1');

if (isCreatePage) {
  // Ensure stepper shows Step 1 as current and keeps it that way on this page
  function lockStepperToStep1() {
    if (!stepper) return;
    stepper.querySelectorAll('.step-card').forEach(card => card.classList.remove('current'));
    const s1 = stepper.querySelector('[data-step="1"]');
    if (s1) s1.classList.add('current');
  }
  lockStepperToStep1();

  // Radiogroup chips
  function makeChipGroup(groupEl, onChange) {
    groupEl.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        groupEl.querySelectorAll('.chip').forEach(c => {
          c.classList.remove('selected');
          c.setAttribute('aria-checked', 'false');
        });
        chip.classList.add('selected');
        chip.setAttribute('aria-checked', 'true');
        onChange?.(chip.dataset.value);
        lockStepperToStep1(); // keep stepper on Step 1
      });
    });
  }

  // Inputs
  const kidName = document.getElementById('kidName');
  const ageGroup = document.getElementById('ageGroup');
  const gender = document.getElementById('gender');
  const kidDoneBtn = document.getElementById('kidDoneBtn');

  let state = {
    name: '',
    age: '',
    gender: '',
    theme: '',
    characters: []
  };

  // Persist minimal state in sessionStorage
  function saveState() {
    sessionStorage.setItem('storybuds_create', JSON.stringify(state));
  }

  // Enable/disable Done
  function validateKidInfo() {
    const ok = state.name.trim() && state.age && state.gender;
    kidDoneBtn.disabled = !ok;
  }

  kidName?.addEventListener('input', e => {
    state.name = e.target.value;
    validateKidInfo();
    saveState();
    lockStepperToStep1();
  });

  makeChipGroup(ageGroup, val => {
    state.age = val;
    validateKidInfo();
    saveState();
  });
  makeChipGroup(gender, val => {
    state.gender = val;
    validateKidInfo();
    saveState();
  });

  // Accordion toggles (programmatic open/close)
  const accKid = document.getElementById('step1');
  const accTheme = document.getElementById('theme');
  const accSupport = document.getElementById('supporting');

  function openAccordion(section) {
    [accKid, accTheme, accSupport].forEach(sec => {
      if (!sec) return;
      const shouldOpen = sec === section;
      sec.classList.toggle('open', shouldOpen);
      sec.toggleAttribute('hidden', !shouldOpen);
    });
    // Keep stepper visually on Step 1 throughout Step 1 page
    lockStepperToStep1();
  }

  kidDoneBtn?.addEventListener('click', () => {
    if (kidDoneBtn.disabled) return;
    openAccordion(accTheme);
  });

  // Theme selection
  const themeGrid = document.getElementById('themeGrid');
  themeGrid?.querySelectorAll('.theme-card').forEach(btn => {
    btn.addEventListener('click', () => {
      themeGrid.querySelectorAll('.theme-card').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.theme = btn.dataset.theme;
      saveState();
      openAccordion(accSupport);
      validateCharacters();
    });
  });

  // Supporting characters
  const addCharacterBtn = document.getElementById('addCharacterBtn');
  const charactersWrap = document.getElementById('characters');
  const createStoriesBtn = document.getElementById('createStoriesBtn');

  function characterRowTemplate(index, value = '') {
    return `
      <div class="char-row" data-index="${index}">
        <input type="text" placeholder="Describe the character (e.g., Mom Isabel, loving, sings 'la-la')" value="${value.replace(/"/g, '&quot;')}" />
        <button type="button" class="char-remove" aria-label="Remove character">✕</button>
      </div>
    `;
  }

  function renderCharacters() {
    charactersWrap.innerHTML = state.characters.map((c, i) => characterRowTemplate(i, c)).join('');
    charactersWrap.querySelectorAll('.char-row input').forEach((inp, i) => {
      inp.addEventListener('input', e => {
        state.characters[i] = e.target.value;
        saveState();
        validateCharacters();
        lockStepperToStep1();
      });
    });
    charactersWrap.querySelectorAll('.char-remove').forEach((btn, i) => {
      btn.addEventListener('click', () => {
        state.characters.splice(i, 1);
        saveState();
        renderCharacters();
        validateCharacters();
        lockStepperToStep1();
      });
    });
  }

  function addCharacter() {
    if (state.characters.length >= 5) return;
    state.characters.push('');
    saveState();
    renderCharacters();
    validateCharacters();
    lockStepperToStep1();
  }

  function validateCharacters() {
    const hasAtLeastOne = state.characters.length >= 1;
    const anyEmpty = state.characters.some(c => !c.trim());
    const ok = hasAtLeastOne && !anyEmpty;
    createStoriesBtn.disabled = !ok;
  }

  addCharacterBtn?.addEventListener('click', addCharacter);

  createStoriesBtn?.addEventListener('click', () => {
    validateCharacters();
    if (createStoriesBtn.disabled) return;
    // All Step 1 sub-sections complete → proceed to Step 2 page
    window.location.href = 'create-step2.html';
  });

  // On load, begin with Kid section open
  openAccordion(accKid);
}

/* ===========================
   (Legacy) Single-page generator guard — retained for compatibility
   =========================== */
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
