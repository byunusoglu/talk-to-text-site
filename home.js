// Homepage-only logic (loaded only on index.html)

// Highlight default age (0–2) on the top strip
(() => {
  const chips = document.querySelectorAll('.age-chip');
  if (!chips.length) return;
  chips.forEach((c, i) => c.classList.toggle('is-active', i === 0));
})();

// Robust, seamless hero carousel (4 slides, 3s, infinite, jitter-free)
(() => {
  const track = document.getElementById('heroTrack');
  const dotsWrap = document.getElementById('heroDots');
  if (!track || !dotsWrap) return;

  const originals = Array.from(track.children);
  const total = originals.length; // 4

  // Clone for seamless loop
  const firstClone = originals[0].cloneNode(true);
  const lastClone  = originals[total - 1].cloneNode(true);
  firstClone.classList.add('is-clone');
  lastClone.classList.add('is-clone');

  track.appendChild(firstClone);
  track.insertBefore(lastClone, originals[0]);

  // Ensure each slide is 100% width
  Array.from(track.children).forEach(s => (s.style.flex = '0 0 100%'));

  const dots = Array.from(dotsWrap.querySelectorAll('.dot'));
  let index = 1; // start at first real slide (offset by the prepended clone)
  let timer = null;

  const setTransition = (on) => {
    track.classList.toggle('no-transition', !on);
  };

  const apply = () => {
    track.style.transform = `translateX(-${index * 100}%)`;
    const activeDot = (index - 1 + total) % total;
    dots.forEach((d, i) => d.classList.toggle('is-active', i === activeDot));
  };

  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
  const start = () => {
    stop();
    timer = setInterval(() => {
      index += 1;
      setTransition(true);
      apply();
    }, 3000);
  };

  // Snap seamlessly when we hit clones
  track.addEventListener('transitionend', () => {
    const items = track.children;
    if (items[index].classList.contains('is-clone')) {
      setTransition(false);
      if (index === 0) index = total;          // jumped to lastClone → show last real
      if (index === total + 1) index = 1;      // jumped to firstClone → show first real
      apply();
      // Force reflow so transition toggle takes effect
      void track.offsetWidth;
      setTransition(true);
    }
  });

  // Dots click
  dots.forEach((d, i) => d.addEventListener('click', () => {
    stop();
    index = i + 1; // offset because of leading clone
    setTransition(true);
    apply();
    start();
  }));

  // Hover pause
  ['mouseenter', 'mouseleave'].forEach(evt => {
    [track, dotsWrap].forEach(el => el.addEventListener(evt, () => {
      if (evt === 'mouseenter') stop(); else start();
    }));
  });

  // Kickoff
  setTransition(false);
  apply();          // position at first real
  void track.offsetWidth;
  setTransition(true);
  start();

  // Tab visibility handling
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });
})();
