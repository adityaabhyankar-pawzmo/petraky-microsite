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

/* Keep the sharp frame just under cover on any phone aspect ratio. */
const SPLASH_ZOOM_OUT = 0.88;

function updateSplashFrame() {
  if (!splash || !video) return;

  if (!mobileSplash.matches) {
    video.style.transform = "";
    return;
  }

  const vw = splash.clientWidth || window.innerWidth;
  const vh = splash.clientHeight || window.innerHeight;
  if (vw <= 0 || vh <= 0) return;

  const ratio =
    video.videoWidth > 0 && video.videoHeight > 0
      ? video.videoWidth / video.videoHeight
      : 16 / 9;

  const containH = vw / ratio;
  const containW = vh * ratio;
  const coverFactor = Math.max(vh / containH, vw / containW);
  const scale = Math.max(1, coverFactor * SPLASH_ZOOM_OUT);
  video.style.transform = `scale(${scale})`;
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
    "A society built for DOGS",
    "A society built for DOGS",
    "A society built for DOGS",
    "A society built for DOGS",
  ];
  const dog = `
    <span class="ticker-dog">
      <img src="assets/paw-print.svg?v=2" alt="" width="18" height="18" />
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
    'Leo <span class="hero-accent">walked 2.3 km</span> this morning.',
    'Simba <span class="hero-accent">slept 7 hours</span> last night.',
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

function initMobileNavCta() {
  const nav = document.querySelector(".nav");
  const hero = document.querySelector(".hero");
  if (!nav || !hero) return;

  const mobileQuery = window.matchMedia("(max-width: 699.98px)");

  function update() {
    if (!mobileQuery.matches) {
      nav.classList.remove("is-past-hero");
      return;
    }

    const pastHero = hero.getBoundingClientRect().bottom <= nav.offsetHeight;
    nav.classList.toggle("is-past-hero", pastHero);
  }

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  mobileQuery.addEventListener("change", update);
  update();
}

initMobileNavCta();

function initParallax() {
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const desktopQuery = window.matchMedia("(min-width: 1024px)");
  const hero = document.querySelector(".hero");
  const heroImg = document.querySelector(".hero-media img");
  const note = document.querySelector(".note");
  const noteLeft = document.querySelector(".note-left");
  const noteCard = document.querySelector(".note-card");

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function inView(el, pad = 120) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.bottom > -pad && rect.top < window.innerHeight + pad;
  }

  function viewOffset(el) {
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    return clamp((rect.top + rect.height / 2 - vh / 2) / vh, -0.7, 0.7);
  }

  function reset() {
    if (heroImg) heroImg.style.transform = "";
    if (noteLeft) noteLeft.style.transform = "";
    if (noteCard) noteCard.style.transform = "";
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
      heroImg.style.transform = `translate3d(0, ${y}px, 0) scale(1.16)`;
    }

    if (note && noteLeft && noteCard && inView(note)) {
      const offset = viewOffset(note);
      noteLeft.style.transform = `translate3d(0, ${Math.round(offset * 28)}px, 0)`;
      noteCard.style.transform = `translate3d(0, ${Math.round(offset * -18)}px, 0)`;
    } else {
      if (noteLeft) noteLeft.style.transform = "";
      if (noteCard) noteCard.style.transform = "";
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
