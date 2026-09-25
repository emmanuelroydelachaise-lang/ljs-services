(() => {
  let leaveSignature = '';

  const fmtDate = value => {
    if (!value) return '';
    const d = new Date(`${value}T12:00:00`);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('fr-FR');
  };

  function splitProfileName(fullName) {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { lastName:'', firstName:'' };
    if (parts.length === 1) return { lastName:parts[0], firstName:'' };
    return { lastName:parts.slice(0,-1).join(' '), firstName:parts.at(-1) };
  }

  function todayIso() {
    const d = new Date();
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0,10);
  }

  function hideLeavePanel() {
    document.getElementById('technicianLeavePanel')?.classList.add('hidden');
    document.getElementById('techLeaveTab')?.classList.remove('active');
  }

  function installLeaveTab() {
    const tabs = document.getElementById('technicianTabs');
    if (!tabs || document.getElementById('techLeaveTab')) return;

    const button = document.createElement('button');
    button.id = 'techLeaveTab';
    button.className = 'tech-tab';
    button.type = 'button';
    button.textContent = 'Demande de congés';
    tabs.appendChild(button);

    const panel = document.createElement('section');
    panel.id = 'technicianLeavePanel';
    panel.className = 'card hidden leave-panel';
    tabs.insertAdjacentElement('afterend', panel);

    button.onclick = showLeaveRequestsView;
    renderLeavePanelShell();
  }

  function renderLeavePanelShell() {
    const panel = document.getElementById('technicianLeavePanel');
    if (!panel) return;
    const person = splitProfileName(currentProfile?.full_name);
    panel.innerHTML = `
      <div class="leave-title">DEMANDE DE CONGÉS OU D’ABSENCE</div>
      <div class="leave-form-grid">
        <div><label>NOM</label><input id="leaveLastName" value="${esc(person.lastName)}" autocomplete="family-name"></div>
        <div><label>PRÉNOM</label><input id="leaveFirstName" value="${esc(person.firstName)}" autocomplete="given-name"></div>
      </div>

      <div class="leave-type-row">
        <strong>MOTIF DE L’ABSENCE :</strong>
        <label class="leave-choice"><input type="radio" name="leaveType" value="conge" checked> CONGÉ</label>
        <label class="leave-choice"><input type="radio" name="leaveType" value="absence"> ABSENCE</label>
      </div>

      <div class="leave-comment-field">
        <label for="leaveEmployeeComment">COMMENTAIRE <span class="muted">(facultatif)</span></label>
        <textarea id="leaveEmployeeComment" rows="3" maxlength="800" placeholder="Précision concernant votre demande…"></textarea>
      </div>

      <div class="leave-form-grid leave-dates">
        <div><label>DU</label><input id="leaveDateFrom" type="date"></div>
        <div><label>AU <span class="muted">(inclus)</span></label><input id="leaveDateTo" type="date"></div>
      </div>

      <div class="leave-request-date"><strong>DATE DE VOTRE DEMANDE :</strong> <span id="leaveRequestDateText">${fmtDate(todayIso())}</span></div>
      <p class="leave-copy-note">Après acceptation, une copie de votre demande vous sera remise.</p>

      <div class="leave-signature-block">
        <div class="signature-head">
          <div><h3>Signature de l’employé</h3><p class="hint">La signature est obligatoire pour envoyer la demande.</p></div>
          <button id="clearLeaveSignature" class="secondary" type="button">Effacer</button>
        </div>
        <canvas id="leaveSignatureCanvas" class="signature-pad" width="900" height="220"></canvas>
      </div>

      <div class="leave-responsible-box">
        <div class="leave-responsible-title">ACCORD DU RESPONSABLE</div>
        <div class="leave-decision-placeholder"><strong>OUI</strong><strong>NON</strong></div>
        <p class="hint">Cette partie sera complétée par le responsable après l’envoi de la demande.</p>
      </div>

      <p class="leave-reminder">Il est rappelé que <u>tout départ en congés doit être pris une fois la demande visée par le responsable.</u></p>

      <div class="leave-actions">
        <button id="submitLeaveRequest" class="primary" type="button">Envoyer la demande</button>
        <p id="leaveRequestMsg" class="hint"></p>
      </div>

      <hr class="leave-separator">
      <h2>Mes demandes</h2>
      <div id="leaveRequestList" class="stack"><p class="hint">Chargement…</p></div>`;

    const canvas = document.getElementById('leaveSignatureCanvas');
    leaveSignature = '';
    initSignaturePad(canvas, '', data => { leaveSignature = data; });
    document.getElementById('clearLeaveSignature').onclick = () => {
      clearSignatureCanvas(canvas);
      leaveSignature = '';
    };
    document.getElementById('submitLeaveRequest').onclick = submitLeaveRequest;
  }

  async function showLeaveRequestsView() {
    installLeaveTab();
    if (typeof technicianSheetSections === 'function') technicianSheetSections().forEach(el => el.classList.add('hidden'));
    document.getElementById('technicianArchivesPanel')?.classList.add('hidden');
    document.getElementById('technicianLeavePanel')?.classList.remove('hidden');
    document.getElementById('techSheetTab')?.classList.remove('active');
    document.getElementById('techArchivesTab')?.classList.remove('active');
    document.getElementById('techLeaveTab')?.classList.add('active');
    await loadLeaveRequests();
  }

  async function submitLeaveRequest() {
    const msg = document.getElementById('leaveRequestMsg');
    const button = document.getElementById('submitLeaveRequest');
    const last_name = String(document.getElementById('leaveLastName')?.value || '').trim();
    const first_name = String(document.getElementById('leaveFirstName')?.value || '').trim();
    const request_type = document.querySelector('input[name="leaveType"]:checked')?.value || 'conge';
    const date_from = document.getElementById('leaveDateFrom')?.value || '';
    const date_to = document.getElementById('leaveDateTo')?.value || '';
    const employee_comment = String(document.getElementById('leaveEmployeeComment')?.value || '').trim();

    msg.textContent = '';
    if (!last_name) return alert('Renseigne le nom.');
    if (!date_from || !date_to) return alert('Renseigne les dates de début et de fin.');
    if (date_to < date_from) return alert('La date de fin doit être postérieure ou égale à la date de début.');
    if (!leaveSignature) return alert('Signe la demande avant de l’envoyer.');
    if (!confirm(`Envoyer cette demande de ${request_type === 'conge' ? 'congé' : 'absence'} du ${fmtDate(date_from)} au ${fmtDate(date_to)} inclus ?`)) return;

    button.disabled = true;
    button.textContent = 'Envoi…';
    msg.textContent = 'Enregistrement de la demande…';

    try {
      if (!isCloud) throw new Error('La demande de congés est disponible uniquement sur la version en ligne.');
      const { error } = await sb.from('ljs_leave_requests').insert({
        technician_id: currentProfile.id,
        last_name,
        first_name,
        request_type,
        date_from,
        date_to,
        request_date: todayIso(),
        employee_comment: employee_comment || null,
        employee_signature: leaveSignature,
        status: 'pending'
      });
      if (error) throw error;

      msg.textContent = 'Demande envoyée au responsable.';
      document.getElementById('leaveDateFrom').value = '';
      document.getElementById('leaveDateTo').value = '';
      document.getElementById('leaveEmployeeComment').value = '';
      document.querySelector('input[name="leaveType"][value="conge"]').checked = true;
      clearSignatureCanvas(document.getElementById('leaveSignatureCanvas'));
      leaveSignature = '';
      await loadLeaveRequests();
    } catch (error) {
      console.error(error);
      msg.textContent = `Erreur : ${error.message || error}`;
    } finally {
      button.disabled = false;
      button.textContent = 'Envoyer la demande';
    }
  }

  function statusLabel(request) {
    if (request.status === 'approved') return { label:'ACCORDÉE', cls:'leave-approved' };
    if (request.status === 'refused') return { label:'REFUSÉE', cls:'leave-refused' };
    return { label:'EN ATTENTE', cls:'leave-pending' };
  }

  function renderDecision(request) {
    if (request.status === 'pending') {
      return `<div class="leave-request-decision pending"><strong>Accord du responsable :</strong> en attente de décision.</div>`;
    }
    const approved = request.status === 'approved';
    return `
      <div class="leave-request-decision ${approved ? 'approved' : 'refused'}">
        <strong>Accord du responsable : ${approved ? 'OUI' : 'NON'}</strong>
        ${request.decision_date ? `<span>Date : ${esc(fmtDate(request.decision_date))}</span>` : ''}
        ${!approved && request.refusal_reason ? `<span class="leave-refusal-reason">Motif du refus : ${esc(request.refusal_reason)}</span>` : ''}
        ${request.responsible_name ? `<span>Responsable : ${esc(request.responsible_name)}</span>` : ''}
        ${request.responsible_signature ? `<img class="leave-responsible-signature" src="${request.responsible_signature}" alt="Signature responsable">` : ''}
      </div>`;
  }

  async function loadLeaveRequests() {
    const box = document.getElementById('leaveRequestList');
    if (!box || !currentProfile?.id) return;
    box.innerHTML = '<p class="hint">Chargement des demandes…</p>';

    try {
      if (!isCloud) {
        box.innerHTML = '<p class="hint">Les demandes de congés sont disponibles uniquement sur la version en ligne.</p>';
        return;
      }
      const { data, error } = await sb
        .from('ljs_leave_requests')
        .select('*')
        .eq('technician_id', currentProfile.id)
        .order('created_at', { ascending:false });
      if (error) throw error;

      const requests = data || [];
      box.innerHTML = '';
      if (!requests.length) {
        box.innerHTML = '<p class="hint">Aucune demande envoyée pour le moment.</p>';
        return;
      }

      requests.forEach(request => {
        const status = statusLabel(request);
        const item = document.createElement('div');
        item.className = 'leave-request-item';
        item.innerHTML = `
          <div class="leave-request-head">
            <div>
              <strong>${request.request_type === 'conge' ? 'Congé' : 'Absence'} du ${esc(fmtDate(request.date_from))} au ${esc(fmtDate(request.date_to))}</strong>
              <div class="meta">Demandée le ${esc(fmtDate(request.request_date))}</div>
            </div>
            <span class="leave-status ${status.cls}">${status.label}</span>
          </div>
          ${renderDecision(request)}`;
        box.appendChild(item);
      });
    } catch (error) {
      console.error(error);
      box.innerHTML = `<p class="error">Impossible de charger les demandes : ${esc(error.message || error)}</p>`;
    }
  }

  const baseSheetView = window.showTechnicianSheetView;
  if (typeof baseSheetView === 'function') {
    window.showTechnicianSheetView = function(...args) {
      hideLeavePanel();
      return baseSheetView.apply(this,args);
    };
  }

  const baseArchivesView = window.showTechnicianArchivesView;
  if (typeof baseArchivesView === 'function') {
    window.showTechnicianArchivesView = async function(...args) {
      hideLeavePanel();
      return await baseArchivesView.apply(this,args);
    };
  }

  const observer = new MutationObserver(installLeaveTab);
  observer.observe(document.getElementById('app'), { childList:true, subtree:true });
  installLeaveTab();

  window.showLeaveRequestsView = showLeaveRequestsView;
})();

(() => {
  const VERSION = '20260925-leave-comment-1';
  function loadButtons() {
    if (document.querySelector('script[data-leave-pdf-buttons]')) return;
    const buttons = document.createElement('script');
    buttons.src = `./leave-pdf-buttons.js?v=${VERSION}`;
    buttons.dataset.leavePdfButtons = '1';
    buttons.async = false;
    document.head.appendChild(buttons);
  }
  if (!document.querySelector('script[data-leave-pdf]')) {
    const pdf = document.createElement('script');
    pdf.src = `./leave-pdf.js?v=${VERSION}`;
    pdf.dataset.leavePdf = '1';
    pdf.async = false;
    pdf.addEventListener('load', loadButtons, {once:true});
    pdf.addEventListener('error', loadButtons, {once:true});
    document.head.appendChild(pdf);
  } else {
    loadButtons();
  }
})();