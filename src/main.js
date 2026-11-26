const splash = document.querySelector("#splash");
const video = document.querySelector("#splash-video");
const videoBleed = document.querySelector("#splash-video-bleed");
const skip = document.querySelector("#skip");
const site = document.querySelector("#site");
const mobileSplash = window.matchMedia("(max-width: 767px)");

const CRT_MS = 1200;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let exiting = false;

function pauseSplashVideos() {
  try {
    video.pause();
  } catch {
    /* ignore */
  }
  try {
    videoBleed?.pause();
  } catch {
    /* ignore */
  }
}

function syncBleed() {
  if (!videoBleed || !mobileSplash.matches) {
    try {
      videoBleed?.pause();
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    if (Math.abs(videoBleed.currentTime - video.currentTime) > 0.3) {
      videoBleed.currentTime = video.currentTime;
    }
  } catch {
    /* ignore */
  }
}

/* Splash video uses object-fit: cover; no mobile letterbox scale needed. */
function updateSplashFrame() {
  if (!video) return;
  video.style.transform = "";
}

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

function resetToTop() {
  if (window.location.hash) {
    history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`
    );
  }
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

resetToTop();

function revealSite() {
  site.hidden = false;
  document.body.classList.add("is-live");
  document.body.style.overflow = "";
  document.body.style.overflowX = "";
  document.body.style.overflowY = "";
  window.dispatchEvent(new Event("resize"));
}

function initTickers() {
  const phrases = [
    "A society built for DOGS",
    "More movement, more good years",
    "A society built for DOGS",
    "More movement, more good years",
    "A society built for DOGS",
    "More movement, more good years",
  ];
  const dog = `
    <span class="ticker-dog">
      <img src="assets/ticker-dog.png?v=1" alt="" width="28" height="28" />
    </span>`;
  const set = `<div class="ticker-set">${phrases
    .map((text) => `<span class="ticker-copy">${text}</span>${dog}`)
    .join("")}</div>`;

  for (const track of document.querySelectorAll(".ticker-track")) {
    track.innerHTML = set + set;
  }

  initTickerMotion();
}

function initTickerMotion() {
  const tickers = [...document.querySelectorAll(".ticker")];
  if (!tickers.length) return;

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const DURATION_S = 28;
  const items = tickers.map((ticker) => ({
    ticker,
    track: ticker.querySelector(".ticker-track"),
    loop: 0,
  }));

  function measure() {
    for (const item of items) {
      if (!item.track) continue;
      const sets = item.track.querySelectorAll(".ticker-set");
      item.loop =
        sets.length >= 2
          ? sets[1].offsetLeft - sets[0].offsetLeft
          : item.track.scrollWidth / 2;
      item.track.style.transform = "translate3d(0,0,0)";
    }
  }

  let offset = 0;
  let last = performance.now();
  let raf = 0;
  let running = false;

  function apply() {
    for (const item of items) {
      if (item.loop <= 0 || !item.track) continue;
      /* Whole CSS pixels only — fractional translateX softens type. */
      const px = Math.round(offset % item.loop);
      item.track.style.transform = `translate3d(${-px}px,0,0)`;
    }
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const loop = items.find((item) => item.loop > 0)?.loop || 0;
    if (loop > 0) {
      offset = (offset + (loop / DURATION_S) * dt) % loop;
      apply();
    }
    raf = requestAnimationFrame(frame);
  }

  function start() {
    cancelAnimationFrame(raf);
    measure();
    if (motionQuery.matches) {
      running = false;
      offset = 0;
      apply();
      return;
    }
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  window.addEventListener("resize", () => {
    measure();
    apply();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(raf);
    } else {
      start();
    }
  });
  motionQuery.addEventListener("change", start);

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      measure();
      apply();
    });
  }

  start();
}

initTickers();

function endSplash() {
  if (exiting) return;
  exiting = true;

  skip.setAttribute("disabled", "true");
  splash.classList.add("is-off");
  splash.setAttribute("aria-hidden", "true");
  pauseSplashVideos();

  const delay = reducedMotion ? 80 : CRT_MS;

  window.setTimeout(() => {
    splash.classList.add("is-gone");
    resetToTop();
    revealSite();
    window.requestAnimationFrame(() => {
      resetToTop();
    });
  }, delay);
}

async function startSplash() {
  video.muted = true;
  video.playsInline = true;
  if (videoBleed) {
    videoBleed.muted = true;
    videoBleed.playsInline = true;
    videoBleed.loop = true;
  }
  updateSplashFrame();

  const tryPlay = async () => {
    try {
      await video.play();
      if (!video.paused) {
        syncBleed();
        if (videoBleed && mobileSplash.matches) {
          try {
            await videoBleed.play();
          } catch {
            /* ignore */
          }
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  if (await tryPlay()) return;

  const resume = async () => {
    await tryPlay();
  };

  splash.addEventListener("pointerdown", resume);
  window.addEventListener("pointerdown", resume, { once: true });

  const poll = window.setInterval(async () => {
    if (exiting || !video.paused) {
      window.clearInterval(poll);
      return;
    }
    await tryPlay();
  }, 400);
}

video.addEventListener("ended", endSplash);
video.addEventListener("error", endSplash);
video.addEventListener("timeupdate", syncBleed);
video.addEventListener("loadedmetadata", updateSplashFrame);
window.addEventListener("resize", updateSplashFrame);
mobileSplash.addEventListener("change", () => {
  updateSplashFrame();
  if (exiting) return;
  if (mobileSplash.matches && !video.paused) {
    syncBleed();
    videoBleed?.play().catch(() => {});
  } else {
    videoBleed?.pause();
  }
});
skip.addEventListener("click", endSplash);
window.setTimeout(() => {
  if (!exiting && video.paused) endSplash();
}, 12000);

if (video.readyState >= 2) {
  startSplash();
} else {
  video.addEventListener("canplay", startSplash, { once: true });
  video.addEventListener("loadeddata", startSplash, { once: true });
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
    if (!exiting) {
      event.preventDefault();
      endSplash();
    }
  }
});

function initDayCarousel() {
  const section = document.querySelector(".day");
  const pin = document.querySelector(".day-pin");
  const viewport = document.querySelector(".day-viewport");
  const track = document.querySelector(".day-scroller");
  if (!section || !pin || !viewport || !track) return;

  const cards = [...track.querySelectorAll(".day-card")];
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  /* Sticky scrub from tablet/desktop up; phones keep the swipe carousel. */
  const pinQuery = window.matchMedia("(min-width: 700px)");
  const landscapeQuery = window.matchMedia(
    "(max-height: 500px) and (orientation: landscape)"
  );
  let overflow = 0;
  let running = false;
  let playedThrough = -1;
  let pinMode = false;

  function navHeight() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(
      "--nav-height"
    );
    return Number.parseFloat(raw) || 56;
  }

  function shouldPin() {
    return pinQuery.matches && !motionQuery.matches && !landscapeQuery.matches;
  }

  function resetPlayed() {
    playedThrough = -1;
    for (const card of cards) card.classList.remove("is-played");
  }

  function markPlayedThrough(index) {
    const next = Math.min(Math.max(index, 0), cards.length - 1);
    if (next <= playedThrough) return;
    for (let i = playedThrough + 1; i <= next; i += 1) {
      cards[i]?.classList.add("is-played");
    }
    playedThrough = next;
  }

  function focusedIndex(progress) {
    if (!cards.length) return 0;
    return Math.round(progress * (cards.length - 1));
  }

  function measure() {
    const nextPin = shouldPin();
    if (nextPin !== pinMode) {
      resetPlayed();
      pinMode = nextPin;
    }

    if (!pinMode) {
      overflow = 0;
      section.style.height = "";
      track.style.transform = "";
      onViewportScroll();
      return;
    }

    const previous = track.style.transform;
    track.style.transform = "translate3d(0,0,0)";
    overflow = Math.max(0, track.scrollWidth - viewport.clientWidth);
    track.style.transform = previous;

    const steps = Math.max(cards.length - 1, 1);
    const travel = Math.max(
      overflow > 0 ? Math.round(overflow * 1.2) : 0,
      Math.round(steps * window.innerHeight * 0.7)
    );

    section.style.height = `${pin.offsetHeight + travel}px`;
  }

  function update() {
    if (!pinMode) return;

    overflow = Math.max(0, track.scrollWidth - viewport.clientWidth);

    const travelPx = Math.max(1, section.offsetHeight - pin.offsetHeight);
    const scrolled = navHeight() - section.getBoundingClientRect().top;
    const progress = Math.min(1, Math.max(0, scrolled / travelPx));

    if (overflow > 0) {
      track.style.transform = `translate3d(${-progress * overflow}px,0,0)`;
    } else {
      track.style.transform = "translate3d(0,0,0)";
    }

    if (cardsInView()) {
      markPlayedThrough(focusedIndex(progress));
    }
  }

  function cardsInView() {
    const rect = viewport.getBoundingClientRect();
    const top = navHeight();
    return rect.bottom > top && rect.top < window.innerHeight;
  }

  function onViewportScroll() {
    if (pinMode) return;
    const centerX = viewport.scrollLeft + viewport.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < cards.length; i += 1) {
      const card = cards[i];
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const dist = Math.abs(cardCenter - centerX);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    markPlayedThrough(best);
  }

  function loop() {
    if (!running) return;
    update();
    window.requestAnimationFrame(loop);
  }

  function startLoop() {
    if (running) return;
    running = true;
    window.requestAnimationFrame(loop);
  }

  function onResize() {
    measure();
    update();
  }

  pinMode = shouldPin();
  measure();
  update();
  startLoop();

  window.addEventListener("scroll", update, { passive: true });
  document.addEventListener("scroll", update, { passive: true, capture: true });
  window.addEventListener("resize", onResize);
  window.visualViewport?.addEventListener("resize", onResize);
  motionQuery.addEventListener("change", onResize);
  pinQuery.addEventListener("change", onResize);
  landscapeQuery.addEventListener("change", onResize);
  viewport.addEventListener("scroll", onViewportScroll, { passive: true });

  if (document.fonts?.ready) {
    document.fonts.ready.then(onResize);
  }
}

initDayCarousel();

function initHeroHeadline() {
  const headline = document.querySelector(".hero-headline");
  if (!headline) return;

  const lines = [
    'Leo <span class="hero-accent">walked 2.3&nbsp;km</span> this morning.',
    'Simba <span class="hero-accent">slept 7&nbsp;hours</span> last night.',
    'Bella <span class="hero-accent">rested well</span> after her evening walk.',
    'Coco hit her <span class="hero-accent">activity goal</span> today.',
  ];
  const slots = [...headline.querySelectorAll(".hero-headline-line")];
  if (slots.length < 2) return;

  const HOLD_MS = 5500;
  const TRANSITION_MS = 800;
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  let index = 0;
  let current = 0;
  let timer = 0;
  let clearing = 0;
  let started = false;

  slots[0].innerHTML = lines[0];
  slots[0].classList.add("is-in");
  slots[0].classList.remove("is-out", "is-entering");
  slots[0].removeAttribute("aria-hidden");
  slots[1].textContent = "";
  slots[1].classList.remove("is-in", "is-out", "is-entering");
  slots[1].setAttribute("aria-hidden", "true");

  function syncHeight(primary, secondary) {
    const h = Math.max(
      primary?.offsetHeight || 0,
      secondary?.offsetHeight || 0,
    );
    headline.style.height = h ? `${h}px` : "";
  }

  function clearTimer() {
    window.clearTimeout(timer);
  }

  function schedule() {
    clearTimer();
    timer = window.setTimeout(advance, HOLD_MS);
  }

  function advance() {
    const nextIndex = (index + 1) % lines.length;
    const outgoing = slots[current];
    const incoming = slots[1 - current];

    window.clearTimeout(clearing);
    incoming.innerHTML = lines[nextIndex];
    incoming.classList.remove("is-out", "is-in", "is-entering");
    void incoming.offsetWidth;
    incoming.classList.add("is-in", "is-entering");
    incoming.removeAttribute("aria-hidden");

    outgoing.classList.remove("is-in", "is-entering");
    outgoing.classList.add("is-out");
    outgoing.setAttribute("aria-hidden", "true");

    syncHeight(incoming, outgoing);

    current = 1 - current;
    index = nextIndex;

    const settle = motionQuery.matches ? 0 : TRANSITION_MS;
    clearing = window.setTimeout(() => {
      outgoing.classList.remove("is-out");
      outgoing.textContent = "";
      incoming.classList.remove("is-entering");
      syncHeight(incoming);
    }, settle);

    schedule();
  }

  document.addEventListener("visibilitychange", () => {
    if (!started) return;
    if (document.hidden) clearTimer();
    else schedule();
  });
  window.addEventListener("resize", () => syncHeight(slots[current]));

  syncHeight(slots[0]);
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => syncHeight(slots[current]));
  }

  function start() {
    if (started) return;
    started = true;
    headline.classList.add("is-ready");

    const first = slots[current];
    first.classList.remove("is-entering");
    void first.offsetWidth;
    first.classList.add("is-entering");
    const settle = motionQuery.matches ? 0 : TRANSITION_MS;
    clearing = window.setTimeout(() => {
      first.classList.remove("is-entering");
    }, settle);

    schedule();
  }

  if (!splash || splash.classList.contains("is-gone")) {
    start();
  } else {
    const observer = new MutationObserver(() => {
      if (splash.classList.contains("is-gone")) {
        observer.disconnect();
        start();
      }
    });
    observer.observe(splash, { attributes: true, attributeFilter: ["class"] });
  }
}

initHeroHeadline();

function initNoteQuestion() {
  const slot = document.querySelector(".note-question");
  if (!slot) return;

  const lines = [...slot.querySelectorAll(".note-question-line")];
  if (lines.length < 2) return;

  const HOLD_MS = 3800;
  const TRANSITION_MS = 800;
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  let index = 0;
  let timer = 0;
  let clearing = 0;
  let running = false;

  function lineHeight(line) {
    return Math.ceil(line.getBoundingClientRect().height);
  }

  function fit(animate) {
    const line = lines[index];
    const next = lineHeight(line);
    if (!next) return;

    const current = Math.ceil(slot.getBoundingClientRect().height);
    if (!animate || motionQuery.matches || current === next) {
      const previous = slot.style.transition;
      slot.style.transition = "none";
      slot.style.height = `${next}px`;
      void slot.offsetWidth;
      slot.style.transition = previous;
      return;
    }

    slot.style.height = `${current}px`;
    window.requestAnimationFrame(() => {
      slot.style.height = `${next}px`;
    });
  }

  function clearTimer() {
    window.clearTimeout(timer);
  }

  function schedule() {
    clearTimer();
    if (!running) return;
    timer = window.setTimeout(advance, HOLD_MS);
  }

  function advance() {
    const outgoing = lines[index];
    index = (index + 1) % lines.length;
    const incoming = lines[index];

    window.clearTimeout(clearing);
    incoming.classList.remove("is-out", "is-entering");
    void incoming.offsetWidth;
    incoming.classList.add("is-in");
    if (!motionQuery.matches) incoming.classList.add("is-entering");
    incoming.removeAttribute("aria-hidden");

    outgoing.classList.remove("is-in", "is-entering");
    if (!motionQuery.matches) outgoing.classList.add("is-out");
    outgoing.setAttribute("aria-hidden", "true");
    fit(true);

    clearing = window.setTimeout(() => {
      outgoing.classList.remove("is-out");
      incoming.classList.remove("is-entering");
    }, motionQuery.matches ? 0 : TRANSITION_MS);

    schedule();
  }

  function inView() {
    const rect = slot.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight;
  }

  function start() {
    if (running || document.hidden || !inView()) return;
    running = true;
    slot.classList.add("is-ready");
    schedule();
  }

  function stop() {
    running = false;
    clearTimer();
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) start();
      else stop();
    },
    { threshold: 0.4 }
  );

  observer.observe(slot);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });
  motionQuery.addEventListener("change", () => {
    lines.forEach((line) => line.classList.remove("is-entering", "is-out"));
    fit(false);
  });
  window.addEventListener("resize", () => fit(false));
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => fit(false));
  }
  fit(false);
}

initNoteQuestion();

function initNavCta() {
  const nav = document.querySelector(".nav");
  const hero = document.querySelector(".hero");
  if (!nav || !hero) return;

  function update() {
    const pastHero = hero.getBoundingClientRect().bottom <= nav.offsetHeight;
    nav.classList.toggle("is-past-hero", pastHero);
  }

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
}

initNavCta();

function initParallax() {
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const desktopQuery = window.matchMedia("(min-width: 1024px)");
  const hero = document.querySelector(".hero");
  const heroImg = document.querySelector(".hero-media img");

  function inView(el, pad = 120) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.bottom > -pad && rect.top < window.innerHeight + pad;
  }

  function reset() {
    if (heroImg) heroImg.style.transform = "";
  }

  function enabled() {
    return desktopQuery.matches && !motionQuery.matches;
  }

  function update() {
    if (!enabled()) {
      reset();
      return;
    }

    if (hero && heroImg && inView(hero)) {
      const y = Math.round(-hero.getBoundingClientRect().top * 0.22);
      heroImg.style.transform = `translate3d(0, ${y}px, 0) scale(1.04)`;
    }
  }

  let running = false;

  function loop() {
    if (!running) return;
    update();
    window.requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    running = true;
    update();
    window.requestAnimationFrame(loop);
  }

  function sync() {
    if (!enabled()) {
      running = false;
      reset();
      return;
    }
    start();
  }

  motionQuery.addEventListener("change", sync);
  desktopQuery.addEventListener("change", sync);
  window.addEventListener("scroll", update, { passive: true });
  document.addEventListener("scroll", update, { passive: true, capture: true });
  window.addEventListener("resize", update);

  if (enabled()) start();
}

initParallax();

function initPerkMotion() {
  const section = document.querySelector("#founding");
  if (!section) return;

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  function setPaused(paused) {
    section.classList.toggle("is-perk-paused", paused);
  }

  function sync() {
    if (motionQuery.matches) {
      setPaused(true);
      return;
    }
    const rect = section.getBoundingClientRect();
    const inView = rect.bottom > 0 && rect.top < window.innerHeight;
    setPaused(!inView || document.hidden);
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (motionQuery.matches) {
        setPaused(true);
        return;
      }
      const visible = entries.some((entry) => entry.isIntersecting);
      setPaused(!visible || document.hidden);
    },
    { threshold: 0 }
  );

  observer.observe(section);
  motionQuery.addEventListener("change", sync);
  document.addEventListener("visibilitychange", sync);
  sync();
}

initPerkMotion();

function initProcessStats() {
  const list = document.querySelector(".process-stats");
  if (!list) return;

  const figures = [...list.querySelectorAll(".process-stat strong")];
  if (!figures.length) return;

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const DURATION = 1200;
  const STAGGER = 140;

  const stats = figures.map((el) => {
    const raw = el.textContent.trim();
    const match = raw.match(/^(\d+)(.*)$/);
    return {
      el,
      raw,
      value: match ? Number(match[1]) : 0,
      suffix: match ? match[2] : "",
      digits: null,
    };
  });

  let built = false;
  let played = false;
  let rafId = 0;
  let timeoutId = 0;
  let ticket = 0;

  function build(stat) {
    const sr = document.createElement("span");
    sr.className = "stat-sr";
    sr.textContent = stat.raw;

    const visual = document.createElement("span");
    visual.className = "stat-visual";
    visual.setAttribute("aria-hidden", "true");

    const digits = document.createElement("span");
    digits.className = "stat-digits";
    digits.textContent = String(stat.value);

    visual.append(digits);
    if (stat.suffix) {
      const suffix = document.createElement("span");
      suffix.className = "stat-suffix";
      suffix.textContent = stat.suffix;
      visual.append(suffix);
    }

    stat.el.replaceChildren(sr, visual);
    stat.digits = digits;
  }

  function measure() {
    for (const stat of stats) {
      if (!stat.digits) continue;
      const previous = stat.digits.textContent;
      stat.digits.style.minWidth = "0px";
      stat.digits.textContent = String(stat.value);
      const width = Math.ceil(stat.digits.getBoundingClientRect().width);
      stat.digits.textContent = previous;
      stat.digits.style.minWidth = width ? `${width}px` : "";
    }
  }

  function showFinal() {
    for (const stat of stats) {
      stat.el.classList.remove("is-rise");
      stat.el.style.removeProperty("--stat-delay");
      if (!stat.digits) continue;
      stat.digits.textContent = String(stat.value);
      stat.digits.style.minWidth = "";
    }
    list.classList.remove("is-in");
  }

  function easeOut(t) {
    return 1 - (1 - t) ** 3;
  }

  function ensureBuilt() {
    if (built) return;
    for (const stat of stats) build(stat);
    built = true;
  }

  function play() {
    if (played || motionQuery.matches) return;
    played = true;
    ensureBuilt();
    measure();
    for (const [index, stat] of stats.entries()) {
      if (stat.value <= 1) {
        stat.el.classList.add("is-rise");
        stat.el.style.setProperty("--stat-delay", `${index * STAGGER}ms`);
      } else {
        stat.digits.textContent = "0";
      }
    }
    list.classList.add("is-in");

    const start = performance.now();

    function frame(now) {
      let running = false;
      for (const [index, stat] of stats.entries()) {
        if (stat.value <= 1) continue;
        const elapsed = now - start - index * STAGGER;
        if (elapsed < 0) {
          running = true;
          continue;
        }
        const t = Math.min(1, elapsed / DURATION);
        const current = Math.round(easeOut(t) * stat.value);
        const next = String(current);
        if (stat.digits.textContent !== next) stat.digits.textContent = next;
        if (t < 1) running = true;
      }
      if (running) schedule();
      else {
        for (const stat of stats) {
          if (stat.value <= 1 || !stat.digits) continue;
          stat.digits.textContent = String(stat.value);
          stat.digits.style.minWidth = "";
        }
      }
    }

    function schedule() {
      const mine = ++ticket;
      const run = (stamp) => {
        if (mine !== ticket) return;
        ticket += 1;
        frame(typeof stamp === "number" ? stamp : performance.now());
      };
      rafId = requestAnimationFrame(run);
      timeoutId = window.setTimeout(run, 32);
    }

    schedule();

    window.setTimeout(() => {
      for (const stat of stats) stat.el.classList.remove("is-rise");
    }, DURATION + STAGGER * stats.length);
  }

  function inView() {
    const rect = list.getBoundingClientRect();
    if (rect.height <= 0) return false;
    const vh = window.innerHeight || 1;
    const visible = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
    return visible / rect.height >= 0.35;
  }

  function tryPlay() {
    if (played || motionQuery.matches) return;
    if (inView()) play();
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) tryPlay();
    },
    { threshold: 0.35 }
  );

  function syncMotion() {
    if (!motionQuery.matches) return;
    ticket += 1;
    cancelAnimationFrame(rafId);
    window.clearTimeout(timeoutId);
    observer.disconnect();
    window.removeEventListener("scroll", tryPlay);
    if (!played) {
      if (built) showFinal();
      played = true;
    }
  }

  motionQuery.addEventListener("change", syncMotion);
  window.addEventListener("scroll", tryPlay, { passive: true });
  document.addEventListener("scroll", tryPlay, { passive: true, capture: true });
  window.addEventListener("resize", tryPlay);

  function watch() {
    observer.observe(list);
    tryPlay();
  }

  const splashEl = document.querySelector("#splash");
  if (!splashEl || splashEl.classList.contains("is-gone") || document.body.classList.contains("is-live")) {
    watch();
  } else {
    const splashWatch = new MutationObserver(() => {
      if (splashEl.classList.contains("is-gone") || document.body.classList.contains("is-live")) {
        splashWatch.disconnect();
        watch();
      }
    });
    splashWatch.observe(splashEl, { attributes: true, attributeFilter: ["class"] });
    splashWatch.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }
}

initProcessStats();

/* Keep the Tally popup full-height after submit (thank-you page is shorter). */
function initTallyPopupLock() {
  const FULL = "100dvh";
  let locking = false;

  function lockEl(el) {
    if (!el) return;
    el.style.setProperty("height", FULL, "important");
    el.style.setProperty("min-height", FULL, "important");
    el.style.setProperty("max-height", FULL, "important");
  }

  function lockPopup() {
    if (locking) return;
    const popup = document.querySelector(".tally-popup");
    if (!popup) return;
    locking = true;
    try {
      lockEl(popup);
      popup.style.setProperty("top", "0", "important");
      popup.style.setProperty("bottom", "0", "important");
      lockEl(popup.querySelector('[class*="_popupContainer"]'));
      lockEl(popup.querySelector("iframe"));
    } finally {
      locking = false;
    }
  }

  const observer = new MutationObserver(lockPopup);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["style"],
  });

  window.addEventListener("message", (event) => {
    if (typeof event.data === "string" && event.data.includes("iframeResizer")) {
      lockPopup();
    }
  });

  lockPopup();
}

initTallyPopupLock();
