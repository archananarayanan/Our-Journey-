import './style.css';
import { getCurrentScoreData, updateJourney, type JourneyData, type JourneyEntry } from './json_backend_service';

// ─── Configuration ────────────────────────────────────────────────────────────
const MAX_POINTS = 10_000;
const MILESTONE_INTERVAL = 1_000;

/** Celebration GIFs stored in /public/videos/ */
const BASE = import.meta.env.BASE_URL;
const CELEBRATION_GIFS: string[] = [
  `${BASE}videos/celebration1.gif`,
  `${BASE}videos/celebration2.gif`,
  `${BASE}videos/celebration3.gif`,
  `${BASE}videos/celebration4.gif`,
  `${BASE}videos/celebration5.gif`,
  `${BASE}videos/celebration6.gif`,
  `${BASE}videos/celebration7.gif`,
  `${BASE}videos/celebration8.gif`,
  `${BASE}videos/celebration9.gif`,
];

const CELEBRATION_MESSAGES: string[] = [
  "🦊 Nick: 'Finally, our hard work paid off!' 🎉",
  "🐰 Judy: 'We did it together, Nick! Anyone can do anything!' 🌟",
  "🦊🐰 Nick & Judy high-five! Another 1,000 points in the bag! 💪",
  "🐰 Judy: 'Try everything — and we just did!' 🎶",
  "🦊 Nick: 'Pretty sly, Carrots. Pretty sly.' 😏❤️",
  "🦊🐰 Zootopia cheers for Nick & Judy! 🏙️🎊",
  "🐰 Judy: 'I knew you believed in us all along, Nick!' 💕",
  "🦊 Nick: 'I may have been wrong about giving up.' 🙌",
  "🦊🐰 Another milestone smashed — onward to 10,000! 🚀",
  "🎉 The whole of Zootopia is celebrating with you two! 🦁🐘🦒",
];

// ─── Persistent storage ───────────────────────────────────────────────────────
const STORAGE_KEY = "ourJourney";
const DATA_PATH = `${BASE}data/journey.json`;

function loadState(): JourneyData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as JourneyData;
  } catch {
    // fallback to defaults below
  }
  return { totalScore: 0, lastCelebratedMilestone: 0, log: [] };
}

function buildJourneyData(): JourneyData {
  return {
    totalScore: currentPoints,
    lastCelebratedMilestone,
    log: journeyLog,
  };
}

