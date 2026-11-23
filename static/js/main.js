/* StateStream project page: hero stream with its prompt timeline, synced multi-method comparison player,
   figure lightbox, section progress and BibTeX copy. No dependencies. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const PCOL = ["var(--p1)", "var(--p2)", "var(--p3)", "var(--p4)"];
  const OURS = "StateStream";
  const BASELINES = ["LongLive", "TempAct", "IAMFlow"];
  const GROUPS = [
    { id: "all", label: "All" },
    { id: "everyday", label: "Everyday" },
    { id: "memory", label: "Memory-dependent" },
    { id: "conditional", label: "Conditional" },
    { id: "short", label: "15-second clips" },
  ];
  const HERO = ["polar-bear-aurora", "telephone-box-fog", "kitchen-cat", "attic-trunk-owl"];
  const DEFAULT_SCENE = "garden-shed-door";
  const vurl = (id, file) => `static/video/${id}/${file}`;
  const fmt = (t) => `${(Math.max(0, t)).toFixed(1)} s`;
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ───────── nav progress + active section ───────── */
  const bar = $(".progress");
  const links = $$(".nav a");
  const secs = links.map((a) => $(a.getAttribute("href"))).filter(Boolean);
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const h = document.documentElement;
      const p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
      if (bar) bar.style.transform = `scaleX(${p})`;
      let cur = null;
      for (const s of secs) if (s.getBoundingClientRect().top < 140) cur = s;
      links.forEach((a) => a.classList.toggle("is-active", cur && a.getAttribute("href") === "#" + cur.id));
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ───────── motion: blocks rise in as they scroll into view ───────── */
  if (!reduceMotion && "IntersectionObserver" in window) {
    document.documentElement.classList.add("js-motion");
    const sel = ".section .sec-head, .section .plate, .section .panel, .mcard, .f-card, .explain, .run, .player, .overview-grid .prose, .bib";
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      io.unobserve(e.target);
    }), { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    $$(sel).forEach((el) => {
      if (el.parentElement.closest(".rv") || el.getBoundingClientRect().top < window.innerHeight) return;
      const sib = Array.from(el.parentElement.children).filter((c) => c.matches(sel));
      el.style.setProperty("--d", `${Math.min(sib.indexOf(el), 4) * 0.08}s`);
      el.classList.add("rv");
      io.observe(el);
    });
  }

  /* ───────── Fig. 3: the figure rebuilt from its PowerPoint source, assembled step by step ───────── */
  (function pipeline() {
    const fig = $("#pipe");
    const svg = fig && $("svg.f3", fig);
    if (!svg) return;
    const wrap = $(".f3wrap", fig), stepsEl = $("#pipe-steps"), cap = $("#pipe-cap"), btn = $("#pipe-play");
    const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5v14l12-7z"/></svg>';
    const PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';
    const STEPS = [
      { k: "Modules", ms: 3400, c: "Three modules share one world state. Below them runs the generated stream." },
      { k: "Prompt", ms: 5200, c: "While the video streams, a prompt arrives at 10 s: “Blue fish swims in and stays by plants.” The panel above zooms into this moment." },
      { k: "Planner", ms: 5600, c: "The State Planner reads the prompt against the state code, the program that records every change requested so far." },
      { k: "Plan", ms: 6200, c: "It writes a state update, <code>blue_fish = Creature(…)</code>, and an execution plan: action “Swim in”, check “Blue fish visible?”." },
      { k: "Condition", ms: 5800, c: "The update becomes World-State text, which describes every entity as it should now be, next to the active step description “Swim in”." },
      { k: "Generate", ms: 6400, c: "The frozen generator streams the next chunk from that text, Shared KV (the opening scene) and Window KV (recent frames)." },
      { k: "Check", ms: 7400, c: "The same VLM checks a generated frame: “Blue fish visible?” Not yet: keep generating and check again; nothing is written to memory." },
      { k: "Confirm", ms: 6000, c: "Confirmed: the step description is dropped, and “blue fish” stays in the World-State text." },
      { k: "Write", ms: 7200, c: "Only now are the fish's K/V taken from its region, found through cross-attention to its name, into Entity KV." },
      { k: "Reuse", ms: 5600, c: "Later chunks read the fish's Entity KV inside its region, so the same fish stays in the scene." },
      { k: "Stream", ms: 5600, c: "The stream goes on with the next prompts; each change stays until a later prompt replaces it." },
      { k: "Full", ms: 6500, c: "The whole pipeline, as in the paper." },
    ];
    const FULL = STEPS.length - 1;
    const els = $$("g[data-s]", svg).map((g) => ({ g, s: +g.dataset.s, t: +g.dataset.t }));
    let idx = 0, t0 = 0, elapsed = 0, playing = !reduceMotion, visible = false, raf = 0;
    wrap.classList.add(reduceMotion ? "is-static" : "is-anim");
    STEPS.forEach((st, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<button type="button"><i>${i}</i><span>${st.k}</span><b></b></button>`;
      $("button", li).addEventListener("click", () => { setPlaying(false); show(i); });
      stepsEl.appendChild(li);
    });
    function show(i) {
      idx = (i + STEPS.length) % STEPS.length;
      const st = STEPS[idx], full = idx === FULL;
      els.forEach((e) => {
        const cur = !full && e.s === idx;
        e.g.style.setProperty("--d", cur ? `${Math.round(e.t * st.ms)}ms` : "0ms");
        e.g.classList.toggle("on", full || e.s <= idx);
        e.g.classList.toggle("now", cur);
        e.g.classList.toggle("past", !full && e.s > 0 && e.s < idx);
      });
      wrap.classList.toggle("is-focus", idx > 0 && !full);
      $$("li", stepsEl).forEach((li, j) => {
        li.classList.toggle("is-on", j === idx);
        li.classList.toggle("done", j < idx);
        $("button", li).setAttribute("aria-current", j === idx ? "step" : "false");
        $("b", li).style.transform = `scaleX(${j < idx ? 1 : 0})`;
      });
      cap.innerHTML = `<span class="n">${idx === 0 ? "Overview" : full ? "Full figure" : `Step ${idx}`}</span>${st.c}`;
      elapsed = 0; t0 = performance.now();
    }
    function tick(now) {
      raf = 0;
      if (!visible || !playing) return;
      elapsed = now - t0;
      const li = $$("li", stepsEl)[idx];
      if (li) $("b", li).style.transform = `scaleX(${Math.min(1, elapsed / STEPS[idx].ms)})`;
      if (elapsed >= STEPS[idx].ms) show(idx + 1);
      raf = requestAnimationFrame(tick);
    }
    function run() { if (!raf && visible && playing) { t0 = performance.now() - elapsed; raf = requestAnimationFrame(tick); } }
    function setPlaying(on) {
      playing = on;
      btn.innerHTML = on ? PAUSE : PLAY;
      btn.setAttribute("aria-label", on ? "Pause the walkthrough" : "Play the walkthrough");
      if (on) { if (idx === FULL) show(0); run(); }
    }
    btn.addEventListener("click", () => setPlaying(!playing));
    if ("IntersectionObserver" in window && !reduceMotion) {
      new IntersectionObserver((es) => es.forEach((en) => { visible = en.isIntersecting; run(); }), { threshold: 0.3 }).observe(wrap);
    }
    setPlaying(playing);
    show(reduceMotion ? FULL : 0);
  })();

  /* ───────── lightbox ───────── */
  const lb = $("#lightbox"), lbImg = $("#lb-img");
  let lbReturn = null;
  $$("[data-zoom]").forEach((b) => b.addEventListener("click", () => {
    lbReturn = b;
    lbImg.src = b.dataset.zoom;
    lbImg.alt = ($("img", b) || {}).alt || "";
    lb.hidden = false;
    $("#lb-close").focus();
  }));
  function closeLb() { lb.hidden = true; lbImg.removeAttribute("src"); if (lbReturn) lbReturn.focus(); }
  $("#lb-close").addEventListener("click", closeLb);
  lb.addEventListener("click", (e) => { if (e.target === lb) closeLb(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !lb.hidden) closeLb(); });

  /* ───────── BibTeX copy ───────── */
  const copyBtn = $("#copy-bib");
  copyBtn.addEventListener("click", () => {
    const text = $("#bib-text").innerText;
    const label = $("span", copyBtn);
    const done = (msg) => { label.textContent = msg; setTimeout(() => { label.textContent = "Copy"; }, 1600); };
    const fallback = () => {
      const r = document.createRange(); r.selectNodeContents($("#bib-text"));
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      done("Selected");
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done("Copied"), fallback);
    else fallback();
  });

  /* ───────── shared timeline widget ───────── */
  function makeTimeline(el, { duration, prompts, onSeek }) {
    $$(".tl-mark", el).forEach((m) => m.remove());
    el.setAttribute("aria-valuemax", duration.toFixed(1));
    const fill = $(".tl-fill", el), head = $(".tl-head", el);
    const marks = prompts.map((p, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tl-mark";
      b.style.left = `${(p.time_s / duration) * 100}%`;
      b.style.background = PCOL[i % PCOL.length];
      b.setAttribute("aria-label", `${p.time_s} s: ${p.prompt}`);
      b.title = `${p.time_s} s · ${p.prompt}`;
      b.addEventListener("click", (e) => { e.stopPropagation(); onSeek(p.time_s, true); });
      el.appendChild(b);
      return b;
    });
    let dragging = false;
    const at = (e) => {
      const r = el.getBoundingClientRect();
      return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * duration;
    };
    el.onpointerdown = (e) => {
      if (e.target.classList.contains("tl-mark")) return;
      dragging = true; el.setPointerCapture(e.pointerId); onSeek(at(e), false);
    };
    el.onpointermove = (e) => { if (dragging) onSeek(at(e), false); };
    el.onpointerup = el.onpointercancel = () => { dragging = false; };
    el.onkeydown = (e) => {
      const cur = parseFloat(el.getAttribute("aria-valuenow")) || 0;
      if (e.key === "ArrowRight") { onSeek(Math.min(duration, cur + 1), false); e.preventDefault(); }
      if (e.key === "ArrowLeft") { onSeek(Math.max(0, cur - 1), false); e.preventDefault(); }
    };
    return {
      update(t) {
        const f = Math.min(1, t / duration);
        fill.style.transform = `scaleX(${f})`;
        head.style.left = `${f * 100}%`;
        el.setAttribute("aria-valuenow", t.toFixed(1));
        el.setAttribute("aria-valuetext", fmt(t));
        marks.forEach((m, i) => m.classList.toggle("passed", t >= prompts[i].time_s));
      },
    };
  }

  function promptList(ol, scene, { onPick, initLabel }) {
    ol.innerHTML = "";
    const init = document.createElement("li");
    init.className = "is-init";
    init.innerHTML = `<span class="t">0 s</span><span><b>${initLabel}</b> ${esc(scene.initial_prompt)}</span>`;
    ol.appendChild(init);
    const items = scene.prompts.map((p, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="t"><i style="background:${PCOL[i % PCOL.length]}"></i>${p.time_s} s</span><span>${esc(p.prompt)}</span>`;
      if (onPick) {
        li.tabIndex = 0;
        li.setAttribute("role", "button");
        li.addEventListener("click", () => onPick(p.time_s));
        li.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(p.time_s); } });
      }
      ol.appendChild(li);
      return li;
    });
    return (t) => {
      let now = -1;
      scene.prompts.forEach((p, i) => { if (t >= p.time_s) now = i; });
      items.forEach((li, i) => {
        li.classList.toggle("is-past", i <= now);
        li.classList.toggle("is-now", i === now && t - scene.prompts[i].time_s < 5);
      });
    };
  }

  /* ───────── data ───────── */
  // data files carry their own version (from the page, as the CSS / JS do), so a new script never meets an old cached file
  const DV = Object.fromEntries(((document.querySelector('meta[name="ss-data"]') || {}).content || "").split(";").filter((x) => x.includes("="))
    .map((x) => x.split("=")));
  const dataUrl = (f) => `static/${f}.json${DV[f] ? `?v=${DV[f]}` : ""}`;
  fetch(dataUrl("scenes")).then((r) => r.json()).then((data) => {
    const scenes = data.scenes;
    const byId = Object.fromEntries(scenes.map((s) => [s.id, s]));
    initHero(HERO.map((id) => byId[id]).filter(Boolean));
    initPlayer(scenes, byId);
    fetch(dataUrl("trace")).then((r) => r.json()).then((tr) => initRun(byId, tr.scenes))
      .catch(() => { const r = $("#run"); if (r) r.hidden = true; });
  }).catch(() => {
    const p = $("#player");
    if (p) p.insertAdjacentHTML("afterbegin", '<p class="pl-note">The video list could not be loaded. Reload the page to try again.</p>');
  });

  /* ───────── hero stream ───────── */
  function initHero(list) {
    if (!list.length) return;
    const video = $("#hero-video"), clock = $("#hero-clock"), toast = $("#hero-toast");
    const tlEl = $("#hero-tl"), log = $("#hero-log"), picker = $("#hero-picker");
    let scene = null, tl = null, mark = null, lastToast = -1, visible = true, userPaused = false;

    function show(s) {
      scene = s;
      lastToast = -1;
      toast.classList.remove("show");
      video.poster = vurl(s.id, "poster.jpg");
      video.src = vurl(s.id, "StateStream.mp4");
      tl = makeTimeline(tlEl, { duration: s.duration, prompts: s.prompts, onSeek: (t) => { video.currentTime = t; render(); } });
      mark = promptList(log, s, { initLabel: "Opening scene.", onPick: (t) => { video.currentTime = t; render(); } });
      $$(".chip", picker).forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.id === s.id)));
      render();
      if (visible && !userPaused && !reduceMotion) video.play().catch(() => {});
    }
    function render() {
      if (!scene) return;
      const t = video.currentTime || 0;
      clock.textContent = fmt(t);
      tl.update(t);
      mark(t);
      let idx = -1;
      scene.prompts.forEach((p, i) => { if (t >= p.time_s) idx = i; });
      const live = idx >= 0 && t - scene.prompts[idx].time_s < 4.5;
      if (live && idx !== lastToast) {
        const p = scene.prompts[idx];
        toast.innerHTML = `<span class="t" style="background:${PCOL[idx % PCOL.length]}">${p.time_s} s</span><span><span class="k">New prompt</span>${esc(p.prompt)}</span>`;
        lastToast = idx;
      }
      toast.classList.toggle("show", live);
    }
    list.forEach((s) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.dataset.id = s.id;
      b.setAttribute("aria-pressed", "false");
      b.innerHTML = `<img src="${vurl(s.id, "thumb.jpg")}" alt="" width="30" height="30" loading="lazy">${esc(s.title)}`;
      b.addEventListener("click", () => { userPaused = false; show(s); });
      picker.appendChild(b);
    });
    video.addEventListener("timeupdate", render);
    video.addEventListener("seeked", render);
    video.addEventListener("ended", () => {
      const i = list.indexOf(scene);
      show(list[(i + 1) % list.length]);
    });
    video.addEventListener("click", () => {
      if (video.paused) { userPaused = false; video.play().catch(() => {}); } else { userPaused = true; video.pause(); }
    });
    (function loop() { if (!video.paused) render(); requestAnimationFrame(loop); })();
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => es.forEach((e) => {
        visible = e.isIntersecting;
        if (!visible) video.pause();
        else if (!userPaused && !reduceMotion) video.play().catch(() => {});
      }), { threshold: 0.15 }).observe(video);
    }
    show(list[0]);
  }

  /* ───────── inside one run: the logged agent trace, replayed with its video ───────── */
  const KIND = { change: "Change", global: "Global change", arrival: "Arrival", departure: "Departure", motion: "Motion" };
  function hlCode(src) {
    return src.split("\n").map((line, i) => {
      let h = esc(line)
        .replace(/(&quot;.*?&quot;)/g, '<span class="s">$1</span>')
        .replace(/^(del\s+)?([A-Za-z_]\w*)(?=\s*=|\.|$)/, (m, d, v) => `${d ? '<span class="f">del</span> ' : ""}<span class="h">${v}</span>`)
        .replace(/\b(verify|Thing|Creature|Part)\(/g, '<span class="f">$1</span>(');
      return `<span class="ln" style="--i:${i}">${h || " "}</span>`;
    }).join("");
  }
  function initRun(byId, traces) {
    const root = $("#run");
    const list = HERO.filter((id) => traces[id] && byId[id]);
    if (!root || !list.length) { if (root) root.hidden = true; return; }
    const video = $("#run-video"), clock = $("#run-clock"), toast = $("#run-toast"), tlEl = $("#run-tl"), chk = $(".tl-chk", tlEl);
    const feedBox = $("#run-feed"), wstEl = $("#run-wst"), stepsEl = $("#run-steps"), memEl = $("#run-mem"), picker = $("#run-picker");
    const feed = document.createElement("div");
    feed.className = "feed-in";
    feedBox.appendChild(feed);
    video.loop = true;
    let tr = null, scene = null, tl = null, items = [], evEls = [], dotEls = [];
    let prevT = 0, keys = {}, toastUntil = 0, visible = false, userPaused = false, userScroll = -1e9, lastNewest = null, looping = false;

    function show(id) {
      tr = traces[id]; scene = byId[id];
      keys = {}; prevT = 0; lastNewest = null;
      toast.classList.remove("show");
      video.poster = vurl(id, "poster.jpg");
      video.src = vurl(id, "StateStream.mp4");
      $$(".chip", picker).forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.id === id)));
      tl = makeTimeline(tlEl, { duration: tr.end || tr.duration, prompts: scene.prompts, onSeek: (t) => seek(t) });
      // the log
      feed.innerHTML = "";
      items = []; evEls = []; dotEls = []; chk.innerHTML = "";
      const open = document.createElement("article");
      open.className = "ev on";
      open.innerHTML = `<button type="button" class="ev-h"><span class="t init">0 s</span><b>Opening scene<small>state program at the start</small></b></button>` +
        `<div class="ev-row on"><span>Program</span><code class="ev-code">${hlCode(tr.opening.code)}</code></div>`;
      $(".ev-h", open).addEventListener("click", () => seek(0));
      feed.appendChild(open);
      evEls.push({ el: open, t: 0 });
      tr.events.forEach((ev, i) => {
        const col = PCOL[i % PCOL.length];
        const a = document.createElement("article");
        a.className = "ev";
        const q = `<q>${esc(ev.step.question)}</q><em>expect ${esc(ev.step.expect)}</em>`;
        const dots = (arr, late) => arr.map((c) => `<i class="${c[1] ? "ok" : "no"}" data-t="${c[0]}" title="${fmt(c[0])}: ${c[1] ? "met" : "not yet"}"></i>`).join("") ;
        let checks = "";
        if (ev.checks.length || ev.late) {
          checks = `<div class="ev-row" data-t="${ev.start}"><span>Checks</span><div class="ev-p">${q}<div class="dots">${dots(ev.checks)}` +
            (ev.late ? `<span class="sep" data-t="${ev.late[0][0]}">later frames</span>${dots(ev.late)}` : "") + `</div></div></div>`;
        }
        let out;
        if (ev.end.how === "confirmed") out = `<b class="ok">Confirmed at ${fmt(ev.end.t)}.</b> ${esc(ev.memory.label)}`;
        else if (ev.end.how === "motion") out = `<b class="mo">Step ends at ${fmt(ev.end.t)}.</b> ${esc(ev.memory.label)}`;
        else out = `<b class="warn">Time ran out at ${fmt(ev.end.t)}: unverified.</b> ${ev.later ? "The target stays in the World-State text while later frames are checked." : esc(ev.memory.label)}`;
        const later = ev.later ? `<div class="ev-row ev-out" data-t="${ev.later}"><span>Later</span><p class="ev-p"><b class="ok">Confirmed at ${fmt(ev.later)}.</b> ${esc(ev.memory.label)}</p></div>` : "";
        a.innerHTML = `<button type="button" class="ev-h"><span class="t" style="background:${col}">${fmt(ev.t)}</span><b>${esc(ev.prompt)}<small>${KIND[ev.kind] || ev.kind}</small></b></button>` +
          (ev.resolved ? `<div class="ev-row on"><span>Resolved</span><p class="ev-p">${esc(ev.resolved)}</p></div>` : "") +
          `<div class="ev-row on"><span>Program</span><code class="ev-code">${hlCode(ev.code)}</code></div>` +
          `<div class="ev-row on"><span>Plan step</span><p class="ev-p">${esc(ev.step.sentence)} <em>${ev.step.duration} s</em></p></div>` +
          checks +
          `<div class="ev-row ev-out" data-t="${ev.end.t}"><span>Result</span><p class="ev-p">${out}</p></div>` + later;
        $(".ev-h", a).addEventListener("click", () => { seek(ev.t); play(); });
        feed.appendChild(a);
        evEls.push({ el: a, t: ev.t });
        $$("[data-t]", a).forEach((el) => {
          const t = parseFloat(el.dataset.t);
          items.push({ el, t });
          if (el.tagName === "I") {
            el.addEventListener("click", () => seek(t));
            const d = document.createElement("i");
            d.className = el.className;
            d.style.left = `${(t / tr.duration) * 100}%`;
            chk.appendChild(d);
            dotEls.push({ el: d, t });
          }
        });
      });
      render(true);
      if (visible && !userPaused && !reduceMotion) play();
    }

    function wst(t) {
      let base = null;
      tr.events.forEach((ev, i) => { if (ev.text && ev.text.t <= t) base = { parts: ev.text.parts, i }; });
      const ents = Object.entries(tr.entities).filter(([, e]) => e.add <= t && !(e.drop !== undefined && e.drop <= t));
      return { base, ents };
    }
    function say(html, col) {
      toast.innerHTML = html;
      toast.classList.add("show");
      toastUntil = performance.now() + 3200;
    }

    function render(force) {
      if (!tr) return;
      const t = video.currentTime || 0;
      if (tr.end && t >= tr.end && !looping) {            // a replay that ends before the video does loops there
        looping = true; seek(0); looping = false; return;
      }
      clock.textContent = fmt(t);
      tl.update(t);
      // the log: entries and their timed rows
      let newest = null;
      items.forEach((x) => { const on = t >= x.t; if (x.el.classList.contains("on") !== on) x.el.classList.toggle("on", on); if (on && x.el.tagName !== "I" && x.el.tagName !== "SPAN") newest = x.el; });
      let cur = 0;
      evEls.forEach((x, i) => { const on = t >= x.t; x.el.classList.toggle("on", on); if (on) cur = i; });
      evEls.forEach((x, i) => { x.el.classList.toggle("is-now", i === cur && i > 0); x.el.classList.toggle("past", i < cur); });
      dotEls.forEach((x) => x.el.classList.toggle("on", t >= x.t));
      const head = evEls[cur].el;
      const target = newest && head.contains(newest) ? newest : head;
      if (target !== lastNewest) {
        lastNewest = target;
        if (performance.now() - userScroll > 4000) {
          const f0 = feed.getBoundingClientRect().top - feed.scrollTop;      // positions inside the scrolling log
          const tr0 = target.getBoundingClientRect();
          const top = tr0.bottom - f0 - feed.clientHeight + 24;
          const headTop = head.getBoundingClientRect().top - f0 - 6;
          feed.scrollTo({ top: Math.max(0, Math.min(headTop, Math.max(top, 0))), behavior: force || reduceMotion ? "auto" : "smooth" });
        }
      }
      // World-State text
      const w = wst(t);
      const key = `${w.base ? w.base.i : -1}|${w.ents.map(([v]) => v).join(",")}`;
      if (key !== keys.wst) {
        const fresh = keys.wst !== undefined && !force;
        const prevEnts = keys.ents || [];
        const baseHtml = w.base ? w.base.parts.map(([s, ch]) => (ch ? `<mark>${esc(s)}</mark>` : esc(s))).join("") : esc(tr.opening.text);
        wstEl.innerHTML = baseHtml + w.ents.map(([v, e]) => ` <span class="ent${fresh && !prevEnts.includes(v) ? " fresh" : ""}">${esc(e.sentence)}</span>`).join("");
        wstEl.classList.toggle("fresh", fresh && (!keys.wst || keys.wst.split("|")[0] !== key.split("|")[0]));
        keys.wst = key; keys.ents = w.ents.map(([v]) => v);
      }
      // steps in progress
      const act = [];
      tr.events.forEach((ev, i) => {
        const col = PCOL[i % PCOL.length];
        if (t >= ev.start && t < ev.end.t) {
          const checking = ev.checks.length && t >= ev.checks[0][0] - 0.75;
          act.push(`<div><i style="background:${col}"></i><span><span class="st-k">${checking ? "checking" : "executing"}</span>${esc(checking ? ev.step.question : ev.step.sentence)}</span></div>`);
        } else if (ev.end.how === "unverified" && t >= ev.end.t && ev.late && t < (ev.later || 1e9)) {
          act.push(`<div><i style="background:${col}"></i><span><span class="st-k">rechecking</span>${esc(ev.step.question)}</span></div>`);
        }
      });
      const sKey = act.join("");
      if (sKey !== keys.steps) { stepsEl.innerHTML = sKey || '<span class="idle">None. The World-State text alone conditions the generator.</span>'; keys.steps = sKey; }
      // memory writes
      const chips = [];
      tr.events.forEach((ev) => {
        const m = ev.memory, at = ev.later || ev.end.t;
        if (!m || t < m.t || (ev.end.how === "unverified" && !ev.later)) return;
        if (m.op === "local") chips.push(`<span class="chipm"><i>Shared KV</i><b>${esc(m.what)}</b><i>${fmt(m.t)}</i></span>`);
        if (m.op === "entity") {
          const e = tr.entities[m.var];
          const off = e.inactive !== undefined && t >= e.inactive;
          chips.push(`<span class="chipm entity${off ? " inactive" : ""}"><i>Entity KV</i><b>${esc(m.var.replace(/_/g, " "))}</b><i>${off ? "inactive " + fmt(e.inactive) : fmt(m.t)}</i></span>`);
        }
      });
      const mKey = chips.join("");
      if (mKey !== keys.mem) { memEl.innerHTML = mKey || '<span class="idle">Nothing yet: only confirmed results are written.</span>'; keys.mem = mKey; }
      // toasts on forward play only
      if (!force && t > prevT && t - prevT < 0.6) {
        tr.events.forEach((ev, i) => {
          const col = PCOL[i % PCOL.length];
          const cross = (x) => x !== undefined && prevT < x && t >= x;
          if (cross(ev.t)) say(`<span class="t" style="background:${col}">${fmt(ev.t)}</span><span><span class="k">New prompt · ${KIND[ev.kind]}</span>${esc(ev.prompt)}</span>`);
          if (cross(ev.end.t)) {
            const msg = ev.end.how === "confirmed" ? "Confirmed, written to memory" : ev.end.how === "motion" ? "Motion step finished" : "Time ran out: unverified, still checking";
            say(`<span class="t" style="background:${ev.end.how === "confirmed" ? "var(--ours)" : ev.end.how === "motion" ? "var(--p1)" : "var(--p3)"}">${fmt(ev.end.t)}</span><span><span class="k">${msg}</span>${esc(ev.end.how === "motion" ? ev.step.sentence : ev.step.question)}</span>`);
          }
          if (cross(ev.later)) say(`<span class="t" style="background:var(--ours)">${fmt(ev.later)}</span><span><span class="k">Confirmed on a later check</span>${esc(ev.step.question)}</span>`);
        });
      }
      if (performance.now() > toastUntil) toast.classList.remove("show");
      prevT = t;
    }

    function seek(t) { video.currentTime = Math.max(0, Math.min((tr.end || tr.duration) - 0.05, t)); prevT = t; render(true); }
    function play() { userPaused = false; video.play().catch(() => {}); }
    feed.addEventListener("wheel", () => { userScroll = performance.now(); }, { passive: true });
    feed.addEventListener("touchmove", () => { userScroll = performance.now(); }, { passive: true });
    video.addEventListener("click", () => { if (video.paused) play(); else { userPaused = true; video.pause(); } });
    video.addEventListener("seeked", () => render(true));
    list.forEach((id) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.dataset.id = id;
      b.setAttribute("aria-pressed", "false");
      b.innerHTML = `<img src="${vurl(id, "thumb.jpg")}" alt="" width="30" height="30" loading="lazy">${esc(byId[id].title)}`;
      b.addEventListener("click", () => { userPaused = false; show(id); });
      picker.appendChild(b);
    });
    (function loop() { if (!video.paused || performance.now() < toastUntil + 100) render(false); requestAnimationFrame(loop); })();
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => es.forEach((e) => {
        visible = e.isIntersecting;
        if (!visible) video.pause();
        else if (!userPaused && !reduceMotion) play();
      }), { threshold: 0.35 }).observe(video);
    }
    show(list[list.length - 1]);
  }

  /* ───────── synced comparison player ───────── */
  function initPlayer(scenes, byId) {
    const groupsEl = $("#groups"), rail = $("#rail"), screens = $("#screens");
    const modesEl = $("#pl-modes"), title = $("#pl-title"), playBtn = $("#pl-play");
    const timeEl = $("#pl-time"), tlEl = $("#pl-tl"), plist = $("#pl-prompts");
    const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5v14l12-7z"/></svg>';
    const PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';
    const MODES = [...BASELINES.map((m) => ({ id: m, label: `vs ${m}` })), { id: "all", label: "All four" }];
    let group = "all", scene = null, mode = "all", playing = false, waiting = false;
    let tiles = [], tl = null, mark = null, seekTarget = null;

    // group tabs
    GROUPS.forEach((g) => {
      const n = g.id === "all" ? scenes.length : scenes.filter((s) => s.group === g.id).length;
      if (!n) return;
      const b = document.createElement("button");
      b.setAttribute("role", "tab");
      b.dataset.g = g.id;
      b.setAttribute("aria-selected", String(g.id === group));
      b.innerHTML = `${g.label} <i>${n}</i>`;
      b.addEventListener("click", () => { group = g.id; renderGroups(); renderRail(); });
      groupsEl.appendChild(b);
    });
    function renderGroups() { $$("button", groupsEl).forEach((b) => b.setAttribute("aria-selected", String(b.dataset.g === group))); }

    function renderRail() {
      rail.innerHTML = "";
      scenes.filter((s) => group === "all" || s.group === group).forEach((s) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "scene";
        b.dataset.id = s.id;
        b.setAttribute("aria-pressed", String(scene && scene.id === s.id));
        b.innerHTML = `<span class="th"><img src="${vurl(s.id, "thumb.jpg")}" alt="" loading="lazy" width="832" height="480"><b>${Math.round(s.duration)} s</b></span>` +
          `<span class="nm">${esc(s.title)}<span>${s.prompts.length} prompts</span></span>`;
        b.addEventListener("click", () => { load(s); $("#player").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" }); });
        rail.appendChild(b);
      });
    }

    MODES.forEach((m) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.m = m.id;
      b.textContent = m.label;
      b.addEventListener("click", () => { mode = m.id; buildScreens(true); });
      modesEl.appendChild(b);
    });

    function methodsFor() {
      if (mode === "all") return scene.methods.slice();
      return [OURS, scene.methods.includes(mode) ? mode : scene.methods.find((m) => m !== OURS)];
    }

    function buildScreens(keepTime) {
      const t = keepTime && tiles.length ? tiles[0].v.currentTime : 0;
      const wasPlaying = playing;
      setPlaying(false);
      tiles.forEach((x) => { x.v.removeAttribute("src"); x.v.load(); });
      screens.innerHTML = "";
      if (mode !== "all" && !scene.methods.includes(mode)) mode = "all";
      $$("button", modesEl).forEach((b) => {
        const ok = b.dataset.m === "all" || scene.methods.includes(b.dataset.m);
        b.disabled = !ok;
        b.setAttribute("aria-pressed", String(b.dataset.m === mode));
      });
      tiles = methodsFor().map((m) => {
        const d = document.createElement("div");
        d.className = "screen" + (m === OURS ? " screen--ours" : "");
        const v = document.createElement("video");
        v.muted = true; v.playsInline = true; v.preload = "auto";
        v.setAttribute("aria-label", `${m} video`);
        if (m === OURS) v.poster = vurl(scene.id, "poster.jpg");
        v.src = vurl(scene.id, `${m}.mp4`);
        const lab = document.createElement("span");
        lab.className = "lab"; lab.textContent = m;
        const spin = document.createElement("span");
        spin.className = "spin"; spin.hidden = true;
        d.append(v, lab, spin);
        screens.appendChild(d);
        ["waiting", "canplay", "playing", "loadeddata"].forEach((ev) => v.addEventListener(ev, checkReady));
        v.addEventListener("click", toggle);
        return { m, v, spin };
      });
      screens.style.gridTemplateColumns = "";
      if (t) seek(t);
      if (wasPlaying) setPlaying(true);
    }

    function load(s) {
      scene = s;
      title.innerHTML = `${esc(s.title)}<span>${s.duration < 20 ? "15" : "36"} s · ${s.prompts.length} interactive prompts</span>`;
      $$(".scene", rail).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === s.id)));
      tl = makeTimeline(tlEl, { duration: s.duration, prompts: s.prompts, onSeek: (t, play) => { seek(t); if (play) setPlaying(true); } });
      mark = promptList(plist, s, { initLabel: "Opening scene.", onPick: (t) => { seek(t); setPlaying(true); } });
      const wasPlaying = playing;
      buildScreens(false);
      seek(0);
      if (wasPlaying) setPlaying(true);
    }

    function seek(t) {
      seekTarget = t;
      tiles.forEach((x) => { try { x.v.currentTime = t; } catch (e) { /* not loaded yet */ } });
      paint(t);
    }

    function ready(v) { return v.readyState >= 3; }
    function checkReady() {
      if (!playing) { tiles.forEach((x) => { x.spin.hidden = ready(x.v) || x.v.readyState >= 2; }); return; }
      const notReady = tiles.filter((x) => !ready(x.v));
      tiles.forEach((x) => { x.spin.hidden = ready(x.v); });
      if (notReady.length && !waiting) {
        waiting = true;
        tiles.forEach((x) => x.v.pause());
      } else if (!notReady.length && waiting) {
        waiting = false;
        const t = tiles[0].v.currentTime;
        tiles.forEach((x) => { if (Math.abs(x.v.currentTime - t) > 0.05) x.v.currentTime = t; x.v.play().catch(() => {}); });
      }
    }

    function setPlaying(on) {
      playing = on;
      playBtn.innerHTML = on ? PAUSE : PLAY;
      playBtn.setAttribute("aria-label", on ? "Pause" : "Play");
      if (on) {
        waiting = false;
        if (seekTarget !== null) { tiles.forEach((x) => { if (Math.abs(x.v.currentTime - seekTarget) > 0.05) x.v.currentTime = seekTarget; }); seekTarget = null; }
        if (tiles.every((x) => ready(x.v))) tiles.forEach((x) => x.v.play().catch(() => {}));
        else { waiting = true; tiles.forEach((x) => x.v.pause()); }
        checkReady();
      } else {
        waiting = false;
        tiles.forEach((x) => x.v.pause());
      }
    }
    function toggle() { setPlaying(!playing); }
    playBtn.addEventListener("click", toggle);

    function paint(t) {
      if (!scene) return;
      timeEl.textContent = `${t.toFixed(1)} / ${scene.duration.toFixed(1)} s`;
      tl.update(t);
      mark(t);
    }

    (function loop() {
      if (tiles.length && scene) {
        const master = tiles[0].v;
        const t = master.currentTime || 0;
        if (playing && !waiting) {
          for (let i = 1; i < tiles.length; i++) {
            const v = tiles[i].v;
            if (ready(v) && Math.abs(v.currentTime - t) > 0.12) v.currentTime = t;
          }
          if (t >= scene.duration - 0.06 || master.ended) { seek(0); tiles.forEach((x) => x.v.play().catch(() => {})); }
        }
        paint(seekTarget !== null && !playing ? seekTarget : t);
      }
      requestAnimationFrame(loop);
    })();

    document.addEventListener("keydown", (e) => {
      if (e.key !== " " || !lb.hidden) return;
      const r = $("#player").getBoundingClientRect();
      const inView = r.top < window.innerHeight * 0.6 && r.bottom > window.innerHeight * 0.4;
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      if (inView && !/^(BUTTON|INPUT|TEXTAREA|A)$/.test(tag)) { e.preventDefault(); toggle(); }
    });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting && playing) setPlaying(false); }), { threshold: 0.05 }).observe($("#player"));
    }

    renderRail();
    load(byId[DEFAULT_SCENE] || scenes[0]);
  }
})();
