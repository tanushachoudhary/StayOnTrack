// Content script for Pomodoro Timer Extension
// This script runs on blocked sites to show a custom message

(function () {
  "use strict";

  // Check if we're on a blocked site during focus time
  chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
    if (response && response.state.isBlocking) {
      const currentSite = window.location.hostname.replace("www.", "");

      if (
        response.settings.blockedSites.some((site) =>
          currentSite.includes(site)
        )
      ) {
        showBlockedMessage();
      }
    }
  });

  function showBlockedMessage() {
    // Create overlay
    const overlay = document.createElement("div");
    overlay.id = "pomodoro-block-overlay";
    overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            z-index: 999999;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: white;
        `;

    // Create content container
    const content = document.createElement("div");
    content.style.cssText = `
            text-align: center;
            padding: 40px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            backdrop-filter: blur(10px);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            margin: 20px;
        `;

    // Create tomato emoji
    const tomatoIcon = document.createElement("div");
    tomatoIcon.textContent = "🍅";
    tomatoIcon.style.cssText = `
            font-size: 4em;
            margin-bottom: 20px;
            animation: pulse 2s infinite;
        `;

    // Add CSS animation
    const style = document.createElement("style");
    style.textContent = `
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); }
            }
        `;
    document.head.appendChild(style);

    // Create title
    const title = document.createElement("h1");
    title.textContent = "Focus Time! 🎯";
    title.style.cssText = `
            font-size: 2.5em;
            margin: 0 0 20px 0;
            font-weight: bold;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        `;

    // Create message
    const message = document.createElement("p");
    message.textContent =
      "This site is blocked during your Pomodoro focus session. Stay focused and get back to work!";
    message.style.cssText = `
            font-size: 1.2em;
            line-height: 1.6;
            margin: 0 0 30px 0;
            opacity: 0.9;
        `;

    // Create motivational quote
    const quotes = [
      "Success is the sum of small efforts repeated day in and day out.",
      "The way to get started is to quit talking and begin doing.",
      "Don't watch the clock; do what it does. Keep going.",
      "Focus on being productive instead of busy.",
      "Time is what we want most, but what we use worst.",
    ];

    const quote = document.createElement("p");
    quote.textContent = `"${
      quotes[Math.floor(Math.random() * quotes.length)]
    }"`;
    quote.style.cssText = `
            font-style: italic;
            font-size: 1em;
            margin: 20px 0;
            opacity: 0.8;
            border-left: 3px solid rgba(255, 255, 255, 0.5);
            padding-left: 20px;
        `;

    // Create timer display (if we can get it)
    const timerDisplay = document.createElement("div");
    timerDisplay.id = "blocked-timer";
    timerDisplay.style.cssText = `
            font-size: 2em;
            font-family: 'Courier New', monospace;
            margin: 20px 0;
            font-weight: bold;
            background: rgba(255, 255, 255, 0.1);
            padding: 15px;
            border-radius: 10px;
        `;

    // Create close button (for emergency access)
    const closeButton = document.createElement("button");
    closeButton.textContent = "Emergency Access (Use Sparingly)";
    closeButton.style.cssText = `
            background: rgba(255, 255, 255, 0.2);
            border: 2px solid rgba(255, 255, 255, 0.3);
            color: white;
            padding: 12px 24px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 1em;
            margin-top: 20px;
            transition: all 0.3s ease;
        `;

    closeButton.addEventListener("click", () => {
      overlay.remove();
      // Store emergency access to prevent abuse
      sessionStorage.setItem("pomodoroEmergencyAccess", Date.now().toString());
    });

    closeButton.addEventListener("mouseenter", () => {
      closeButton.style.background = "rgba(255, 255, 255, 0.3)";
      closeButton.style.transform = "translateY(-2px)";
    });

    closeButton.addEventListener("mouseleave", () => {
      closeButton.style.background = "rgba(255, 255, 255, 0.2)";
      closeButton.style.transform = "translateY(0)";
    });

    // Check if emergency access was recently used (within last 5 minutes)
    const lastAccess = sessionStorage.getItem("pomodoroEmergencyAccess");
    if (lastAccess && Date.now() - parseInt(lastAccess) < 300000) {
      return; // Don't show overlay if emergency access was recent
    }

    // Assemble the overlay
    content.appendChild(tomatoIcon);
    content.appendChild(title);
    content.appendChild(message);
    content.appendChild(quote);
    content.appendChild(timerDisplay);
    content.appendChild(closeButton);
    overlay.appendChild(content);

    // Add to page
    document.body.appendChild(overlay);

    // Update timer display
    updateTimerDisplay();
  }

  function updateTimerDisplay() {
    const timerElement = document.getElementById("blocked-timer");
    if (!timerElement) return;

    chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
      if (response && response.state.isRunning) {
        const minutes = Math.floor(response.state.timeRemaining / 60);
        const seconds = response.state.timeRemaining % 60;
        timerElement.textContent = `${minutes
          .toString()
          .padStart(2, "0")}:${seconds.toString().padStart(2, "0")} remaining`;

        // Update every second
        setTimeout(updateTimerDisplay, 1000);
      } else {
        timerElement.textContent = "Focus session ended!";
      }
    });
  }
})();
