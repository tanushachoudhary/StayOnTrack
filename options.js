const focusEl = document.getElementById('focusMinutes');
const breakEl = document.getElementById('breakMinutes');
const listEl = document.getElementById('list');
const domainInput = document.getElementById('domainInput');

document.getElementById('saveTimer').onclick = async () => {
  const focusMinutes = parseInt(focusEl.value, 10) || 25;
  const breakMinutes = parseInt(breakEl.value, 10) || 5;
  await send('settings:set', { settings: { focusMinutes, breakMinutes } });
  alert('Timer settings saved.');
};

document.getElementById('addDomain').onclick = () => {
  const d = (domainInput.value || '').trim().toLowerCase();
  if (!d) return;
  addItem(d);
  domainInput.value = '';
};

document.getElementById('saveBlocklist').onclick = async () => {
  const domains = [...listEl.querySelectorAll('.domain')].map(el => el.textContent);
  await send('blocklist:set', { blocklist: domains });
  alert('Blocklist saved.');
};

function addItem(domain) {
  if (!/^[a-z0-9.-]+$/.test(domain)) {
    alert('Enter a valid domain like "instagram.com"');
    return;
  }
  if ([...listEl.querySelectorAll('.domain')].some(el => el.textContent === domain)) return;

  const li = document.createElement('li');
  li.className = 'item';
  li.innerHTML = `<span class="domain">${domain}</span>
    <button title="Remove">Remove</button>`;
  li.querySelector('button').onclick = () => li.remove();
  listEl.appendChild(li);
}

async function load() {
  const settings = await send('settings:get');
  focusEl.value = settings.focusMinutes ?? 25;
  breakEl.value = settings.breakMinutes ?? 5;

  const blocklist = await send('blocklist:get');
  listEl.innerHTML = '';
  (blocklist || []).forEach(addItem);
}
load();

function send(type, payload = {}) {
  return new Promise(res => chrome.runtime.sendMessage({ type, ...payload }, res));
}
