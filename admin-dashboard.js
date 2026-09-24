(() => {
  let dashboardRenderToken = 0;
  let dashboardBusy = false;

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  function weekLabel(weekStart) {
    try {
      const start = new Date(weekStart + 'T12:00:00');
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const sameMonth = start.getMonth() === end.getMonth();
      const sameYear = start.getFullYear() === end.getFullYear();
      const startText = start.toLocaleDateString('fr-FR', sameMonth && sameYear ? {day:'numeric'} : {day:'numeric',month:'long',year:sameYear?undefined:'numeric'});
      const endText = end.toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric'});
      return `Semaine du ${startText} au ${endText}`;
    } catch (_) {
      return 'Semaine sélectionnée';
    }
  }

  function ensureDashboard() {
    let card = document.getElementById('adminDashboardCard');
    if (card) return card;
    const listCard = document.getElementById('adminListCard');
    if (!listCard) return null;

    card = document.createElement('section');
    card.id = 'adminDashboardCard';
    card.className = 'card admin-dashboard-card';
    card.innerHTML = `
      <div class="admin-dashboard-head">
        <div>
          <h2>Tableau de bord</h2>
          <p id="dashboardWeekLabel" class="hint"></p>
        </div>
        <button id="exportGroupedPdfBtn" class="secondary dashboard-export-pdf" type="button">Export PDF groupé</button>
      </div>
      <div id="adminDashboardGrid" class="admin-dashboard-grid"></div>
      <div id="adminDashboardDetails" class="dashboard-details hidden"></div>`;
    listCard.insertAdjacentElement('beforebegin', card);
    card.querySelector('#exportGroupedPdfBtn').onclick = exportApprovedWeekPdf;
    return card;
  }

  function activeTechnicians() {
    return (state.technicians || [])
      .filter(t => t.active !== false && !t.deleted)
      .sort((a,b) => String(a.full_name||'').localeCompare(String(b.full_name||''), 'fr'));
  }

  async function getWeekSheets(weekStart) {
    if (!isCloud) {
      return (demoDb().sheets || []).filter(s => s.week_start === weekStart);
    }
    const { data, error } = await sb.from('ljs_timesheets')
      .select('id,technician_id,status,week_start')
      .eq('week_start', weekStart);
    if (error) throw error;
    return data || [];
  }

  function showDetails(kind, title, names) {
    const box = document.getElementById('adminDashboardDetails');
    if (!box) return;
    if (box.dataset.kind === kind && !box.classList.contains('hidden')) {
      box.classList.add('hidden');
      box.dataset.kind = '';
      return;
    }
    box.dataset.kind = kind;
    box.innerHTML = `
      <div class="dashboard-details-head"><strong>${esc(title)}</strong><span class="small muted">${names.length} technicien${names.length>1?'s':''}</span></div>
      ${names.length ? `<div class="dashboard-name-list">${names.map(name=>`<span class="dashboard-name">${esc(name)}</span>`).join('')}</div>` : '<p class="dashboard-empty">Aucun technicien dans cette catégorie.</p>'}`;
    box.classList.remove('hidden');
  }

  async function waitForImages(root) {
    const images = [...root.querySelectorAll('img')];
    await Promise.all(images.map(img => new Promise(resolve => {
      const finish = async () => {
        try { if (img.decode) await img.decode(); } catch (_) {}
        resolve();
      };
      if (img.complete) { finish(); return; }
      img.addEventListener('load', finish, { once:true });
      img.addEventListener('error', finish, { once:true });
    })));
  }

  async function exportApprovedWeekPdf() {
    if (dashboardBusy) return;
    const weekInput = document.getElementById('adminWeekInput');
    const btn = document.getElementById('exportGroupedPdfBtn');
    const area = document.getElementById('printArea');
    if (!weekInput || !area || typeof printTimesheet !== 'function' || typeof loadAdminSheet !== 'function') return;

    const weekStart = mondayOfWeekValue(weekInput.value || currentWeekValue());
    dashboardBusy = true;
    const oldText = btn?.textContent || 'Export PDF groupé';
    if (btn) { btn.disabled = true; btn.textContent = 'Préparation du PDF…'; }

    const realPrint = window.print;
    let cleaned = false;
    let cleanupTimer = null;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (cleanupTimer) clearTimeout(cleanupTimer);
      window.print = realPrint;
      area.classList.remove('grouped-print-mode');
      dashboardBusy = false;
      if (btn) { btn.disabled = false; btn.textContent = oldText; }
    };

    try {
      const summaries = (await getWeekSheets(weekStart)).filter(s => s.status === 'approved');
      if (!summaries.length) {
        alert('Aucune feuille validée par le responsable pour cette semaine.');
        cleanup();
        return;
      }

      await loadReferenceData(true);

      // Empêche les impressions individuelles programmées par printTimesheet pendant la construction.
      window.print = () => {};
      const pages = [];
      const fullSheets = [];

      for (const summary of summaries) {
        const tech = (state.technicians || []).find(t => t.id === summary.technician_id);
        const full = await loadAdminSheet(summary.id, tech?.full_name || '');
        fullSheets.push(full);
      }

      fullSheets.sort((a,b) => String(a.technician_name||'').localeCompare(String(b.technician_name||''), 'fr'));

      for (const sheet of fullSheets) {
        printTimesheet(sheet, sheet.technician_name || 'Technicien');
        await wait(40);
        const page = area.querySelector('.exact-print-sheet');
        if (!page) throw new Error('Impossible de préparer une des feuilles.');
        pages.push(page.outerHTML);
      }

      // Laisse finir les appels d'impression individuels, toujours neutralisés.
      await wait(650);
      area.innerHTML = pages.join('');
      area.classList.add('grouped-print-mode');

      await waitForImages(area);
      try { if (document.fonts?.ready) await document.fonts.ready; } catch (_) {}
      await wait(350);

      const afterPrint = () => cleanup();
      window.addEventListener('afterprint', afterPrint, { once:true });
      cleanupTimer = setTimeout(cleanup, 30000);

      // Appelle directement le mécanisme d'impression fiable enregistré avant la neutralisation.
      realPrint();
    } catch (error) {
      console.error(error);
      cleanup();
      alert('Impossible de préparer le PDF groupé : ' + (error.message || error));
    }
  }

  async function renderAdminDashboard() {
    const card = ensureDashboard();
    const weekInput = document.getElementById('adminWeekInput');
    const grid = document.getElementById('adminDashboardGrid');
    if (!card || !weekInput || !grid) return;

    const token = ++dashboardRenderToken;
    const weekStart = mondayOfWeekValue(weekInput.value || currentWeekValue());
    const weekLabelEl = document.getElementById('dashboardWeekLabel');
    if (weekLabelEl) weekLabelEl.textContent = weekLabel(weekStart);
    grid.innerHTML = '<p class="hint">Mise à jour du tableau de bord…</p>';

    try {
      const techs = activeTechnicians();
      const sheets = await getWeekSheets(weekStart);
      if (token !== dashboardRenderToken) return;

      const byTech = new Map();
      sheets.forEach(s => {
        if (!s.technician_id) return;
        const existing = byTech.get(s.technician_id);
        if (!existing || existing.status !== 'approved') byTech.set(s.technician_id, s);
      });

      const received = techs.filter(t => ['submitted','approved'].includes(byTech.get(t.id)?.status));
      const pending = techs.filter(t => byTech.get(t.id)?.status === 'submitted');
      const approved = techs.filter(t => byTech.get(t.id)?.status === 'approved');
      const missing = techs.filter(t => !['submitted','approved'].includes(byTech.get(t.id)?.status));

      const stats = [
        {kind:'active', label:'Techniciens actifs', value:techs.length, people:techs, title:'Techniciens actifs'},
        {kind:'received', label:'Feuilles reçues', value:received.length, people:received, title:'Feuilles reçues'},
        {kind:'pending', label:'À valider', value:pending.length, people:pending, title:'Feuilles à valider'},
        {kind:'approved', label:'Validées', value:approved.length, people:approved, title:'Feuilles validées'},
        {kind:'missing', label:'Manquantes', value:missing.length, people:missing, title:'Feuilles non remises'}
      ];

      grid.innerHTML = '';
      stats.forEach(stat => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dashboard-stat';
        btn.dataset.kind = stat.kind;
        btn.innerHTML = `<span class="dashboard-number">${stat.value}</span><span class="dashboard-label">${esc(stat.label)}</span>`;
        btn.title = `Afficher les techniciens : ${stat.label}`;
        btn.onclick = () => showDetails(stat.kind, stat.title, stat.people.map(t => t.full_name));
        grid.appendChild(btn);
      });
    } catch (error) {
      grid.innerHTML = `<p class="error">Impossible de mettre à jour le tableau de bord : ${esc(error.message || error)}</p>`;
    }
  }

  function installRefreshWrapper() {
    const current = window.refreshAdmin;
    if (typeof current !== 'function' || current.__ljsDashboardWrapped) return false;
    const wrapped = async function(...args) {
      const result = await current.apply(this, args);
      await renderAdminDashboard();
      return result;
    };
    wrapped.__ljsDashboardWrapped = true;
    window.refreshAdmin = wrapped;
    return true;
  }

  let attempts = 0;
  let initialRendered = false;
  const timer = setInterval(() => {
    installRefreshWrapper();
    if (!initialRendered && document.getElementById('adminWeekInput')) {
      initialRendered = true;
      renderAdminDashboard();
    }
    attempts += 1;
    if (attempts >= 30 && window.refreshAdmin?.__ljsDashboardWrapped) clearInterval(timer);
  }, 120);

  window.renderAdminDashboard = renderAdminDashboard;
  window.exportApprovedWeekPdf = exportApprovedWeekPdf;
})();
