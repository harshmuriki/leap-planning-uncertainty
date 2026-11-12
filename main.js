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

// Shared hover/tap tooltip for chart marks and finding definitions
const tip = document.createElement('div');
tip.className = 'def-tip';
tip.setAttribute('role', 'tooltip');
document.body.appendChild(tip);
const showTip = (el, html) => {
  tip.innerHTML = html;
  tip.classList.add('on');
  const r = el.getBoundingClientRect();
  const left = Math.min(r.left + r.width / 2 - tip.offsetWidth / 2, window.innerWidth - tip.offsetWidth - 8);
  const above = r.top - tip.offsetHeight - 8;
  tip.style.left = `${Math.max(8, left)}px`;
  tip.style.top = `${above > 8 ? above : r.bottom + 8}px`;
};
const hideTip = () => tip.classList.remove('on');
window.addEventListener('scroll', hideTip, { passive: true });

const PLANNERS = ['react', 'vlm', 'tru'];
const PLANNER_NAMES = { react: 'ReAct', vlm: 'VLM-TAMP', tru: 'Tru-POMDP' };
const legendHtml = () => `<div class="ch-legend">${PLANNERS.map((p) => `<span class="${p}">${PLANNER_NAMES[p]}</span>`).join('')}</div>`;
const wireTips = (root) => root.querySelectorAll('[data-tip]').forEach((m) => {
  const on = () => showTip(m, m.dataset.tip);
  m.addEventListener('mouseenter', on);
  m.addEventListener('focus', on);
  m.addEventListener('click', on);
  m.addEventListener('mouseleave', hideTip);
  m.addEventListener('blur', hideTip);
});

// Grouped vertical bars, one bar per planner per group. Handles negative values by
// growing bars from the zero line. opts: groups [{label, sub, name, vals, ref}],
// min, max, ticks, fmt (value -> text), tipFmt (planner, group, value -> html), labels (bool)
function renderBars(el, opts) {
  const { groups, min = 0, max = 100, ticks = [0, 25, 50, 75, 100], fmt, tipFmt, labels = true } = opts;
  const pos = (v) => ((v - min) / (max - min)) * 100;
  const zero = pos(0);
  const grid = ticks.map((t) => `<div class="${t === 0 ? 'zero' : ''}" style="bottom:${pos(t)}%"><span>${t > 0 && min < 0 ? '+' + t : t}</span></div>`).join('');
  el.innerHTML = `<div class="ch-plot"><div class="ch-grid">${grid}</div><div class="ch-cols">` + groups.map((g) => {
    const vals = PLANNERS.map((p) => g.vals[p]);
    const best = Math.max(...vals);
    return `<div class="ch-col${g.ref ? ' ref' : ''}"><div class="ch-bars">` + PLANNERS.map((p, i) => {
      const v = vals[i];
      const h = Math.abs(pos(v) - zero);
      const neg = v < 0;
      return `<div class="ch-slot"><button type="button" class="ch-b ${p}${neg ? ' neg' : ''}" ` +
        `style="${neg ? `top:${100 - zero}%` : `bottom:${zero}%`};height:${h}%" ` +
        `aria-label="${PLANNER_NAMES[p]}, ${g.name || g.label}: ${fmt(v)}" data-tip="${tipFmt(p, g, v).replace(/"/g, '&quot;')}">` +
        (labels ? `<span class="${v === best && !opts.noBest ? 'best' : ''}">${fmt(v)}</span>` : '') + '</button></div>';
    }).join('') + `</div><div class="ch-xl">${g.label}${g.sub ? `<small>${g.sub}</small>` : ''}</div></div>`;
  }).join('') + '</div></div>';
  wireTips(el);
}

