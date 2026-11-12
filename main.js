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

// Metrics explorer: pick a metric and a breakdown; a vertical grouped bar chart re-renders
// from window.METRICS. Per-environment values exist only for TC-SPL_act, so that view locks the metric.
const explorer = document.getElementById('explorer');
if (explorer && window.METRICS) {
  const D = window.METRICS;
  const state = { metric: 'tcspl', by: 'memory', mem: 'ALL' };
  const planners = ['react', 'vlm', 'tru'];
  const plannerNames = { react: 'ReAct', vlm: 'VLM-TAMP', tru: 'Tru-POMDP' };
  const metricNames = { success: 'task success', spl: 'SPL<sub>act</sub>', completion: 'task completion', tcspl: 'TC-SPL<sub>act</sub>' };
  const memNames = { ACC: 'Accurate', INC: 'Incomplete', OUT: 'Outdated' };
  const taskNames = ['Water fetching', 'Package preparation', 'Book collection', 'Grocery organization',
    'Guest table preparation', 'Meal delivery', 'Household cleanup'];
  const envNames = { BASE: 'Target on a surface', SUB: 'Only a substitute', ABS: 'No suitable object',
    HID: 'Inside closed receptacle', DIS: 'Distractors present' };
  const chart = explorer.querySelector('.ex-chart');
  const note = explorer.querySelector('.ex-note');
  const readout = explorer.querySelector('.ex-readout');
  const memSeg = explorer.querySelector('[data-key="mem"]');

  // Each group: short x-axis label, its long name for the readout, run count, and values
  const groups = () => {
    if (state.by === 'memory') return [
      { label: 'All', name: 'all runs', n: D.overall.all.n, vals: D.overall.all, ref: true },
      ...['ACC', 'INC', 'OUT'].map((k) => ({ label: memNames[k], name: `${memNames[k].toLowerCase()} memory`, n: D.memory[k].n, vals: D.memory[k] })),
    ];
    if (state.by === 'task') return [
      { label: 'All', name: 'all tasks', n: D.overall.all.n, vals: D.overall.all, ref: true },
      ...taskNames.map((name, i) => ({ label: `T${i + 1}`, name: `T${i + 1} ${name}`, n: D.task[i + 1].n, vals: D.task[i + 1] })),
    ];
    return ['BASE', 'SUB', 'ABS', 'HID', 'DIS'].map((k) => ({
      label: k, name: `${k} (${envNames[k].toLowerCase()})`, n: D.env[k].n, ref: k === 'BASE',
      vals: Object.fromEntries(planners.map((p) => [p, { tcspl: D.env[k][state.mem][p] }])),
    }));
  };

  const render = () => {
    explorer.querySelectorAll('.seg').forEach((seg) => seg.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('on', b.dataset.val === state[seg.dataset.key]);
      b.setAttribute('aria-pressed', b.dataset.val === state[seg.dataset.key]);
      if (seg.dataset.key === 'metric') b.disabled = state.by === 'env' && b.dataset.val !== 'tcspl';
    }));
    memSeg.hidden = state.by !== 'env';
    const gs = groups();
    const grid = [0, 25, 50, 75, 100].map((t) => `<div style="bottom:${t}%"><span>${t}</span></div>`).join('');
    chart.innerHTML = `<div class="ex-grid">${grid}</div><div class="ex-cols">` + gs.map((g, gi) => {
      const v = planners.map((p) => g.vals[p][state.metric]);
      const max = Math.max(...v);
      return `<div class="ex-col${g.ref ? ' ref' : ''}"><div class="ex-bars">` +
        planners.map((p, i) => `<button type="button" class="ex-b ${p}${v[i] === max && max > 0 ? ' max' : ''}" style="--v:${v[i]}%" ` +
          `data-g="${gi}" data-p="${p}" aria-label="${plannerNames[p]}, ${g.name}: ${v[i].toFixed(1)}%"><span>${v[i].toFixed(1)}</span></button>`).join('') +
        `</div><div class="ex-xl">${g.label}<small>n=${g.n}</small></div></div>`;
    }).join('') + '</div>';
    chart.setAttribute('aria-label', `Bar chart of ${metricNames[state.metric].replace(/<[^>]+>/g, '')} by ${state.by}`);
    chart.querySelectorAll('.ex-b').forEach((b) => {
      const show = () => {
        chart.querySelectorAll('.ex-b.sel').forEach((x) => x.classList.remove('sel'));
        b.classList.add('sel');
        const g = gs[b.dataset.g];
        readout.innerHTML = `<strong class="c-${b.dataset.p}">${plannerNames[b.dataset.p]}</strong> &middot; ${g.name}: ` +
          `<strong>${g.vals[b.dataset.p][state.metric].toFixed(1)}%</strong> ${metricNames[state.metric]} (n=${g.n})`;
      };
      b.addEventListener('mouseenter', show);
      b.addEventListener('focus', show);
      b.addEventListener('click', show);
    });
    readout.textContent = 'Hover or tap a bar for its exact value.';
    note.innerHTML = state.by === 'env'
      ? `TC-SPL<sub>act</sub> (%) per environment configuration${state.mem === 'ALL' ? ', averaged equally over the three memory conditions' : ` with ${memNames[state.mem].toLowerCase()} memory`}; n is runs per planner${state.mem === 'ALL' ? ' and memory condition' : ''}. BASE covers all seven tasks, the others only the tasks where they apply, so use the &Delta; chart below for matched comparisons.`
      : `${metricNames[state.metric][0].toUpperCase() + metricNames[state.metric].slice(1)} (%) by ${state.by === 'memory' ? 'initial-memory condition' : 'task'}; n is runs per planner. Bold values mark the best planner in each group.`;
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

// Failure / inefficiency tables: one-line definition above a row on hover, focus, or tap
const defRows = [...document.querySelectorAll('.finding-table tbody tr')].filter((tr) => tr.querySelector('th[data-def]'));
if (defRows.length) {
  const tip = document.createElement('div');
  tip.className = 'def-tip';
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);
  let current = null;
  let shownAt = 0;

  const show = (tr) => {
    shownAt = Date.now();
    const th = tr.querySelector('th[data-def]');
    if (current) current.classList.remove('def-on');
    current = tr;
    tr.classList.add('def-on');
    tip.textContent = th.dataset.def;
    const r = th.getBoundingClientRect();
    tip.style.left = '0px';
    tip.classList.add('on');
    const left = Math.min(r.left, window.innerWidth - tip.offsetWidth - 8);
    const above = r.top - tip.offsetHeight - 6;
    tip.style.left = `${Math.max(8, left)}px`;
    tip.style.top = `${above > 8 ? above : r.bottom + 6}px`;
  };
  const hide = () => {
    if (current) current.classList.remove('def-on');
    current = null;
    tip.classList.remove('on');
  };

  defRows.forEach((tr) => {
    const th = tr.querySelector('th[data-def]');
    th.setAttribute('aria-description', th.dataset.def);
    tr.addEventListener('mouseenter', () => show(tr));
    tr.addEventListener('mouseleave', hide);
    th.addEventListener('focus', () => show(tr));
    th.addEventListener('blur', hide);
    // A tap fires mouseenter then click; only a second tap should close it
    tr.addEventListener('click', () => (current === tr && Date.now() - shownAt > 400 ? hide() : show(tr)));
  });
  window.addEventListener('scroll', hide, { passive: true });
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
