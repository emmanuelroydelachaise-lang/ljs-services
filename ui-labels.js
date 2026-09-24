function applyShortAbsentLabels(root=document){
  root.querySelectorAll('.absence-line label').forEach(label=>{
    if(label.textContent.trim()==='Technicien absent ce jour') label.textContent='Absent';
  });
}

function applyZonePlaceholderLabels(root=document){
  root.querySelectorAll('select.zone option[value="0"], select.admin-zone option[value="0"]').forEach(option=>{
    if(option.textContent.trim()!=='Sélectionner zone') option.textContent='Sélectionner zone';
  });
}

function applyUiLabels(root=document){
  applyShortAbsentLabels(root);
  applyZonePlaceholderLabels(root);
}

function installLeavePdfSignatureStyle(){
  if(document.getElementById('leavePdfSignatureStyleFix')) return;
  const style=document.createElement('style');
  style.id='leavePdfSignatureStyleFix';
  style.textContent=`
    .leave-pdf-responsible-signature-block{color:#111!important}
    .leave-pdf-responsible-name{display:none!important}
    .leave-pdf-red-signature{filter:none!important}

    /* Mise en page PDF plus harmonieuse : bloc principal un peu plus bas */
    .leave-pdf-title{margin-top:17mm!important}

    /* Rappel et signatures remontés pour réduire le grand vide central */
    .leave-pdf-reminder{bottom:64mm!important}
    .leave-pdf-signatures{bottom:22mm!important}
  `;
  document.head.appendChild(style);
}

function loadTechnicianAdminChanges(){
  if(!document.querySelector('link[data-tech-admin-changes]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='./technician-admin-changes.css?v=20260916-tech-red-2';
    link.dataset.techAdminChanges='1';
    document.head.appendChild(link);
  }
  if(!document.querySelector('script[data-tech-admin-changes]')){
    const script=document.createElement('script');
    script.src='./technician-admin-changes.js?v=20260916-tech-red-2';
    script.dataset.techAdminChanges='1';
    script.async=false;
    document.head.appendChild(script);
  }
}

function loadAdminArchiveNavigation(){
  if(document.querySelector('script[data-admin-archive-navigation]')) return;
  const script=document.createElement('script');
  script.src='./admin-archive-navigation.js?v=20260916-archives-bottom-1';
  script.dataset.adminArchiveNavigation='1';
  script.async=false;
  document.head.appendChild(script);
}

function loadLeavePdfTools(){
  const loadButtons=()=>{
    if(document.querySelector('script[data-leave-pdf-buttons]')) return;
    const buttons=document.createElement('script');
    buttons.src='./leave-pdf-buttons.js?v=20260916-leave-pdf-5';
    buttons.dataset.leavePdfButtons='1';
    buttons.async=false;
    document.head.appendChild(buttons);
  };

  if(window.downloadLeaveRequestPdf){
    loadButtons();
    return;
  }

  let pdf=document.querySelector('script[data-leave-pdf]');
  if(pdf){
    pdf.addEventListener('load',loadButtons,{once:true});
    return;
  }

  pdf=document.createElement('script');
  pdf.src='./leave-pdf.js?v=20260916-leave-pdf-5';
  pdf.dataset.leavePdf='1';
  pdf.async=false;
  pdf.addEventListener('load',loadButtons,{once:true});
  document.head.appendChild(pdf);
}

function loadLeaveNotifications(){
  if(document.querySelector('script[data-leave-notifications]')) return;
  const script=document.createElement('script');
  script.src='./leave-notifications.js?v=20260916-leave-notify-1';
  script.dataset.leaveNotifications='1';
  script.async=false;
  document.head.appendChild(script);
}

document.addEventListener('DOMContentLoaded',()=>{
  applyUiLabels();
  installLeavePdfSignatureStyle();
  loadTechnicianAdminChanges();
  loadAdminArchiveNavigation();
  loadLeavePdfTools();
  loadLeaveNotifications();
  const app=document.getElementById('app');
  if(!app) return;
  const observer=new MutationObserver(()=>applyUiLabels(app));
  observer.observe(app,{childList:true,subtree:true});
});
