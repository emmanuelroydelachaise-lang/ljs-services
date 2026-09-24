(() => {
  const POLL_MS = 30000;
  let pollTimer = null;
  let busy = false;
  let initializedFor = null;
  let activeTechId = null;

  function installStyle() {
    if (document.getElementById('timesheetNotificationStyle')) return;
    const style = document.createElement('style');
    style.id = 'timesheetNotificationStyle';
    style.textContent = `
      #techArchivesTab{position:relative}
      .timesheet-notification-badge{display:inline-flex;align-items:center;justify-content:center;min-width:21px;height:21px;padding:0 6px;margin-left:7px;border-radius:999px;background:#d92d20;color:#fff;font-size:.72rem;font-weight:900;line-height:1;vertical-align:middle;box-shadow:0 0 0 2px #fff}
      .timesheet-notification-badge.pulse{animation:ljs-notif-pulse 1.5s ease-in-out 2}
      @keyframes ljs-notif-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}
    `;
    document.head.appendChild(style);
  }

  function technicianId() {
    return currentProfile?.role === 'technician' ? currentProfile.id : null;
  }

  function storageKey(id) {
    return `ljs_seen_approved_timesheets_v1_${id}`;
  }

  function readSeen(id) {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey(id)) || '[]');
      return new Set(Array.isArray(raw) ? raw : []);
    } catch (_) {
      return new Set();
    }
  }

  function writeSeen(id, ids) {
    localStorage.setItem(storageKey(id), JSON.stringify([...new Set(ids)]));
  }

  async function approvedSheets() {
    const id = technicianId();
    if (!id) return [];
    if (!isCloud) {
      return (demoDb().sheets || [])
        .filter(sheet => sheet.technician_id === id && sheet.status === 'approved')
        .map(sheet => ({ id:sheet.id, week_start:sheet.week_start, approved_at:sheet.approved_at || '' }));
    }
    const { data, error } = await sb
      .from('ljs_timesheets')
      .select('id,week_start,approved_at,status')
      .eq('technician_id', id)
      .eq('status', 'approved')
      .order('approved_at', { ascending:false, nullsFirst:false });
    if (error) throw error;
    return data || [];
  }

  function ensureBadge(count, pulse=false) {
    const tab = document.getElementById('techArchivesTab');
    if (!tab) return;
    let badge = tab.querySelector('.timesheet-notification-badge');
    if (!count) {
      badge?.remove();
      tab.title = '';
      return;
    }
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'timesheet-notification-badge';
      tab.appendChild(badge);
    }
    badge.textContent = String(count);
    badge.setAttribute('aria-label', `${count} nouvelle${count > 1 ? 's' : ''} feuille${count > 1 ? 's' : ''} validée${count > 1 ? 's' : ''}`);
    tab.title = `${count} nouvelle${count > 1 ? 's' : ''} feuille${count > 1 ? 's' : ''} validée${count > 1 ? 's' : ''} par le responsable`;
    if (pulse) {
      badge.classList.remove('pulse');
      void badge.offsetWidth;
      badge.classList.add('pulse');
    }
  }

  async function refreshNotifications({ initialize=false, pulse=false }={}) {
    const id = technicianId();
    if (!id || busy || !document.getElementById('techArchivesTab')) return;
    busy = true;
    try {
      const sheets = await approvedSheets();
      const ids = sheets.map(sheet => sheet.id).filter(Boolean);
      const keyExists = localStorage.getItem(storageKey(id)) !== null;

      if ((initialize || initializedFor !== id) && !keyExists) {
        writeSeen(id, ids);
        initializedFor = id;
        ensureBadge(0);
        return;
      }

      initializedFor = id;
      const seen = readSeen(id);
      const unseen = ids.filter(sheetId => !seen.has(sheetId));
      ensureBadge(unseen.length, pulse && unseen.length > 0);
    } catch (error) {
      console.warn('Notification feuille validée indisponible :', error);
    } finally {
      busy = false;
    }
  }

  async function markApprovedSheetsSeen() {
    const id = technicianId();
    if (!id) return;
    try {
      const sheets = await approvedSheets();
      writeSeen(id, sheets.map(sheet => sheet.id).filter(Boolean));
      ensureBadge(0);
    } catch (error) {
      console.warn('Impossible de marquer les feuilles validées comme lues :', error);
    }
  }

  function installArchiveClickHandler() {
    const tab = document.getElementById('techArchivesTab');
    if (!tab || tab.dataset.validationNotificationBound === '1') return;
    tab.dataset.validationNotificationBound = '1';
    tab.addEventListener('click', () => {
      setTimeout(markApprovedSheetsSeen, 150);
    });
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') refreshNotifications({ pulse:true });
    }, POLL_MS);
  }

  function installForTechnician() {
    const id = technicianId();
    if (!id || !document.getElementById('techArchivesTab')) return false;
    installArchiveClickHandler();

    if (activeTechId !== id) {
      activeTechId = id;
      refreshNotifications({ initialize:true });
      startPolling();
    } else {
      refreshNotifications();
      if (!pollTimer) startPolling();
    }
    return true;
  }

  installStyle();
  const observer = new MutationObserver(() => installForTechnician());
  const app = document.getElementById('app');
  if (app) observer.observe(app, { childList:true, subtree:true });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      installForTechnician();
      refreshNotifications({ pulse:true });
    }
  });

  setTimeout(installForTechnician, 0);
  setTimeout(installForTechnician, 500);

  window.refreshTimesheetNotifications = refreshNotifications;
})();
