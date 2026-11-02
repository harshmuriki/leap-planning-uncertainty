// Copy-to-clipboard for the BibTeX block
document.querySelectorAll('.copy-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const text = document.getElementById(btn.dataset.copy).textContent;
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = 'Copied!';
    } catch {
      btn.textContent = 'Copy failed';
    }
    setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
  });
});

// Task carousel: the centred slide plays its rollout, then advances to the next
// task when the clip ends. Arrows, T1-T7 tabs, swipe/scroll and arrow keys all
// move it manually; the pause button stops playback and auto-advance.
const carousel = document.querySelector('.carousel');
if (carousel) {
  const track = carousel.querySelector('.carousel-track');
  const slides = [...track.querySelectorAll('.slide')];
  const tabs = [...carousel.querySelectorAll('.carousel-tab')];
  const toggle = carousel.querySelector('.carousel-toggle');
  let active = -1;
  let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let inView = false;

  slides.forEach((slide, i) => {
    const video = slide.querySelector('video');
    const placeholder = slide.querySelector('.slide-ph');
    video.addEventListener('loadedmetadata', () => { placeholder.hidden = true; });
    video.addEventListener('timeupdate', () => {
      if (i === active && video.duration) tabs[i].firstChild.style.width = (100 * video.currentTime / video.duration) + '%';
    });
    video.addEventListener('ended', () => { if (i === active && !paused) goTo(i + 1); });
    video.src = slide.dataset.video;
    slide.querySelector('.slide-media').addEventListener('click', () => {
      if (i !== active) return goTo(i);
      setPaused(!paused);
    });
  });

  const sync = () => {
    slides.forEach((slide, i) => {
      const video = slide.querySelector('video');
      if (i === active && inView && !paused) video.play().catch(() => {});
      else video.pause();
    });
  };

  const setActive = (i) => {
    if (i === active) return;
    if (active >= 0) {
      slides[active].querySelector('video').currentTime = 0;
      tabs[active].firstChild.style.width = '0';
    }
    active = i;
    slides.forEach((s, j) => s.classList.toggle('active', j === i));
    tabs.forEach((t, j) => { t.classList.toggle('active', j === i); t.setAttribute('aria-current', j === i); });
    sync();
  };

  function goTo(i) {
    i = (i + slides.length) % slides.length;
    const slide = slides[i];
    track.scrollTo({ left: slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2 });
    setActive(i);
  }

  const setPaused = (p) => {
    paused = p;
    toggle.classList.toggle('paused', p);
    toggle.setAttribute('aria-label', p ? 'Play' : 'Pause');
    sync();
  };

  // Whichever slide is closest to the centre after manual scrolling becomes active
  let scrollTimer;
  track.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const mid = track.scrollLeft + track.clientWidth / 2;
      const dist = slides.map((s) => Math.abs(s.offsetLeft + s.offsetWidth / 2 - mid));
      setActive(dist.indexOf(Math.min(...dist)));
    }, 120);
  });

  carousel.querySelectorAll('[data-dir]').forEach((btn) =>
    btn.addEventListener('click', () => goTo(active + Number(btn.dataset.dir))));
  tabs.forEach((tab, i) => tab.addEventListener('click', () => goTo(i)));
  toggle.addEventListener('click', () => setPaused(!paused));
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(active + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(active - 1); }
    if (e.key === ' ') { e.preventDefault(); setPaused(!paused); }
  });

  // Only play while the carousel is on screen
  new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }, { threshold: 0.3 }).observe(carousel);

  setPaused(paused);
  setActive(0);
}

// Highlight the nav link for the section currently in view
const links = [...document.querySelectorAll('.nav-links a, .dotnav a')];
const sections = [...new Set(links.map((a) => a.getAttribute('href')))].map((h) => document.querySelector(h));
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id));
  });
}, { rootMargin: '-40% 0px -55% 0px' });
sections.forEach((s) => s && observer.observe(s));
