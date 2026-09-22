const splash = document.querySelector("#splash");
const video = document.querySelector("#splash-video");
const skip = document.querySelector("#skip");
const site = document.querySelector("#site");

const CRT_MS = 1200;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let exiting = false;

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
    "A society built for pets",
  ];
  const dog = `
    <span class="ticker-dog">
      <img class="ticker-dog-outline" src="assets/dog-outline.svg?v=2" alt="" width="27.6255" height="29.0698" />
      <img class="ticker-dog-body" src="assets/dog-body.svg?v=2" alt="" width="21.3996" height="27.1492" />
      <img class="ticker-dog-nose" src="assets/dog-nose.svg?v=2" alt="" width="11.8749" height="4.36945" />
    </span>`;
  const set = `<div class="ticker-set">${phrases
    .map((text) => `<span class="ticker-copy">${text}</span>${dog}`)
    .join("")}</div>`;

  for (const track of document.querySelectorAll(".ticker-track")) {
    track.innerHTML = set + set;
  }
}

initTickers();

function endSplash() {
  if (exiting) return;
  exiting = true;

  skip.setAttribute("disabled", "true");
  splash.classList.add("is-off");
  splash.setAttribute("aria-hidden", "true");

  try {
    video.pause();
  } catch {
    /* ignore */
  }

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

  const tryPlay = async () => {
    try {
      await video.play();
      return !video.paused;
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
  const landscapeQuery = window.matchMedia(
    "(max-height: 500px) and (orientation: landscape)"
  );
  let overflow = 0;
  let travel = 0;
  let running = false;
  let playedThrough = -1;

  function navHeight() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(
      "--nav-height"
    );
    return Number.parseFloat(raw) || 56;
  }

  function shouldPin() {
    return !motionQuery.matches && !landscapeQuery.matches;
  }

  function markPlayedThrough(index) {
    const next = Math.min(Math.max(index, 0), cards.length - 1);
    if (next <= playedThrough) return;
    for (let i = playedThrough + 1; i <= next; i += 1) {
      cards[i]?.classList.add("is-played");
    }
    playedThrough = next;
  }

  function markAllPlayed() {
    markPlayedThrough(cards.length - 1);
  }

  function focusedIndex(progress) {
    if (!cards.length) return 0;
    if (overflow <= 0) return 0;
    return Math.round(progress * (cards.length - 1));
  }

  function measure() {
    if (!shouldPin()) {
      overflow = 0;
      travel = 0;
      section.style.height = "";
      track.style.transform = "";
      markAllPlayed();
      return;
    }

    const previous = track.style.transform;
    track.style.transform = "translate3d(0,0,0)";
    overflow = Math.max(0, track.scrollWidth - viewport.clientWidth);
    track.style.transform = previous;

    const steps = Math.max(track.children.length - 1, 1);
    travel =
      overflow > 0
        ? Math.max(
            Math.round(overflow * 1.2),
            Math.round(steps * window.innerHeight * 0.7)
          )
        : 0;

    section.style.height = travel > 0 ? `${pin.offsetHeight + travel}px` : "";

    if (overflow <= 0) {
      markAllPlayed();
    }
  }

  function update() {
    overflow = Math.max(0, track.scrollWidth - viewport.clientWidth);

    if (overflow <= 0) {
      track.style.transform = "translate3d(0,0,0)";
      if (cardsInView()) markPlayedThrough(0);
      return;
    }

    const travelPx = Math.max(1, section.offsetHeight - pin.offsetHeight);
    const scrolled = navHeight() - section.getBoundingClientRect().top;
    const progress = Math.min(1, Math.max(0, scrolled / travelPx));
    track.style.transform = `translate3d(${-progress * overflow}px,0,0)`;
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
    if (shouldPin()) return;
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

  measure();
  update();
  startLoop();

  window.addEventListener("scroll", update, { passive: true });
  document.addEventListener("scroll", update, { passive: true, capture: true });
  window.addEventListener("resize", onResize);
  window.visualViewport?.addEventListener("resize", onResize);
  motionQuery.addEventListener("change", onResize);
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
    "Leo walked 2.3 km this morning.",
    "Simba slept 7 hours last night.",
    "Bella rested well after her evening walk.",
  ];
  const slots = [...headline.querySelectorAll(".hero-headline-line")];
  if (slots.length < 2) return;

  const HOLD_MS = 5500;
  const TRANSITION_MS = 700;
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  let index = 0;
  let current = 0;
  let timer = 0;
  let clearing = 0;
  let started = false;

  slots[0].textContent = lines[0];
  slots[0].classList.add("is-in");
  slots[0].removeAttribute("aria-hidden");
  slots[1].textContent = "";
  slots[1].classList.remove("is-in", "is-out");
  slots[1].setAttribute("aria-hidden", "true");

  function lockHeight() {
    const probe = document.createElement("span");
    probe.className = "hero-headline-line is-in";
    probe.setAttribute("aria-hidden", "true");
    probe.style.visibility = "hidden";
    headline.append(probe);

    let max = 0;
    for (const text of lines) {
      probe.textContent = text;
      max = Math.max(max, probe.offsetHeight);
    }

    probe.remove();
    headline.style.minHeight = max ? `${max}px` : "";
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
    incoming.textContent = lines[nextIndex];
    incoming.classList.remove("is-out", "is-in");
    void incoming.offsetWidth;
    incoming.classList.add("is-in");
    incoming.removeAttribute("aria-hidden");

    outgoing.classList.remove("is-in");
    outgoing.classList.add("is-out");
    outgoing.setAttribute("aria-hidden", "true");

    current = 1 - current;
    index = nextIndex;

    const settle = motionQuery.matches ? 0 : TRANSITION_MS;
    clearing = window.setTimeout(() => {
      outgoing.classList.remove("is-out");
      outgoing.textContent = "";
    }, settle);

    schedule();
  }

  document.addEventListener("visibilitychange", () => {
    if (!started) return;
    if (document.hidden) clearTimer();
    else schedule();
  });
  window.addEventListener("resize", lockHeight);

  lockHeight();

  function start() {
    if (started) return;
    started = true;
    headline.classList.add("is-ready");
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
  const desktopQuery = window.matchMedia("(min-width: 880px)");
  const hero = document.querySelector(".hero");
  const heroImg = document.querySelector(".hero-media img");
  const askCard = document.querySelector(".ask-card");
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
    if (askCard) askCard.style.transform = "";
    if (noteLeft) noteLeft.style.transform = "";
    if (noteCard) noteCard.style.transform = "";
  }

  function update() {
    if (motionQuery.matches) {
      reset();
      return;
    }

    if (hero && heroImg && inView(hero)) {
      const y = Math.round(-hero.getBoundingClientRect().top * 0.22);
      heroImg.style.transform = `translate3d(0, ${y}px, 0) scale(1.16)`;
    }

    if (askCard && inView(askCard, 200)) {
      const offset = viewOffset(askCard);
      askCard.style.transform = `translate3d(0, ${Math.round(offset * 42)}px, 0)`;
    }

    if (desktopQuery.matches && note && noteLeft && noteCard && inView(note)) {
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

  motionQuery.addEventListener("change", () => {
    if (motionQuery.matches) {
      running = false;
      reset();
      return;
    }
    start();
  });

  desktopQuery.addEventListener("change", update);
  window.addEventListener("scroll", update, { passive: true });
  document.addEventListener("scroll", update, { passive: true, capture: true });
  window.addEventListener("resize", update);

  if (!motionQuery.matches) start();
}

initParallax();
