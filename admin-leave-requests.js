(() => {
  const fmtDate = value => {
    if (!value) return '';
    const d = new Date(`${value}T12:00:00`);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('fr-FR');
  };
  const todayIso = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,10);
  };
  const displayName = r => [r.last_name, r.first_name].filter(Boolean).join(' ').trim() || 'Technicien';
  const statusInfo = status => status === 'approved'
    ? {label:'ACCORDÉE', cls:'leave-approved'}
    : status === 'refused'
      ? {label:'REFUSÉE', cls:'leave-refused'}
      : {label:'EN ATTENTE', cls:'leave-pending'};

  async function fetchLeaveRequests(statuses=null) {
    if (!isCloud) return [];
    let q = sb.from('ljs_leave_requests').select('*').order('created_at', {ascending:false});
    if (Array.isArray(statuses) && statuses.length === 1) q = q.eq('status', statuses[0]);
    else if (Array.isArray(statuses) && statuses.length > 1) q = q.in('status', statuses);
    const {data, error} = await q;
    if (error) throw error;
    return data || [];
  }

  function ensureResponsibleDashboardTabs() {
    const card = document.getElementById('adminDashboardCard');
    if (!card || document.getElementById('adminLeaveDashboardTab')) return Boolean(card);
    const head = card.querySelector('.admin-dashboard-head');
    const grid = document.getElementById('adminDashboardGrid');
    if (!head || !grid) return false;

    const tabs = document.createElement('div');
    tabs.className = 'admin-leave-tabs';
    tabs.innerHTML = `
      <button id="adminHoursDashboardTab" class="admin-leave-tab active" type="button">Feuilles d’heures</button>
      <button id="adminLeaveDashboardTab" class="admin-leave-tab" type="button">Demandes d’absence <span id="adminLeavePendingBadge" class="admin-leave-count hidden">0</span></button>`;
    head.insertAdjacentElement('afterend', tabs);

    const panel = document.createElement('div');
    panel.id = 'adminLeaveDashboardPanel';
    panel.className = 'hidden admin-leave-dashboard-panel';
    panel.innerHTML = `
      <div class="admin-leave-panel-head">
        <div><h3>Demandes d’absence à traiter</h3><p class="hint">Valide ou refuse les demandes reçues. La signature du responsable est enregistrée en rouge.</p></div>
        <button id="refreshAdminLeaveBtn" class="secondary" type="button">Actualiser</button>
      </div>
      <div id="adminLeavePendingList" class="stack"><p class="hint">Chargement…</p></div>`;
    card.appendChild(panel);

    document.getElementById('adminHoursDashboardTab').onclick = () => setDashboardMode('hours');
    document.getElementById('adminLeaveDashboardTab').onclick = () => setDashboardMode('leave');
    document.getElementById('refreshAdminLeaveBtn').onclick = renderPendingLeaveRequests;
    refreshPendingBadge();
    return true;
  }

  function setDashboardMode(mode) {
    const leave = mode === 'leave';
    document.getElementById('adminHoursDashboardTab')?.classList.toggle('active', !leave);
    document.getElementById('adminLeaveDashboardTab')?.classList.toggle('active', leave);
    document.getElementById('adminLeaveDashboardPanel')?.classList.toggle('hidden', !leave);
    document.getElementById('adminDashboardGrid')?.classList.toggle('hidden', leave);
    document.getElementById('adminDashboardDetails')?.classList.add('hidden');
    document.getElementById('exportGroupedPdfBtn')?.classList.toggle('hidden', leave);
    document.getElementById('adminListCard')?.classList.toggle('hidden', leave);
    document.getElementById('adminEditor')?.classList.add('hidden');
    if (leave) renderPendingLeaveRequests();
  }

  async function refreshPendingBadge() {
    const badge = document.getElementById('adminLeavePendingBadge');
    if (!badge || currentProfile?.role !== 'admin') return;
    try {
      const requests = await fetchLeaveRequests(['pending']);
      badge.textContent = String(requests.length);
      badge.classList.toggle('hidden', requests.length === 0);
    } catch (error) {
      console.error('leave badge', error);
    }
  }

  function pendingRequestHtml(request) {
    return `
      <div class="admin-leave-request-summary">
        <div>
          <strong>${esc(displayName(request))}</strong>
          <div class="meta">${request.request_type === 'conge' ? 'Congé' : 'Absence'} · du ${esc(fmtDate(request.date_from))} au ${esc(fmtDate(request.date_to))} inclus · demandée le ${esc(fmtDate(request.request_date))}</div>
        </div>
        <span class="leave-status leave-pending">EN ATTENTE</span>
      </div>
      <div class="admin-leave-signatures">
        <div><span class="admin-leave-mini-label">Signature du technicien</span>${request.employee_signature ? `<img src="${request.employee_signature}" alt="Signature technicien">` : '<span class="error">Absente</span>'}</div>
      </div>
      <div class="admin-row-actions admin-leave-actions">
        <button class="primary admin-leave-approve" type="button">Accorder</button>
        <button class="secondary admin-leave-refuse" type="button">Refuser</button>
      </div>
      <div class="admin-leave-decision-editor hidden"></div>`;
  }

  async function renderPendingLeaveRequests() {
    const box = document.getElementById('adminLeavePendingList');
    if (!box || currentProfile?.role !== 'admin') return;
    box.innerHTML = '<p class="hint">Chargement des demandes…</p>';
    try {
      const requests = await fetchLeaveRequests(['pending']);
      box.innerHTML = '';
      if (!requests.length) {
        box.innerHTML = '<p class="hint">Aucune demande d’absence en attente.</p>';
      } else {
        requests.forEach(request => {
          const item = document.createElement('div');
          item.className = 'admin-leave-request-item';
          item.innerHTML = pendingRequestHtml(request);
          item.querySelector('.admin-leave-approve').onclick = () => openDecisionEditor(item, request, 'approved');
          item.querySelector('.admin-leave-refuse').onclick = () => openDecisionEditor(item, request, 'refused');
          box.appendChild(item);
        });
      }
      await refreshPendingBadge();
    } catch (error) {
      console.error(error);
      box.innerHTML = `<p class="error">Impossible de charger les demandes : ${esc(error.message || error)}</p>`;
    }
  }

  function openDecisionEditor(item, request, decision) {
    const editor = item.querySelector('.admin-leave-decision-editor');
    if (!editor) return;
    const refused = decision === 'refused';
    editor.classList.remove('hidden');
    editor.innerHTML = `
      <div class="admin-leave-decision-title">${refused ? 'Refus de la demande' : 'Accord de la demande'}</div>
      <div class="admin-leave-decision-grid">
        <div><label>Date accord ou refus</label><input class="admin-leave-decision-date" type="date" value="${todayIso()}"></div>
        ${refused ? '<div><label>Motif du refus</label><textarea class="admin-leave-refusal-reason" rows="2" placeholder="Motif obligatoire"></textarea></div>' : '<div></div>'}
      </div>
      <div class="signature-head admin-leave-signature-head">
        <div><h3>Signature du responsable</h3><p class="hint">Signature en rouge.</p></div>
        <button class="secondary admin-leave-clear-signature" type="button">Effacer</button>
      </div>
      <canvas class="signature-pad admin-leave-responsible-canvas" width="900" height="220"></canvas>
      <div class="admin-row-actions admin-leave-decision-actions">
        <button class="primary admin-leave-save-decision" type="button">Valider la décision</button>
        <button class="ghost dark-ghost admin-leave-cancel-decision" type="button">Annuler</button>
      </div>
      <p class="admin-leave-decision-msg hint"></p>`;

    let signature = '';
    const canvas = editor.querySelector('.admin-leave-responsible-canvas');
    initSignaturePad(canvas, '', data => { signature = data; }, '#d40000');
    editor.querySelector('.admin-leave-clear-signature').onclick = () => { clearSignatureCanvas(canvas); signature = ''; };
    editor.querySelector('.admin-leave-cancel-decision').onclick = () => editor.classList.add('hidden');
    editor.querySelector('.admin-leave-save-decision').onclick = async () => {
      const date = editor.querySelector('.admin-leave-decision-date').value;
      const reason = refused ? String(editor.querySelector('.admin-leave-refusal-reason').value || '').trim() : '';
      const msg = editor.querySelector('.admin-leave-decision-msg');
      if (!date) return alert('Renseigne la date de décision.');
      if (refused && !reason) return alert('Renseigne le motif du refus.');
      if (!signature) return alert('Signe la demande avant de valider la décision.');
      if (!confirm(`${refused ? 'Refuser' : 'Accorder'} définitivement la demande de ${displayName(request)} ?`)) return;

      const btn = editor.querySelector('.admin-leave-save-decision');
      btn.disabled = true;
      msg.textContent = 'Enregistrement…';
      try {
        const {error} = await sb.from('ljs_leave_requests').update({
          status: decision,
          decision_date: date,
          refusal_reason: reason,
          responsible_signature: signature,
          responsible_name: currentProfile?.full_name || 'Responsable'
        }).eq('id', request.id);
        if (error) throw error;
        msg.textContent = refused ? 'Demande refusée et archivée.' : 'Demande accordée et archivée.';
        await renderPendingLeaveRequests();
        await renderAdminLeaveArchives();
      } catch (error) {
        console.error(error);
        msg.textContent = `Erreur : ${error.message || error}`;
        btn.disabled = false;
      }
    };
  }

  function ensureArchiveLeaveTab() {
    const card = document.getElementById('adminArchivesCard');
    const hoursBox = document.getElementById('adminArchives');
    if (!card || !hoursBox || document.getElementById('adminArchiveLeaveTab')) return Boolean(card && hoursBox);

    const title = card.querySelector('.archive-title-row h2');
    if (title) title.textContent = 'Archives';
    const hint = card.querySelector('.archive-title-row .hint');
    if (hint) hint.textContent = 'Retrouve les feuilles d’heures validées et les demandes d’absence traitées.';

    const tabs = document.createElement('div');
    tabs.className = 'admin-archive-tabs';
    tabs.innerHTML = `
      <button id="adminArchiveTimesheetsTab" class="admin-archive-tab active" type="button">Feuilles d’heures</button>
      <button id="adminArchiveLeaveTab" class="admin-archive-tab" type="button">Demandes d’absence</button>`;
    card.querySelector('.archive-title-row')?.insertAdjacentElement('afterend', tabs);

    const hoursPanel = document.createElement('div');
    hoursPanel.id = 'adminArchiveTimesheetsPanel';
    hoursBox.parentNode.insertBefore(hoursPanel, hoursBox);
    hoursPanel.appendChild(hoursBox);

    const leavePanel = document.createElement('div');
    leavePanel.id = 'adminArchiveLeavePanel';
    leavePanel.className = 'hidden';
    leavePanel.innerHTML = '<div id="adminLeaveArchiveList" class="archive-tech-list"><p class="hint">Chargement…</p></div>';
    hoursPanel.insertAdjacentElement('afterend', leavePanel);

    document.getElementById('adminArchiveTimesheetsTab').onclick = () => setArchiveMode('timesheets');
    document.getElementById('adminArchiveLeaveTab').onclick = () => setArchiveMode('leave');
    card.querySelector('#refreshArchivesBtn')?.addEventListener('click', () => {
      if (!leavePanel.classList.contains('hidden')) renderAdminLeaveArchives();
    });
    return true;
  }

  function setArchiveMode(mode) {
    const leave = mode === 'leave';
    document.getElementById('adminArchiveTimesheetsTab')?.classList.toggle('active', !leave);
    document.getElementById('adminArchiveLeaveTab')?.classList.toggle('active', leave);
    document.getElementById('adminArchiveTimesheetsPanel')?.classList.toggle('hidden', leave);
    document.getElementById('adminArchiveLeavePanel')?.classList.toggle('hidden', !leave);
    if (leave) renderAdminLeaveArchives();
  }

  async function verifyResponsiblePinForLeaveDelete() {
    const pin = prompt('Code responsable requis pour supprimer définitivement cette demande :');
    if (pin === null) return false;
    if (!/^\d{4}$/.test(pin.trim())) {
      alert('Le code responsable doit contenir 4 chiffres.');
      return false;
    }
    if (typeof window.verifyResponsiblePinEntry !== 'function') {
      alert('La vérification du code responsable n’est pas disponible. Reconnecte-toi à l’accès responsable puis réessaie.');
      return false;
    }
    const ok = await window.verifyResponsiblePinEntry(pin.trim());
    if (!ok) alert('Code responsable incorrect.');
    return ok;
  }

  async function deleteArchivedLeaveRequest(request) {
    if (!(await verifyResponsiblePinForLeaveDelete())) return;
    if (!confirm(`Supprimer définitivement la demande de ${displayName(request)} du ${fmtDate(request.date_from)} au ${fmtDate(request.date_to)} ?\n\nCette action est irréversible.`)) return;
    try {
      const {error} = await sb.from('ljs_leave_requests').delete().eq('id', request.id);
      if (error) throw error;
      await renderAdminLeaveArchives();
      await refreshPendingBadge();
      alert('La demande a été supprimée.');
    } catch (error) {
      console.error(error);
      alert('Impossible de supprimer cette demande : ' + (error.message || error));
    }
  }

  function archivedRequestRow(request) {
    const status = statusInfo(request.status);
    const item = document.createElement('div');
    item.className = 'archive-sheet-row admin-leave-archive-row';
    item.innerHTML = `
      <div class="archive-sheet-info">
        <strong>${request.request_type === 'conge' ? 'Congé' : 'Absence'} du ${esc(fmtDate(request.date_from))} au ${esc(fmtDate(request.date_to))}</strong>
        <span class="meta">Demandée le ${esc(fmtDate(request.request_date))} · décision le <span class="admin-leave-red-date">${esc(fmtDate(request.decision_date))}</span></span>
      </div>
      <div class="admin-row-actions">
        <span class="leave-status ${status.cls}">${status.label}</span>
        <button class="secondary admin-leave-archive-details" type="button">Détails</button>
        <button class="secondary admin-leave-archive-delete" type="button">Supprimer</button>
      </div>
      <div class="admin-leave-archive-details-box hidden">
        ${request.refusal_reason ? `<div class="admin-leave-refusal-reason"><strong>Motif du refus :</strong> ${esc(request.refusal_reason)}</div>` : ''}
        <div class="admin-leave-signatures">
          <div><span class="admin-leave-mini-label">Signature du technicien</span>${request.employee_signature ? `<img src="${request.employee_signature}" alt="Signature technicien">` : ''}</div>
          <div><span class="admin-leave-mini-label">Signature du responsable</span>${request.responsible_signature ? `<img class="admin-leave-red-signature" src="${request.responsible_signature}" alt="Signature responsable">` : ''}</div>
        </div>
        ${request.responsible_name ? `<div class="meta">Responsable : ${esc(request.responsible_name)}</div>` : ''}
      </div>`;
    const details = item.querySelector('.admin-leave-archive-details-box');
    item.querySelector('.admin-leave-archive-details').onclick = () => details.classList.toggle('hidden');
    item.querySelector('.admin-leave-archive-delete').onclick = () => deleteArchivedLeaveRequest(request);
    return item;
  }

  async function renderAdminLeaveArchives() {
    const box = document.getElementById('adminLeaveArchiveList');
    if (!box || currentProfile?.role !== 'admin') return;
    box.innerHTML = '<p class="hint">Chargement des demandes archivées…</p>';
    try {
      const requests = await fetchLeaveRequests(['approved','refused']);
      requests.sort((a,b) => {
        const byName = displayName(a).localeCompare(displayName(b), 'fr');
        if (byName !== 0) return byName;
        return String(b.decision_date || '').localeCompare(String(a.decision_date || ''));
      });
      box.innerHTML = '';
      if (!requests.length) {
        box.innerHTML = '<p class="hint">Aucune demande d’absence traitée pour le moment.</p>';
        return;
      }

      const groups = new Map();
      requests.forEach(r => {
        const key = r.technician_id || displayName(r);
        if (!groups.has(key)) groups.set(key, {name:displayName(r), requests:[]});
        groups.get(key).requests.push(r);
      });

      [...groups.values()].forEach(group => {
        const wrapper = document.createElement('div');
        wrapper.className = 'archive-tech-group';
        wrapper.innerHTML = `
          <button class="archive-tech-toggle" type="button">
            <span><strong>${esc(group.name)}</strong></span>
            <span>${group.requests.length} demande${group.requests.length > 1 ? 's' : ''} ▾</span>
          </button>
          <div class="archive-sheet-list hidden"></div>`;
        const list = wrapper.querySelector('.archive-sheet-list');
        group.requests.forEach(r => list.appendChild(archivedRequestRow(r)));
        wrapper.querySelector('.archive-tech-toggle').onclick = () => list.classList.toggle('hidden');
        box.appendChild(wrapper);
      });
    } catch (error) {
      console.error(error);
      box.innerHTML = `<p class="error">Impossible de charger les demandes archivées : ${esc(error.message || error)}</p>`;
    }
  }

  function install() {
    if (currentProfile?.role !== 'admin') return;
    ensureResponsibleDashboardTabs();
    ensureArchiveLeaveTab();
  }

  const observer = new MutationObserver(install);
  const appRoot = document.getElementById('app');
  if (appRoot) observer.observe(appRoot, {childList:true, subtree:true});

  let attempts = 0;
  const timer = setInterval(() => {
    install();
    attempts += 1;
    if (attempts > 120 || (document.getElementById('adminLeaveDashboardTab') && document.getElementById('adminArchiveLeaveTab'))) clearInterval(timer);
  }, 150);

  document.addEventListener('click', event => {
    if (event.target?.id === 'refreshAdmin') setTimeout(refreshPendingBadge, 250);
  });

  window.renderPendingLeaveRequests = renderPendingLeaveRequests;
  window.renderAdminLeaveArchives = renderAdminLeaveArchives;
})();