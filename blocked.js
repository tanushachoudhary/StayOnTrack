// blocked.js
document.addEventListener("DOMContentLoaded", () => {
  const openBtn = document.getElementById("open");
  if (openBtn) {
    openBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "open:popup" });
    });
  }
});
