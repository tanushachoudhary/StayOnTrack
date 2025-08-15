# StayOnTrack

**StayOnTrack** is a productivity-focused browser extension that helps you stay focused by blocking distracting websites and showing a friendly reminder page instead.  
Designed for both **Chrome** (Manifest V3) and **Firefox** (Manifest V2) for maximum compatibility.
<img width="1893" height="852" alt="Screenshot 2025-08-15 150153" src="https://github.com/user-attachments/assets/1efdfb63-f354-4c45-8816-1ced914a2c5c" />

<img width="1895" height="652" alt="Screenshot 2025-08-15 150525" src="https://github.com/user-attachments/assets/9cc3132d-b2bf-4148-af0e-0bd85d4db16b" />

<img width="1918" height="827" alt="Screenshot 2025-08-15 152137" src="https://github.com/user-attachments/assets/f32cb739-3061-44d1-acca-08e399c57cc5" />


## 📌 Features

- Block specific websites or patterns you define.
- Display a custom `blocked.html` page with helpful reminders or motivational quotes.
- Lightweight and easy to customize.
- Works across multiple browsers.
- Simple to install and configure.

---

## 📂 Folder Structure

```

.
├── manifest\_chrome.json      # Chrome MV3 manifest
├── manifest\_firefox.json     # Firefox MV2 manifest
├── background.js             # Background script for Firefox
├── service\_worker.js         # Service Worker for Chrome
├── blocked.html              # Page shown when a site is blocked
├── blocked.js                # JavaScript for blocked.html
├── icons/                    # Extension icons (16, 48, 128px)
└── README.md                 # Documentation

```

---

## 🛠 Installation

### **Chrome**

1. Rename `manifest_chrome.json` → `manifest.json`.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the extension folder.

---

### **Firefox**

1. Rename `manifest_firefox.json` → `manifest.json`.
2. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on**.
4. Select the extension folder.
5. The extension will work until you restart Firefox (use AMO signing for permanent installation).

---

## ⚙ Customization

- To **add or remove blocked sites**, edit the list inside:
  - `background.js` (Firefox)
  - `service_worker.js` (Chrome)
- To **change the blocked page message**, edit:
  - `blocked.html` & `blocked.js`.

---

## 📜 License

This project is licensed under the MIT License — feel free to modify and share.

---

## 💡 Motivation

StayOnTrack was built to help you **focus on what matters most**. Whether you’re studying, working, or just want a cleaner browsing experience, StayOnTrack ensures you avoid distractions and keep your productivity high.