function saveLocalState(data: JourneyData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let journeySyncChain: Promise<void> = Promise.resolve();

function saveState(): void {
  const data = buildJourneyData();
  saveLocalState(data);
  journeySyncChain = journeySyncChain
    .then(async () => {
      try {
        await updateJourney(data);
      } catch {
        // remote sync unavailable — keep local state intact
      }
    })
    .catch(() => undefined);
}

/** Trigger a download of the current journey.json so users can commit it back. */
function exportJourney(): void {
  const data = buildJourneyData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "journey.json";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── State ────────────────────────────────────────────────────────────────────
let journeyLog: JourneyEntry[] = [];
let currentPoints = 0;
let lastCelebratedMilestone = 0;
let celebrationHideTimer: ReturnType<typeof setTimeout> | null = null;
let confettiAnimationFrameId: number | null = null;
let confettiRunId = 0;
let updaterConfettiTimer: ReturnType<typeof setTimeout> | null = null;

async function initState(): Promise<void> {
  try {
    const remote = await getCurrentScoreData();
    if (remote) {
      currentPoints = remote.totalScore ?? 0;
      lastCelebratedMilestone = remote.lastCelebratedMilestone ?? 0;
      journeyLog = remote.log ?? [];
      saveLocalState(buildJourneyData());
      return;
    }
  } catch {
    // remote unavailable — fall back below
  }

  const local = loadState();
  if (local.totalScore !== 0 || local.log.length > 0) {
    currentPoints = local.totalScore;
    lastCelebratedMilestone = local.lastCelebratedMilestone;
    journeyLog = local.log;
    return;
  }

  try {
    const res = await fetch(DATA_PATH);
    if (res.ok) {
      const seed = (await res.json()) as JourneyData;
      currentPoints = seed.totalScore ?? 0;
      lastCelebratedMilestone = seed.lastCelebratedMilestone ?? 0;
      journeyLog = seed.log ?? [];
      saveLocalState(buildJourneyData());
      return;
    }
  } catch {
    // network unavailable — stay at defaults
  }

  currentPoints = 0;
  lastCelebratedMilestone = 0;
  journeyLog = [];
}


// ─── DOM refs ─────────────────────────────────────────────────────────────────
const scoreDisplay = document.getElementById("score-display") as HTMLElement;
const milestoneLabel = document.getElementById("milestone-label") as HTMLElement;
const progressFill = document.getElementById("progress-fill") as HTMLElement;
const milestoneMarkers = document.getElementById("milestone-markers") as HTMLElement;
const milestoneTicks = document.getElementById("milestone-ticks") as HTMLElement;
const milestoneChips = document.getElementById("milestone-chips") as HTMLElement;
const maxLabel = document.getElementById("max-label") as HTMLElement;
const pointsInput = document.getElementById("points-input") as HTMLInputElement;
const btnAdd = document.getElementById("btn-add") as HTMLButtonElement;
const btnLose = document.getElementById("btn-lose") as HTMLButtonElement;
const actionLog = document.getElementById("action-log") as HTMLUListElement;
const celebrationPopup = document.getElementById("celebration-popup") as HTMLElement;
const celebrationMessage = document.getElementById("celebration-message") as HTMLElement;
const celebrationClose = document.getElementById("celebration-close") as HTMLButtonElement;
const confettiCanvas = document.getElementById("confetti-canvas") as HTMLCanvasElement;
const scoreUpdaterInner = document.querySelector(".score-updater-inner") as HTMLElement;
const gifBg = document.getElementById("gif-bg") as HTMLElement;

// ─── GIF background cycling ───────────────────────────────────────────────────
let gifBgTimer: ReturnType<typeof setTimeout> | null = null;
let gifBgIndex = 0;
const GIF_DISPLAY_DURATION = 120_000; // ms each gif stays visible

function preloadGifImage(src: string): HTMLImageElement {
  const img = document.createElement("img");
  img.src = src;
  img.alt = "";
  return img;
}

/** Show gifs one-at-a-time cycling as translucent background */
function startGifBackground(): void {
  if (gifBgTimer !== null) clearTimeout(gifBgTimer);
  gifBg.innerHTML = "";

  const shuffled = [...CELEBRATION_GIFS].sort(() => Math.random() - 0.5);
  gifBgIndex = 0;

  const img = preloadGifImage(shuffled[gifBgIndex]);
  gifBg.appendChild(img);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => img.classList.add("gif-visible"));
  });

  function cycleNext(): void {
    const currentImg = gifBg.querySelector("img");
    gifBgIndex = (gifBgIndex + 1) % shuffled.length;
    const nextImg = preloadGifImage(shuffled[gifBgIndex]);
    gifBg.appendChild(nextImg);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        nextImg.classList.add("gif-visible");
        if (currentImg) currentImg.classList.remove("gif-visible");
        setTimeout(() => currentImg?.remove(), 900);
      });
    });

    gifBgTimer = setTimeout(cycleNext, GIF_DISPLAY_DURATION);
  }

  gifBgTimer = setTimeout(cycleNext, GIF_DISPLAY_DURATION);
}

// ─── Init UI ──────────────────────────────────────────────────────────────────
function init(): void {
  maxLabel.textContent = MAX_POINTS.toLocaleString();
  buildMilestoneMarkers();
  startGifBackground();
}

function buildMilestoneMarkers(): void {
  milestoneMarkers.innerHTML = "";
  milestoneTicks.innerHTML = "";
  const totalMilestones = MAX_POINTS / MILESTONE_INTERVAL;

  for (let i = 1; i <= totalMilestones; i++) {
    const pct = (i / totalMilestones) * 100;

    const tick = document.createElement("div");
    tick.className = "text-xs opacity-60 select-none";
    tick.textContent = `${(i * MILESTONE_INTERVAL).toLocaleString()}`;
    tick.style.width = `${100 / totalMilestones}%`;
    tick.style.textAlign = "center";
    milestoneTicks.appendChild(tick);

    const marker = document.createElement("div");
    marker.id = `milestone-marker-${i}`;
    marker.className = "absolute top-0 bottom-0 w-0.5 transition-colors duration-500";
    marker.style.left = `${pct}%`;
    marker.style.background = "rgba(255,255,255,0.4)";
    marker.setAttribute("aria-label", `Milestone ${i * MILESTONE_INTERVAL}`);
    milestoneMarkers.appendChild(marker);
  }
}

