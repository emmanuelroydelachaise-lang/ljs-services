(() => {
  function moveArchivesToBottom() {
    const root = document.getElementById('app');
    const card = document.getElementById('adminArchivesCard');
    if (!root || !card) return false;
    if (card.parentElement !== root || root.lastElementChild !== card) root.appendChild(card);
    return true;
  }

  async function goToArchives() {
    let card = document.getElementById('adminArchivesCard');
    if (!card && typeof window.renderAdminArchives === 'function') {
      try { await window.renderAdminArchives(); } catch (_) {}
      card = document.getElementById('adminArchivesCard');
    }
    if (!card) {
      alert('Les archives ne sont pas encore disponibles. Réessaie dans un instant.');
      return;
    }
    moveArchivesToBottom();
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    card.classList.add('archive-target-highlight');
    setTimeout(() => card.classList.remove('archive-target-highlight'), 1400);
  }

  function ensureArchiveDashboardButton() {
    if (document.getElementById('dashboardArchivesBtn')) return true;
    const exportBtn = document.getElementById('exportGroupedPdfBtn');
    const head = exportBtn?.closest('.admin-dashboard-head');
    if (!exportBtn || !head) return false;

    const btn = document.createElement('button');
    btn.id = 'dashboardArchivesBtn';
    btn.type = 'button';
    btn.className = 'secondary dashboard-export-pdf';
    btn.textContent = 'Archives ↓';
    btn.title = 'Aller directement aux archives';
    btn.onclick = goToArchives;
    head.insertBefore(btn, exportBtn);
    return true;
  }

  function ensureStyle() {
    if (document.getElementById('archiveNavigationStyle')) return;
    const style = document.createElement('style');
    style.id = 'archiveNavigationStyle';
    style.textContent = `
      #adminArchivesCard{scroll-margin-top:82px}
      #adminArchivesCard.archive-target-highlight{outline:3px solid #8dc9ee;outline-offset:3px;transition:outline-color .3s ease}
      @media(max-width:480px){#dashboardArchivesBtn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function installRefreshWrapper() {
    const current = window.refreshAdmin;
    if (typeof current !== 'function' || current.__ljsArchiveNavigationWrapped) return;
    const wrapped = async function(...args) {
      const result = await current.apply(this, args);
      moveArchivesToBottom();
      ensureArchiveDashboardButton();
      return result;
    };
    wrapped.__ljsArchiveNavigationWrapped = true;
    window.refreshAdmin = wrapped;
  }

  ensureStyle();
  let attempts = 0;
  const timer = setInterval(() => {
    installRefreshWrapper();
    const moved = moveArchivesToBottom();
    const button = ensureArchiveDashboardButton();
    attempts += 1;
    if ((moved && button && attempts > 5) || attempts > 80) clearInterval(timer);
  }, 120);
})();
