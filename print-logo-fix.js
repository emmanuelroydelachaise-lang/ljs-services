(() => {
  const basePrintTimesheet = window.printTimesheet;
  if (typeof basePrintTimesheet !== 'function') return;

  window.printTimesheet = function(sheet, technicianName) {
    basePrintTimesheet(sheet, technicianName);

    const page = document.querySelector('#printArea .exact-print-sheet');
    if (!page) return;

    page.querySelector('.print-brand-fix')?.remove();

    const brand = document.createElement('div');
    brand.className = 'print-brand-fix';
    brand.setAttribute('style', [
      'position:absolute',
      'z-index:10',
      'left:0',
      'top:0',
      'width:95mm',
      'height:18.2mm',
      'background:#fff',
      'display:flex',
      'align-items:center',
      'gap:3mm',
      'padding-left:4mm',
      'box-sizing:border-box',
      'overflow:hidden'
    ].join(';'));

    brand.innerHTML = `
      <svg viewBox="0 0 320 260" aria-label="Logo LJS Energies" style="width:17mm;height:16mm;display:block;flex:0 0 auto">
        <defs>
          <linearGradient id="pmetal" x1="0" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="#d9d9d9"/><stop offset="0.35" stop-color="#8c8c8c"/><stop offset="0.72" stop-color="#505050"/><stop offset="1" stop-color="#242424"/></linearGradient>
          <linearGradient id="pgreen" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#147d19"/><stop offset="0.55" stop-color="#53a600"/><stop offset="1" stop-color="#b6d800"/></linearGradient>
          <linearGradient id="porange" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e74a00"/><stop offset="0.55" stop-color="#ff7900"/><stop offset="1" stop-color="#ffc400"/></linearGradient>
          <linearGradient id="pblue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#61d5ff"/><stop offset="1" stop-color="#008ccc"/></linearGradient>
        </defs>
        <path d="M250 52 A112 112 0 1 0 254 205" fill="none" stroke="url(#pmetal)" stroke-width="34" stroke-linecap="round"/>
        <path d="M88 129 C118 157 151 153 184 124 C218 94 250 91 278 108 C247 105 224 115 197 139 C160 171 120 172 88 148 Z" fill="url(#pgreen)"/>
        <path d="M108 162 C137 184 169 184 202 155 C231 130 260 127 291 145 C263 142 240 151 215 173 C177 205 139 202 108 181 Z" fill="url(#porange)"/>
        <path d="M104 76 C104 76 132 106 132 125 C132 143 119 156 103 156 C86 156 74 143 74 126 C74 106 104 76 104 76 Z" fill="url(#pblue)"/>
        <path d="M89 119 C87 131 92 140 102 144" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity="0.9"/>
      </svg>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:18pt;font-weight:700;letter-spacing:1.5mm;color:#0668a9;white-space:nowrap">LJS ENERGIES</div>`;

    page.appendChild(brand);
  };
})();
