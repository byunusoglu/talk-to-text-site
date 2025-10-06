/* ---------- Tiny DOM helpers ---------- */
const $  = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

/* ---------- Age persistence ---------- */
const STORAGE_KEY = "yw_age_group";
const DEFAULT_AGE = "0-2";

const getAge = () => localStorage.getItem(STORAGE_KEY) || DEFAULT_AGE;
const setAge = (age) => localStorage.setItem(STORAGE_KEY, age);

function paintSelectedAge() {
  const current = getAge();
  $$(".age-btn").forEach(btn => {
    const raw = (btn.dataset.age || "").trim();
    btn.classList.toggle("selected", raw === current);
  });
}

/* ---------- Smooth fade navigation helper ---------- */
function fadeOutAnd(cb){
  // If you have an app-wide transition, hook it here. Fallback: call immediately.
  try { document.body.classList.add('page-fade-out'); } catch {}
  setTimeout(() => cb && cb(), 80);
}

/* ---------- HERO CONFIG PER AGE ---------- */
const HERO_BY_AGE = {
  "0-2": {
    image: "momdaughterbanner.png",
    title: "Create magical fairytales together.",
    desc:  "Turn your child’s imagination into their favourite storytime moment — every night.",
    cta:   "Create story"
  },
  "3-5": {
    image: "childsdreambanner.png",
    title: "Create magical bedtime stories together.",
    desc:  "Turn your child’s imagination into their favourite storytime moment — every night.",
    cta:   "Create story"
  },
  "5+": {
    image: "grownbanner.png",
    title: "Create superhero stories together.",
    desc:  "Turn your child’s imagination into their favourite storytime moment — every night.",
    cta:   "Create story"
  }
};

function updateHeroForAge(ageRaw) {
  const age = (ageRaw || DEFAULT_AGE).trim();
  const cfg = HERO_BY_AGE[age] || HERO_BY_AGE[DEFAULT_AGE];

  const banner = $(".hero-banner");
  const title  = $("#heroTitle") || $(".hero-text h1");
  const desc   = $("#heroDesc")  || $(".hero-text p");
  const cta    = $("#heroCta")   || $(".hero-text .btn");

  // Swap background image
  if (banner && cfg.image) {
    banner.style.backgroundImage = `url('${cfg.image}')`;
  }
  // Swap overlay text
  if (title) title.textContent = cfg.title;
  if (desc)  desc.textContent  = cfg.desc;
  if (cta) {
    cta.textContent = cfg.cta;
    // CTA always navigates to create journey
    cta.onclick = () => fadeOutAnd(() => { window.location.href = "create.html"; });
  }
}

/* ---------- Age buttons behavior (no auto navigation) ---------- */
function initAgeButtons() {
  // Ensure hero matches current selection on load
  paintSelectedAge();
  updateHeroForAge(getAge());

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".age-btn");
    if (!btn) return;

    const raw = (btn.dataset.age || "").trim();
    const val = (raw === "0-2" || raw === "3-5" || raw === "5+") ? raw : DEFAULT_AGE;

    // Persist + repaint
    setAge(val);
    $$(".age-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");

    // Live update hero (image + overlay + CTA text) — no redirect here
    updateHeroForAge(val);
  }, { passive: false });
}

/* ---------- Misc small inits ---------- */
function initYear(){
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
}

/* ---------- Boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
  initYear();
  initAgeButtons();
});
