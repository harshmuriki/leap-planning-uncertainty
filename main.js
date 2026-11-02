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

// Task cards: play the rollout clip on hover (tap on touch screens).
// A card whose clip is missing keeps its "coming soon" placeholder.
document.querySelectorAll('.task[data-video]').forEach((card) => {
  const media = card.querySelector('.task-media');
  const video = media.querySelector('video');
  const placeholder = media.querySelector('.task-media-ph');

  video.addEventListener('loadedmetadata', () => {
    media.classList.add('has-video');
    card.classList.add('has-video');
    placeholder.hidden = true;
  });
  video.addEventListener('error', () => { video.removeAttribute('src'); });
  video.src = card.dataset.video;
  video.preload = 'metadata';

  const play = () => {
    if (!media.classList.contains('has-video')) return;
    media.classList.add('playing');
    video.play().catch(() => {});
  };
  const stop = () => {
    media.classList.remove('playing');
    video.pause();
    video.currentTime = 0;
  };
  card.addEventListener('mouseenter', play);
  card.addEventListener('mouseleave', stop);
  card.addEventListener('click', () => (video.paused ? play() : stop()));
});

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
