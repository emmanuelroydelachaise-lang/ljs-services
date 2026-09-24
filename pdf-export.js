(() => {
  let libraryPromise = null;
  let captureStyleInstalled = false;

  function loadExternalScript(src, marker, ready) {
    if (ready()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let script = document.querySelector(`script[data-${marker}]`);
      if (script) {
        script.addEventListener('load', () => ready() ? resolve() : reject(new Error('Bibliothèque PDF indisponible.')), { once:true });
        script.addEventListener('error', () => reject(new Error('Impossible de charger la bibliothèque PDF.')), { once:true });
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

  function ensurePdfLibraries() {
    if (!libraryPromise) {
      libraryPromise = Promise.all([
        loadExternalScript(
          'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
          'ljsHtml2canvas',
          () => typeof window.html2canvas === 'function'
        ),
        loadExternalScript(
          'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
          'ljsJspdf',
          () => Boolean(window.jspdf?.jsPDF)
        )
      ]).catch(error => {
        libraryPromise = null;
        throw error;
      });
    }
    return libraryPromise;
  }

  function installCaptureStyle() {
    if (captureStyleInstalled || document.getElementById('ljsPdfCaptureStyle')) return;
    captureStyleInstalled = true;
    const style = document.createElement('style');
    style.id = 'ljsPdfCaptureStyle';
    style.textContent = `
      .ljs-pdf-stage{position:fixed;left:-12000px;top:0;width:285.12mm;height:201.6mm;background:#fff;z-index:-1;pointer-events:none;overflow:hidden}
      .ljs-pdf-stage .exact-print-sheet{position:relative;width:285.12mm;height:201.6mm;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff;box-sizing:border-box}
      .ljs-pdf-stage .exact-print-bg{position:absolute;z-index:0;inset:0;width:100%;height:100%;object-fit:fill;display:block}
      .ljs-pdf-stage .p-overlay{position:absolute;z-index:2;box-sizing:border-box;display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:7.2pt;line-height:1.05;color:#000}
      .ljs-pdf-stage .p-field{justify-content:flex-start;padding-left:.4mm;font-weight:600;font-size:7.5pt}
      .ljs-pdf-stage .p-field span{background:#fff;padding:0 .5mm}
      .ljs-pdf-stage .p-comments{align-items:flex-start;justify-content:flex-start;padding:.2mm .5mm;font-size:6.5pt;line-height:3.8mm;white-space:normal}
      .ljs-pdf-stage .p-comments span{background:#fff}
      .ljs-pdf-stage .p-year-mask{background:#fff;font-size:7pt;font-weight:700;justify-content:flex-start;padding-left:.5mm}
      .ljs-pdf-stage .p-month{justify-content:flex-start;padding-left:.2mm;font-size:6.7pt;font-weight:700;text-transform:capitalize}
      .ljs-pdf-stage .p-week-number{justify-content:flex-start;font-size:8pt;font-weight:700}
      .ljs-pdf-stage .p-week-number span{background:#fff;padding:0 .5mm}
      .ljs-pdf-stage .p-project-code{font-size:6.4pt;font-weight:700;text-align:center;padding:.4mm}
      .ljs-pdf-stage .p-project-name{font-size:5.8pt;font-weight:600;text-align:center;padding:.5mm .25mm}
      .ljs-pdf-stage .p-project-vertical{overflow:visible}
      .ljs-pdf-stage .p-project-vertical span{display:block;white-space:nowrap;transform:rotate(-90deg);transform-origin:center center;max-width:none}
      .ljs-pdf-stage .p-day-name{font-size:7.2pt;font-weight:700;justify-content:center}
      .ljs-pdf-stage .p-day-number{font-size:7.5pt;font-weight:800;justify-content:center;padding:0}
      .ljs-pdf-stage .p-day-mask{background:#fff}
      .ljs-pdf-stage .p-zone,.ljs-pdf-stage .p-hours,.ljs-pdf-stage .p-day-total,.ljs-pdf-stage .p-project-total,.ljs-pdf-stage .p-week-total{font-size:8pt;font-weight:700}
      .ljs-pdf-stage .p-absent{font-size:10pt;font-weight:900;letter-spacing:.08em}
      .ljs-pdf-stage .p-signature{padding:0;align-items:center;justify-content:center}
      .ljs-pdf-stage .p-signature img{width:100%;height:100%;object-fit:contain;object-position:center}
      .ljs-pdf-stage .responsible-signature-print img{filter:brightness(0) saturate(100%) invert(13%) sepia(100%) saturate(5790%) hue-rotate(357deg) brightness(86%) contrast(118%)}
      .ljs-pdf-stage .red-edit{color:#d40000!important;font-weight:700!important}
    `;
    document.head.appendChild(style);
  }

  async function waitForImages(root) {
    const images = [...root.querySelectorAll('img')];
    await Promise.all(images.map(img => new Promise(resolve => {
      let finished = false;
      const done = async () => {
        if (finished) return;
        finished = true;
        try { if (img.decode) await img.decode(); } catch (_) {}
        resolve();
      };
      if (img.complete && img.naturalWidth > 0) return done();
      img.addEventListener('load', done, { once:true });
      img.addEventListener('error', done, { once:true });
      setTimeout(done, 5000);
    })));
  }

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  function safeFilenamePart(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'Technicien';
  }

  function pdfFilename(sheet, technicianName) {
    const year = String(sheet?.week_start || '').slice(0,4) || new Date().getFullYear();
    let week = '';
    try { week = String(weekNumber(sheet.week_start)).padStart(2, '0'); } catch (_) { week = '00'; }
    return `Feuille_heures_${safeFilenamePart(technicianName)}_S${week}_${year}.pdf`;
  }

  async function downloadTimesheetPdf(sheet, technicianName, technicianOnly = false) {
    if (!sheet) throw new Error('Feuille introuvable.');
    if (typeof window.printTimesheet !== 'function') throw new Error('Le modèle de feuille n’est pas disponible.');

    await ensurePdfLibraries();
    installCaptureStyle();

    const previousPrint = window.print;
    window.print = () => {};
    let stage = null;

    try {
      window.printTimesheet(technicianOnly ? {...sheet, days:(sheet.days||[]).slice(0,5)} : sheet, technicianName);
      const source = document.querySelector('#printArea .exact-print-sheet');
      if (!source) throw new Error('Impossible de préparer la feuille PDF.');

      await waitForImages(source);
      try { if (document.fonts?.ready) await document.fonts.ready; } catch (_) {}
      await wait(250);

      stage = document.createElement('div');
      stage.className = 'ljs-pdf-stage';
      const clone = source.cloneNode(true);
      stage.appendChild(clone);
      document.body.appendChild(stage);
      await waitForImages(stage);
      await wait(100);

      const canvas = await window.html2canvas(clone, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 5000
      });

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4', compress:true });
      const image = canvas.toDataURL('image/jpeg', 0.96);
      pdf.addImage(image, 'JPEG', 5.94, 4.2, 285.12, 201.6, undefined, 'FAST');
      pdf.save(pdfFilename(sheet, technicianName));
    } finally {
      if (stage) stage.remove();
      window.print = previousPrint;
    }
  }

  window.downloadTimesheetPdf = downloadTimesheetPdf;
})();