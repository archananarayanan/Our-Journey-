import './style.css';

// ─── Configuration ────────────────────────────────────────────────────────────
const MAX_POINTS = 10_000;
const MILESTONE_INTERVAL = 1_000;

/** Static in-memory celebration videos stored in /public/videos/ */
const BASE = import.meta.env.BASE_URL;
const CELEBRATION_VIDEOS: string[] = [
  `${BASE}videos/celebration1.mp4`,
  `${BASE}videos/celebration2.mp4`,
  `${BASE}videos/celebration3.mp4`,
  `${BASE}videos/celebration4.mp4`,
  `${BASE}videos/celebration5.mp4`,
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

interface JourneyEntry {
  timestamp: string;
  action: "add" | "lose";
  points: number;
  totalAfter: number;
}

interface JourneyData {
  totalScore: number;
  lastCelebratedMilestone: number;
  log: JourneyEntry[];
}

function loadState(): JourneyData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as JourneyData;
  } catch {
    // fallback to defaults below
  }
  return { totalScore: 0, lastCelebratedMilestone: 0, log: [] };
}

function saveState(): void {
  const data: JourneyData = {
    totalScore: currentPoints,
    lastCelebratedMilestone,
    log: journeyLog,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** Trigger a download of the current journey.json so users can commit it back. */
function exportJourney(): void {
  const data: JourneyData = {
    totalScore: currentPoints,
    lastCelebratedMilestone,
    log: journeyLog,
  };
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

async function initState(): Promise<void> {
  // 1. Try localStorage first (most recent session)
  const local = loadState();
  // 2. If localStorage is empty, seed from the repo's journey.json
  if (local.totalScore === 0 && local.log.length === 0) {
    try {
      const res = await fetch(DATA_PATH);
      if (res.ok) {
        const seed = (await res.json()) as JourneyData;
        currentPoints = seed.totalScore ?? 0;
        lastCelebratedMilestone = seed.lastCelebratedMilestone ?? 0;
        journeyLog = seed.log ?? [];
        return;
      }
    } catch {
      // network unavailable — stay at defaults
    }
  }
  currentPoints = local.totalScore;
  lastCelebratedMilestone = local.lastCelebratedMilestone;
  journeyLog = local.log;
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
const celebrationPanel = document.getElementById("celebration-panel") as HTMLElement;
const celebrationMessage = document.getElementById("celebration-message") as HTMLElement;
const videoWrapper = document.getElementById("video-wrapper") as HTMLElement;
const celebrationVideo = document.getElementById("celebration-video") as HTMLVideoElement;
const celebrationVideoSrc = document.getElementById("celebration-video-src") as HTMLSourceElement;
const celebrationVideoSrcMp4 = document.getElementById("celebration-video-src-mp4") as HTMLSourceElement;
const confettiCanvas = document.getElementById("confetti-canvas") as HTMLCanvasElement;

// ─── Init UI ──────────────────────────────────────────────────────────────────
function init(): void {
  maxLabel.textContent = MAX_POINTS.toLocaleString();
  buildMilestoneMarkers();
}

function buildMilestoneMarkers(): void {
  milestoneMarkers.innerHTML = "";
  milestoneTicks.innerHTML = "";
  const totalMilestones = MAX_POINTS / MILESTONE_INTERVAL;

  for (let i = 1; i <= totalMilestones; i++) {
    const pct = (i / totalMilestones) * 100;

    // Tick label row above the bar
    const tick = document.createElement("div");
    tick.className = "text-xs text-purple-300 opacity-60 select-none";
    tick.textContent = `${(i * MILESTONE_INTERVAL).toLocaleString()}`;
    tick.style.width = `${100 / totalMilestones}%`;
    tick.style.textAlign = "center";
    milestoneTicks.appendChild(tick);

    // Vertical line marker on the bar
    const marker = document.createElement("div");
    marker.id = `milestone-marker-${i}`;
    marker.className =
      "absolute top-0 bottom-0 w-0.5 bg-white/30 transition-colors duration-500";
    marker.style.left = `${pct}%`;
    marker.setAttribute("aria-label", `Milestone ${i * MILESTONE_INTERVAL}`);
    milestoneMarkers.appendChild(marker);
  }
}

// ─── Update display ───────────────────────────────────────────────────────────
function updateDisplay(): void {
  scoreDisplay.textContent = currentPoints.toLocaleString();

  // Progress fill
  const pct = Math.min((currentPoints / MAX_POINTS) * 100, 100);
  progressFill.style.width = `${pct}%`;

  // Next milestone label
  const nextMilestone =
    Math.ceil((currentPoints + 1) / MILESTONE_INTERVAL) * MILESTONE_INTERVAL;
  if (currentPoints >= MAX_POINTS) {
    milestoneLabel.textContent = "🏆 Max love reached!";
  } else {
    const remaining = nextMilestone - currentPoints;
    milestoneLabel.textContent = `Next milestone: ${nextMilestone.toLocaleString()} pts (${remaining.toLocaleString()} to go)`;
  }

  // Score bump animation
  scoreDisplay.classList.remove("score-bump");
  void scoreDisplay.offsetWidth; // reflow to restart animation
  scoreDisplay.classList.add("score-bump");

  // Update milestone markers colour
  const totalMilestones = MAX_POINTS / MILESTONE_INTERVAL;
  for (let i = 1; i <= totalMilestones; i++) {
    const marker = document.getElementById(`milestone-marker-${i}`);
    if (!marker) continue;
    if (currentPoints >= i * MILESTONE_INTERVAL) {
      marker.classList.replace("bg-white/30", "bg-yellow-400");
    } else {
      if (marker.classList.contains("bg-yellow-400")) {
        marker.classList.replace("bg-yellow-400", "bg-white/30");
      }
    }
  }
}

// ─── Milestone reached ────────────────────────────────────────────────────────
function checkMilestones(): void {
  const reachedMilestone =
    Math.floor(currentPoints / MILESTONE_INTERVAL) * MILESTONE_INTERVAL;

  if (reachedMilestone > 0 && reachedMilestone > lastCelebratedMilestone) {
    lastCelebratedMilestone = reachedMilestone;
    celebrate(reachedMilestone);
    addMilestoneChip(reachedMilestone);
  }
}

function addMilestoneChip(milestone: number): void {
  const chip = document.createElement("span");
  chip.className =
    "px-3 py-1 rounded-full text-xs font-bold bg-yellow-400/20 border border-yellow-400/50 text-yellow-300";
  chip.textContent = `🏅 ${milestone.toLocaleString()} pts`;
  milestoneChips.appendChild(chip);
}

// ─── Celebration ──────────────────────────────────────────────────────────────
function celebrate(milestone: number): void {
  // Pick random message
  const msg =
    CELEBRATION_MESSAGES[Math.floor(Math.random() * CELEBRATION_MESSAGES.length)];
  celebrationMessage.textContent = `${msg} — ${milestone.toLocaleString()} points reached!`;

  // Pick random video
  const videoSrc =
    CELEBRATION_VIDEOS[Math.floor(Math.random() * 100) % CELEBRATION_VIDEOS.length];
  celebrationVideoSrc.src = videoSrc;
  celebrationVideoSrcMp4.src = videoSrc;
  celebrationVideo.load();
  celebrationVideo.play().catch(() => {
    // Autoplay may be blocked by browser — user can hit play
  });

  // Show video
  videoWrapper.classList.remove("hidden");

  // Glow effect on panel
  celebrationPanel.classList.add("celebration-active");
  setTimeout(() => celebrationPanel.classList.remove("celebration-active"), 5_000);

  // Confetti
  launchConfetti();
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

  const colors = ["#f472b6", "#a78bfa", "#60a5fa", "#fbbf24", "#34d399", "#f87171"];
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
      requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      confettiCanvas.classList.add("hidden");
    }
  }
  requestAnimationFrame(draw);
}

// ─── Action log ───────────────────────────────────────────────────────────────
function logAction(text: string, positive: boolean, pts: number): void {
  // DOM log
  const li = document.createElement("li");
  li.className = `flex items-center gap-1 ${positive ? "text-green-300" : "text-red-300"}`;
  li.innerHTML = `<span>${positive ? "➕" : "➖"}</span><span>${text}</span>`;
  actionLog.prepend(li);
  // Keep only last 20 DOM entries
  while (actionLog.children.length > 20) {
    actionLog.removeChild(actionLog.lastChild!);
  }

  // Persistent log entry
  journeyLog.push({
    timestamp: new Date().toISOString(),
    action: positive ? "add" : "lose",
    points: pts,
    totalAfter: currentPoints,
  });
  saveState();
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
  updateDisplay();
  checkMilestones();
});

btnLose.addEventListener("click", () => {
  const pts = getInputValue();
  if (pts === null) return;
  currentPoints = Math.max(currentPoints - pts, 0);
  logAction(`-${pts.toLocaleString()} pts lost`, false, pts);
  pointsInput.value = "";
  updateDisplay();
});

pointsInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnAdd.click();
});

// ─── Export button ────────────────────────────────────────────────────────────
const btnExport = document.getElementById("btn-export");
if (btnExport) btnExport.addEventListener("click", exportJourney);

// ─── Boot ─────────────────────────────────────────────────────────────────────
(async () => {
  await initState();
  init();
  updateDisplay();

  // Replay log entries into DOM (latest 20)
  const recent = journeyLog.slice(-20).reverse();
  for (const entry of recent) {
    const positive = entry.action === "add";
    const li = document.createElement("li");
    li.className = `flex items-center gap-1 ${positive ? "text-green-300" : "text-red-300"}`;
    const sign = positive ? "➕" : "➖";
    const pts = entry.points.toLocaleString();
    li.innerHTML = `<span>${sign}</span><span>${positive ? "+" : "-"}${pts} pts — ${entry.timestamp.slice(0, 10)}</span>`;
    actionLog.appendChild(li);
  }

  // Restore milestone chips
  const totalMilestones = MAX_POINTS / MILESTONE_INTERVAL;
  for (let i = 1; i <= totalMilestones; i++) {
    if (currentPoints >= i * MILESTONE_INTERVAL) {
      addMilestoneChip(i * MILESTONE_INTERVAL);
    }
  }
})();
