let currentState = "idle";
let timeLeft = 25 * 60; // 25 minutes in seconds
let totalTime = 25 * 60;
let pomodoros = parseInt(localStorage.getItem("pomodoros") || "0");
let timer = null;

const phaseEl = document.getElementById("phase");
const timeEl = document.getElementById("time");
const controlsEl = document.getElementById("controls");
const pomosEl = document.getElementById("pomos");
const progressCircle = document.querySelector(".progress-ring .progress");

// Update display
function updateDisplay() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  timeEl.textContent = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;

  // Update progress ring
  const progress = ((totalTime - timeLeft) / totalTime) * 691.15;
  progressCircle.style.strokeDashoffset = 691.15 - progress;

  pomosEl.textContent = pomodoros;

  // Update classes
  phaseEl.className = `phase ${currentState}`;
  timeEl.className = `time ${currentState}`;
  controlsEl.className = `controls ${currentState}`;

  if (currentState === "running") {
    timeEl.classList.add("running");
  }
}

function setState(newState, duration = null) {
  currentState = newState;
  if (duration) {
    timeLeft = duration * 60;
    totalTime = duration * 60;
  }

  phaseEl.textContent =
    newState === "idle"
      ? "Ready to Focus"
      : newState === "focus"
      ? "Focus Time"
      : newState === "break"
      ? "Break Time"
      : newState === "paused"
      ? "Paused"
      : "Running";

  updateDisplay();
}

function startTimer() {
  if (timer) clearInterval(timer);

  timer = setInterval(() => {
    timeLeft--;
    updateDisplay();

    if (timeLeft <= 0) {
      clearInterval(timer);
      if (currentState === "focus") {
        pomodoros++;
        localStorage.setItem("pomodoros", pomodoros.toString());
        setState("idle", 5); // Break time
      } else {
        setState("idle", 25); // Back to focus
      }
    }
  }, 1000);
}

// Event listeners
document.getElementById("startFocus").addEventListener("click", () => {
  setState("focus", 25);
  currentState = "running";
  startTimer();
  updateDisplay();
});

document.getElementById("startBreak").addEventListener("click", () => {
  setState("break", 5);
  currentState = "running";
  startTimer();
  updateDisplay();
});

document.getElementById("pause").addEventListener("click", () => {
  clearInterval(timer);
  setState("paused");
});

document.getElementById("resume").addEventListener("click", () => {
  currentState = "running";
  startTimer();
  updateDisplay();
});

document.getElementById("reset").addEventListener("click", () => {
  clearInterval(timer);
  setState("idle", 25);
});

document.getElementById("openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

// Initialize
setState("idle", 25);