// Rows of planner x memory, columns of environment configuration, shaded by value
function renderHeat(el, D) {
  const envs = ['BASE', 'SUB', 'ABS', 'HID', 'DIS'];
  const envNames = { BASE: 'Target on a surface', SUB: 'Only a substitute', ABS: 'No suitable object', HID: 'Inside closed receptacle', DIS: 'Distractors present' };
  const mems = [['ACC', 'Accurate'], ['INC', 'Incomplete'], ['OUT', 'Outdated']];
  const all = PLANNERS.flatMap((p) => mems.flatMap(([m]) => envs.map((e) => D.env[e][m][p])));
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const body = PLANNERS.map((p) => mems.map(([m, mName], mi) => `<tr class="${mi === 0 ? 'first' : ''}">` +
    (mi === 0 ? `<th scope="rowgroup" rowspan="3" class="hm-planner ${p}"><span>${PLANNER_NAMES[p]}</span></th>` : '') +
    `<th scope="row" class="hm-mem">${mName}</th>` +
    envs.map((e) => {
      const v = D.env[e][m][p];
      const best = Math.max(...envs.map((x) => D.env[x][m][p]));
      return `<td style="--h:${Math.round(((v - lo) / (hi - lo)) * 100)}%" class="${v === best ? 'best' : ''}" tabindex="0" ` +
        `data-tip="<strong>${PLANNER_NAMES[p]}</strong> &middot; ${mName.toLowerCase()} memory &middot; ${e}<br>${v.toFixed(1)}% TC-SPL<sub>act</sub> (n=${D.env[e].n})">${v.toFixed(1)}</td>`;
    }).join('') + '</tr>').join('')).join('');
  el.innerHTML = `<div class="finding-scroll"><table class="hm-table"><thead><tr><th colspan="2"></th>` +
    envs.map((e) => `<th scope="col">${e}<small>${envNames[e]}</small></th>`).join('') + `</tr></thead><tbody>${body}</tbody></table></div>`;
  wireTips(el);
}

if (window.METRICS) {
  const D = window.METRICS;
  const pct = (v) => v.toFixed(1);
  const overall = document.getElementById('chart-overall');
  if (overall) {
    const metrics = [['success', 'Task success'], ['spl', 'SPL<sub>act</sub>'], ['completion', 'Completion'], ['tcspl', 'TC-SPL<sub>act</sub>']];
    overall.innerHTML = legendHtml() + '<div class="ch-body"></div>';
    renderBars(overall.querySelector('.ch-body'), {
      groups: metrics.map(([k, label]) => ({ label, name: label.replace(/<[^>]+>/g, ''), vals: Object.fromEntries(PLANNERS.map((p) => [p, D.overall.all[p][k]])) })),
      fmt: pct, tipFmt: (p, g, v) => `<strong>${PLANNER_NAMES[p]}</strong> &middot; ${g.label}: ${v.toFixed(1)}% (n=450)`,
    });
  }
  const byTask = document.getElementById('chart-spl-task');
  if (byTask) {
    const names = ['Water fetching', 'Package preparation', 'Book collection', 'Grocery organization', 'Guest table preparation', 'Meal delivery', 'Household cleanup'];
    byTask.innerHTML = legendHtml() + '<div class="ch-body"></div>';
    renderBars(byTask.querySelector('.ch-body'), {
      groups: names.map((n, i) => ({ label: `T${i + 1}`, sub: n, name: `T${i + 1} ${n}`, vals: Object.fromEntries(PLANNERS.map((p) => [p, D.task[i + 1][p].spl])) })),
      fmt: pct, labels: false,
      tipFmt: (p, g, v) => `<strong>${PLANNER_NAMES[p]}</strong> &middot; ${g.name}: ${v.toFixed(1)}% SPL<sub>act</sub> (n=${D.task[g.label.slice(1)].n})`,
    });
  }
  const delta = document.getElementById('chart-delta');
  if (delta) {
    const envs = [['SUB', 'Substitute'], ['ABS', 'Absent'], ['HID', 'Hidden'], ['DIS', 'Distractors']];
    delta.innerHTML = legendHtml() + '<div class="ch-body"></div>';
    renderBars(delta.querySelector('.ch-body'), {
      groups: envs.map(([k, label]) => ({ label, sub: k, name: `${label} (${k})`, vals: D.delta[k] })),
      min: -25, max: 20, ticks: [-20, -10, 0, 10, 20], noBest: true,
      fmt: (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1),
      tipFmt: (p, g, v) => `<strong>${PLANNER_NAMES[p]}</strong> &middot; ${g.name}: ${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)} pts TC-SPL<sub>act</sub> vs BASE`,
    });
  }
  const heat = document.getElementById('chart-scenario-memory');
  if (heat) renderHeat(heat, D);
}

