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

// Hero comparison: one rollout at a time at 2x, cycling ReAct -> VLM-TAMP ->
// Tru-POMDP. The tabs switch planner (restarting its clip); clicking the video pauses.
const compare = document.querySelector('.compare');
if (compare) {
  const videos = [...compare.querySelectorAll('.compare-stage video')];
  const tabs = [...compare.querySelectorAll('.compare-tab')];
  const stat = compare.querySelector('.compare-stat');
  const keys = ['react', 'vlm', 'tru'];
  let active = 0;
  let paused = false;
  let inView = true;

  const sync = () => videos.forEach((v, i) => {
    if (i === active && inView && !paused) { v.playbackRate = 2; v.play().catch(() => {}); }
    else v.pause();
  });

  const show = (i) => {
    tabs[active].firstChild.style.width = '0';
    active = (i + videos.length) % videos.length;
    videos.forEach((v, j) => { v.classList.toggle('active', j === active); v.currentTime = 0; });
    tabs.forEach((t, j) => { t.classList.toggle('active', j === active); t.setAttribute('aria-pressed', j === active); });
    compare.classList.remove(...keys);
    compare.classList.add(keys[active]);
    stat.textContent = `${tabs[active].textContent}: ${tabs[active].dataset.actions} actions`;
    paused = false;
    sync();
  };

  videos.forEach((v, i) => {
    v.addEventListener('timeupdate', () => {
      if (i === active && v.duration) tabs[i].firstChild.style.width = (100 * v.currentTime / v.duration) + '%';
    });
    v.addEventListener('ended', () => { if (i === active) show(i + 1); });
  });
  tabs.forEach((t, i) => t.addEventListener('click', () => show(i)));
  compare.querySelector('.compare-stage').addEventListener('click', () => { paused = !paused; sync(); });
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync(); }, { threshold: 0.3 }).observe(compare);
  show(0);
}

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
    // Browsers can drop a smooth scroll on an off-screen element, so jump instantly then
    const behavior = inView && document.visibilityState === 'visible' ? 'smooth' : 'instant';
    const left = slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2;
    const from = track.scrollLeft;
    track.scrollTo({ left, behavior });
    // ...and if a smooth scroll never started at all, land there directly
    if (behavior === 'smooth') setTimeout(() => {
      if (track.scrollLeft === from && Math.abs(from - left) > 2) track.scrollTo({ left, behavior: 'instant' });
    }, 400);
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

// Metrics explorer: pick a metric and a breakdown; the table re-renders from window.METRICS.
// Per-environment values exist only for TC-SPL_act, so that view locks the metric.
const explorer = document.getElementById('explorer');
if (explorer && window.METRICS) {
  const D = window.METRICS;
  const state = { metric: 'tcspl', by: 'memory', mem: 'ALL' };
  const planners = ['react', 'vlm', 'tru'];
  const metricNames = { success: 'task success', spl: 'SPL<sub>act</sub>', completion: 'task completion', tcspl: 'TC-SPL<sub>act</sub>' };
  const memNames = { ACC: 'Accurate', INC: 'Incomplete', OUT: 'Outdated' };
  const taskNames = ['Water fetching', 'Package preparation', 'Book collection', 'Grocery organization',
    'Guest table preparation', 'Meal delivery', 'Household cleanup'];
  const envNames = { BASE: 'Target on a surface', SUB: 'Only a substitute', ABS: 'No suitable object',
    HID: 'Inside closed receptacle', DIS: 'Distractors present' };
  const tbody = explorer.querySelector('tbody');
  const groupHead = explorer.querySelector('.ex-group');
  const note = explorer.querySelector('.ex-note');
  const memSeg = explorer.querySelector('[data-key="mem"]');

  const rows = () => {
    if (state.by === 'memory') return [
      { label: 'All runs', sub: `n=${D.overall.all.n}`, vals: D.overall.all, ref: true },
      ...['ACC', 'INC', 'OUT'].map((k) => ({ label: memNames[k], sub: `n=${D.memory[k].n}`, vals: D.memory[k] })),
    ];
    if (state.by === 'task') return [
      { label: 'All tasks', sub: `n=${D.overall.all.n}`, vals: D.overall.all, ref: true },
      ...taskNames.map((name, i) => ({ label: `T${i + 1} ${name}`, sub: `n=${D.task[i + 1].n}`, vals: D.task[i + 1] })),
    ];
    return ['BASE', 'SUB', 'ABS', 'HID', 'DIS'].map((k) => {
      const cell = D.env[k][state.mem];
      return { label: `${k} &middot; ${envNames[k]}`, sub: `n=${D.env[k].n} per planner${state.mem === 'ALL' ? ' per memory' : ''}`,
        vals: Object.fromEntries(planners.map((p) => [p, { tcspl: cell[p] }])), ref: k === 'BASE' };
    });
  };

  const render = () => {
    explorer.querySelectorAll('.seg').forEach((seg) => seg.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('on', b.dataset.val === state[seg.dataset.key]);
      b.setAttribute('aria-pressed', b.dataset.val === state[seg.dataset.key]);
      if (seg.dataset.key === 'metric') b.disabled = state.by === 'env' && b.dataset.val !== 'tcspl';
    }));
    memSeg.hidden = state.by !== 'env';
    groupHead.textContent = { memory: 'Initial memory', task: 'Task', env: 'Environment' }[state.by];
    tbody.innerHTML = rows().map((r) => {
      const v = planners.map((p) => r.vals[p][state.metric]);
      const max = Math.max(...v);
      return `<tr class="${r.ref ? 'ref' : ''}"><th scope="row">${r.label}<small>${r.sub}</small></th>` +
        planners.map((p, i) => `<td class="${p}${v[i] === max && max > 0 ? ' max' : ''}" title="${v[i].toFixed(1)}%">` +
          `<div class="ex-bar"><i style="--w:${v[i]}%"></i><span>${v[i].toFixed(1)}</span></div></td>`).join('') + '</tr>';
    }).join('');
    note.innerHTML = state.by === 'env'
      ? `TC-SPL<sub>act</sub> (%) per environment configuration${state.mem === 'ALL' ? ', averaged equally over the three memory conditions' : ` with ${memNames[state.mem].toLowerCase()} memory`}. BASE covers all seven tasks; the others only the tasks where they apply, so use the &Delta; chart below for matched comparisons.`
      : `${metricNames[state.metric][0].toUpperCase() + metricNames[state.metric].slice(1)} (%) by ${state.by === 'memory' ? 'initial-memory condition' : 'task'}. Bold marks the best planner in each row.`;
  };

  explorer.querySelectorAll('.seg').forEach((seg) => seg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    state[seg.dataset.key] = b.dataset.val;
    if (state.by === 'env') state.metric = 'tcspl';
    render();
  }));
  render();
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
