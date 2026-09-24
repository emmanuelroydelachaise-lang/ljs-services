(() => {
  let leavePdfLibrariesPromise = null;

  function loadScriptOnce(src, marker, ready) {
    if (ready()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let script = document.querySelector(`script[data-${marker}]`);
      if (script) {
        script.addEventListener('load', () => ready() ? resolve() : reject(new Error('Bibliothèque PDF indisponible.')), {once:true});
        script.addEventListener('error', () => reject(new Error('Impossible de charger la bibliothèque PDF.')), {once:true});
        return;
      }
      script = document.createElement('script');
      script.src = src;
      script.dataset[marker] = '1';
      script.onload = () => ready() ? resolve() : reject(new Error('Bibliothèque PDF indisponible.'));
      script.onerror = () => reject(new Error('Impossible de charger la bibliothèque PDF.'));
      document.head.appendChild(script);
    });
  }

  function ensureLeavePdfLibraries() {
    if (!leavePdfLibrariesPromise) {
      leavePdfLibrariesPromise = Promise.all([
        loadScriptOnce('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js','leaveHtml2canvas',() => typeof window.html2canvas === 'function'),
        loadScriptOnce('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js','leaveJspdf',() => Boolean(window.jspdf?.jsPDF))
      ]).catch(error => {
        leavePdfLibrariesPromise = null;
        throw error;
      });
    }
    return leavePdfLibrariesPromise;
  }

  const fmtDate = value => {
    if (!value) return '';
    const d = new Date(`${value}T12:00:00`);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('fr-FR');
  };

  function safeFilePart(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'Technicien';
  }

  function checkbox(checked) {
    return `<span class="leave-pdf-checkbox${checked ? ' checked' : ''}">${checked ? '✓' : ''}</span>`;
  }

  function inlineLjsLogo() {
    return `
      <svg class="leave-pdf-brand-logo" viewBox="0 0 320 260" role="img" aria-label="LJS Energies">
        <defs>
          <linearGradient id="leave-metal" x1="0" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="#d9d9d9"/><stop offset="0.35" stop-color="#8c8c8c"/><stop offset="0.72" stop-color="#505050"/><stop offset="1" stop-color="#242424"/></linearGradient>
          <linearGradient id="leave-green" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#147d19"/><stop offset="0.55" stop-color="#53a600"/><stop offset="1" stop-color="#b6d800"/></linearGradient>
          <linearGradient id="leave-orange" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e74a00"/><stop offset="0.55" stop-color="#ff7900"/><stop offset="1" stop-color="#ffc400"/></linearGradient>
          <linearGradient id="leave-blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#61d5ff"/><stop offset="1" stop-color="#008ccc"/></linearGradient>
        </defs>
        <path d="M250 52 A112 112 0 1 0 254 205" fill="none" stroke="url(#leave-metal)" stroke-width="34" stroke-linecap="round"/>
        <path d="M88 129 C118 157 151 153 184 124 C218 94 250 91 278 108 C247 105 224 115 197 139 C160 171 120 172 88 148 Z" fill="url(#leave-green)"/>
        <path d="M108 162 C137 184 169 184 202 155 C231 130 260 127 291 145 C263 142 240 151 215 173 C177 205 139 202 108 181 Z" fill="url(#leave-orange)"/>
        <path d="M104 76 C104 76 132 106 132 125 C132 143 119 156 103 156 C86 156 74 143 74 126 C74 106 104 76 104 76 Z" fill="url(#leave-blue)"/>
        <path d="M89 119 C87 131 92 140 102 144" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity="0.9"/>
      </svg>`;
  }

  function buildLeavePdfPage(request) {
    const approved = request.status === 'approved';
    const refused = request.status === 'refused';
    const decided = approved || refused;
    const fullName = [request.last_name, request.first_name].filter(Boolean).join(' ').trim();

    const page = document.createElement('div');
    page.className = 'leave-pdf-page';
    page.innerHTML = `
      <div class="leave-pdf-brand">
        ${inlineLjsLogo()}
        <div class="leave-pdf-brand-name">LJS ENERGIES</div>
      </div>
      <div class="leave-pdf-title">DEMANDE DE CONGÉS OU D’ABSENCE</div>

      <div class="leave-pdf-person">
        <div><strong>NOM :</strong> <span>${esc(request.last_name || '')}</span></div>
        <div><strong>PRÉNOM :</strong> <span>${esc(request.first_name || '')}</span></div>
      </div>

      <div class="leave-pdf-main-grid">
        <div class="leave-pdf-left">
          <div class="leave-pdf-field"><strong>DU :</strong> <span>${esc(fmtDate(request.date_from))}</span></div>
          <div class="leave-pdf-field"><strong>AU :</strong> <span>${esc(fmtDate(request.date_to))}</span> <em>(Inclus)</em></div>
          <div class="leave-pdf-field leave-pdf-request-date"><strong>DATE DE VOTRE DEMANDE :</strong> <span>${esc(fmtDate(request.request_date))}</span></div>
          <div class="leave-pdf-copy-note">(Après acceptation une copie de votre demande vous sera remise)</div>
        </div>
        <div class="leave-pdf-right">
          <div class="leave-pdf-motif-title">MOTIF DE L’ABSENCE :</div>
          <div class="leave-pdf-choice">${checkbox(request.request_type === 'conge')} <span>CONGÉ</span></div>
          <div class="leave-pdf-choice">${checkbox(request.request_type === 'absence')} <span>ABSENCE</span></div>
        </div>
      </div>

      <div class="leave-pdf-accord-title">ACCORD DU RESPONSABLE</div>
      <div class="leave-pdf-decision-row">
        <div class="leave-pdf-decision ${approved ? 'selected' : ''}">OUI</div>
        <div class="leave-pdf-decision ${refused ? 'selected' : ''}">NON</div>
      </div>

      <div class="leave-pdf-field leave-pdf-decision-date"><strong>DATE ACCORD OU REFUS :</strong> <span class="leave-pdf-red">${decided ? esc(fmtDate(request.decision_date)) : ''}</span></div>
      <div class="leave-pdf-field leave-pdf-refusal"><strong>MOTIF DU REFUS :</strong> <span class="leave-pdf-red">${refused ? esc(request.refusal_reason || '') : ''}</span></div>

      <div class="leave-pdf-reminder">Il est rappelé que <u>tout départ en congés doit être pris une fois<br>ce bordereau visé.</u></div>

      <div class="leave-pdf-signatures">
        <div class="leave-pdf-signature-block">
          <div class="leave-pdf-signature-label">Signature de l’employé</div>
          ${request.employee_signature ? `<img src="${request.employee_signature}" alt="Signature de ${esc(fullName)}">` : ''}
        </div>
        <div class="leave-pdf-signature-block leave-pdf-responsible-signature-block">
          <div class="leave-pdf-signature-label">Signature du responsable<br>de secteur</div>
          ${request.responsible_signature ? `<img class="leave-pdf-red-signature" src="${request.responsible_signature}" alt="Signature responsable">` : ''}
          ${request.responsible_name ? `<div class="leave-pdf-responsible-name">${esc(request.responsible_name)}</div>` : ''}
        </div>
      </div>`;
    return page;
  }

  function ensureLeavePdfStyle() {
    if (document.getElementById('leavePdfStyle')) return;
    const style = document.createElement('style');
    style.id = 'leavePdfStyle';
    style.textContent = `
      .leave-pdf-stage{position:fixed;left:-12000px;top:0;width:210mm;height:297mm;background:#fff;z-index:-1;pointer-events:none;overflow:hidden}
      .leave-pdf-page{position:relative;width:210mm;height:297mm;box-sizing:border-box;padding:12mm 12mm 10mm;background:#fff;color:#111;font-family:Georgia,'Times New Roman',serif;font-size:10.2pt;overflow:hidden}
      .leave-pdf-brand{position:absolute;left:10mm;top:6mm;display:flex;align-items:center;gap:2.5mm;font-family:Arial,Helvetica,sans-serif;z-index:3}
      .leave-pdf-brand-logo{width:27mm;height:22mm;display:block;flex:0 0 auto}
      .leave-pdf-brand-name{font-size:10.5pt;font-weight:900;letter-spacing:.3px;color:#222;white-space:nowrap}
      .leave-pdf-title{margin:11mm 8mm 14mm 38mm;background:#879fb2;color:#fff;text-align:center;font-size:16pt;font-style:italic;font-weight:700;padding:4.5mm 4mm;border-radius:3mm;font-family:Arial,Helvetica,sans-serif;line-height:1.15}
      .leave-pdf-person{display:grid;grid-template-columns:1fr 1fr;gap:8mm;margin-bottom:9mm;font-size:11pt}
      .leave-pdf-person span,.leave-pdf-field span{display:inline-block;border-bottom:.35mm solid #222;min-width:43mm;padding:0 1.5mm 1mm}
      .leave-pdf-main-grid{display:grid;grid-template-columns:1.35fr .85fr;gap:8mm;align-items:start}
      .leave-pdf-left{display:flex;flex-direction:column;gap:6.5mm}
      .leave-pdf-field{font-size:10.7pt;white-space:nowrap}
      .leave-pdf-field em{font-style:normal;margin-left:2mm}
      .leave-pdf-request-date span{min-width:38mm}
      .leave-pdf-copy-note{font-size:9.5pt;font-style:italic;margin-top:-1mm;max-width:112mm;line-height:1.25}
      .leave-pdf-motif-title{font-weight:700;margin-bottom:4mm}
      .leave-pdf-choice{display:flex;align-items:center;gap:3mm;margin:4mm 0;font-weight:700}
      .leave-pdf-checkbox{display:inline-flex;width:6.5mm;height:6.5mm;border:.5mm solid #111;align-items:center;justify-content:center;font-family:Arial,Helvetica,sans-serif;font-size:12pt;line-height:1;box-sizing:border-box}
      .leave-pdf-checkbox.checked{font-weight:900}
      .leave-pdf-accord-title{width:68mm;margin:12mm auto 4mm;text-align:center;border:1.1mm double #748b9b;padding:3mm 2mm;font-size:11.5pt;font-weight:700;box-sizing:border-box}
      .leave-pdf-decision-row{display:flex;justify-content:space-around;width:90mm;margin:0 auto 8mm;font-weight:700;font-size:11pt}
      .leave-pdf-decision.selected{color:#d40000;text-decoration:underline;text-decoration-thickness:.5mm;text-underline-offset:1.5mm}
      .leave-pdf-decision-date{margin-bottom:5mm}
      .leave-pdf-decision-date span{min-width:38mm}
      .leave-pdf-refusal{white-space:normal;display:flex;align-items:flex-start;gap:2mm}
      .leave-pdf-refusal strong{white-space:nowrap}
      .leave-pdf-refusal span{min-width:92mm;max-width:122mm;min-height:6mm;white-space:normal;line-height:1.2}
      .leave-pdf-red{color:#d40000!important;font-weight:800}
      .leave-pdf-reminder{position:absolute;left:12mm;right:12mm;bottom:49mm;text-align:center;font-weight:700;font-size:10.2pt;line-height:1.45}
      .leave-pdf-signatures{position:absolute;left:12mm;right:12mm;bottom:8mm;display:grid;grid-template-columns:1fr 1fr;gap:14mm;align-items:start}
      .leave-pdf-signature-block{text-align:left;min-height:32mm;overflow:hidden}
      .leave-pdf-signature-label{font-size:10pt;margin-bottom:1.5mm}
      .leave-pdf-signature-block img{display:block;width:53mm;height:21mm;object-fit:contain;object-position:left center}
      .leave-pdf-responsible-signature-block{color:#d40000}
      .leave-pdf-red-signature{filter:none}
      .leave-pdf-responsible-name{font-size:9pt;font-weight:700;margin-top:.5mm}
    `;
    document.head.appendChild(style);
  }

  async function waitForImages(root) {
    await Promise.all([...root.querySelectorAll('img')].map(img => new Promise(resolve => {
      let doneOnce = false;
      const done = () => { if (!doneOnce) { doneOnce = true; resolve(); } };
      if (img.complete) return done();
      img.addEventListener('load', done, {once:true});
      img.addEventListener('error', done, {once:true});
      setTimeout(done, 4000);
    })));
  }

  async function downloadLeaveRequestPdf(request) {
    if (!request) throw new Error('Demande introuvable.');
    if (!['approved','refused'].includes(request.status)) throw new Error('Le PDF est disponible après décision du responsable.');

    await ensureLeavePdfLibraries();
    ensureLeavePdfStyle();

    const stage = document.createElement('div');
    stage.className = 'leave-pdf-stage';
    const page = buildLeavePdfPage(request);
    stage.appendChild(page);
    document.body.appendChild(stage);

    try {
      await waitForImages(page);
      try { if (document.fonts?.ready) await document.fonts.ready; } catch (_) {}
      await new Promise(resolve => setTimeout(resolve, 120));

      const canvas = await window.html2canvas(page, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 5000,
        width: page.scrollWidth,
        height: page.scrollHeight,
        windowWidth: page.scrollWidth,
        windowHeight: page.scrollHeight
      });

      const {jsPDF} = window.jspdf;
      const pdf = new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
      pdf.addImage(canvas.toDataURL('image/jpeg',0.96),'JPEG',0,0,210,297,undefined,'FAST');
      const who = safeFilePart([request.last_name, request.first_name].filter(Boolean).join('_'));
      const date = String(request.date_from || '').replaceAll('-','');
      pdf.save(`Demande_absence_${who}_${date}.pdf`);
    } finally {
      stage.remove();
    }
  }

  window.downloadLeaveRequestPdf = downloadLeaveRequestPdf;
})();