// ─── Update display ───────────────────────────────────────────────────────────
function updateDisplay(): void {
  scoreDisplay.textContent = currentPoints.toLocaleString();

  const pct = Math.min((currentPoints / MAX_POINTS) * 100, 100);
  progressFill.style.width = `${pct}%`;

  const nextMilestone =
    Math.ceil((currentPoints + 1) / MILESTONE_INTERVAL) * MILESTONE_INTERVAL;
  if (currentPoints >= MAX_POINTS) {
    milestoneLabel.textContent = "🏆 Max love reached!";
  } else {
    const remaining = nextMilestone - currentPoints;
    milestoneLabel.textContent = `Next milestone: ${nextMilestone.toLocaleString()} pts (${remaining.toLocaleString()} to go)`;
  }

  scoreDisplay.classList.remove("score-bump");
  void scoreDisplay.offsetWidth;
  scoreDisplay.classList.add("score-bump");

  const totalMilestones = MAX_POINTS / MILESTONE_INTERVAL;
  for (let i = 1; i <= totalMilestones; i++) {
    const marker = document.getElementById(`milestone-marker-${i}`);
    if (!marker) continue;
    if (currentPoints >= i * MILESTONE_INTERVAL) {
      marker.style.background = "#ff8c00";
    } else {
      marker.style.background = "rgba(255,255,255,0.4)";
    }
  }
}

// ─── Score updater panel animation ───────────────────────────────────────────
function animateUpdaterPanel(type: "add" | "lose"): void {
  if (!scoreUpdaterInner) return;
  scoreUpdaterInner.classList.remove("anim-add", "anim-lose");
  void scoreUpdaterInner.offsetWidth;
  scoreUpdaterInner.classList.add(type === "add" ? "anim-add" : "anim-lose");
  setTimeout(() => {
    scoreUpdaterInner.classList.remove("anim-add", "anim-lose");
  }, 1_300);
}

// ─── Milestone reached ────────────────────────────────────────────────────────
function checkMilestones(): void {
  const reachedMilestone =
    Math.floor(currentPoints / MILESTONE_INTERVAL) * MILESTONE_INTERVAL;

  if (reachedMilestone <= 0 || reachedMilestone <= lastCelebratedMilestone) return;

  const milestonesToCelebrate: number[] = [];
  for (
    let milestone = lastCelebratedMilestone + MILESTONE_INTERVAL;
    milestone <= reachedMilestone;
    milestone += MILESTONE_INTERVAL
  ) {
    milestonesToCelebrate.push(milestone);
    addMilestoneChip(milestone);
  }

  lastCelebratedMilestone = reachedMilestone;

  milestonesToCelebrate.forEach((milestone, index) => {
    setTimeout(() => celebrate(milestone), index * 900);
  });
}

function addMilestoneChip(milestone: number): void {
  const chip = document.createElement("span");
  chip.className = "px-3 py-1 rounded-full text-xs font-bold";
  chip.style.background = "rgba(255,140,0,0.15)";
  chip.style.border = "1px solid rgba(255,140,0,0.45)";
  chip.style.color = "#c84b00";
  chip.textContent = `🏅 ${milestone.toLocaleString()} pts`;
  milestoneChips.appendChild(chip);
}

// ─── Celebration ──────────────────────────────────────────────────────────────
function celebrate(milestone: number): void {
  const msg =
    CELEBRATION_MESSAGES[Math.floor(Math.random() * CELEBRATION_MESSAGES.length)];
  celebrationMessage.textContent = `${msg} — ${milestone.toLocaleString()} points reached!`;
  celebrationPopup.classList.remove("hidden");
  if (celebrationHideTimer !== null) clearTimeout(celebrationHideTimer);
  celebrationHideTimer = setTimeout(() => {
    celebrationPopup.classList.add("hidden");
    celebrationHideTimer = null;
  }, 10_000);

  // Restart gif background cycling for visual freshness
  startGifBackground();

  launchUpdaterConfetti();
  launchConfetti();
}

function launchUpdaterConfetti(): void {
  if (!scoreUpdaterInner) return;
  scoreUpdaterInner.classList.remove("milestone-confetti");
  void scoreUpdaterInner.offsetWidth;
  scoreUpdaterInner.classList.add("milestone-confetti");

  if (updaterConfettiTimer !== null) clearTimeout(updaterConfettiTimer);
  updaterConfettiTimer = setTimeout(() => {
    scoreUpdaterInner.classList.remove("milestone-confetti");
    updaterConfettiTimer = null;
  }, 1_900);
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  color: string;
  size: number;
  alpha: number;
}