// Metrics explorer: pick a metric and a breakdown; the grouped bar chart re-renders
// from window.METRICS. Per-environment values exist only for TC-SPL_act, so that view locks the metric.
const explorer = document.getElementById('explorer');
if (explorer && window.METRICS) {
  const D = window.METRICS;
  const state = { metric: 'tcspl', by: 'memory', mem: 'ALL' };
  const metricNames = { success: 'task success', spl: 'SPL<sub>act</sub>', completion: 'task completion', tcspl: 'TC-SPL<sub>act</sub>' };
  const memNames = { ACC: 'Accurate', INC: 'Incomplete', OUT: 'Outdated' };
  const taskNames = ['Water fetching', 'Package preparation', 'Book collection', 'Grocery organization',
    'Guest table preparation', 'Meal delivery', 'Household cleanup'];
  const envNames = { BASE: 'Target on a surface', SUB: 'Only a substitute', ABS: 'No suitable object',
    HID: 'Inside closed receptacle', DIS: 'Distractors present' };
  const chart = explorer.querySelector('.ex-chart');
  const note = explorer.querySelector('.ex-note');
  const memSeg = explorer.querySelector('[data-key="mem"]');

  const groups = () => {
    const pick = (src) => Object.fromEntries(PLANNERS.map((p) => [p, src[p][state.metric]]));
    if (state.by === 'memory') return [
      { label: 'All', sub: `n=${D.overall.all.n}`, name: 'all runs', n: D.overall.all.n, vals: pick(D.overall.all), ref: true },
      ...['ACC', 'INC', 'OUT'].map((k) => ({ label: memNames[k], sub: `n=${D.memory[k].n}`, name: `${memNames[k].toLowerCase()} memory`, n: D.memory[k].n, vals: pick(D.memory[k]) })),
    ];
    if (state.by === 'task') return [
      { label: 'All', sub: `n=${D.overall.all.n}`, name: 'all tasks', n: D.overall.all.n, vals: pick(D.overall.all), ref: true },
      ...taskNames.map((name, i) => ({ label: `T${i + 1}`, sub: `n=${D.task[i + 1].n}`, name: `T${i + 1} ${name}`, n: D.task[i + 1].n, vals: pick(D.task[i + 1]) })),
    ];
    return ['BASE', 'SUB', 'ABS', 'HID', 'DIS'].map((k) => ({
      label: k, sub: `n=${D.env[k].n}`, name: `${k} (${envNames[k].toLowerCase()})`, n: D.env[k].n, ref: k === 'BASE',
      vals: Object.fromEntries(PLANNERS.map((p) => [p, D.env[k][state.mem][p]])),
    }));
  };

  const render = () => {
    explorer.querySelectorAll('.seg').forEach((seg) => seg.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('on', b.dataset.val === state[seg.dataset.key]);
      b.setAttribute('aria-pressed', b.dataset.val === state[seg.dataset.key]);
      if (seg.dataset.key === 'metric') b.disabled = state.by === 'env' && b.dataset.val !== 'tcspl';
    }));
    memSeg.hidden = state.by !== 'env';
    hideTip();
    renderBars(chart, {
      groups: groups(), fmt: (v) => v.toFixed(1), labels: state.by !== 'task',
      tipFmt: (p, g, v) => `<strong>${PLANNER_NAMES[p]}</strong> &middot; ${g.name}: ${v.toFixed(1)}% ${metricNames[state.metric]} (n=${g.n})`,
    });
    note.innerHTML = state.by === 'env'
      ? `TC-SPL<sub>act</sub> (%) per environment configuration${state.mem === 'ALL' ? ', averaged equally over the three memory conditions' : ` with ${memNames[state.mem].toLowerCase()} memory`}; n is runs per planner${state.mem === 'ALL' ? ' and memory condition' : ''}. BASE covers all seven tasks, the others only the tasks where they apply, so use the &Delta; chart below for matched comparisons.`
      : `${metricNames[state.metric][0].toUpperCase() + metricNames[state.metric].slice(1)} (%) by ${state.by === 'memory' ? 'initial-memory condition' : 'task'}; n is runs per planner. Hover or tap a bar for its exact value${state.by === 'task' ? '' : '; bold values mark the best planner in each group'}.`;
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
let defRow = null;
let defShownAt = 0;
const showDef = (tr) => {
  if (defRow) defRow.classList.remove('def-on');
  defRow = tr;
  defShownAt = Date.now();
  tr.classList.add('def-on');
  const th = tr.querySelector('th[data-def]');
  showTip(th, th.dataset.def);
  // Anchor definitions to the label's left edge rather than its centre
  tip.style.left = `${Math.max(8, Math.min(th.getBoundingClientRect().left, window.innerWidth - tip.offsetWidth - 8))}px`;
};
const hideDef = () => {
  if (defRow) defRow.classList.remove('def-on');
  defRow = null;
  hideTip();
};
defRows.forEach((tr) => {
  const th = tr.querySelector('th[data-def]');
  th.setAttribute('aria-description', th.dataset.def);
  tr.addEventListener('mouseenter', () => showDef(tr));
  tr.addEventListener('mouseleave', hideDef);
  th.addEventListener('focus', () => showDef(tr));
  th.addEventListener('blur', hideDef);
  // A tap fires mouseenter then click; only a second tap should close it
  tr.addEventListener('click', () => (defRow === tr && Date.now() - defShownAt > 400 ? hideDef() : showDef(tr)));
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