function launchConfetti(): void {
  confettiCanvas.classList.remove("hidden");
  const ctx = confettiCanvas.getContext("2d")!;
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
  if (confettiAnimationFrameId !== null) cancelAnimationFrame(confettiAnimationFrameId);
  const runId = ++confettiRunId;

  const colors = ["#ff8c00", "#4a90d9", "#ffffff", "#fbbf24", "#e05c00", "#6db3f2"];
  const particles: Particle[] = Array.from({ length: 150 }, () => ({
    x: Math.random() * confettiCanvas.width,
    y: Math.random() * confettiCanvas.height * 0.5,
    vx: (Math.random() - 0.5) * 4,
    vy: Math.random() * 3 + 1,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: Math.random() * 8 + 4,
    alpha: 1,
  }));

  let frame = 0;
  const maxFrames = 180;

  function draw(): void {
    if (runId !== confettiRunId) return;

    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.alpha = Math.max(0, 1 - frame / maxFrames);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    frame++;
    if (frame < maxFrames) {
      confettiAnimationFrameId = requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      confettiCanvas.classList.add("hidden");
      confettiAnimationFrameId = null;
    }
  }
  confettiAnimationFrameId = requestAnimationFrame(draw);
}

// ─── Action log ───────────────────────────────────────────────────────────────
function logAction(text: string, positive: boolean, pts: number): void {
  const li = document.createElement("li");
  li.className = `flex items-center gap-1 ${positive ? "text-orange-700" : "text-blue-700"}`;
  li.innerHTML = `<span>${positive ? "➕" : "➖"}</span><span>${text}</span>`;
  actionLog.prepend(li);
  while (actionLog.children.length > 20) {
    actionLog.removeChild(actionLog.lastChild!);
  }

  journeyLog.push({
    timestamp: new Date().toISOString(),
    action: positive ? "add" : "lose",
    points: pts,
    totalAfter: currentPoints,
  });
}

// ─── Button handlers ──────────────────────────────────────────────────────────
function getInputValue(): number | null {
  const val = parseInt(pointsInput.value, 10);
  if (isNaN(val) || val <= 0) {
    pointsInput.classList.add("ring-2", "ring-red-400");
    setTimeout(() => pointsInput.classList.remove("ring-2", "ring-red-400"), 1_200);
    return null;
  }
  return val;
}

btnAdd.addEventListener("click", () => {
  const pts = getInputValue();
  if (pts === null) return;
  currentPoints = Math.min(currentPoints + pts, MAX_POINTS);
  logAction(`+${pts.toLocaleString()} pts added`, true, pts);
  pointsInput.value = "";
  animateUpdaterPanel("add");
  updateDisplay();
  checkMilestones();
  saveState();
});

btnLose.addEventListener("click", () => {
  const pts = getInputValue();
  if (pts === null) return;
  currentPoints = Math.max(currentPoints - pts, 0);
  logAction(`-${pts.toLocaleString()} pts lost`, false, pts);
  pointsInput.value = "";
  animateUpdaterPanel("lose");
  updateDisplay();
  saveState();
});

pointsInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnAdd.click();
});

// ─── Export button ────────────────────────────────────────────────────────────
const btnExport = document.getElementById("btn-export");
if (btnExport) btnExport.addEventListener("click", exportJourney);

// ─── Celebration close button ─────────────────────────────────────────────────
celebrationClose.addEventListener("click", () => {
  celebrationPopup.classList.add("hidden");
  if (celebrationHideTimer !== null) {
    clearTimeout(celebrationHideTimer);
    celebrationHideTimer = null;
  }
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
(async () => {
  await initState();
  init();
  updateDisplay();

  const recent = journeyLog.slice(-20).reverse();
  for (const entry of recent) {
    const positive = entry.action === "add";
    const li = document.createElement("li");
    li.className = `flex items-center gap-1 ${positive ? "text-orange-700" : "text-blue-700"}`;
    const sign = positive ? "➕" : "➖";
    const pts = entry.points.toLocaleString();
    li.innerHTML = `<span>${sign}</span><span>${positive ? "+" : "-"}${pts} pts — ${entry.timestamp.slice(0, 10)}</span>`;
    actionLog.appendChild(li);
  }

  const totalMilestones = MAX_POINTS / MILESTONE_INTERVAL;
  for (let i = 1; i <= totalMilestones; i++) {
    if (currentPoints >= i * MILESTONE_INTERVAL) {
      addMilestoneChip(i * MILESTONE_INTERVAL);
    }
  }
})();
