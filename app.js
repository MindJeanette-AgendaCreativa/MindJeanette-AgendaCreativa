const weekdays=["Lunes","Martes","Miércoles","Jueves","Viernes"];
const baseTasks=[];
const demoWeekKey='2026-10-19';
const weekKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
function inicioDeSemana(fecha){const inicio=new Date(fecha);inicio.setHours(0,0,0,0);inicio.setDate(inicio.getDate()-((inicio.getDay()+6)%7));return inicio}
/* 1. Limpieza inmediata de claves pesadas que saturaban la cuota de 5MB de localStorage */
['mindJeanetteHistoryUndo','mindJeanetteHistoryRedo','mindJeanetteSafetyBackup','mindJeanetteSnapshotBackups','mindJeanetteTasks'].forEach(k=>{
  try{localStorage.removeItem(k);}catch(_){}
  try{sessionStorage.removeItem(k);}catch(_){}
});
if(typeof navigator!=='undefined'&&navigator.storage&&navigator.storage.persist){
  try{navigator.storage.persist();}catch(_){}
}

let weeks=null;
try{
  weeks=JSON.parse(localStorage.getItem('mindJeanetteWeeks')||'null');
}catch(_){
  weeks=null;
}
if(!weeks||typeof weeks!=='object'){
  weeks={};
  try{localStorage.setItem('mindJeanetteWeeks',JSON.stringify(weeks));}catch(_){}
}

// Purga incondicional de tarjetas erróneas o eliminadas
const startupPurgedIds = new Set(['1793755422762', '1793858998471']);
let startupTombstones = new Set();
try {
  startupTombstones = new Set(JSON.parse(localStorage.getItem('mindJeanetteTombstones') || '[]'));
} catch(_) {}
if(weeks && typeof weeks === 'object'){
  Object.keys(weeks).forEach(wk => {
    if(Array.isArray(weeks[wk])){
      weeks[wk] = weeks[wk].filter(t => t && !startupPurgedIds.has(String(t.id)) && !startupTombstones.has(String(t.id)));
    }
  });
}
/* Limpieza permanente de la demo dummy Film budget (id: 991) autosembrada */
if(!localStorage.getItem('mindJeanetteFilmBudgetSeedCleanedFinal')){
  Object.values(weeks).forEach(week=>{
    if(!Array.isArray(week))return;
    for(let i=week.length-1;i>=0;i--){
      if(week[i]&&(week[i].id===991||(week[i].title==='Film budget'&&week[i].type==='todo-table'&&!week[i].project))){
        week.splice(i,1);
      }
    }
  });
  try{
    localStorage.setItem('mindJeanetteFilmBudgetSeedCleanedFinal','true');
  }catch(_){}
}
/* Limpieza permanente de recurrencias: se eliminan reglas rígidas para dar 100% libertad de movimiento con el mouse y duplicación */
try {
  localStorage.removeItem('mindJeanetteRecurringTasks');
} catch(_) {}
function sanitizeTasksList(list){
  if(!Array.isArray(list)) return;
  list.forEach(task => {
    if(!task) return;
    delete task.recurrence;
    delete task.time;
    delete task.hour;
    delete task.schedule;
    if(task.description){
      task.description = String(task.description)
        .replace(/Pieza guardada en tu bitácora\.?/gi, '')
        .replace(/Elemento guardado en tu bitácora\.?/gi, '')
        .replace(/Elemento guardado en tu agenda\.?/gi, '')
        .replace(/Documento guardado\.?/gi, '')
        .replace(/Sticker decorativo con movimiento libre\.?/gi, '')
        .replace(/guardad[oa] en tu bitácora\.?/gi, '')
        .trim();
    }
    if(task.result && task.result.includes('bitácora')){
      task.result = task.result.replace(/en tu bitácora/gi, 'en tu agenda').trim();
    }
    if(task.type === 'meeting' && task.title && task.title.startsWith('Reunión con ') && task.personName){
      task.title = task.personName;
    }
  });
}
Object.values(weeks).forEach(sanitizeTasksList);

let mindFerDatabase=null;
let hasUserSavedInSession=false;

function updateSaveStatusBadge(text, isOk = true){
  const badge = document.querySelector('#saveStatusBadge');
  if(badge){
    badge.textContent = text;
    badge.style.color = isOk ? '#15803d' : '#b45309';
  }
  const dot = document.querySelector('#saveStatusDot');
  const label = document.querySelector('#saveStatusLabel');
  if(dot) dot.style.background = isOk ? '#16a34a' : '#d97706';
  if(label){
    if(text.includes('Guardando') || text.includes('...')){
      label.textContent = 'Guardando...';
    } else if(text.includes('Guardado') || text.includes('✓')){
      label.textContent = 'Guardado';
      setTimeout(() => {
        if(label.textContent === 'Guardado') label.textContent = 'Guardar';
      }, 3500);
    } else {
      label.textContent = text;
    }
  }
}
window.updateSaveStatusBadge = updateSaveStatusBadge;

function buildLightWeeksForLocalStorage(sourceWeeks, maxImgChars = 80000){
  const light = {};
  if(!sourceWeeks || typeof sourceWeeks !== 'object') return light;
  Object.keys(sourceWeeks).forEach(wk => {
    const arr = sourceWeeks[wk];
    if(!Array.isArray(arr)) return;
    light[wk] = arr.map(t => {
      if(!t || typeof t !== 'object') return t;
      const copy = { ...t };
      if(copy.transcriptData && copy.transcriptData.length > 50000) delete copy.transcriptData;
      if(copy.fileData && copy.fileData.length > 50000) delete copy.fileData;
      if(copy.media && copy.media.length > 50000) delete copy.media;
      if(Array.isArray(copy.files)){
        copy.files = copy.files.map(fItem => {
          const fCopy = { ...fItem };
          if(fCopy.data && fCopy.data.length > 50000) delete fCopy.data;
          return fCopy;
        });
      }
      // Respaldo de emergencia para no saturar los 5MB de localStorage (IndexedDB preserva el 100% íntegro)
      if(copy.image && copy.image.length > maxImgChars) copy.image = '';
      if(Array.isArray(copy.images)){
        copy.images = copy.images.map(img => (typeof img === 'string' && img.length > maxImgChars) ? '' : img);
      }
      return copy;
    });
  });
  return light;
}

function buildWeeksForCloudPayload(sourceWeeks){
  const light = {};
  if(!sourceWeeks || typeof sourceWeeks !== 'object') return light;
  Object.keys(sourceWeeks).forEach(wk => {
    const arr = sourceWeeks[wk];
    if(!Array.isArray(arr)) return;
    light[wk] = arr.map(t => {
      if(!t || typeof t !== 'object') return t;
      const copy = { ...t };
      // En Firestore, el documento principal mindfer_state/main tiene un límite estricto de 1MB.
      // Todos los adjuntos pesados se suben intactos a la colección mindfer_media por tarjeta.
      if(copy.image && typeof copy.image === 'string' && copy.image.startsWith('data:')) copy.image = '';
      if(Array.isArray(copy.images)){
        copy.images = copy.images.map(img => (typeof img === 'string' && img.startsWith('data:')) ? '' : img);
      }
      if(Array.isArray(copy.files)){
        copy.files = copy.files.map(fItem => {
          const fCopy = { ...fItem };
          if(fCopy.data && typeof fCopy.data === 'string' && fCopy.data.startsWith('data:')) delete fCopy.data;
          return fCopy;
        });
      }
      if(copy.transcriptData && copy.transcriptData.length > 50000) delete copy.transcriptData;
      if(copy.fileData && copy.fileData.length > 50000) delete copy.fileData;
      if(copy.media && copy.media.length > 50000) delete copy.media;
      return copy;
    });
  });
  return light;
}

window.getMindFerCloudPayload = function(){
  try {
    if(!hasUserSavedInSession && countRealBoardTasks(weeks) === 0) return null;
    let weeksJson = JSON.stringify(buildWeeksForCloudPayload(weeks));
    const drawMap = {};
    for(let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i);
      if(k && k.startsWith('mindJeanetteDrawStrokes_')){
        drawMap[k] = localStorage.getItem(k) || '[]';
      }
    }
    let stickersFolderJson = localStorage.getItem('mindJeanetteStickerFolder') || '[]';
    if(stickersFolderJson.length > 80000) stickersFolderJson = '[]';
    return {
      savedAt: Number(localStorage.getItem('mindJeanetteLastSavedAt') || Date.now()),
      weeksJson,
      pipelineJson: JSON.stringify(pipelineItems || []),
      motivationQuote: typeof motivationQuote === 'string' ? motivationQuote : '',
      customProjectsJson: localStorage.getItem('mindJeanetteCustomProjects') || '[]',
      projectStoriesJson: localStorage.getItem('mindJeanetteProjectStories') || '{}',
      customChannelsJson: localStorage.getItem('mindJeanetteCustomChannels') || '[]',
      stickersFolderJson,
      drawStrokesMapJson: JSON.stringify(drawMap)
    };
  } catch(_) {
    return null;
  }
};

function countRealBoardTasks(wObj){
  if(!wObj || typeof wObj !== 'object') return 0;
  let total = 0;
  Object.entries(wObj).forEach(([wk, arr]) => {
    if(wk === '2026-10-19') return; // ignorar semilla por defecto
    if(Array.isArray(arr)) total += arr.length;
  });
  return total;
}

function countBoardImages(wObj){
  if(!wObj || typeof wObj !== 'object') return 0;
  let total = 0;
  Object.values(wObj).forEach(arr => {
    if(!Array.isArray(arr)) return;
    arr.forEach(t => {
      if(t && typeof t.image === 'string' && t.image.length > 100) total++;
    });
  });
  return total;
}

window.applyMindFerCloudPayloadIfNewer = function(cloudData, allowLiveUpdate = false){
  try {
    if(!cloudData || !cloudData.weeksJson) return false;
    const parsedWeeks = JSON.parse(cloudData.weeksJson);
    if(!parsedWeeks || typeof parsedWeeks !== 'object') return false;

    const cloudRealCount = countRealBoardTasks(parsedWeeks);
    const localRealCount = countRealBoardTasks(weeks);

    // Nunca aceptar un estado vacío de la nube si localmente tenemos tareas reales
    if(cloudRealCount === 0 && localRealCount > 0) return false;

    // Forzar restauración si el navegador local está vacío y la nube tiene datos
    const forceRestoreFromCloud = !hasUserSavedInSession && (localRealCount === 0 && cloudRealCount > 0);

    if(!forceRestoreFromCloud){
      const cloudSavedAt = Number(cloudData.savedAt || 0);
      const localSavedAt = Number(localStorage.getItem('mindJeanetteLastSavedAt') || 0);
      // NUNCA sobreescribir el navegador local si la nube tiene datos iguales o más antiguos
      if(cloudSavedAt <= localSavedAt) return false;
      // Proteger la sesión activa contra ecos remotos recientes
      if(hasUserSavedInSession && (Date.now() - localSavedAt < 10000)) return false;
    }
    const cloudSavedAt = Number(cloudData.savedAt || Date.now());

    let cloudTombstones = new Set(['1793755422762', '1793858998471']);
    try {
      const storedT = JSON.parse(localStorage.getItem('mindJeanetteTombstones') || '[]');
      storedT.forEach(id => cloudTombstones.add(String(id)));
    } catch(_) {}

    Object.keys(parsedWeeks).forEach(wk => {
      if(Array.isArray(parsedWeeks[wk])){
        parsedWeeks[wk] = parsedWeeks[wk].filter(t => t && !cloudTombstones.has(String(t.id)));
      }
    });

    mergeHeavyAttachmentsFromDb(parsedWeeks, weeks);
    // Preservar tareas locales existentes y todos sus adjuntos (imágenes, PDFs, etc.) para evitar pérdidas
    if(weeks && typeof weeks === 'object'){
      Object.keys(weeks).forEach(wKey => {
        if(!parsedWeeks[wKey]) {
          parsedWeeks[wKey] = (weeks[wKey] || []).filter(t => t && !cloudTombstones.has(String(t.id)));
        } else if(Array.isArray(weeks[wKey]) && Array.isArray(parsedWeeks[wKey])) {
          const cloudIds = new Set(parsedWeeks[wKey].map(t => String(t.id)));
          weeks[wKey].forEach(localTask => {
            if(!localTask || !localTask.id || cloudTombstones.has(String(localTask.id))) return;
            const idStr = String(localTask.id);
            if(!cloudIds.has(idStr)){
              parsedWeeks[wKey].push(localTask);
            } else {
              const cloudTask = parsedWeeks[wKey].find(t => String(t.id) === idStr);
              if(cloudTask){
                // Preservar SIEMPRE la imagen y adjuntos locales de alta calidad
                if(localTask.image && localTask.image.length > 50 && (!cloudTask.image || cloudTask.image.length < localTask.image.length)){
                  cloudTask.image = localTask.image;
                }
                if(Array.isArray(localTask.images) && localTask.images.length > 0 && (!Array.isArray(cloudTask.images) || cloudTask.images.length === 0 || (cloudTask.images[0] && cloudTask.images[0].length < 50))){
                  cloudTask.images = localTask.images;
                }
                if(Array.isArray(localTask.files) && localTask.files.length > 0 && (!Array.isArray(cloudTask.files) || cloudTask.files.length === 0 || !cloudTask.files[0]?.data)){
                  cloudTask.files = localTask.files;
                }
                ['transcriptData', 'fileData', 'media'].forEach(k => {
                  if(localTask[k] && localTask[k].length > 50 && (!cloudTask[k] || cloudTask[k].length < 50)){
                    cloudTask[k] = localTask[k];
                  }
                });
                ['transcriptName', 'transcriptSize', 'fileName', 'fileSize', 'url'].forEach(k => {
                  if(localTask[k] && !cloudTask[k]) cloudTask[k] = localTask[k];
                });
                if(localTask.bajada && !cloudTask.bajada) cloudTask.bajada = localTask.bajada;
              }
            }
          });
        }
      });
    }
    weeks = parsedWeeks;
    Object.values(weeks).forEach(sanitizeTasksList);
    limpiarTodasLasSemanasDuplicadas();

    if(cloudData.pipelineJson){
      try {
        pipelineItems = JSON.parse(cloudData.pipelineJson);
        localStorage.setItem('mindJeanettePipeline', cloudData.pipelineJson);
      } catch(_) {}
    }
    if(typeof cloudData.motivationQuote === 'string'){
      motivationQuote = cloudData.motivationQuote;
      try { localStorage.setItem('mindJeanetteMotivationQuote', motivationQuote); } catch(_) {}
    }
    if(cloudData.customProjectsJson){
      try {
        localStorage.setItem('mindJeanetteCustomProjects', cloudData.customProjectsJson);
        syncProjectSelect();
      } catch(_) {}
    }
    if(cloudData.projectStoriesJson){
      try {
        localStorage.setItem('mindJeanetteProjectStories', cloudData.projectStoriesJson);
        Object.assign(projectStories, JSON.parse(cloudData.projectStoriesJson || '{}'));
      } catch(_) {}
    }
    if(cloudData.drawStrokesMapJson){
      try {
        const drawMap = JSON.parse(cloudData.drawStrokesMapJson || '{}');
        Object.keys(drawMap).forEach(k => {
          if(k.startsWith('mindJeanetteDrawStrokes_')) localStorage.setItem(k, drawMap[k]);
        });
      } catch(_) {}
    }
    if(cloudData.stickersFolderJson){
      try {
        localStorage.setItem('mindJeanetteStickerFolder', cloudData.stickersFolderJson);
        if(typeof loadUserStickersFolder === 'function') loadUserStickersFolder();
      } catch(_) {}
    }
    try {
      localStorage.setItem('mindJeanetteWeeks', JSON.stringify(buildLightWeeksForLocalStorage(weeks)));
      localStorage.setItem('mindJeanetteLastSavedAt', String(cloudSavedAt));
    } catch(_) {}
    if(mindFerDatabase){
      try {
        const tx = mindFerDatabase.transaction('estado', 'readwrite');
        const store = tx.objectStore('estado');
        store.put(weeks, 'semanas');
        store.put(cloudSavedAt, 'semanas_savedAt');
      } catch(_) {}
    }
    cargarSemana();
    recordHistoryState();
    const hhmm = new Date(cloudSavedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    updateSaveStatusBadge(`☁✓ Mac + Cloud ${hhmm}`, true);
    return true;
  } catch(err) {
    console.warn('Error aplicando estado de la nube:', err);
    return false;
  }
};

window.getMindFerMediaAttachments = function(){
  const list = [];
  if(!weeks || typeof weeks !== 'object') return list;
  Object.values(weeks).forEach(arr => {
    if(!Array.isArray(arr)) return;
    arr.forEach(t => {
      if(!t || !t.id) return;
      const hasImg = Boolean(t.image && t.image.length > 0);
      const hasImages = Boolean(Array.isArray(t.images) && t.images.length > 0);
      const hasFiles = Boolean(Array.isArray(t.files) && t.files.length > 0);
      const hasFile = Boolean(t.fileData && t.fileData.length > 0);
      const hasTrans = Boolean(t.transcriptData && t.transcriptData.length > 0);
      const hasMedia = Boolean(t.media && t.media.length > 0);
      if(hasImg || hasImages || hasFiles || hasFile || hasTrans || hasMedia){
        list.push({
          id: String(t.id),
          image: t.image || '',
          images: hasImages ? t.images : undefined,
          files: hasFiles ? t.files : undefined,
          fileData: (t.fileData && t.fileData.length < 750000) ? t.fileData : '',
          transcriptData: (t.transcriptData && t.transcriptData.length < 750000) ? t.transcriptData : '',
          media: (t.media && t.media.length < 750000) ? t.media : ''
        });
      }
    });
  });
  return list;
};

function hydrateMissingCardImages(targetWeeks = weeks) {
  let anyRestored = false;
  const vault = window.MindFerMediaVault || {};
  const restoredWeeks = window.MindFerSemanasRestauradas || {};

  const getVaultImage = (id, task) => {
    const strId = String(id);
    if (vault[strId] && vault[strId].length > 50) return vault[strId];
    for (const arr of Object.values(restoredWeeks)) {
      if (Array.isArray(arr)) {
        const found = arr.find(x => x && String(x.id) === strId && x.image && x.image.length > 50);
        if (found) return found.image;
      }
    }
    if (task && (
      (task.description && /inteligencia de mercado/i.test(task.description)) ||
      (task.thoughts && /RADAR 3/i.test(task.thoughts)) ||
      (task.day === 'Jueves' && (task.title === 'Imagen' || /agente/i.test(task.title)))
    )) {
      if (vault['agente_ia_banner'] && vault['agente_ia_banner'].length > 50) {
        return vault['agente_ia_banner'];
      }
    }
    return null;
  };

  const applyToTask = t => {
    if (!t || !t.id) return;
    if (t.type === 'image' || t.type === 'meeting' || t.featured || t.type === 'sticker') {
      if (!t.image || t.image.length < 50) {
        const restoredImg = getVaultImage(t.id, t);
        if (restoredImg) {
          t.image = restoredImg;
          anyRestored = true;
        }
      }
    }
  };

  if (targetWeeks && typeof targetWeeks === 'object') {
    Object.values(targetWeeks).forEach(arr => {
      if (Array.isArray(arr)) arr.forEach(applyToTask);
    });
  }

  if (Array.isArray(tasks)) {
    tasks.forEach(applyToTask);
  }

  if (anyRestored && mindFerDatabase) {
    try {
      const tx = mindFerDatabase.transaction('estado', 'readwrite');
      tx.objectStore('estado').put(weeks, 'semanas');
    } catch (_) {}
  }

  return anyRestored;
}

async function fetchMissingImagesFromCloudRest() {
  return;
}

window.applyMindFerMediaMap = function(mediaMap){
  if(!mediaMap || typeof mediaMap !== 'object' || !weeks || typeof weeks !== 'object') return false;
  let updated = false;
  const updateTaskObj = t => {
    if(!t || !t.id) return;
    const m = mediaMap[String(t.id)];
    if(!m) return;
    if(m.image && (!t.image || t.image.length < m.image.length)){
      t.image = m.image;
      updated = true;
    }
    if(Array.isArray(m.images) && m.images.length > 0 && (!Array.isArray(t.images) || t.images.length < m.images.length)){
      t.images = m.images;
      updated = true;
    }
    if(Array.isArray(m.files) && m.files.length > 0 && (!Array.isArray(t.files) || t.files.length < m.files.length)){
      t.files = m.files;
      updated = true;
    }
    if(m.fileData && !t.fileData){
      t.fileData = m.fileData;
      updated = true;
    }
    if(m.transcriptData && !t.transcriptData){
      t.transcriptData = m.transcriptData;
      updated = true;
    }
    if(m.media && !t.media){
      t.media = m.media;
      updated = true;
    }
  };

  Object.values(weeks).forEach(arr => {
    if(Array.isArray(arr)) arr.forEach(updateTaskObj);
  });
  if(Array.isArray(tasks)) tasks.forEach(updateTaskObj);

  if(updated){
    if(mindFerDatabase){
      try {
        const tx = mindFerDatabase.transaction('estado', 'readwrite');
        tx.objectStore('estado').put(weeks, 'semanas');
      } catch(_) {}
    }
    try {
      localStorage.setItem('mindJeanetteWeeks', JSON.stringify(buildLightWeeksForLocalStorage(weeks)));
    } catch(_) {}
    cargarSemana();
  }
  return updated;
};

function mergeHeavyAttachmentsFromDb(targetWeeks, dbWeeks){
  if(!targetWeeks || !dbWeeks || typeof targetWeeks !== 'object' || typeof dbWeeks !== 'object') return;
  const dbTaskMap = new Map();
  Object.values(dbWeeks).forEach(list => {
    if(!Array.isArray(list)) return;
    list.forEach(item => {
      if(item && item.id) dbTaskMap.set(item.id, item);
    });
  });
  Object.values(targetWeeks).forEach(list => {
    if(!Array.isArray(list)) return;
    list.forEach(item => {
      if(!item || !item.id) return;
      const dbItem = dbTaskMap.get(item.id);
      if(!dbItem) return;
      if(!item.transcriptData && dbItem.transcriptData) item.transcriptData = dbItem.transcriptData;
      if(!item.fileData && dbItem.fileData) item.fileData = dbItem.fileData;
      if(!item.media && dbItem.media) item.media = dbItem.media;
      if((!item.image || item.image.length < 50) && dbItem.image && dbItem.image.length > 50) item.image = dbItem.image;
      if((!Array.isArray(item.images) || item.images.length === 0 || (item.images[0] && item.images[0].length < 50)) && Array.isArray(dbItem.images) && dbItem.images.length > 0){
        item.images = dbItem.images;
      }
      if((!Array.isArray(item.files) || item.files.length === 0 || (item.files[0] && !item.files[0].data)) && Array.isArray(dbItem.files) && dbItem.files.length > 0){
        item.files = dbItem.files;
      }
    });
  });
}

const guardarSemanas=()=>{
  hasUserSavedInSession = true;
  const prevSavedAt = Number(localStorage.getItem('mindJeanetteLastSavedAt') || 0);
  const nowTs = Math.max(Date.now(), prevSavedAt + 1);
  let savedToLocal = false;
  try{
    localStorage.setItem('mindJeanetteWeeks', JSON.stringify(weeks));
    localStorage.setItem('mindJeanetteLastSavedAt', String(nowTs));
    savedToLocal = true;
  }catch(quotaErr){
    try{
      ['mindJeanetteHistoryUndo','mindJeanetteHistoryRedo','mindJeanetteSafetyBackup','mindJeanetteSnapshotBackups','mindJeanetteTasks'].forEach(k=>localStorage.removeItem(k));
      const lightWeeks = buildLightWeeksForLocalStorage(weeks);
      localStorage.setItem('mindJeanetteWeeks', JSON.stringify(lightWeeks));
      localStorage.setItem('mindJeanetteLastSavedAt', String(nowTs));
      savedToLocal = true;
    }catch(err2){
      console.warn('Cuota de localStorage llena, guardando íntegro en IndexedDB:', err2);
    }
  }
  if(mindFerDatabase){
    try{
      const tx = mindFerDatabase.transaction('estado','readwrite');
      const store = tx.objectStore('estado');
      store.put(weeks, 'semanas');
      store.put(nowTs, 'semanas_savedAt');
      tx.oncomplete = () => {
        const hhmm = new Date(nowTs).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
        updateSaveStatusBadge(`✓ Guardado ${hhmm}`, true);
      };
      tx.onerror = () => {
        if(savedToLocal){
          const hhmm = new Date(nowTs).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
          updateSaveStatusBadge(`✓ Guardado ${hhmm}`, true);
        }
      };
    }catch(err){
      console.warn('Error en transacción de base local:', err);
    }
  } else if(savedToLocal) {
    const hhmm = new Date(nowTs).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    updateSaveStatusBadge(`✓ Guardado ${hhmm}`, true);
  }
  if(typeof window.scheduleMindFerCloudSync === 'function'){
    window.scheduleMindFerCloudSync();
  }
};

const guardarSemanasLocalSilencioso=()=>{
  try{
    const lightWeeks = buildLightWeeksForLocalStorage(weeks);
    localStorage.setItem('mindJeanetteWeeks', JSON.stringify(lightWeeks));
  }catch(_){}
  if(mindFerDatabase){
    try{
      const tx = mindFerDatabase.transaction('estado','readwrite');
      tx.objectStore('estado').put(weeks, 'semanas');
    }catch(_){}
  }
};

const abrirBaseMindFer=()=>{
  if(!('indexedDB' in window)) return;
  const request = indexedDB.open('mindJeanetteLocal', 1);
  request.onupgradeneeded = () => {
    if(!request.result.objectStoreNames.contains('estado')){
      request.result.createObjectStore('estado');
    }
  };
  request.onsuccess = () => {
    mindFerDatabase = request.result;
    try {
      const tx = mindFerDatabase.transaction('estado', 'readonly');
      const store = tx.objectStore('estado');
      const reqSemanas = store.get('semanas');
      const reqSavedAt = store.get('semanas_savedAt');
      tx.oncomplete = () => {
        if(hasUserSavedInSession){
          guardarSemanas();
          return;
        }
        const dbWeeks = reqSemanas.result;
        const dbSavedAt = Number(reqSavedAt.result || 0);
        const localSavedAt = Number(localStorage.getItem('mindJeanetteLastSavedAt') || 0);
        const localRealCount = countRealBoardTasks(weeks);
        const dbRealCount = countRealBoardTasks(dbWeeks);

        if(dbWeeks && typeof dbWeeks === 'object' && (dbRealCount > 0 || dbSavedAt > localSavedAt)){
          if(localRealCount > 0 && localSavedAt >= dbSavedAt){
            mergeHeavyAttachmentsFromDb(weeks, dbWeeks);
            limpiarTodasLasSemanasDuplicadas();
            guardarSemanasLocalSilencioso();
          } else {
            mergeHeavyAttachmentsFromDb(dbWeeks, weeks);
            weeks = dbWeeks;
            Object.values(weeks).forEach(sanitizeTasksList);
            limpiarTodasLasSemanasDuplicadas();
            try {
              localStorage.setItem('mindJeanetteWeeks', JSON.stringify(buildLightWeeksForLocalStorage(weeks)));
            } catch(_) {}
          }
          cargarSemana();
          recordHistoryState();
        } else if(localRealCount > 0) {
          limpiarTodasLasSemanasDuplicadas();
          guardarSemanasLocalSilencioso();
        }
      };
    } catch(err) {
      console.warn('Error leyendo IndexedDB:', err);
    }
  };
};
let tasks=[],activeChannel="Todos",selectedProject="Todos",draggedId=null;
let motivationQuote = localStorage.getItem('mindJeanetteMotivationQuote') || '';
if(/[\u3000-\u9fff]/.test(motivationQuote)){
  motivationQuote = '';
  try { localStorage.setItem('mindJeanetteMotivationQuote', motivationQuote); } catch(_) {}
}
let pipelineItems=null;
try {
  pipelineItems=JSON.parse(localStorage.getItem('mindJeanettePipeline')||'null');
} catch(_) {}
if(!pipelineItems){
  pipelineItems=[];
  try { localStorage.setItem('mindJeanettePipeline',JSON.stringify(pipelineItems)); } catch(_) {}
}
/* Limpieza de duplicados accidentales en pipeline (por repetición de clics) */
try {
  if(Array.isArray(pipelineItems)){
    const seenP = new Set();
    const origPLen = pipelineItems.length;
    pipelineItems = pipelineItems.filter(p => {
      if(!p || !p.title) return false;
      const tNorm = p.title.trim();
      const key = `${p.stage}_${tNorm}`;
      if(tNorm === 'Nueva idea' || tNorm === 'Nueva conexión' || tNorm === 'Nueva acción'){
        if(seenP.has(key)) return false;
      }
      seenP.add(key);
      return true;
    });
    if(pipelineItems.length !== origPLen){
      localStorage.setItem('mindJeanettePipeline', JSON.stringify(pipelineItems));
    }
  }
} catch(_) {}
var historyUndoStack = [];
var historyRedoStack = [];
var historyCurrentSnapshot = null;
var isApplyingHistory = false;
var lastCardDragEndTime = 0;

// Bloquear cualquier evento de clic inmediatamente posterior a un movimiento/arrastre
window.addEventListener('click', e => {
  if(Date.now() - lastCardDragEndTime < 450){
    e.stopImmediatePropagation();
    e.preventDefault();
  }
}, true);

function getActiveDrawStorageKey(){
  const wk = (typeof semanaVisible !== 'undefined' && typeof weekKey === 'function') ? weekKey(semanaVisible) : 'default';
  const pr = (typeof selectedProject !== 'undefined' && selectedProject) ? selectedProject : 'NetThinking';
  return `mindJeanetteDrawStrokes_${wk}_${pr}`;
}

function captureBoardSnapshot(){
  try {
    const drawKey = getActiveDrawStorageKey();
    return JSON.stringify({
      weeks,
      pipeline: JSON.stringify(pipelineItems || []),
      motivation: typeof motivationQuote === 'string' ? motivationQuote : (localStorage.getItem('mindJeanetteMotivationQuote') || ''),
      drawKey,
      drawStrokes: localStorage.getItem(drawKey) || '[]'
    });
  } catch(_) {
    return null;
  }
}

function updateHistoryButtons(){
  const undoBtn = document.querySelector('#btnUndo');
  const redoBtn = document.querySelector('#btnRedo');
  const canUndo = historyUndoStack.length > 0;
  const canRedo = historyRedoStack.length > 0;
  if(undoBtn){
    undoBtn.style.opacity = canUndo ? '1' : '0.45';
    undoBtn.removeAttribute('disabled');
  }
  if(redoBtn){
    redoBtn.style.opacity = canRedo ? '1' : '0.45';
    redoBtn.removeAttribute('disabled');
  }
}

function recordHistoryState(){
  if(isApplyingHistory) return;
  const nextSnap = captureBoardSnapshot();
  if(!nextSnap) return;
  if(historyCurrentSnapshot === null){
    historyCurrentSnapshot = nextSnap;
    updateHistoryButtons();
    return;
  }
  if(nextSnap !== historyCurrentSnapshot){
    historyUndoStack.push(historyCurrentSnapshot);
    if(historyUndoStack.length > 15) historyUndoStack.shift();
    historyCurrentSnapshot = nextSnap;
    updateHistoryButtons();
  }
}

function applyBoardSnapshot(snapStr){
  if(!snapStr) return;
  isApplyingHistory = true;
  try {
    const data = JSON.parse(snapStr);
    if(data.weeks && typeof data.weeks === 'object'){
      weeks = data.weeks;
      if(typeof semanaVisible !== 'undefined'){
        tasks = weeks[weekKey(semanaVisible)] || [];
      }
      guardarSemanas();
    }
    if(typeof data.pipeline === 'string'){
      localStorage.setItem('mindJeanettePipeline', data.pipeline);
      try { pipelineItems = JSON.parse(data.pipeline); } catch(_) {}
    }
    if(typeof data.motivation === 'string'){
      motivationQuote = data.motivation;
      if(motivationQuote) localStorage.setItem('mindJeanetteMotivationQuote', motivationQuote);
      else localStorage.removeItem('mindJeanetteMotivationQuote');
    }
    if(data.drawKey && typeof data.drawStrokes === 'string'){
      localStorage.setItem(data.drawKey, data.drawStrokes);
    }
    if(typeof render === 'function') render();
  } catch(err) {
    console.error('Error restaurando historial:', err);
  } finally {
    isApplyingHistory = false;
    updateHistoryButtons();
  }
}

function undoBoardState(){
  if(historyUndoStack.length === 0) return;
  const prevSnap = historyUndoStack.pop();
  if(historyCurrentSnapshot){
    historyRedoStack.push(historyCurrentSnapshot);
    if(historyRedoStack.length > 15) historyRedoStack.shift();
  }
  historyCurrentSnapshot = prevSnap;
  applyBoardSnapshot(prevSnap);
}

function redoBoardState(){
  if(historyRedoStack.length > 0){
    const nextSnap = historyRedoStack.pop();
    if(historyCurrentSnapshot){
      historyUndoStack.push(historyCurrentSnapshot);
      if(historyUndoStack.length > 15) historyUndoStack.shift();
    }
    historyCurrentSnapshot = nextSnap;
    applyBoardSnapshot(nextSnap);
    return true;
  }
  return false;
}

window.undoBoardState = undoBoardState;
window.redoBoardState = redoBoardState;
window.recordHistoryState = recordHistoryState;

function savePipeline(){
  hasUserSavedInSession = true;
  const nowTs = Date.now();
  try {
    localStorage.setItem('mindJeanettePipeline',JSON.stringify(pipelineItems));
    localStorage.setItem('mindJeanetteLastSavedAt', String(nowTs));
  } catch(_) {}
  recordHistoryState();
  if(typeof window.scheduleMindFerCloudSync === 'function'){
    window.scheduleMindFerCloudSync();
  }
}
const board=document.querySelector('#board'),panel=document.querySelector('#detailPanel'),overlay=document.querySelector('#overlay');
let projectStories={"NetThinking":"Prioridades, relaciones e ideas de NetThinking, reunidas en una sola vista.","Personal Branding":"Una semana para hacer visible tu voz, tus ideas y las relaciones que importan.","Branding Corporativo":"Un tablero para cuidar la dirección, la identidad y las conversaciones de marca."};
try{
  const savedStories=JSON.parse(localStorage.getItem('mindJeanetteProjectStories')||'{}');
  Object.assign(projectStories,savedStories);
}catch(_){}
const save=()=>{weeks[weekKey(semanaVisible)]=tasks;guardarSemanas();recordHistoryState()};
const esc=(value='')=>String(value).replace(/[&<>\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
const fileSize=size=>{
  if(!size) return '';
  if(size < 1024) return `${size} B`;
  if(size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};
function openDataOrUrlImmediately(rawSource, fileName = ''){
  if(!rawSource) return;
  if(rawSource.startsWith('data:')){
    try {
      const commaIdx = rawSource.indexOf(',');
      const header = rawSource.slice(0, commaIdx);
      const base64Data = rawSource.slice(commaIdx + 1);
      let mime = (header.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
      const ext = (String(fileName).split('.').pop() || '').toLowerCase();
      if(ext === 'pdf') mime = 'application/pdf';
      else if(['txt','md','csv','vtt','srt'].includes(ext)) mime = 'text/plain;charset=utf-8';
      else if(['jpg','jpeg'].includes(ext)) mime = 'image/jpeg';
      else if(ext === 'png') mime = 'image/png';
      const binStr = atob(base64Data);
      const len = binStr.length;
      const bytes = new Uint8Array(len);
      for(let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return;
    } catch(err) {
      console.error('Error abriendo archivo:', err);
    }
  }
  const targetUrl = (rawSource.startsWith('http://') || rawSource.startsWith('https://') || rawSource.startsWith('blob:')) ? rawSource : `https://${rawSource}`;
  window.open(targetUrl, '_blank', 'noopener,noreferrer');
}
function getFileDocInfo(t){
  const name = String(t.fileName || t.title || 'archivo');
  const ext = (name.split('.').pop() || '').toLowerCase();
  const pdfSwirlSvg = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display:block;fill:#ef4444!important;color:#ef4444!important"><path fill="#ef4444" d="M23.63 15.3c-.71-.745-2.166-1.17-4.224-1.17-1.1 0-2.377.106-3.761.354a19.443 19.443 0 0 1-2.307-2.661c-.532-.71-.994-1.49-1.42-2.236.817-2.484 1.207-4.507 1.207-5.962 0-1.632-.603-3.336-2.342-3.336-.532 0-1.065.32-1.349.781-.78 1.384-.425 4.4.923 7.381a60.277 60.277 0 0 1-1.703 4.507c-.568 1.349-1.207 2.733-1.917 4.01C2.834 18.53.314 20.34.03 21.758c-.106.533.071 1.03.462 1.42.142.107.639.533 1.49.533 2.59 0 5.323-4.188 6.707-6.707 1.065-.355 2.13-.71 3.194-.994a34.963 34.963 0 0 1 3.407-.745c2.732 2.448 5.145 2.839 6.352 2.839 1.49 0 2.023-.604 2.2-1.1.32-.64.106-1.349-.213-1.704zm-1.42 1.03c-.107.532-.64.887-1.384.887-.213 0-.39-.036-.604-.071-1.348-.32-2.626-.994-3.903-2.059a17.717 17.717 0 0 1 2.98-.248c.746 0 1.385.035 1.81.142.497.106 1.278.426 1.1 1.348zm-7.524-1.668a38.01 38.01 0 0 0-2.945.674 39.68 39.68 0 0 0-2.52.745 40.05 40.05 0 0 0 1.207-2.555c.426-.994.78-2.023 1.136-2.981.354.603.745 1.207 1.135 1.739a50.127 50.127 0 0 0 1.987 2.378zM10.038 1.46a.768.768 0 0 1 .674-.425c.745 0 .887.851.887 1.526 0 1.135-.355 2.874-.958 4.861-1.03-2.768-1.1-5.074-.603-5.962zM6.134 17.997c-1.81 2.981-3.549 4.826-4.613 4.826a.872.872 0 0 1-.532-.177c-.213-.213-.32-.461-.249-.745.213-1.065 2.271-2.555 5.394-3.904Z"/></svg>`;
  const textDocSvg = `<svg width="24" height="20" viewBox="0 0 28 22" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block"><text x="1" y="13" fill="#475569" font-family="Georgia, serif" font-weight="700" font-size="14">T</text><rect x="13" y="3" width="13" height="2.4" rx="1.2" fill="#475569"/><rect x="13" y="9.5" width="13" height="2.4" rx="1.2" fill="#475569"/><rect x="2" y="16.5" width="24" height="2.4" rx="1.2" fill="#475569"/></svg>`;
  if(['doc','docx','word'].includes(ext)){
    return { symbol: '<span style="color:#29b6f6!important;font-size:22px;font-weight:800;font-family:\'Montserrat\',sans-serif">W</span>', ext, color: '#29b6f6', label: 'Word' };
  }
  if(['ppt','pptx','powerpoint','key'].includes(ext)){
    return { symbol: '<span style="color:#ea580c!important;font-size:22px;font-weight:800;font-family:\'Montserrat\',sans-serif">P</span>', ext, color: '#ea580c', label: 'PowerPoint' };
  }
  if(['xls','xlsx','csv','excel','numbers'].includes(ext)){
    return { symbol: '<span style="color:#16a34a!important;font-size:22px;font-weight:800;font-family:\'Montserrat\',sans-serif">X</span>', ext, color: '#16a34a', label: 'Excel' };
  }
  if(['pdf'].includes(ext) || t.type === 'pdf'){
    return { symbol: pdfSwirlSvg, ext: 'pdf', color: '#ef4444', label: 'PDF' };
  }
  if(['txt','text','rtf','md'].includes(ext)){
    return { symbol: textDocSvg, ext, color: '#475569', label: 'Texto' };
  }
  if(['zip','rar','7z','tar','gz'].includes(ext)){
    return { symbol: '<span style="color:#d97706!important;font-size:13px;font-weight:800">ZIP</span>', ext, color: '#d97706', label: 'Comprimido' };
  }
  return { symbol: textDocSvg, ext, color: '#475569', label: 'Documento' };
}
function formatPipelineTaskTitle(t){
  if(!t) return 'Registro';

  // 1. Tipo de registro
  let reg = 'Nota';
  if(t.type === 'meeting') reg = 'Reunión';
  else if(t.type === 'location') reg = 'Ubicación';
  else if(t.type === 'file' || t.type === 'document' || t.type === 'pdf') reg = 'Archivo';
  else if(t.type === 'task' || t.type === 'todo-table') reg = 'To-do';
  else if(t.type === 'link') reg = 'Link';
  else if(t.type === 'image') reg = 'Imagen';
  else if(t.type === 'video') reg = 'Video';
  else if(t.type === 'audio' || t.type === 'voice') reg = 'Audio';
  else if(t.type === 'sticker') reg = 'Sticker';
  else if(t.type === 'whiteboard') reg = 'Lienzo';

  // 2. Proyecto
  let proj = t.project && t.project !== 'Todos' ? t.project : (selectedProject !== 'Todos' ? selectedProject : 'Todos los proyectos');

  // 3. Nombre de la persona o archivo
  let name = '';
  if(t.type === 'meeting'){
    name = t.personName || t.person?.name || t.title || 'Reunión';
    if(typeof name === 'string' && name.startsWith('Reunión con ')){
      name = name.replace(/^Reunión con\s*/i, '').trim();
    }
  } else if(t.type === 'location'){
    name = t.title || t.address || 'Ubicación';
  } else if(t.type === 'file' || t.type === 'document' || t.type === 'pdf'){
    name = t.fileName || t.title || 'Documento';
  } else {
    name = t.title || 'Sin título';
  }

  return `${reg} | ${proj} | ${name}`;
}
function getTaskDateFormatted(t){
  if(!t) return '00:00';
  const dayNames = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  let dayIdx = dayNames.indexOf(t.day);
  if(dayIdx === -1) dayIdx = 0;

  const d = new Date(semanaVisible);
  d.setDate(semanaVisible.getDate() + dayIdx);

  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);

  let time = '00:00';
  if(t.time){
    time = t.time;
  } else if(t.schedule){
    const parts = String(t.schedule).split('·');
    const last = parts[parts.length - 1].trim();
    if(/\d{1,2}:\d{2}/.test(last)){
      time = last;
    } else if(/\d{1,2}/.test(last)){
      time = last.padStart(2, '0') + ':00';
    }
  }

  return `${dd}${mm}${yy} | ${time}`;
}
function videoThumbnail(url=''){const match=url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([^?&/]+)/i);return match?`https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`:''}
function asset(t){
 if(t.type==='location')return `<div class="asset-location" style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:#f8fafc;border-radius:8px;margin-bottom:6px"><img src="map-icon.png" style="width:34px;height:34px;object-fit:contain" alt="Mapa"><div><strong style="display:block;font-size:12px;color:#0f172a">${esc(t.title||t.address||'Ubicación')}</strong><span style="font-size:10px;color:#64748b">${esc(t.address||'Ver en mapa')}</span></div></div>`;
 if(t.type==='pdf')return `<div class="asset-file asset-pdf"><b>pdf</b><div><strong>${esc(t.fileName||'Documento.pdf')}</strong><span>${fileSize(t.fileSize)||'PDF adjunto'}</span></div></div>`;
 if(t.type==='file')return `<div class="asset-file"><b>${esc((t.fileName||'archivo').split('.').pop().slice(0,3).toUpperCase())}</b><div><strong>${esc(t.fileName||'Archivo')}</strong><span>${fileSize(t.fileSize)||'Archivo adjunto'}</span></div></div>`;
 if(t.type==='image'){
   let imgSrc = t.image;
   if(typeof imgSrc === 'string' && imgSrc.length > 0 && imgSrc.length < 100){
     imgSrc = '';
   }
   if(!imgSrc){
     imgSrc = (window.MindFerMediaVault && window.MindFerMediaVault[String(t.id)])
       || ((t.day === 'Jueves' || (t.description && /inteligencia de mercado/i.test(t.description))) && window.MindFerMediaVault && window.MindFerMediaVault['agente_ia_banner'])
       || (window.MindFerMediaVault && window.MindFerMediaVault['1793820000002'])
       || '';
     if(imgSrc && imgSrc.length > 100) t.image = imgSrc;
   }
   if(imgSrc){
     const overlayText = getImageOverlayText(t);
     return `
       <div class="image-card-box detail-image-box" style="position:relative;width:100%;border-radius:10px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#0f172a">
         <img class="card-image" src="${imgSrc}" alt="${esc(overlayText||'')}" style="width:100%;height:auto;display:block">
         ${overlayText ? `<div class="image-card-overlay-text"><span>${esc(overlayText)}</span></div>` : ''}
       </div>
     `;
   }
 }
 if(t.type==='video'){
   const thumbnail=videoThumbnail(t.url);
   const ytIconSvg = `<svg viewBox="0 0 24 17" width="15" height="11" style="flex-shrink:0;display:block"><path fill="#FF0000" d="M23.5 2.7a3 3 0 0 0-2.1-2.1C19.5 0 12 0 12 0S4.5 0 2.6.6A3 3 0 0 0 .5 2.7C0 4.6 0 8.5 0 8.5s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8z"/><polygon fill="#FFFFFF" points="9.6,12.2 15.8,8.5 9.6,4.8"/></svg>`;
   const linkIconSvg = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#64748b" stroke-width="2" style="flex-shrink:0;display:block"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
   const centerPlaySvg = `<span class="video-play-circle" title="Reproducir video"><svg viewBox="0 0 24 24" width="18" height="18"><polygon fill="#ffffff" points="8,5 19,12 8,19"/></svg></span>`;
   const vidTitle = (t.title && t.title !== 'Video guardado') ? t.title : (t.url || 'Video');
   return `${thumbnail?`<div class="video-thumb"><img class="card-image" src="${thumbnail}" alt="Vista previa del video" draggable="false">${centerPlaySvg}</div>`:t.media?`<video class="card-video" controls muted preload="metadata" src="${t.media}"></video>`:`<div class="video-placeholder">${centerPlaySvg}</div>`}
   <div class="video-card-body">
     ${t.url?`<div class="media-link" data-url="${esc(t.url)}">${thumbnail?ytIconSvg:linkIconSvg}<span>${esc(t.url)}</span></div>`:''}
     <div class="video-card-title" title="${esc(vidTitle)}">${esc(vidTitle)}</div>
   </div>`;
 }
 if(t.type==='audio')return `<div class="audio-piece"><span>●</span><div><strong>Nota de voz</strong><audio controls src="${t.media||''}"></audio></div></div>`;
 if(t.type==='link')return `<div class="link-piece"><span>${esc(t.icon||'⌘')}</span></div>`;
 if((t.type==='meeting'||t.type==='person')&&t.image)return `<img class="card-image" src="${t.image}" alt="Foto de ${esc(t.personName||t.person?.name||'persona')}">`;
 return '';
}
const resizeHandles=()=>`<span class="resize-handle nw" data-corner="nw" title="Cambiar tamaño"></span><span class="resize-handle ne" data-corner="ne" title="Cambiar tamaño"></span><span class="resize-handle sw" data-corner="sw" title="Cambiar tamaño"></span><span class="resize-handle se" data-corner="se" title="Cambiar tamaño"></span><span class="resize-handle e" data-corner="e" title="Ajustar ancho"></span><span class="resize-handle s" data-corner="s" title="Ajustar alto"></span>`;
function getGridTemplateCols(t){
  const count=t.colCount||(t.colHeaders?t.colHeaders.length:2);
  if(count===1)return '15px 1fr';
  if(count===3){
    const w1=t.colWidths?.[0]||'1.5fr',w2=t.colWidths?.[1]||'1fr',w3=t.colWidths?.[2]||'0.9fr';
    return `15px ${w1} ${w2} ${w3}`;
  }
  const w1=t.colWidths?.[0]||'1.7fr',w2=t.colWidths?.[1]||'1fr';
  return `15px ${w1} ${w2}`;
}
function formatMoneyValue(rawVal, currency = '$') {
  if (rawVal === undefined || rawVal === null) return '';
  const str = String(rawVal).trim();
  if (!str) return '';
  const cleanDigits = str.replace(/[^\d]/g, '');
  if (!cleanDigits) return str;
  const num = parseInt(cleanDigits, 10);
  if (isNaN(num)) return str;
  const formatted = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const cur = currency || '$';
  const prefix = (cur === '$' || cur === '€' || cur === '£') ? cur : (cur + ' ');
  return `${prefix}${formatted}`;
}

function calculateTotal(t){
  if(!t.items||!t.items.length)return '';
  let sum=0,hasNum=false;
  const cur = t.currency || '$';
  for(const item of t.items){
    const last = item.cols?.[item.cols.length-1]||'';
    const cleanDigits = String(last).replace(/[^\d]/g, '');
    if(cleanDigits){
      hasNum = true;
      const n = parseInt(cleanDigits, 10);
      if(!isNaN(n)) sum += n;
    }
  }
  if(!hasNum) return '';
  const formatted = sum.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const prefix = (cur === '$' || cur === '€' || cur === '£') ? cur : (cur + ' ');
  return `${prefix}${formatted}`;
}
function renderTodoTable(t){
  const cols=getGridTemplateCols(t);
  const total=calculateTotal(t);
  const colSpan=t.colSpan||1;
  const headers=t.colHeaders||(t.colCount===1?['Item']:(t.colCount===3?['Item','Cost','Estado']:['Item','Cost']));
  return `<article class="task-card type-todo-table span-${colSpan}" draggable="false" data-id="${t.id}">
    <div class="card-resize-handle" data-card-id="${t.id}" title="Arrastra para ajustar automáticamente a 1, 2 o 3 columnas de días"></div>
    <div class="todo-table-header">
      <div class="todo-table-grip" title="Arrastra para mover o a la papelera">⠿</div>
      <div class="todo-table-title-wrap">
        <h3 class="todo-table-title" contenteditable="true" data-card-id="${t.id}" title="Clic para renombrar">${esc(t.title||'Herramientas')}</h3>
      </div>
      <div class="todo-table-header-actions">
        <div class="todo-table-span-picker" title="Ocupar 1, 2 o 3 días de ancho">
          <button type="button" class="todo-span-btn ${colSpan===1?'active':''}" data-card-id="${t.id}" data-span="1" title="1 día de ancho">1d</button>
          <button type="button" class="todo-span-btn ${colSpan===2?'active':''}" data-card-id="${t.id}" data-span="2" title="2 días de ancho">2d</button>
          <button type="button" class="todo-span-btn ${colSpan===3?'active':''}" data-card-id="${t.id}" data-span="3" title="3 días de ancho">3d</button>
        </div>
        <button type="button" class="todo-table-remove-row" data-card-id="${t.id}" title="Eliminar última fila (-)" aria-label="Eliminar última fila">-</button>
        <button type="button" class="todo-table-add-row" data-card-id="${t.id}" title="Añadir fila (+)" aria-label="Añadir fila">+</button>
      </div>
    </div>
    <div class="todo-table-columns" style="grid-template-columns:${cols};">
      <div class="todo-th col-check"></div>
      ${headers.map((h,i)=>`<div class="todo-th ${i===headers.length-1&&t.showTotal?'col-align-right':''}" contenteditable="true" data-card-id="${t.id}" data-header-idx="${i}" title="Clic para editar cabecera">${esc(h)}</div>`).join('')}
    </div>
    <div class="todo-table-body">
      ${(t.items||[]).map((row,rIdx)=>`
        <div class="todo-table-row ${row.checked?'row-checked':''}" style="grid-template-columns:${cols};" data-row-idx="${rIdx}">
          <div class="todo-td col-check">
            <input type="checkbox" class="todo-table-check" data-card-id="${t.id}" data-row-idx="${rIdx}" ${row.checked?'checked':''} aria-label="Marcar fila">
          </div>
          ${row.cols.map((colVal,cIdx)=>{
            const isCostCol = (cIdx===row.cols.length-1)&&t.showTotal;
            const displayVal = (isCostCol && colVal && /\d/.test(colVal)) ? formatMoneyValue(colVal, t.currency || '$') : colVal;
            return `<div class="todo-td ${isCostCol?'col-align-right':''}" contenteditable="true" data-card-id="${t.id}" data-row-idx="${rIdx}" data-col-idx="${cIdx}">${esc(displayVal)}</div>`;
          }).join('')}
          <button type="button" class="todo-table-del-row" data-card-id="${t.id}" data-row-idx="${rIdx}" title="Borrar fila">×</button>
        </div>
      `).join('')}
    </div>
    ${t.showTotal&&total?`
      <div class="todo-table-footer" style="grid-template-columns:${cols};">
        <div class="todo-td col-check"></div>
        ${headers.map((_,idx)=>`
          <div class="todo-td ${idx===headers.length-1?'col-align-right todo-total-val':''}">${idx===headers.length-1?esc(total):''}</div>
        `).join('')}
      </div>
    `:''}
  </article>`;
}
const targetSvg=`<svg class="target-ico" viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/></svg>`;
const targetSvgSmall=`<svg class="target-ico" viewBox="0 0 24 24" style="width:12px;height:12px"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/></svg>`;
const ideaSvg=`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.4 1 1.1 1 1.8V17h6v-.5c0-.7.4-1.4 1-1.8A7 7 0 0 0 12 2z"/></svg>`;
const ideaSvgSmall=`<svg viewBox="0 0 24 24" style="width:12px;height:12px" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.4 1 1.1 1 1.8V17h6v-.5c0-.7.4-1.4 1-1.8A7 7 0 0 0 12 2z"/></svg>`;
const conexionSvg=`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/></svg>`;
const conexionSvgSmall=`<svg viewBox="0 0 24 24" style="width:12px;height:12px" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/></svg>`;
const linkSvgSmall=`<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;

function getDomainFromUrl(url){
  if(!url) return '';
  let cleanUrl = String(url).replace(/businessrepublicstch\.com/gi, 'businessrepublicmatch.com');
  try {
    const raw = (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) ? cleanUrl : `https://${cleanUrl}`;
    const parsed = new URL(raw);
    return parsed.hostname.replace(/^www\./, '');
  } catch(_) {
    return String(cleanUrl).replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split('?')[0];
  }
}

function getFaviconUrl(url){
  const domain = getDomainFromUrl(url);
  if(!domain || !domain.includes('.')) return '';
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

function renderLinkCard(t){
  const domain = getDomainFromUrl(t.url);
  const favicon = getFaviconUrl(t.url);
  let title = t.title;
  if(!title || title === 'Enlace' || title === 'Link'){
    title = domain ? (domain.charAt(0).toUpperCase() + domain.slice(1)) : (t.title || 'Enlace');
  }
  const subtitle = (t.description && !t.description.includes('guardad')) ? t.description : (domain || '');
  const customStyle = (t.color === 'custom' && t.fill) ? `background:${esc(t.fill)}!important;` : '';

  const neutralSvg = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;

  return `
    <article class="task-card type-link link-bookmark-card" draggable="false" data-id="${t.id}" title="${esc(t.url || title)}" data-url="${esc(t.url || '')}">
      <div class="link-squircle" ${customStyle ? `style="${customStyle}"` : ''}>
        ${favicon ? `
          <img class="link-favicon" src="${favicon}" alt="" loading="lazy" draggable="false" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
          <div class="link-neutral-fallback" style="display:none;">${neutralSvg}</div>
        ` : `
          <div class="link-neutral-fallback" style="display:flex;">${neutralSvg}</div>
        `}
      </div>
      <div class="link-info">
        <strong class="link-title">${esc(title)}</strong>
        ${subtitle ? `<span class="link-subtitle">${esc(subtitle)}</span>` : ''}
      </div>
    </article>
  `;
}

function renderContactCard(t){
  const domain = getDomainFromUrl(t.url);
  const subtitle = t.description ? t.description : (domain || 'Contacto');
  const squircleColor = t.squircleColor || (t.fill || '#c084fc');
  const icon = t.icon || '👤';
  const customStyle = (t.color === 'custom' && t.fill) ? `border-color:${esc(t.fill)}!important;` : '';

  let iconContent = '';
  if(t.image){
    iconContent = `<img src="${t.image}" alt="${esc(t.title)}" loading="lazy">`;
  } else {
    iconContent = `<span>${esc(icon)}</span>`;
  }

  return `
    <article class="task-card type-contact contact-card" draggable="false" data-id="${t.id}" title="${esc(t.title)} · ${esc(t.url || '')}" data-url="${esc(t.url || '')}" style="${customStyle}">
      <div class="contact-squircle" style="background:${esc(squircleColor)};">
        ${iconContent}
      </div>
      <div class="contact-details">
        <strong class="contact-name">${esc(t.title)}</strong>
        <span class="contact-sub">${esc(subtitle)}</span>
      </div>
    </article>
  `;
}

function isRecurringTask(t){
  return false;
}

function taskMatchesDay(t, day){
  if(!t) return false;
  return t.day === day;
}

function isTaskDoneForDay(t, day){
  return Boolean(t && t.done);
}

function isAgentReportTask(t){
  return false;
}

function isObviousFillerDescription(text){
  if(!text) return true;
  const s = String(text).trim();
  if(!s) return true;
  return /^(Pieza guardada en tu bitácora|Elemento guardado en tu bitácora|Elemento guardado en tu agenda|Documento guardado|Sticker decorativo con movimiento libre)\.?$/i.test(s) || /guardad[oa] en tu bitácora/i.test(s);
}

function getImageOverlayText(t){
  if(!t) return '';
  const desc = !isObviousFillerDescription(t.description) ? String(t.description).trim() : '';
  if(desc) return desc;
  const tit = !isObviousFillerDescription(t.title) ? String(t.title).trim() : '';
  if(tit && tit !== 'Imagen' && tit !== 'Foto' && tit !== 'Sin título') return tit;
  return '';
}

function getCompactCardDescription(t){
  if(!t) return '';
  if(t.bajada) return t.bajada;
  const raw = !isObviousFillerDescription(t.description) ? String(t.description).trim() : '';
  return raw;
}

function renderAgentReportSection(t){
  return '';
}

function isProspectingTask(t){
  return false;
}

function renderProspectingSection(t){
  return '';
}

function bindProspectingEvents(t){
  return;
}

function renderAudioCard(t, currentDay = t.day){
  const isDone = isTaskDoneForDay(t, currentDay);
  const displayTitle = t.title || 'Nota de voz';
  const rawDesc = !isObviousFillerDescription(t.description) ? String(t.description || '').trim() : '';
  const sizeText = fileSize(t.fileSize) || (t.media ? '1.0 MB' : '');
  const displayMeta = sizeText ? `Descargar - ${sizeText}` : (rawDesc || 'Audio');
  const stagePill = t.stage ? `<span class="card-stage-pill" title="En flujo: ${t.stage}">${t.stage==='idea'?ideaSvgSmall:t.stage==='conexion'?conexionSvgSmall:targetSvgSmall}</span>` : '';

  const audioDocSvg = `<div class="audio-doc-box">
    <svg width="24" height="28" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block">
      <path d="M3 1C1.9 1 1 1.9 1 3v22c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V7.5L16.5 1H3z" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.6"/>
      <path d="M16 1v6.5h6.5" fill="none" stroke="#cbd5e1" stroke-width="1.6"/>
      <path d="M9 19v-6.5l6-1.5V17" stroke="#2563eb" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="7.2" cy="19" r="1.8" fill="#2563eb"/>
      <circle cx="13.2" cy="17" r="1.8" fill="#2563eb"/>
    </svg>
  </div>`;

  return `<article class="task-card type-audio audio-card-row ${isDone ? 'completed' : ''}" draggable="false" data-id="${t.id}" data-day="${esc(currentDay)}" title="${esc(displayTitle)}">
    ${stagePill}
    ${audioDocSvg}
    <div class="audio-card-info">
      <strong class="audio-card-title">${esc(displayTitle)}</strong>
      <span class="audio-card-meta">${esc(displayMeta)}</span>
    </div>
  </article>`;
}

function renderIconPieceCard(t, currentDay = t.day){
  const isDoc = t.type === 'file' || t.type === 'pdf' || t.type === 'document';
  const stagePill = t.stage ? `<span class="card-stage-pill" title="En flujo: ${t.stage}">${t.stage==='idea'?ideaSvgSmall:t.stage==='conexion'?conexionSvgSmall:targetSvgSmall}</span>` : '';
  const isDone = isTaskDoneForDay(t, currentDay);

  let iconGraphicHtml = '';
  let displayTitle = t.title || 'Elemento';
  let displayMeta = '';

  if(isDoc && Array.isArray(t.files) && t.files.length > 1){
    displayTitle = t.title || `${t.files.length} archivos`;
    const totalBytes = t.files.reduce((a, b) => a + (b.size || 0), 0);
    const rawDesc = !isObviousFillerDescription(t.description) ? String(t.description || '').trim() : '';
    displayMeta = rawDesc || `${t.files.length} archivos · ${fileSize(totalBytes)}`;
    const tooltipText = t.schedule ? `${t.schedule} · ${displayTitle}` : displayTitle;

    const fileIconsHtml = t.files.slice(0, 4).map((fItem, fIdx) => {
      const fInfo = getFileDocInfo({ fileName: fItem.name, ext: fItem.ext });
      return `
        <button type="button" class="btn-open-subfile" data-card-id="${t.id}" data-file-idx="${fIdx}" title="Abrir ${esc(fItem.name)} (${fileSize(fItem.size)})" style="flex:1;min-width:28px;max-width:44px;height:34px;background:#ffffff;border:1px solid #d1d5db;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;padding:2px 1px;box-shadow:0 1px 2px rgba(0,0,0,0.06);transition:all .15s ease">
          <div style="font-size:11px;line-height:1;display:flex;align-items:center;justify-content:center;height:16px">${fInfo.symbol}</div>
          <span style="font-size:8px;font-weight:800;color:${fInfo.color};text-transform:uppercase;line-height:1;margin-top:2px;letter-spacing:-0.2px">${fInfo.ext || 'DOC'}</span>
        </button>
      `;
    }).join('');

    return `<article class="task-card grid-icon-card type-${esc(t.type)} multi-file-card ${isDone ? 'completed' : ''}" draggable="false" data-id="${t.id}" data-day="${esc(currentDay)}" style="padding:6px 4px" title="${esc(tooltipText)}">
      ${stagePill}
      <div class="multi-file-row" style="display:flex;align-items:center;justify-content:center;gap:5px;width:100%;margin-bottom:4px">
        ${fileIconsHtml}
      </div>
      <div class="unified-icon-info" style="width:100%;text-align:center">
        <strong class="unified-icon-title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block">${esc(displayTitle)}</strong>
        <span class="unified-icon-meta" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block">${esc(displayMeta)}</span>
      </div>
    </article>`;
  }

  if(isDoc){
    const info = getFileDocInfo(t);
    displayTitle = t.title || t.fileName || 'Documento';
    const rawDesc = !isObviousFillerDescription(t.description) ? String(t.description || '').trim() : '';
    displayMeta = fileSize(t.fileSize) || rawDesc || info.label;
    iconGraphicHtml = `<div class="unified-squircle-box">${info.symbol}</div>`;
  } else if(t.type === 'location'){
    displayTitle = t.title || t.address || 'Ubicación';
    const rawDesc = !isObviousFillerDescription(t.description) ? String(t.description || '').trim() : '';
    displayMeta = (t.address && t.address !== displayTitle) ? t.address : (rawDesc || 'Ver en mapa');
    iconGraphicHtml = `<div class="unified-squircle-box"><img src="map-icon.png" alt="Ubicación" class="unified-squircle-img" draggable="false"></div>`;
  } else if(t.type === 'link'){
    const domain = getDomainFromUrl(t.url);
    const favicon = getFaviconUrl(t.url);
    if(!displayTitle || displayTitle === 'Enlace' || displayTitle === 'Link'){
      displayTitle = domain ? (domain.charAt(0).toUpperCase() + domain.slice(1)) : (t.title || 'Enlace');
    }
    const rawDesc = !isObviousFillerDescription(t.description) ? String(t.description || '').trim() : '';
    displayMeta = rawDesc || domain || 'Enlace';
    const neutralLinkSvg = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#111111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
    const inner = favicon ? `<img class="unified-squircle-img" src="${favicon}" alt="" loading="lazy" draggable="false" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><span style="display:none;width:22px;height:22px;align-items:center;justify-content:center">${neutralLinkSvg}</span>` : `<span style="display:flex;width:22px;height:22px;align-items:center;justify-content:center">${neutralLinkSvg}</span>`;
    iconGraphicHtml = `<div class="unified-squircle-box">${inner}</div>`;
  }

  const tooltipText = t.schedule ? `${t.schedule} · ${displayTitle}` : displayTitle;

  return `<article class="task-card grid-icon-card type-${esc(t.type)} ${isDone ? 'completed' : ''}" draggable="false" data-id="${t.id}" data-day="${esc(currentDay)}" data-url="${esc(t.url || t.mapUrl || '')}" title="${esc(tooltipText)}">
    ${stagePill}
    ${iconGraphicHtml}
    <div class="unified-icon-info">
      <strong class="unified-icon-title">${esc(displayTitle)}</strong>
      ${displayMeta ? `<span class="unified-icon-meta">${esc(displayMeta)}</span>` : ''}
    </div>
  </article>`;
}

function renderWhiteboard(t, currentDay = t.day){
  const wVal = t.cardWidth ? `${t.cardWidth}px` : '850px';
  const hVal = t.cardHeight ? `${t.cardHeight}px` : '460px';

  // Stickers y piezas que viven DENTRO de este lienzo para que viajen siempre con él:
  const wbStickers = tasks.filter(x => (x.featured || x.type === 'sticker') && x.whiteboardId === t.id && taskMatchesProject(x));
  const stickersHtml = wbStickers.map(s => floatingCard(s, true)).join('');

  return `<article class="task-card type-whiteboard" draggable="false" data-id="${t.id}" data-day="${esc(currentDay)}" style="width:${wVal}!important;height:${hVal}!important;min-height:${hVal}!important;">
    <div class="whiteboard-drag-handle" title="Arrastra para mover o a la papelera"></div>
    <div class="whiteboard-body">
      <div class="whiteboard-stickers-layer">
        ${stickersHtml}
      </div>
    </div>
    <div class="whiteboard-width-grip" title="Arrastra para cambiar el ancho (doble clic para auto)">
      <span class="whiteboard-grip-line-vert"></span>
    </div>
    <div class="whiteboard-height-grip" title="Arrastra para cambiar el alto (doble clic para auto)">
      <span class="whiteboard-grip-line-horiz"></span>
    </div>
  </article>`;
}

function card(t, currentDay = t.day){
  if(t.type==='whiteboard')return renderWhiteboard(t, currentDay);
  if(t.type==='todo-table')return renderTodoTable(t);
  if(t.type==='audio')return renderAudioCard(t, currentDay);
  if(['file','pdf','document','location','link'].includes(t.type)){
    return renderIconPieceCard(t, currentDay);
  }
  const imageOnly=t.type==='image';
  const isMeeting=t.type==='meeting';
  const isPerson=t.type==='person';
  const isExpandable=t.type==='note'||!t.type||isMeeting||isPerson;

  const rawTitle = isMeeting ? (t.personName || t.title) : t.title;
  const cardTitle = String(rawTitle || '').replace(/\r?\n+/g, ' ').trim();
  const rawDesc = getCompactCardDescription(t);
  const cleanDesc = String(rawDesc || '').replace(/\r?\n+/g, ' ').trim();
  const description = cleanDesc ? `<p>${esc(cleanDesc)}</p>` : '';
  const identity = (isPerson && t.person) ? `<div class="identity"><img src="${t.image}" alt=""><div><strong>${esc(t.person.name)} · ${esc(t.person.role)}</strong><span>${esc(t.person.company)} · ${esc(t.person.project)}</span></div></div>` : '';
  const stagePill = t.stage ? `<span class="card-stage-pill" title="En flujo: ${t.stage}">${t.stage==='idea'?ideaSvgSmall:t.stage==='conexion'?conexionSvgSmall:targetSvgSmall}</span>` : '';
  const isDone = isTaskDoneForDay(t, currentDay);
  const customStyle = (t.color==='custom'&&t.fill) ? `background:${esc(t.fill)}!important;color:${esc(t.textColor||'#fff')}!important;` : '';

  if(imageOnly){
    const hStyle=t.cardHeight?`height:${t.cardHeight}px;`:'';
    const imgFit=t.cardHeight?`height:100%!important;object-fit:cover;`:'height:auto;';
    const hasMultiple = Array.isArray(t.images) && t.images.length > 1;
    const curIdx = (hasMultiple && typeof t.currentImageIdx === 'number' && t.currentImageIdx >= 0 && t.currentImageIdx < t.images.length) ? t.currentImageIdx : 0;
    let currentImgSrc = (hasMultiple && t.images[curIdx]) ? t.images[curIdx] : (t.image || '');

    // Blindaje contra strings corruptos o truncados (< 100 caracteres)
    if(typeof currentImgSrc === 'string' && currentImgSrc.length > 0 && currentImgSrc.length < 100){
      currentImgSrc = '';
    }
    if(!currentImgSrc){
      const vImg = (window.MindFerMediaVault && window.MindFerMediaVault[String(t.id)])
        || ((t.day === 'Jueves' || (t.description && /inteligencia de mercado/i.test(t.description))) && window.MindFerMediaVault && window.MindFerMediaVault['agente_ia_banner'])
        || (window.MindFerMediaVault && window.MindFerMediaVault['1793820000002']);
      if(vImg && vImg.length > 100){
        currentImgSrc = vImg;
        t.image = vImg;
      }
    }

    const arrowsHtml = hasMultiple ? `
      <button class="image-nav-btn prev" data-card-id="${t.id}" data-dir="prev" title="Foto anterior" type="button" aria-label="Anterior">‹</button>
      <button class="image-nav-btn next" data-card-id="${t.id}" data-dir="next" title="Foto siguiente" type="button" aria-label="Siguiente">›</button>
      <span class="image-nav-counter">${curIdx + 1}/${t.images.length}</span>
    ` : '';

    const overlayText = getImageOverlayText(t);
    const isCover = !hasMultiple || curIdx === 0;
    const overlayHtml = (overlayText && isCover) ? `<div class="image-card-overlay-text"><span>${esc(overlayText)}</span></div>` : '';

    const imgTag = currentImgSrc
      ? `<img class="card-image" src="${currentImgSrc}" alt="${esc(overlayText || t.title || '')}" style="${imgFit}">`
      : `<div class="card-image-placeholder" style="height:120px;display:flex;align-items:center;justify-content:center;background:#f1f5f9;color:#94a3b8;font-size:11px"><span>Cargando imagen…</span></div>`;
    return `<article class="task-card type-image image-only ${hasMultiple ? 'has-multiple-images' : ''}" draggable="false" data-id="${t.id}" data-day="${esc(currentDay)}" style="${hStyle}">
      <div class="image-card-box" style="${hStyle}">
        ${imgTag}
        ${arrowsHtml}
        ${overlayHtml}
        <div class="image-height-grip" title="Arrastra para cambiar el alto (doble clic para auto)">
          <span class="image-grip-line"></span>
        </div>
      </div>
    </article>`;
  }

  const tooltipText = t.schedule ? `${t.schedule} · ${cardTitle}` : cardTitle;

  if(t.type === 'video'){
    return `<article class="task-card type-video size-${esc(t.size||'wide')} ${isDone?'completed':''}" draggable="false" data-id="${t.id}" data-day="${esc(currentDay)}" title="${esc(tooltipText)}">
      ${asset(t)}
    </article>`;
  }

  return `<article class="task-card color-${esc(t.color||'neutral')} type-${esc(t.type||'note')} size-${esc(t.size||'small')} ${isDone?'completed':''}${isExpandable?' is-desplegable':''}" draggable="false" data-id="${t.id}" data-day="${esc(currentDay)}" title="${esc(tooltipText)}" style="${customStyle}">
    ${asset(t)}<div class="card-copy">${stagePill}<div class="task-top"><h3 style="${customStyle?'color:inherit!important':''}">${esc(cardTitle)}</h3></div>${description}${identity}</div>
  </article>`;
}
function floatingCard(t, inWhiteboard = false){
  const isWb = inWhiteboard || Boolean(t.whiteboardId);
  const w = t.noteWidth ? `${t.noteWidth}px` : '180px';
  const h = t.noteHeight ? `${t.noteHeight}px` : '180px';

  let posStyle = '';
  if(isWb){
    const leftPx = typeof t.wbX === 'number' ? t.wbX : (typeof t.x === 'number' && t.x > 100 ? t.x : 50);
    const topPx = typeof t.wbY === 'number' ? t.wbY : (typeof t.y === 'number' ? t.y : 50);
    posStyle = `left:${leftPx}px;top:${topPx}px;`;
  } else {
    posStyle = `left:${t.x || 40}%;top:${t.y || 100}px;`;
  }

  if(t.type === 'sticker'){
    return `<article class="floating-note floating-sticker ${isWb ? 'in-whiteboard' : ''}" draggable="false" data-id="${t.id}" style="${posStyle}--note-width:${w};--note-height:${h};width:${w}!important;height:${h}!important;">
      ${resizeHandles()}
      <img src="${t.image}" alt="${esc(t.title||'Sticker')}" class="sticker-img" draggable="false">
    </article>`;
  }
  const widths={small:'180px',medium:'280px',large:'420px',banner:'760px'};
  const noteW = t.noteWidth ? `${t.noteWidth}px` : (widths[t.highlightSize] || '280px');
  const noteH = t.noteHeight ? `${t.noteHeight}px` : 'auto';
  const textColor = t.textColor || (t.fill && t.fill.toLowerCase() === '#ffffff' ? '#111111' : '#ffffff');
  return `<article class="floating-note ${isWb ? 'in-whiteboard' : ''}" data-id="${t.id}" style="${posStyle}--note-width:${noteW};--note-height:${noteH};width:${noteW}!important;height:${noteH}!important;background:${esc(t.fill||'#ff3560')};color:${esc(textColor)}!important;font-family:${esc(t.fontStyle||'Manrope, sans-serif')}">
    ${resizeHandles()}
    <div class="floating-note-body">
      <strong class="floating-note-title" style="color:inherit!important">${esc(t.title)}</strong>
      ${t.description?`<p class="floating-note-desc" style="color:inherit!important">${esc(t.description)}</p>`:''}
    </div>
  </article>`;
}

function getDefaultXForDay(day){
  const idx = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].indexOf(day);
  const colIdx = idx === 6 ? 5 : (idx >= 0 ? idx : 0);
  return Math.round((colIdx * (100 / 6) + 3.2) * 10) / 10;
}

function normalizeGridIconTasks(){
  const gridIconTypes = ['file', 'pdf', 'document', 'location', 'link', 'audio'];
  const validDays = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  let changed = false;
  if(!Array.isArray(tasks)) return;
  tasks.forEach(t => {
    if(t && gridIconTypes.includes(t.type)){
      if(t.featured){
        t.featured = false;
        changed = true;
      }
      if(!t.day || !validDays.includes(t.day)){
        const xVal = typeof t.x === 'number' ? t.x : 10;
        const colIdx = Math.min(5, Math.max(0, Math.floor(xVal / (100 / 6))));
        t.day = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][colIdx] || 'Lunes';
        changed = true;
      }
    }
  });
  if(changed){
    weeks[weekKey(semanaVisible)] = tasks;
    guardarSemanas();
  }
}

function clampFloatingNoteToBoard(el, t){
  if(!el || !t || !board || t.whiteboardId) return;
  const boardRect = board.getBoundingClientRect();
  if(!boardRect.width) return;
  const elRect = el.getBoundingClientRect();
  const cardW = elRect.width || 180;
  const cardH = elRect.height || 100;

  const rawLeftPct = typeof t.x === 'number' ? t.x : (parseFloat(el.style.left) || 40);
  const rawTopPx = typeof t.y === 'number' ? t.y : (parseFloat(el.style.top) || 100);

  const minLeftPct = 0.5;
  const maxLeftPct = Math.max(minLeftPct, 99.5 - (cardW / boardRect.width) * 100);
  const clampedLeftPct = Math.round(Math.min(Math.max(isNaN(rawLeftPct) ? 35 : rawLeftPct, minLeftPct), maxLeftPct) * 10) / 10;

  const minTopPx = 20;
  const maxBoardH = Math.max(board.scrollHeight || 700, boardRect.height || 700, (rawTopPx || 0) + cardH + 120);
  const maxTopPx = Math.max(minTopPx, maxBoardH - cardH - 8);
  const clampedTopPx = Math.round(Math.min(Math.max(isNaN(rawTopPx) ? 80 : rawTopPx, minTopPx), maxTopPx));

  el.style.left = `${clampedLeftPct}%`;
  el.style.top = `${clampedTopPx}px`;
  t.x = clampedLeftPct;
  t.y = clampedTopPx;
}

function clampFloatingIconsToDayGrid(){
  document.querySelectorAll('.floating-note').forEach(el => {
    const t = tasks.find(item => item.id === +el.dataset.id);
    if(t && !t.whiteboardId) clampFloatingNoteToBoard(el, t);
  });
}
function parseTimeFromTask(t){
  if(!t) return 9999;
  const raw = ((t.time || '') + ' ' + (t.schedule || '')).trim();
  if(!raw) return 9999;

  // 1. Coincide con HH:MM (ej. 06:40, 10:00, 12:30, 9:15)
  const mColon = raw.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if(mColon){
    return parseInt(mColon[1], 10) * 60 + parseInt(mColon[2], 10);
  }

  // 2. Coincide con formato 12h am/pm (ej. 10am, 2pm, 10:30 pm)
  const mAmpm = raw.match(/\b([1-9]|1[0-2])(?::([0-5]\d))?\s*(am|pm)\b/i);
  if(mAmpm){
    let h = parseInt(mAmpm[1], 10);
    const mins = mAmpm[2] ? parseInt(mAmpm[2], 10) : 0;
    const isPm = mAmpm[3].toLowerCase() === 'pm';
    if(isPm && h < 12) h += 12;
    if(!isPm && h === 12) h = 0;
    return h * 60 + mins;
  }

  // 3. Coincide con hora simple como "12", "10", "9", "18", "12h"
  const mHour = raw.match(/\b([01]?\d|2[0-3])\s*(?:h|hrs|hr|:00)?\b/i);
  if(mHour){
    const h = parseInt(mHour[1], 10);
    if(h >= 0 && h <= 23) return h * 60;
  }

  return 9999;
}
function sortDayTasks(items){
  return items.sort((a, b) => {
    const hasA = typeof a.manualOrder === 'number';
    const hasB = typeof b.manualOrder === 'number';
    if(hasA && hasB && a.manualOrder !== b.manualOrder){
      return a.manualOrder - b.manualOrder;
    }
    if(hasA && !hasB) return -1;
    if(!hasA && hasB) return 1;
    return (a.id || 0) - (b.id || 0);
  });
}
function getDaySectionAtPoint(clientX, clientY){
  if(!board) return null;
  const dayEls = Array.from(board.querySelectorAll('.day-column:not(.weekend-column), .weekend-section'));
  if(!dayEls.length) return null;

  // 1. Coincidencia directa dentro de la columna visible
  for(const el of dayEls){
    const r = el.getBoundingClientRect();
    if(clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom){
      return el;
    }
  }

  // 2. Franja vertical completa (clientX dentro de la columna, a cualquier altura)
  for(const el of dayEls){
    const r = el.getBoundingClientRect();
    if(clientX >= r.left && clientX <= r.right){
      if(el.classList.contains('saturday') && clientY > r.bottom) continue;
      if(el.classList.contains('sunday') && clientY < r.top) continue;
      return el;
    }
  }

  // 3. Columna más cercana por X (cubre gaps entre columnas y márgenes laterales)
  let closestEl = null;
  let minDiff = Infinity;
  for(const el of dayEls){
    const r = el.getBoundingClientRect();
    if(el.classList.contains('saturday') && clientY > r.bottom) continue;
    if(el.classList.contains('sunday') && clientY < r.top) continue;
    const centerX = (r.left + r.right) / 2;
    const diff = Math.abs(clientX - centerX);
    if(diff < minDiff){
      minDiff = diff;
      closestEl = el;
    }
  }
  return closestEl;
}
function getBeforeCardInTaskList(taskListEl, clientY, excludeTaskId){
  if(!taskListEl) return null;
  const cards = Array.from(taskListEl.querySelectorAll('.task-card')).filter(c => +c.dataset.id !== +excludeTaskId && !c.classList.contains('is-dragging-card'));
  for(const cardEl of cards){
    const r = cardEl.getBoundingClientRect();
    if(clientY < r.top + r.height / 2){
      return cardEl;
    }
  }
  return null;
}
function getDaySlotAtPoint(clientX, clientY, draggedTaskId){
  const daySection = getDaySectionAtPoint(clientX, clientY);
  if(!daySection) return null;
  const targetDay = daySection.dataset.day;
  if(!targetDay) return null;
  const taskList = daySection.querySelector('.task-list');
  const beforeCard = getBeforeCardInTaskList(taskList, clientY, draggedTaskId);
  return {
    day: targetDay,
    beforeTaskId: beforeCard ? +beforeCard.dataset.id : null
  };
}
function placeTaskInDayAtSlot(taskId, targetDay, beforeTaskId = null){
  const t = tasks.find(x => x.id === +taskId);
  if(!t || !targetDay) return;
  t.day = targetDay;
  t.featured = false;

  const dayItems = tasks.filter(item => item.id !== t.id && item.day === targetDay && !item.featured);
  sortDayTasks(dayItems);

  if(beforeTaskId !== null && beforeTaskId !== undefined){
    const idx = dayItems.findIndex(item => item.id === +beforeTaskId);
    if(idx >= 0){
      dayItems.splice(idx, 0, t);
    } else {
      dayItems.push(t);
    }
  } else {
    dayItems.push(t);
  }

  dayItems.forEach((item, index) => {
    item.manualOrder = index;
  });
}
let activeSearchQuery = '';
function getTaskSearchableText(t){
  if(!t) return '';
  const todoItemsText = Array.isArray(t.items) ? t.items.map(it => `${it.text || ''} ${it.col2 || ''} ${it.col3 || ''}`).join(' ') : '';
  return [
    t.title,
    t.description,
    t.personName,
    t.personRole,
    t.person?.name,
    t.person?.role,
    t.person?.company,
    t.fileName,
    t.transcriptName,
    t.url,
    t.address,
    t.thoughts,
    t.channel,
    t.project,
    t.day,
    todoItemsText
  ].filter(Boolean).join(' ').toLowerCase();
}
function taskMatchesProject(t){
  if(activeSearchQuery){
    const q = activeSearchQuery.trim().toLowerCase();
    if(q && !getTaskSearchableText(t).includes(q)) return false;
  }
  if(!selectedProject||selectedProject==='Todos'||selectedProject==='Todos los proyectos')return true;
  const p=t.project||(t.person&&t.person.project)||'NetThinking';
  if(p==='Todos'||p==='Todos los proyectos')return true;
  return p===selectedProject;
}
function getDayNumber(dayIndex){const d=new Date(semanaVisible);d.setDate(semanaVisible.getDate()+dayIndex);return d.getDate()}
function dayColumn(day,index){
  const items=tasks.filter(t=>taskMatchesDay(t, day)&&!t.featured&&taskMatchesProject(t));
  sortDayTasks(items);
  const num=getDayNumber(index);
  return `<section class="day-column" data-day="${day}"><div class="day-header"><h2>${day} <span class="day-number">${num}</span></h2></div><div class="task-list">${items.map(t=>card(t, day)).join('')}</div></section>`
}
function weekendColumn(){
  const sabadoTasks=tasks.filter(t=>taskMatchesDay(t, 'Sábado')&&!t.featured&&taskMatchesProject(t));
  sortDayTasks(sabadoTasks);
  const domingoTasks=tasks.filter(t=>taskMatchesDay(t, 'Domingo')&&!t.featured&&taskMatchesProject(t));
  sortDayTasks(domingoTasks);
  const sabadoNum=getDayNumber(5),domingoNum=getDayNumber(6);
  return `<section class="day-column weekend-column"><div class="weekend-section saturday" data-day="Sábado"><div class="day-header"><h2>Sábado <span class="day-number">${sabadoNum}</span></h2></div><div class="task-list">${sabadoTasks.map(t=>card(t, 'Sábado')).join('')}</div></div><div class="weekend-section sunday" data-day="Domingo"><div class="day-header"><h2>Domingo <span class="day-number">${domingoNum}</span></h2></div><div class="task-list">${domingoTasks.map(t=>card(t, 'Domingo')).join('')}</div></div></section>`
}
function syncMultiColumnTodoLayout(){
  if(!board) return;
  const allCols = Array.from(board.querySelectorAll('.day-column:not(.weekend-column), .weekend-section'));
  if(!allCols.length) return;

  board.querySelectorAll('.task-card[data-todo-pushed]').forEach(el => {
    el.style.marginTop = '';
    delete el.dataset.todoPushed;
  });

  const multiTodos = Array.from(board.querySelectorAll('.task-card.type-todo-table.span-2, .task-card.type-todo-table.span-3, .task-card.type-whiteboard'));
  multiTodos.forEach(todoEl => {
    const isWb = todoEl.classList.contains('type-whiteboard');
    const span = isWb ? 6 : (todoEl.classList.contains('span-3') ? 3 : 2);
    const homeCol = todoEl.closest('.day-column:not(.weekend-column), .weekend-section');
    const homeIdx = allCols.indexOf(homeCol);
    if(homeIdx < 0) return;

    const homeCards = Array.from(homeCol.querySelectorAll('.task-list > .task-card'));
    const todoRank = homeCards.indexOf(todoEl);

    // 1. Si en la columna vecina las primeras N tarjetas (arriba del To-Do o Lienzo) bajan un poco más que en la columna del To-Do, bajar para que nunca pise la de arriba
    let todoRect = todoEl.getBoundingClientRect();
    let maxAboveBottom = todoRect.top - 14;
    for(let s = 1; s < span && (homeIdx + s) < allCols.length; s++){
      const neighborCol = allCols[homeIdx + s];
      if(!neighborCol) continue;
      const colRect = neighborCol.getBoundingClientRect();
      if(todoRect.right < colRect.left + 10) continue;
      const neighborCards = Array.from(neighborCol.querySelectorAll('.task-list > .task-card'));
      for(let k = 0; k < Math.min(todoRank, neighborCards.length); k++){
        const nr = neighborCards[k].getBoundingClientRect();
        if(nr.bottom > maxAboveBottom) maxAboveBottom = nr.bottom;
      }
    }
    if(maxAboveBottom + 14 > todoRect.top + 1){
      const extraTop = Math.round(maxAboveBottom + 14 - todoRect.top);
      todoEl.style.marginTop = `${extraTop}px`;
      todoEl.dataset.todoPushed = '1';
      todoRect = todoEl.getBoundingClientRect();
    }

    // 2. Empujar hacia abajo cualquier tarjeta en la columna vecina que quede a la altura del To-Do o Lienzo
    for(let s = 1; s < span && (homeIdx + s) < allCols.length; s++){
      const neighborCol = allCols[homeIdx + s];
      if(!neighborCol) continue;
      const colRect = neighborCol.getBoundingClientRect();
      if(todoRect.right < colRect.left + 10) continue;
      const neighborCards = Array.from(neighborCol.querySelectorAll('.task-list > .task-card'));
      for(let k = 0; k < neighborCards.length; k++){
        const nc = neighborCards[k];
        if(nc === todoEl) continue;
        const nr = nc.getBoundingClientRect();
        const overlaps = (nr.bottom > todoRect.top + 6) && (nr.top < todoRect.bottom - 6);
        if(overlaps && k >= todoRank){
          const pushDown = Math.round(todoRect.bottom + 14 - nr.top);
          if(pushDown > 0){
            nc.style.marginTop = `${pushDown}px`;
            nc.dataset.todoPushed = '1';
          }
          break;
        }
      }
    }
  });
}

function render(){
  normalizeGridIconTasks();

  const freeNotesHtml=tasks.filter(t=>(t.featured || t.type === 'sticker')&&!t.whiteboardId&&taskMatchesProject(t)).map(t => floatingCard(t, false)).join('');
  board.innerHTML=weekdays.map((day,i)=>dayColumn(day,i)).join('')+weekendColumn()+`<div class="free-notes">${freeNotesHtml}</div>`;
  document.querySelector('#projectStory').textContent=projectStories[selectedProject]||`Una vista para avanzar ${selectedProject} con intención.`;
  clampFloatingIconsToDayGrid();
  syncMultiColumnTodoLayout();
  bindCards();
  bindFloatingNotes();
  renderPipeline();
  renderMotivationWidget();
  updateHistoryButtons();
  if(typeof window.redrawMindFerCanvas === 'function') window.redrawMindFerCanvas();
}
function bindResizeHandles(el,t,floating=false){
  el.querySelectorAll('.resize-handle').forEach(handle=>{
    handle.addEventListener('pointerdown',event=>{
      event.preventDefault();
      event.stopPropagation();
      const start={x:event.clientX,y:event.clientY,w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height};
      const corner=handle.dataset.corner;
      handle.setPointerCapture(event.pointerId);
      const move=moveEvent=>{
        const dx=moveEvent.clientX-start.x,dy=moveEvent.clientY-start.y;
        let wChange=0,hChange=0;
        if(corner.includes('e')) wChange=dx;
        if(corner.includes('w')) wChange=-dx;
        if(corner.includes('s')) hChange=dy;
        if(corner.includes('n')) hChange=-dy;
        // Máxima libertad posible: de 60px a 2600px en ancho, y de 40px a 2600px en alto
        const width=Math.max(60,Math.min(2600,start.w+wChange));
        const height=Math.max(40,Math.min(2600,start.h+hChange));
        if(floating){
          t.noteWidth=Math.round(width);
          t.noteHeight=Math.round(height);
          el.style.setProperty('--note-width',`${width}px`);
          el.style.setProperty('--note-height',`${height}px`);
          el.style.width=`${width}px`;
          el.style.height=`${height}px`;
        }else{
          t.cardWidth=Math.round(width);
          t.cardHeight=Math.round(height);
          el.style.setProperty('--card-width',`${width}px`);
          el.style.setProperty('--card-height',`${height}px`);
        }
      };
      const up=()=>{
        handle.removeEventListener('pointermove',move);
        save();
        render();
      };
      handle.addEventListener('pointermove',move);
      handle.addEventListener('pointerup',up,{once:true});
    });
  });
}
function isDropOverTrash(clientX, clientY, draggedEl = null){
  const trash = document.querySelector('#trash');
  if(!trash) return false;
  const tr = trash.getBoundingClientRect();
  // Regla soberana: Únicamente se elimina si el cursor/puntero del usuario está llevado directamente sobre el icono de la papelera
  const pointerHit = (
    typeof clientX === 'number' &&
    typeof clientY === 'number' &&
    clientX >= tr.left - 15 &&
    clientX <= tr.right + 25 &&
    clientY >= tr.top - 15 &&
    clientY <= tr.bottom + 25
  );
  return pointerHit;
}

function deleteTaskImmediately(taskId){
  if(taskId === null || taskId === undefined) return;
  const numId = +taskId;
  const strId = String(taskId);

  // 1. Registrar lápida (tombstone) permanente para impedir cualquier resurrección
  try {
    const tombstones = JSON.parse(localStorage.getItem('mindJeanetteTombstones') || '[]');
    if(!tombstones.includes(strId)) tombstones.push(strId);
    if(numId && !tombstones.includes(String(numId))) tombstones.push(String(numId));
    localStorage.setItem('mindJeanetteTombstones', JSON.stringify(tombstones));
  } catch(_) {}

  const target = tasks.find(x => x && (x.id === numId || x.id === taskId || String(x.id) === strId));
  if(target && target.type === 'todo-table'){
    try { localStorage.setItem('mindJeanetteTodoTableDeleted_' + weekKey(semanaVisible), 'true'); } catch(_) {}
  }
  if(target && target.automationRegistroId){
    try { localStorage.setItem('mindJeanetteAutoDismissed_' + target.automationRegistroId, '1'); } catch(_) {}
  }
  try { localStorage.setItem('mindJeanetteTaskDeleted_' + weekKey(semanaVisible) + '_' + taskId, 'true'); } catch(_) {}
  removeRecurringTask(numId);

  // 2. Eliminar de tasks activas y de todas las semanas
  tasks = tasks.filter(item => item && item.id !== numId && item.id !== taskId && String(item.id) !== strId);
  if(weeks && typeof weeks === 'object'){
    Object.keys(weeks).forEach(wk => {
      if(Array.isArray(weeks[wk])){
        weeks[wk] = weeks[wk].filter(item => item && item.id !== numId && item.id !== taskId && String(item.id) !== strId);
      }
    });
  }

  // 3. Eliminar de Trello / pipeline inferior
  if(Array.isArray(pipelineItems)){
    const prevLen = pipelineItems.length;
    pipelineItems = pipelineItems.filter(p => p && p.taskId !== numId && p.taskId !== taskId && String(p.taskId) !== strId && p.id !== 'p_' + taskId && p.id !== 'p_' + strId);
    if(pipelineItems.length !== prevLen){
      savePipeline();
    }
  }

  if(selectedCardId === numId || selectedCardId === taskId || String(selectedCardId) === strId){
    selectedCardId = null;
  }
  if(currentDetailTaskId === numId || currentDetailTaskId === taskId || String(currentDetailTaskId) === strId){
    currentDetailTaskId = null;
  }

  save();
  render();
}

function bindCards(){
  document.querySelectorAll('.task-card').forEach(el=>{
    const t=tasks.find(item=>item.id===+el.dataset.id);
    let touchStart=null, moved=false, dragRaf=null, lastTapTime=0;

    // Desactivar arrastre fantasma estático de HTML5 para mover la tarjeta directamente con el cursor
    el.addEventListener('dragstart', event => {
      event.preventDefault();
    });

    el.addEventListener('pointerdown',event=>{
      if(event.button !== undefined && event.button !== 0) return;
      if(event.target.closest('.check,.todo-table-check,.todo-table-add-row,.todo-table-remove-row,.todo-table-del-row,.todo-span-btn,.todo-table-ratio-btn,.card-resize-handle,.resize-handle,.whiteboard-width-grip,.whiteboard-height-grip,.floating-note,.image-nav-btn,input,textarea,select')) return;
      if(t && t.type === 'whiteboard' && !event.target.closest('.whiteboard-drag-handle')){
        selectedCardId = t.id;
        document.querySelectorAll('.task-card.is-selected, .floating-note.is-selected').forEach(c => c.classList.remove('is-selected'));
        el.classList.add('is-selected');
        return;
      }
      const editableEl = event.target.closest('[contenteditable="true"]');
      if(editableEl && document.activeElement === editableEl) return;

      touchStart={
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        pointerId: event.pointerId
      };
      moved=false;

      window.addEventListener('pointermove', onWindowCardMove, { passive: false });
      window.addEventListener('pointerup', onWindowCardUp, { once: true });
      window.addEventListener('pointercancel', cancelCardDrag, { once: true });
    });

    const onWindowCardMove = event => {
      if(!touchStart) return;
      if(event.pointerType==='mouse' && event.buttons === 0){
        onWindowCardUp(event);
        return;
      }
      touchStart.lastX = event.clientX;
      touchStart.lastY = event.clientY;
      const dx=event.clientX-touchStart.startX, dy=event.clientY-touchStart.startY;
      if(!moved && (Math.abs(dx)>3 || Math.abs(dy)>3)){
        moved=true;
        try {
          if(document.activeElement && document.activeElement.isContentEditable){
            document.activeElement.blur();
          }
          window.getSelection()?.removeAllRanges();
        } catch(_) {}
        el.classList.add('is-dragging-card');
        el.style.zIndex='99999';
        el.style.boxShadow='0 14px 34px rgba(15, 23, 42, 0.22)';
        el.style.transition='none';
        el.style.cursor='grabbing';
      }

      if(moved){
        el.style.transform=`translate3d(${dx}px,${dy}px,0) scale(1.02)`;

        if(!dragRaf){
          dragRaf = requestAnimationFrame(() => {
            dragRaf = null;
            if(!touchStart || !moved) return;
            const trash = document.querySelector('#trash');
            const isOverTrash = isDropOverTrash(touchStart.lastX, touchStart.lastY, el);
            if (trash) {
              trash.classList.toggle('drag-over', isOverTrash);
            }
          });
        }
      }
    };

    const cancelCardDrag = () => {
      window.removeEventListener('pointermove', onWindowCardMove);
      window.removeEventListener('pointerup', onWindowCardUp);
      window.removeEventListener('pointercancel', cancelCardDrag);

      if(dragRaf) { cancelAnimationFrame(dragRaf); dragRaf = null; }
      el.classList.remove('is-dragging-card');
      el.style.transform='';
      el.style.zIndex='';
      el.style.boxShadow='';
      el.style.transition='';
      el.style.cursor='';
      const allCols = board ? board.querySelectorAll('.day-column.drag-over, .weekend-section.drag-over') : [];
      allCols.forEach(col => col.classList.remove('drag-over'));
      const trash = document.querySelector('#trash');
      if (trash) trash.classList.remove('drag-over');
      touchStart=null;
    };

    const onWindowCardUp = event => {
      if(!touchStart) return;
      const clientX = (typeof event?.clientX === 'number' && event.clientX !== 0) ? event.clientX : touchStart.lastX;
      const clientY = (typeof event?.clientY === 'number' && event.clientY !== 0) ? event.clientY : touchStart.lastY;
      const wasMoved = moved;

      // 1. Detectar destino ANTES de resetear estilos visuales
      const trash = document.querySelector('#trash');
      const droppedOnTrash = Boolean(
        t && wasMoved && (
          (trash && trash.classList.contains('drag-over')) ||
          isDropOverTrash(clientX, clientY, el)
        )
      );

      const slot = (wasMoved && !droppedOnTrash && t) ? getDaySlotAtPoint(clientX, clientY, t.id) : null;

      // 2. Limpiar visuales de arrastre
      cancelCardDrag();

      if(!wasMoved){
        const now = Date.now();
        if(now - lastTapTime < 380){
          lastTapTime = 0;
          el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
        } else {
          lastTapTime = now;
        }
        return;
      }

      lastCardDragEndTime = Date.now();
      el.dataset.justMoved = 'true';
      setTimeout(() => delete el.dataset.justMoved, 450);

      // 3. Drop en papelera: eliminación inmediata al primer intento
      if (droppedOnTrash && t) {
        deleteTaskImmediately(t.id);
        return;
      }

      // 4. Drop en día / ranura
      if(t && slot && slot.day){
        if(event?.altKey){
          const clone = duplicateTask(t.id, slot.day);
          if(clone && slot.beforeTaskId){
            placeTaskInDayAtSlot(clone.id, slot.day, slot.beforeTaskId);
          }
        } else {
          placeTaskInDayAtSlot(t.id, slot.day, slot.beforeTaskId);
        }
        save();
        render();
      }
    };
    el.querySelectorAll('.btn-open-subfile').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        const cardId = Number(btn.dataset.cardId);
        const fIdx = parseInt(btn.dataset.fileIdx, 10);
        const taskItem = tasks.find(x => x.id === cardId);
        if(taskItem && Array.isArray(taskItem.files) && taskItem.files[fIdx]){
          const fItem = taskItem.files[fIdx];
          if(fItem.data || fItem.url){
            openDataOrUrlImmediately(fItem.data || fItem.url, fItem.name || 'archivo');
          }
        }
      });
    });

    el.addEventListener('dblclick',e=>{
      if(e.target.closest('.check,.todo-table-check,.todo-td,.todo-th,.todo-table-add-row,.todo-table-remove-row,.todo-table-del-row,.todo-span-btn,.todo-table-ratio-btn,.card-resize-handle,.whiteboard-width-grip,.whiteboard-height-grip,.image-nav-btn,.btn-open-subfile'))return;
      e.stopPropagation();

      // 1. Videos: 2 clics abre el video en nueva pestaña sin tocar ni redirigir MindFer
      if(t && t.type === 'video' && t.url){
        const a = document.createElement('a');
        a.href = t.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      // 2. Links: 2 clics abre el enlace web en nueva pestaña sin tocar ni redirigir MindFer
      if(t && t.type === 'link' && t.url){
        const targetUrl = (t.url.startsWith('http://') || t.url.startsWith('https://')) ? t.url : `https://${t.url}`;
        const a = document.createElement('a');
        a.href = targetUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      // 3. Archivos (PDF, docs): 2 clics abre panel lateral si tiene varios archivos, o abre/descarga si es 1
      if(t && (t.type === 'file' || t.type === 'document' || t.type === 'pdf')){
        if(Array.isArray(t.files) && t.files.length > 1){
          openDetail(t.id);
          return;
        }
        if(t.fileData || t.media || t.url){
          openDataOrUrlImmediately(t.fileData || t.media || t.url, t.fileName || t.title || 'archivo');
        }
        return;
      }

      // 4. Ubicación: 2 clics abre en Google Maps
      if(t && t.type === 'location'){
        const url = t.mapUrl || t.url || (t.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.address)}` : '');
        if(url){
          try { window.open(url, '_blank', 'noopener,noreferrer'); } catch(_) {}
        }
        return;
      }

      // 5. Voz / Audio: 2 clics reproduce audio
      if(t && t.type === 'audio' && t.media){
        let player = document.querySelector('#globalAudioPlayer');
        if(!player){
          player = document.createElement('audio');
          player.id = 'globalAudioPlayer';
          player.style.display = 'none';
          document.body.appendChild(player);
        }
        if(player.src === t.media && !player.paused){
          player.pause();
        } else {
          player.src = t.media;
          player.play();
        }
        return;
      }

      // 6. Vista lateral con 2 clics: Nota, To-do, Imagen, Reunión
      if(t && (t.type === 'note' || t.type === 'todo-table' || t.type === 'image' || t.type === 'meeting' || !t.type)){
        openDetail(+el.dataset.id, true);
      }
    });

    el.addEventListener('click',e=>{
      // 1 solo clic nunca abre videos, links, archivos ni notas.
      // 1 solo clic es exclusivamente para seleccionar o iniciar el arrastre/movimiento.
      if(Date.now() - lastCardDragEndTime < 450 || el.dataset.justMoved) return;
      selectedCardId = t ? t.id : null;
      document.querySelectorAll('.task-card.is-selected').forEach(c => c.classList.remove('is-selected'));
      el.classList.add('is-selected');
    });

    const linkDelBtn = el.querySelector('.link-del-btn');
    if(linkDelBtn){
      linkDelBtn.addEventListener('click', e => {
        e.stopPropagation();
        deleteTaskImmediately(t.id);
      });
    }

    el.querySelectorAll('.note-stage-opt').forEach(opt=>{
      opt.addEventListener('click',e=>{
        e.stopPropagation();
        const stage=opt.dataset.setStage;
        t.stage = (t.stage === stage) ? null : stage;
        save();
        if(!pipelineItems) pipelineItems = [];
        const pIdx=pipelineItems.findIndex(p=>p.taskId===t.id||p.id==='p_'+t.id);
        if(t.stage){
          const formattedTitle = formatPipelineTaskTitle(t);
          if(pIdx>=0){
            pipelineItems[pIdx].stage=t.stage;
            pipelineItems[pIdx].title=formattedTitle;
            pipelineItems[pIdx].taskId=t.id;
          }else{
            pipelineItems.push({id:'p_'+t.id,taskId:t.id,title:formattedTitle,stage:t.stage});
          }
        }else{
          if(pIdx>=0) pipelineItems.splice(pIdx,1);
        }
        savePipeline();
        render();
      });
    });
    const check=el.querySelector('.check');
    if(check)check.addEventListener('change',e=>{
      t.done = e.target.checked;
      t.status = e.target.checked ? 'completada' : 'pendiente';
      save();
      render();
    });

    el.querySelectorAll('.image-height-grip').forEach(grip=>{
      grip.addEventListener('pointerdown',e=>{
        e.preventDefault();
        e.stopPropagation();
        const cardEl=grip.closest('.task-card');
        const boxEl=grip.closest('.image-card-box');
        const imgEl=boxEl?.querySelector('.card-image');
        const startY=e.clientY;
        const startH=cardEl.getBoundingClientRect().height;
        grip.setPointerCapture(e.pointerId);

        const onMove=me=>{
          const dy=me.clientY-startY;
          const newH=Math.max(60,Math.min(1400,Math.round(startH+dy)));
          t.cardHeight=newH;
          cardEl.style.height=`${newH}px`;
          if(boxEl)boxEl.style.height=`${newH}px`;
          if(imgEl){
            imgEl.style.height='100%';
            imgEl.style.objectFit='cover';
          }
        };
        const onUp=()=>{
          grip.removeEventListener('pointermove',onMove);
          save();
          render();
        };
        grip.addEventListener('pointermove',onMove);
        grip.addEventListener('pointerup',onUp,{once:true});
      });

      grip.addEventListener('dblclick',e=>{
        e.stopPropagation();
        delete t.cardHeight;
        save();
        render();
      });
    });

    el.querySelectorAll('.whiteboard-width-grip').forEach(grip=>{
      grip.addEventListener('pointerdown',e=>{
        e.preventDefault();
        e.stopPropagation();
        const cardEl=grip.closest('.task-card');
        const startX=e.clientX;
        const startW=cardEl.getBoundingClientRect().width;
        grip.setPointerCapture(e.pointerId);

        const onMove=me=>{
          const dx=me.clientX-startX;
          const boardEl=document.querySelector('#board');
          const maxW=boardEl?Math.round(boardEl.getBoundingClientRect().width-32):2400;
          const newW=Math.max(180,Math.min(maxW,Math.round(startW+dx)));
          t.cardWidth=newW;
          cardEl.style.setProperty('width',`${newW}px`,'important');
          syncMultiColumnTodoLayout();
        };
        const onUp=()=>{
          grip.removeEventListener('pointermove',onMove);
          save();
          render();
        };
        grip.addEventListener('pointermove',onMove);
        grip.addEventListener('pointerup',onUp,{once:true});
      });

      grip.addEventListener('dblclick',e=>{
        e.stopPropagation();
        delete t.cardWidth;
        save();
        render();
      });
    });

    el.querySelectorAll('.whiteboard-height-grip').forEach(grip=>{
      grip.addEventListener('pointerdown',e=>{
        e.preventDefault();
        e.stopPropagation();
        const cardEl=grip.closest('.task-card');
        const startY=e.clientY;
        const startH=cardEl.getBoundingClientRect().height;
        grip.setPointerCapture(e.pointerId);

        const onMove=me=>{
          const dy=me.clientY-startY;
          const newH=Math.max(150,Math.min(2500,Math.round(startH+dy)));
          t.cardHeight=newH;
          cardEl.style.setProperty('height',`${newH}px`,'important');
          cardEl.style.setProperty('min-height',`${newH}px`,'important');
          syncMultiColumnTodoLayout();
        };
        const onUp=()=>{
          grip.removeEventListener('pointermove',onMove);
          save();
          render();
        };
        grip.addEventListener('pointermove',onMove);
        grip.addEventListener('pointerup',onUp,{once:true});
      });

      grip.addEventListener('dblclick',e=>{
        e.stopPropagation();
        delete t.cardHeight;
        save();
        render();
      });
    });

    el.querySelectorAll('.whiteboard-title[contenteditable="true"]').forEach(titleEl=>{
      titleEl.addEventListener('blur',()=>{
        const newTitle=titleEl.textContent.trim();
        if(newTitle && newTitle !== t.title){
          t.title=newTitle;
          save();
        }
      });
      titleEl.addEventListener('keydown',e=>{
        if(e.key==='Enter'){
          e.preventDefault();
          titleEl.blur();
        }
      });
    });
  });

  document.querySelectorAll('.todo-table-check').forEach(cb=>{
    cb.addEventListener('change',e=>{
      e.stopPropagation();
      const cardId=+cb.dataset.cardId,rIdx=+cb.dataset.rowIdx;
      const t=tasks.find(x=>x.id===cardId);
      if(t&&t.items&&t.items[rIdx]){
        t.items[rIdx].checked=cb.checked;
        save();
        render();
      }
    });
  });

  document.querySelectorAll('.todo-table-add-row').forEach(btn=>{
    btn.addEventListener('click',e=>{
      e.stopPropagation();
      const cardId=+btn.dataset.cardId;
      const t=tasks.find(x=>x.id===cardId);
      if(t&&t.items){
        t.items.push({id:Date.now(),checked:false,cols:new Array(t.colCount||2).fill('')});
        save();
        render();
      }
    });
  });

  document.querySelectorAll('.todo-table-remove-row').forEach(btn=>{
    btn.addEventListener('click',e=>{
      e.stopPropagation();
      const cardId=+btn.dataset.cardId;
      const t=tasks.find(x=>x.id===cardId);
      if(t&&t.items&&t.items.length>1){
        t.items.pop();
        save();
        render();
      }
    });
  });

  document.querySelectorAll('.todo-table-del-row').forEach(btn=>{
    btn.addEventListener('click',e=>{
      e.stopPropagation();
      const cardId=+btn.dataset.cardId, rIdx=+btn.dataset.rowIdx;
      const t=tasks.find(x=>x.id===cardId);
      if(t&&t.items&&t.items.length>1){
        t.items.splice(rIdx, 1);
        save();
        render();
      }
    });
  });

  document.querySelectorAll('.todo-span-btn').forEach(btn=>{
    btn.addEventListener('click',e=>{
      e.stopPropagation();
      const cardId=+btn.dataset.cardId, span=+btn.dataset.span;
      const t=tasks.find(x=>x.id===cardId);
      if(t){
        t.colSpan=span;
        delete t.cardWidth;
        save();
        render();
      }
    });
  });

  document.querySelectorAll('.todo-table-ratio-btn').forEach(btn=>{
    btn.addEventListener('click',e=>{
      e.stopPropagation();
      const cardId=+btn.dataset.cardId;
      const t=tasks.find(x=>x.id===cardId);
      if(!t)return;
      if(t.colCount===2){
        const presets=['1.6fr 1fr','1fr 1fr','2.3fr 1fr','1fr 1.6fr'];
        const current=(t.colWidths||[]).join(' ');
        const nextIdx=(presets.indexOf(current)+1)%presets.length;
        t.colWidths=presets[nextIdx].split(' ');
      }else if(t.colCount===3){
        const presets=['1.4fr 1fr 0.9fr','1fr 1fr 1fr','2fr 1fr 1fr','1fr 1.5fr 1fr'];
        const current=(t.colWidths||[]).join(' ');
        const nextIdx=(presets.indexOf(current)+1)%presets.length;
        t.colWidths=presets[nextIdx].split(' ');
      }
      save();
      render();
    });
  });

  document.querySelectorAll('.todo-td[contenteditable="true"]').forEach(cell=>{
    cell.addEventListener('keydown',e=>{
      if(e.key==='Enter'){
        e.preventDefault();
        cell.blur();
      }
    });
    cell.addEventListener('input',()=>{
      const cardId=+cell.dataset.cardId,rIdx=+cell.dataset.rowIdx,cIdx=+cell.dataset.colIdx;
      const t=tasks.find(x=>x.id===cardId);
      if(t&&t.items&&t.items[rIdx]){
        t.items[rIdx].cols[cIdx]=cell.textContent.trim();
        weeks[weekKey(semanaVisible)]=tasks;
        guardarSemanas();
        const totalEl=cell.closest('.type-todo-table')?.querySelector('.todo-total-val');
        if(totalEl)totalEl.textContent=calculateTotal(t);
      }
    });
    cell.addEventListener('blur',()=>{
      const cardId=+cell.dataset.cardId,rIdx=+cell.dataset.rowIdx,cIdx=+cell.dataset.colIdx;
      const t=tasks.find(x=>x.id===cardId);
      if(t&&t.items&&t.items[rIdx]){
        let val = cell.textContent.trim();
        const isCostCol = (cIdx === t.items[rIdx].cols.length - 1) && (t.showTotal !== false);
        if(isCostCol && /\d/.test(val)){
          val = formatMoneyValue(val, t.currency || '$');
          cell.textContent = val;
        }
        t.items[rIdx].cols[cIdx]=val;
        save();
        const totalEl=cell.closest('.type-todo-table')?.querySelector('.todo-total-val');
        if(totalEl)totalEl.textContent=calculateTotal(t);
      }
    });
  });

  document.querySelectorAll('.todo-th[contenteditable="true"]').forEach(th=>{
    th.addEventListener('keydown',e=>{
      if(e.key==='Enter'){
        e.preventDefault();
        th.blur();
      }
    });
    th.addEventListener('input',()=>{
      const cardId=+th.dataset.cardId,hIdx=+th.dataset.headerIdx;
      const t=tasks.find(x=>x.id===cardId);
      if(t&&t.colHeaders&&t.colHeaders[hIdx]!==undefined){
        t.colHeaders[hIdx]=th.textContent.trim();
        weeks[weekKey(semanaVisible)]=tasks;
        guardarSemanas();
      }
    });
    th.addEventListener('blur',()=>{
      const cardId=+th.dataset.cardId,hIdx=+th.dataset.headerIdx;
      const t=tasks.find(x=>x.id===cardId);
      if(t&&t.colHeaders&&t.colHeaders[hIdx]!==undefined){
        t.colHeaders[hIdx]=th.textContent.trim();
        save();
      }
    });
  });

  document.querySelectorAll('.todo-table-title[contenteditable="true"]').forEach(titleEl=>{
    titleEl.addEventListener('keydown',e=>{
      if(e.key==='Enter'){
        e.preventDefault();
        titleEl.blur();
      }
    });
    titleEl.addEventListener('input',()=>{
      const cardId=+titleEl.dataset.cardId;
      const t=tasks.find(x=>x.id===cardId);
      if(t){
        t.title=titleEl.textContent.trim()||'Lista de tareas';
        weeks[weekKey(semanaVisible)]=tasks;
        guardarSemanas();
      }
    });
    titleEl.addEventListener('blur',()=>{
      const cardId=+titleEl.dataset.cardId;
      const t=tasks.find(x=>x.id===cardId);
      if(t){
        t.title=titleEl.textContent.trim()||'Lista de tareas';
        save();
      }
    });
  });

  document.querySelectorAll('.card-resize-handle').forEach(handle=>{
    handle.addEventListener('pointerdown',e=>{
      e.preventDefault();
      e.stopPropagation();
      const cardId=+handle.dataset.cardId;
      const t=tasks.find(x=>x.id===cardId);
      const cardEl=handle.closest('.task-card');
      const dayCol=cardEl?.closest('.day-column');
      if(!cardEl||!t||!dayCol)return;
      const colW=dayCol.getBoundingClientRect().width;
      const startX=e.clientX,startW=cardEl.getBoundingClientRect().width;
      handle.setPointerCapture(e.pointerId);
      const move=me=>{
        const curW=Math.max(140,startW+(me.clientX-startX));
        cardEl.style.width=`${curW}px`;
      };
      const up=me=>{
        handle.removeEventListener('pointermove',move);
        const finalW=startW+(me.clientX-startX);
        let span=1;
        if(finalW > colW * 2.2) span=3;
        else if(finalW > colW * 1.35) span=2;
        else span=1;
        t.colSpan=span;
        delete t.cardWidth;
        cardEl.style.width='';
        save();
        render();
      };
      handle.addEventListener('pointermove',move);
      handle.addEventListener('pointerup',up,{once:true});
    });
  });

  document.querySelectorAll('[data-day]').forEach(el=>{
    el.addEventListener('dragover',e=>{
      e.preventDefault();
      el.classList.add('drag-over');
    });
    el.addEventListener('dragleave',e=>{
      if(!el.contains(e.relatedTarget)){
        el.classList.remove('drag-over');
      }
    });
    el.addEventListener('drop',e=>{
      e.preventDefault();
      el.classList.remove('drag-over');
      if(draggedId){
        const slot = getDaySlotAtPoint(e.clientX, e.clientY, draggedId);
        placeTaskInDayAtSlot(draggedId, slot?.day || el.dataset.day, slot ? slot.beforeTaskId : null);
        save();
        render();
      }
    });
  });

  const trashEl = document.querySelector('#trash');
  if(trashEl && !trashEl.dataset.dndBound){
    trashEl.dataset.dndBound = 'true';
    trashEl.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      trashEl.classList.add('drag-over');
    });
    trashEl.addEventListener('dragleave', () => {
      trashEl.classList.remove('drag-over');
    });
    trashEl.addEventListener('drop', e => {
      e.preventDefault();
      trashEl.classList.remove('drag-over');

      if(draggedPipelineId){
        const pipeId = draggedPipelineId;
        draggedPipelineId = null;
        if(pipelineItems){
          const idx = pipelineItems.findIndex(p => p.id === pipeId);
          if(idx >= 0){
            const item = pipelineItems[idx];
            if(item.taskId){
              const t = tasks.find(x => x.id === item.taskId);
              if(t) t.stage = null;
              save();
            }
            pipelineItems.splice(idx, 1);
            savePipeline();
            render();
          }
        }
        return;
      }

      const targetId = draggedId;
      if(targetId !== null && targetId !== undefined){
        const target = tasks.find(x => x.id === +targetId || x.id === targetId);
        if(target && target.type === 'todo-table'){
          try{ localStorage.setItem('mindJeanetteTodoTableDeleted_' + weekKey(semanaVisible), 'true'); }catch(_){}
        }
        try{ localStorage.setItem('mindJeanetteTaskDeleted_' + weekKey(semanaVisible) + '_' + targetId, 'true'); }catch(_){}
        removeRecurringTask(+targetId);
        tasks = tasks.filter(x => x.id !== +targetId && x.id !== targetId);
        if(pipelineItems){
          pipelineItems = pipelineItems.filter(p => p.taskId !== +targetId && p.taskId !== targetId && p.id !== 'p_' + targetId);
          savePipeline();
        }
        draggedId = null;
        save();
        render();
      }
    });
  }

  document.querySelectorAll('.image-nav-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      const cardId = +btn.dataset.cardId;
      const dir = btn.dataset.dir;
      const task = tasks.find(x => x.id === cardId);
      if(!task || !Array.isArray(task.images) || task.images.length <= 1) return;
      const cur = typeof task.currentImageIdx === 'number' ? task.currentImageIdx : 0;
      if(dir === 'next'){
        task.currentImageIdx = (cur + 1) % task.images.length;
      } else {
        task.currentImageIdx = (cur - 1 + task.images.length) % task.images.length;
      }
      task.image = task.images[task.currentImageIdx];
      save();
      render();
    });
    btn.addEventListener('pointerdown', e => {
      e.stopPropagation();
    });
  });
}
function bindFloatingNotes(){
  document.querySelectorAll('.floating-note').forEach(el=>{
    let start = null;
    const t = tasks.find(item => item.id === +el.dataset.id);
    if (!t) return;

    el.addEventListener('dblclick', event => {
      event.stopPropagation();
      // Destacada y Stickers no abren vista lateral
      if (t.type === 'sticker' || t.type === 'idea' || t.featured) return;
      if (t.type === 'location') {
        const url = t.mapUrl || t.url || (t.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.address)}` : '');
        if(url){
          try { window.open(url, '_blank'); } catch(_) {}
        }
        return;
      }
      if (t.type === 'file' || t.type === 'document' || t.type === 'pdf') {
        if(t.fileData || t.media || t.url){
          openDataOrUrlImmediately(t.fileData || t.media || t.url, t.fileName || t.title || 'archivo');
        }
        return;
      }
      if (t.type === 'link' && t.url) {
        const targetUrl = (t.url.startsWith('http://') || t.url.startsWith('https://')) ? t.url : `https://${t.url}`;
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
        return;
      }
    });

    el.querySelector('.floating-edit')?.addEventListener('click', event => {
      event.stopPropagation();
      openDetail(t.id, true);
    });

    el.querySelector('.floating-del')?.addEventListener('click', event => {
      event.stopPropagation();
      deleteTaskImmediately(t.id);
    });

    el.addEventListener('dragstart', e => e.preventDefault());

    const onPointerMove = e => {
      if(!start) return;
      if(e.pointerType === 'mouse' && e.buttons === 0){
        finishFloatingDrag(e);
        return;
      }
      start.lastX = e.clientX;
      start.lastY = e.clientY;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if(Math.abs(dx) + Math.abs(dy) > 3) start.moved = true;

      // Movimiento libre en tiempo real en la capa superior
      el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;

      const trash = document.querySelector('#trash');
      if (trash) {
        const isOverTrash = isDropOverTrash(e.clientX, e.clientY, el);
        trash.classList.toggle('drag-over', isOverTrash);
      }
    };

    const finishFloatingDrag = e => {
      if(!start) return;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', finishFloatingDrag);
      window.removeEventListener('pointercancel', finishFloatingDrag);

      const wasMoved = start.moved;
      const lastX = e?.clientX ?? start.lastX ?? start.x;
      const lastY = e?.clientY ?? start.lastY ?? start.y;
      const initialLeft = start.initialLeft;
      const initialTop = start.initialTop;
      const startX = start.x;
      const startY = start.y;
      const wbElRef = start.wbEl;
      if(wbElRef) wbElRef.style.zIndex = '';

      start = null;
      el.classList.remove('is-dragging');
      el.style.transform = '';
      el.style.zIndex = '';

      const trash = document.querySelector('#trash');
      const droppedOnTrash = Boolean(
        wasMoved && (
          (trash && trash.classList.contains('drag-over')) ||
          isDropOverTrash(lastX, lastY, el)
        )
      );
      if (trash) {
        trash.classList.remove('drag-over');
      }

      if(droppedOnTrash) {
        deleteTaskImmediately(t.id);
        return;
      }

      if(wasMoved){
        lastCardDragEndTime = Date.now();
        const finalLeft = initialLeft + (lastX - startX);
        const finalTop = initialTop + (lastY - startY);

        const wbEl = document.querySelector('.task-card.type-whiteboard');
        let droppedInWb = false;

        if(wbEl){
          const wr = wbEl.getBoundingClientRect();
          // Comprobar si el cursor cayó DENTRO del lienzo blanco:
          if(lastX >= wr.left && lastX <= wr.right && lastY >= wr.top && lastY <= wr.bottom){
            droppedInWb = true;
            t.whiteboardId = +wbEl.dataset.id;
            const bodyEl = wbEl.querySelector('.whiteboard-body') || wbEl;
            const br = bodyEl.getBoundingClientRect();
            // Posición exacta relativa al lienzo blanco:
            const relX = finalLeft - br.left;
            const relY = finalTop - br.top;
            t.wbX = Math.round(Math.max(5, Math.min(br.width - 20, relX)));
            t.wbY = Math.round(Math.max(5, Math.min(br.height - 20, relY)));
          }
        }

        if(!droppedInWb){
          // Cayó FUERA del lienzo: queda libre en el tablero general
          delete t.whiteboardId;
          delete t.wbX;
          delete t.wbY;
          const boardRect = board.getBoundingClientRect();
          const boardW = boardRect.width || 1000;
          const cardW = el.offsetWidth || 180;

          const leftPct = ((finalLeft - boardRect.left) / boardW) * 100;
          const topPx = finalTop - boardRect.top + (board.scrollTop || 0);

          const maxLeftPct = Math.max(0.5, 99.5 - (cardW / boardW) * 100);
          t.x = Math.round(Math.min(Math.max(0.5, leftPct), maxLeftPct) * 10) / 10;
          t.y = Math.round(Math.max(10, topPx));

          el.style.left = `${t.x}%`;
          el.style.top = `${t.y}px`;
        }

        save();
        render();
      }
    };

    el.addEventListener('click', e => {
      e.stopPropagation();
      selectedCardId = t ? t.id : null;
      document.querySelectorAll('.task-card.is-selected, .floating-note.is-selected').forEach(c => c.classList.remove('is-selected'));
      el.classList.add('is-selected');
    });

    el.addEventListener('pointerdown', e => {
      if(e.target.closest('.floating-del, .resize-handle')) return;
      if(e.button !== undefined && e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();

      const r = el.getBoundingClientRect();
      const parentWb = el.closest('.task-card.type-whiteboard');
      if(parentWb) parentWb.style.zIndex = '9999';

      start = {
        x: e.clientX,
        y: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        moved: false,
        initialLeft: r.left,
        initialTop: r.top,
        wbEl: parentWb
      };

      el.classList.add('is-dragging');
      el.style.zIndex = '999999';

      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', finishFloatingDrag, { once: true });
      window.addEventListener('pointercancel', finishFloatingDrag, { once: true });
    });

    bindResizeHandles(el, t, true);
  });
}
function peopleHtml(t){return(t.people||['Andrés Molina','Lucía Flores']).map((p,i)=>`<div class="person"><div class="person-avatar">${p.split(' ').map(x=>x[0]).join('')}</div><div><strong>${esc(p)}</strong><span>${i?'Interacción reciente':'Contacto relacionado'}</span></div></div>`).join('')}
function attachmentDetail(t){
  // En reuniones la foto es el avatar superior y no debe duplicarse como adjunto abajo
  if(t.type === 'meeting' || t.type === 'person') return '';
  if(!['pdf','file','audio','video','image','link'].includes(t.type)) return '';
  const transcript=t.transcriptName?`<div class="asset-file"><b>TXT</b><div><strong>${esc(t.transcriptName)}</strong><span>Transcripción adjunta</span></div></div>`:'';
  return `<section class="detail-section" style="margin-top:16px"><h4 style="font-size:10px;font-family:'DM Mono',monospace;color:#94a3b8;letter-spacing:0.5px;margin-bottom:8px">ARCHIVOS Y ADJUNTOS</h4>${asset(t)}${transcript}${t.publication?`<div class="result-box">Publicación: ${esc(t.publication)}</div>`:''}</section>`;
}
let currentDetailTaskId = null;
let selectedCardId = null;

function duplicateTask(id, targetDay = null){
  const orig = tasks.find(x => x.id === +id);
  if(!orig) return null;
  const clone = JSON.parse(JSON.stringify(orig));
  clone.id = Date.now();
  delete clone.recurrence;
  delete clone.done;
  delete clone.doneDays;
  if(targetDay){
    clone.day = targetDay;
  }
  const dayItems = tasks.filter(x => x.day === clone.day && !x.featured && taskMatchesProject(x));
  sortDayTasks(dayItems);
  const origIdx = dayItems.findIndex(x => x.id === orig.id);
  if(origIdx >= 0){
    dayItems.splice(origIdx + 1, 0, clone);
  } else {
    dayItems.push(clone);
  }
  dayItems.forEach((item, index) => {
    item.manualOrder = index;
  });

  tasks.push(clone);
  save();
  render();
  return clone;
}

function openDetail(id, startEditing = false){
  const t=tasks.find(x=>x.id===id);
  if(!t)return;
  currentDetailTaskId = t.id;

  const isMeeting = t.type==='meeting';
  const isPerson = t.type==='person' || isMeeting;

  // 1. Registro
  let reg = 'Nota';
  if(isMeeting) reg = 'Reunión';
  else if(t.type === 'location') reg = 'Ubicación';
  else if(t.type === 'file' || t.type === 'document' || t.type === 'pdf') reg = 'Archivo';
  else if(t.type === 'task' || t.type === 'todo-table') reg = 'To-do';
  else if(t.type === 'link') reg = 'Link';
  else if(t.type === 'image') reg = 'Imagen';
  else if(t.type === 'video') reg = 'Video';
  else if(t.type === 'audio' || t.type === 'voice') reg = 'Audio';
  else if(t.type === 'sticker') reg = 'Sticker';
  else if(t.type === 'whiteboard') reg = 'Lienzo';

  // 2. Proyecto
  const proj = t.project && t.project !== 'Todos' ? t.project : 'Todos los proyectos';

  // 3. Tema / Canal
  const tema = t.channel || 'General';

  // 4. DDMMAA | 00:00
  const dateTimeStr = getTaskDateFormatted(t);

  // Nombre y cargo sin duplicar
  const personName = t.personName || (t.person && t.person.name) || t.title || 'Registro';
  let cleanRole = t.personRole || (t.person && t.person.role) || '';
  if(cleanRole && cleanRole.startsWith(personName)){
    cleanRole = cleanRole.replace(personName, '').replace(/^[\s·\-|]+/, '').trim();
  }

  // 5. Estado de avatar temporal en edición
  window._detailPendingAvatar = null;

  // Foto compacta tipo avatar o icono de mapa con opción de cambio directo
  const avatarSrc = t.image || (t.person && t.person.photo) || '';
  const canHaveAvatar = isMeeting || isPerson || t.type === 'image' || t.image;
  const avatarHtml = (t.type === 'location') ? `
    <div style="width:52px;height:52px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;display:grid;place-items:center;flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,0.06)">
      <img src="map-icon.png" alt="Ubicación" style="width:36px;height:36px;object-fit:contain">
    </div>
  ` : canHaveAvatar ? `
    <div id="detailAvatarWrap" class="detail-avatar-wrap" style="position:relative;width:56px;height:56px;border-radius:50%;cursor:pointer;flex-shrink:0" title="Clic para cambiar foto">
      ${avatarSrc ? `
        <img src="${avatarSrc}" id="detailAvatarImg" class="detail-avatar" alt="Foto de ${esc(personName)}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid #e2e8f0;display:block">
      ` : `
        <div id="detailAvatarImg" class="detail-avatar" style="width:56px;height:56px;border-radius:50%;background:#e0e7ff;color:#4338ca;font-weight:800;font-size:22px;display:grid;place-items:center;border:2px solid #c7d2fe">${esc((personName.charAt(0)||'P').toUpperCase())}</div>
      `}
      <div style="position:absolute;bottom:-2px;right:-2px;width:20px;height:20px;border-radius:50%;background:#0f172a;color:#ffffff;display:grid;place-items:center;border:2px solid #ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.25)">
        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
      </div>
      <input type="file" id="detailChangeAvatarInput" accept="image/*" style="display:none">
    </div>
  ` : '';

  // Transcripción de la cita (archivo adjunto)
  const transcriptCardHtml = (t.transcriptName || t.transcriptData) ? `
    <div class="detail-transcript-box" style="margin:12px 0;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;display:flex;align-items:center;justify-content:space-between;gap:10px">
      <div style="display:flex;align-items:center;gap:10px;min-width:0">
        <div style="width:36px;height:36px;border-radius:8px;background:#f1f5f9;color:#111111;display:grid;place-items:center;flex-shrink:0"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
        <div style="min-width:0">
          <strong style="display:block;font-size:12px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.transcriptName||'Transcripción de la cita')}</strong>
          <span style="font-size:10px;color:#64748b;font-family:'DM Mono',monospace">${fileSize(t.transcriptSize)||'Archivo adjunto'}</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        ${t.transcriptData ? `<button type="button" id="btnOpenDetailTranscript" style="border:none;padding:6px 12px;background:#0284c7;color:#fff;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:4px">Abrir</button>` : ''}
        <button type="button" id="btnRemoveDetailTranscript" style="border:none;background:#fee2e2;color:#dc2626;padding:6px 8px;border-radius:6px;font-size:11px;cursor:pointer" title="Eliminar transcripción">✕</button>
      </div>
    </div>
  ` : (isMeeting ? `
    <div style="margin:12px 0">
      <label style="display:inline-flex;align-items:center;gap:7px;padding:8px 14px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;color:#475569;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s">
        <span style="display:inline-flex;align-items:center"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg></span>
        <span>Subir transcripción de la cita</span>
        <input type="file" id="btnUploadDetailTranscript" accept=".txt,.pdf,.doc,.docx,.rtf,.vtt,.srt,.md,text/*" style="display:none">
      </label>
    </div>
  ` : '');

  // Bloque para ubicación
  const mapUrl = t.mapUrl || t.url || (t.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.address)}` : '');
  const locationCardHtml = t.type === 'location' ? `
    <div style="margin:12px 0;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;display:flex;flex-direction:column;gap:8px">
      <div>
        <label style="display:block;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:3px;letter-spacing:0.5px">Dirección</label>
        <input type="text" id="detailEditAddress" value="${esc(t.address || '')}" placeholder="Ej. Calle 123, Ciudad..." style="width:100%;padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;color:#0f172a;background:#fff;box-sizing:border-box">
      </div>
      ${mapUrl ? `
        <div style="display:flex;gap:8px;margin-top:2px">
          <a href="${esc(mapUrl)}" target="_blank" rel="noopener noreferrer" style="flex:1;padding:7px 12px;background:#0284c7;color:#fff;border-radius:6px;font-size:11px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 2px 5px rgba(2,132,199,0.25)">
            <span>Abrir en Google Maps</span>
          </a>
        </div>
      ` : ''}
    </div>
  ` : '';

  // Selectores de Proyecto y Tema
  const projectOpts = getProjectOptions(proj);
  const channelOpts = getThemeOptions(tema);
  const editDescVal = !isObviousFillerDescription(t.description) ? (t.description || '') : '';

  // Iconos minimalistas
  const pencilSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;
  const duplicateSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

  document.querySelector('#panelContent').innerHTML = `
    <div class="detail-header-identity" style="display:flex;gap:12px;align-items:flex-start">
      ${avatarHtml}
      <div class="detail-identity-text" style="flex:1;min-width:0">
        <div class="detail-identity-top" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <input type="text" id="detailEditTitle" value="${esc(personName)}" placeholder="${isMeeting ? 'Nombre de la persona' : 'Título'}" style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:17px;color:#0f172a;letter-spacing:-0.4px;width:100%;border:1px solid transparent;border-radius:6px;padding:3px 6px;margin-left:-6px;background:transparent;box-sizing:border-box" onfocus="this.style.borderColor='#cbd5e1';this.style.background='#fff'" onblur="this.style.borderColor='transparent';this.style.background='transparent'">
          <div class="detail-header-actions" style="display:flex;align-items:center;gap:6px;flex-shrink:0">
            <div class="detail-header-stage-group" title="Flujo de trabajo">
              <button type="button" class="detail-stage-btn-mini ${t.stage==='idea'?'active':''}" data-stage="idea" title="Flujo: Idea">${ideaSvg}</button>
              <button type="button" class="detail-stage-btn-mini ${t.stage==='conexion'?'active':''}" data-stage="conexion" title="Flujo: Conexión">${conexionSvg}</button>
              <button type="button" class="detail-stage-btn-mini ${t.stage==='accion'?'active':''}" data-stage="accion" title="Flujo: Acción">${targetSvg}</button>
            </div>
            <span class="detail-header-sep"></span>
            <button type="button" id="btnDuplicateFromHeader" class="detail-edit-pencil" title="Duplicar (⌘D)">${duplicateSvg}</button>
            <button type="button" id="btnEditFromPencil" class="detail-edit-pencil" title="Editar título">${pencilSvg}</button>
            <button type="button" id="btnDeleteTaskFromHeader" class="detail-edit-pencil" title="Eliminar tarjeta" style="color:#dc2626;cursor:pointer">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
        ${(isMeeting || isPerson) ? `
          <input type="text" id="detailEditRole" value="${esc(cleanRole)}" placeholder="Cargo / Subtítulo..." style="font-size:12px;color:#64748b;width:100%;border:1px solid transparent;border-radius:6px;padding:2px 6px;margin-left:-6px;background:transparent;box-sizing:border-box;margin-top:2px" onfocus="this.style.borderColor='#cbd5e1';this.style.background='#fff'" onblur="this.style.borderColor='transparent';this.style.background='transparent'">
        ` : ''}
      </div>
    </div>

    <!-- Selectores de Proyecto y Tema -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0 14px">
      <div>
        <label style="display:block;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:3px;letter-spacing:0.5px">Proyecto</label>
        <select id="detailEditProject" style="width:100%;padding:6px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-weight:600;color:#1e293b;background:#fff">${projectOpts}</select>
      </div>
      <div>
        <label style="display:block;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:3px;letter-spacing:0.5px">Tema / Canal</label>
        <select id="detailEditChannel" style="width:100%;padding:6px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-weight:600;color:#1e293b;background:#fff">${channelOpts}</select>
      </div>
    </div>

    <!-- Campo de Enlace / URL editable con botón de prueba inmediato -->
    <div style="margin-bottom:12px">
      <label style="display:block;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:3px;letter-spacing:0.5px">Enlace / URL</label>
      <div style="display:flex;gap:6px;align-items:center">
        <input type="text" id="detailEditUrl" value="${esc(t.url || '')}" placeholder="https://..." style="flex:1;padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;color:#0f172a;background:#fff;box-sizing:border-box">
        <a id="detailTestUrlBtn" href="${esc(t.url && (t.url.startsWith('http') ? t.url : 'https://' + t.url) || '#')}" target="_blank" rel="noopener noreferrer" style="padding:7px 12px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;font-size:11px;font-weight:700;color:#334155;text-decoration:none;display:${t.url ? 'inline-flex' : 'none'};align-items:center;gap:4px;white-space:nowrap" title="Abrir enlace en pestaña nueva">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          <span>Abrir</span>
        </a>
      </div>
    </div>

    <!-- Campo de Titular / Descripción editable -->
    ${t.type !== 'location' ? `
      <div style="margin-bottom:12px">
        <label style="display:block;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:3px;letter-spacing:0.5px">${isMeeting ? 'Titular / Resumen de la cita' : 'Descripción'}</label>
        <input type="text" id="detailEditDescription" value="${esc(editDescVal)}" placeholder="Ej. Web + Automatizaciones..." style="width:100%;padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;color:#0f172a;background:#fff;box-sizing:border-box">
      </div>
    ` : ''}

    ${locationCardHtml}

    ${renderAgentReportSection(t)}

    ${renderProspectingSection(t)}

    ${t.type === 'todo-table' ? `
      <div style="margin-bottom:14px">
        <label for="detailSelectCurrency" style="display:block;font-size:10px;font-weight:700;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">Moneda</label>
        <select id="detailSelectCurrency" style="width:100%;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-weight:600;color:#1e293b;background:#fff;cursor:pointer">
          <option value="$" ${(!t.currency || t.currency === '$') ? 'selected' : ''}>$ (Peso / Moneda local)</option>
          <option value="CLP" ${t.currency === 'CLP' ? 'selected' : ''}>CLP ($)</option>
          <option value="USD" ${t.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
          <option value="MXN" ${t.currency === 'MXN' ? 'selected' : ''}>MXN ($)</option>
          <option value="€" ${t.currency === '€' ? 'selected' : ''}>EUR (€)</option>
          <option value="UF" ${t.currency === 'UF' ? 'selected' : ''}>UF</option>
        </select>
      </div>
    ` : ''}

    ${transcriptCardHtml}

    <!-- Campo único de Notas y Acuerdos -->
    <div class="detail-thoughts-box" style="margin-bottom:14px">
      <div class="detail-thoughts-head" style="margin-bottom:5px">
        <label for="detailThoughtsInput"><span style="font-size:11px;font-weight:800;color:#1e293b;text-transform:uppercase;letter-spacing:0.5px">Notas y acuerdos</span></label>
        <small style="font-size:10px;color:#94a3b8">Privado · no se ve en la tarjeta</small>
      </div>
      <textarea id="detailThoughtsInput" class="detail-thoughts-textarea" rows="4" placeholder="Escribe aquí tus notas, acuerdos o ideas..." style="width:100%;padding:9px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:12px;color:#1e293b;font-family:inherit;box-sizing:border-box;resize:vertical">${esc(t.thoughts || '')}</textarea>
    </div>

    ${(t.type==='file'||t.type==='document'||t.type==='pdf') ? `
      <div style="margin:14px 0">
        ${Array.isArray(t.files) && t.files.length > 0 ? `
          <div style="display:flex;flex-direction:column;gap:8px">
            <span style="font-size:11px;font-weight:800;color:#1e293b;text-transform:uppercase;letter-spacing:0.5px">Archivos adjuntos (${t.files.length})</span>
            ${t.files.map((fItem, fIdx) => {
              const fInfo = getFileDocInfo({ fileName: fItem.name, ext: fItem.ext });
              return `
                <button type="button" class="btn-open-panel-subfile" data-file-idx="${fIdx}" style="border:1px solid #e2e8f0;padding:8px 12px;background:#ffffff;color:#1e293b;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;box-shadow:0 1px 3px rgba(0,0,0,.05);text-align:left">
                  <div style="display:flex;align-items:center;gap:8px;overflow:hidden">
                    <span style="font-size:11px;font-weight:800;color:${fInfo.color};padding:2px 5px;background:#f1f5f9;border-radius:4px">${fInfo.ext ? fInfo.ext.toUpperCase() : 'DOC'}</span>
                    <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px">${esc(fItem.name)}</span>
                  </div>
                  <span style="font-size:11px;color:#64748b;font-family:'DM Mono',monospace">${fileSize(fItem.size)}</span>
                </button>
              `;
            }).join('')}
          </div>
        ` : ((t.fileData||t.media||t.url) ? `
          <button type="button" id="btnOpenDetailFile" style="border:none;padding:9px 16px;background:#2563eb;color:#fff;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 6px rgba(37,99,235,.25)">Abrir archivo (${esc(t.fileName || t.title)})</button>
        ` : '')}
      </div>
    ` : ''}

    ${attachmentDetail(t)}

    <!-- Pie del panel: UN SOLO BOTÓN GUARDAR -->
    <div style="margin-top:16px;padding-top:12px;border-top:1px solid #eef0f2;display:flex;gap:10px">
      <button type="button" id="btnDeleteTaskFromDetail" style="padding:10px 16px;background:#fee2e2;border:1px solid #fca5a5;border-radius:6px;font-size:12.5px;font-weight:700;color:#dc2626;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px" title="Eliminar tarjeta">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        <span>Eliminar</span>
      </button>
      <button type="button" id="btnSaveTaskFromDetail" style="flex:1;margin-top:0;padding:10px 16px;background:#111827;border:1px solid #111827;border-radius:6px;font-size:12.5px;font-weight:700;color:#ffffff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,0.1)"><span>Guardar</span></button>
    </div>
  `;

  // Bind eventos interactivos de aprobación para Agente Prospector
  bindProspectingEvents(t);

  // Bind duplicar cita/tarea desde cabecera
  const handleDup = () => {
    const clone = duplicateTask(t.id);
    if(clone){
      openDetail(clone.id, false);
    }
  };
  document.querySelector('#btnDuplicateFromHeader')?.addEventListener('click', handleDup);

  // Bind cambio de avatar/foto con un clic
  const avatarWrap = document.querySelector('#detailAvatarWrap');
  const avatarInput = document.querySelector('#detailChangeAvatarInput');
  const avatarImg = document.querySelector('#detailAvatarImg');
  if(avatarWrap && avatarInput){
    avatarWrap.addEventListener('click', () => avatarInput.click());
    avatarInput.addEventListener('change', async () => {
      const file = avatarInput.files?.[0];
      if(file){
        const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
        const compressed = await compressImage(file, 480, 480, 0.85, isPng);
        if(compressed){
          window._detailPendingAvatar = compressed;
          if(avatarImg){
            if(avatarImg.tagName === 'IMG'){
              avatarImg.src = compressed;
            } else {
              avatarWrap.innerHTML = `
                <img src="${compressed}" id="detailAvatarImg" class="detail-avatar" alt="Foto" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid #e2e8f0;display:block">
                <div style="position:absolute;bottom:-2px;right:-2px;width:20px;height:20px;border-radius:50%;background:#0f172a;color:#ffffff;display:grid;place-items:center;border:2px solid #ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.25)">
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                </div>
                <input type="file" id="detailChangeAvatarInput" accept="image/*" style="display:none">
              `;
            }
          }
        }
      }
    });
  }

  // Bind campo de URL y botón de prueba en tiempo real
  const urlInput = document.querySelector('#detailEditUrl');
  const testUrlBtn = document.querySelector('#detailTestUrlBtn');
  if(urlInput && testUrlBtn){
    urlInput.addEventListener('input', () => {
      const val = urlInput.value.trim();
      if(val){
        testUrlBtn.href = val.startsWith('http') ? val : 'https://' + val;
        testUrlBtn.style.display = 'inline-flex';
      } else {
        testUrlBtn.style.display = 'none';
      }
    });
  }

  // Actualización en vivo del texto centrado sobre la imagen al escribir en Descripción
  const descInput = document.querySelector('#detailEditDescription');
  if(descInput && t.type === 'image'){
    descInput.addEventListener('input', () => {
      const val = descInput.value.trim();
      const imgBox = document.querySelector('.detail-image-box');
      if(!imgBox) return;
      let overlayEl = imgBox.querySelector('.image-card-overlay-text');
      if(val){
        if(!overlayEl){
          overlayEl = document.createElement('div');
          overlayEl.className = 'image-card-overlay-text';
          imgBox.appendChild(overlayEl);
        }
        overlayEl.innerHTML = `<span>${esc(val)}</span>`;
      } else {
        if(overlayEl) overlayEl.remove();
      }
    });
  }

  // Bind lápiz en cabecera para enfocar título
  document.querySelector('#btnEditFromPencil')?.addEventListener('click', () => {
    const titleInp = document.querySelector('#detailEditTitle');
    if(titleInp){
      titleInp.focus();
      titleInp.select();
    }
  });

  // Bind guardar UNIFICADO desde el pie del detalle
  document.querySelector('#btnSaveTaskFromDetail')?.addEventListener('click', () => {
    const newTitle = (document.querySelector('#detailEditTitle')?.value || '').trim() || personName;
    const newProject = document.querySelector('#detailEditProject')?.value || proj;
    const newChannel = document.querySelector('#detailEditChannel')?.value || tema;
    const newUrl = (document.querySelector('#detailEditUrl')?.value || '').trim();
    const newDesc = (document.querySelector('#detailEditDescription')?.value || '').trim();
    const newNotes = document.querySelector('#detailThoughtsInput')?.value || '';

    t.title = newTitle;
    if(isMeeting || isPerson){
      t.personName = newTitle;
      const newRole = (document.querySelector('#detailEditRole')?.value || '').trim();
      t.personRole = newRole;
      if(t.person){
        t.person.name = newTitle;
        t.person.role = newRole;
      }
    }

    if(window._detailPendingAvatar){
      t.image = window._detailPendingAvatar;
      if(t.person) t.person.photo = window._detailPendingAvatar;
      window.MindFerMediaVault = window.MindFerMediaVault || {};
      window.MindFerMediaVault[String(t.id)] = window._detailPendingAvatar;
      window._detailPendingAvatar = null;
    }

    if(t.type === 'location'){
      const newAddr = (document.querySelector('#detailEditAddress')?.value || '').trim();
      if(newAddr){
        t.address = newAddr;
        if(!newUrl) t.mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(newAddr)}`;
      }
    }

    t.project = newProject;
    t.channel = newChannel;

    const channelColorMap = {
      'LinkedIn': 'linkedin',
      'WhatsApp': 'whatsapp',
      'Instagram': 'instagram',
      'TikTok': 'tiktok',
      'X': 'x',
      'Email': 'email',
      'Web': 'web',
      'Investigación': 'research',
      'Prospección': 'prospeccion',
      'Ventas': 'sales',
      'Yo': 'neutral',
      'Personal': 'neutral'
    };
    let noteColor = channelColorMap[newChannel] || t.color || 'neutral';
    try {
      const customChannels = JSON.parse(localStorage.getItem('mindJeanetteCustomChannels') || '[]');
      const match = customChannels.find(c => c.name === newChannel);
      if(match){
        noteColor = 'custom';
        t.fill = match.fill || '#6178ec';
        t.textColor = '#ffffff';
      }
    } catch(_) {}
    t.color = noteColor;

    t.url = newUrl;
    if(newUrl && t.type === 'location') t.mapUrl = newUrl;
    t.description = newDesc;
    t.thoughts = newNotes;

    if(t.type === 'todo-table'){
      const curSelect = document.querySelector('#detailSelectCurrency');
      if(curSelect && curSelect.value){
        t.currency = curSelect.value;
        if(t.items && t.items.length){
          t.items.forEach(row => {
            const lastIdx = row.cols.length - 1;
            if(row.cols[lastIdx] && /\d/.test(row.cols[lastIdx])){
              row.cols[lastIdx] = formatMoneyValue(row.cols[lastIdx], t.currency);
            }
          });
        }
      }
    }

    if(pipelineItems && t.stage){
      const pIdx = pipelineItems.findIndex(p => p.taskId === t.id || p.id === 'p_' + t.id);
      if(pIdx >= 0){
        pipelineItems[pIdx].title = formatPipelineTaskTitle(t);
        savePipeline();
      }
    }

    save();
    render();
    closeDetail();
  });

  // Bind selector de moneda en lateral para tablas todo
  document.querySelector('#detailSelectCurrency')?.addEventListener('change', e => {
    t.currency = e.target.value;
    if(t.items && t.items.length){
      t.items.forEach(row => {
        const lastIdx = row.cols.length - 1;
        if(row.cols[lastIdx] && /\d/.test(row.cols[lastIdx])){
          row.cols[lastIdx] = formatMoneyValue(row.cols[lastIdx], t.currency);
        }
      });
    }
    save();
    render();
  });

  // Bind Mis Notas con guardado automático inmediato
  const thoughtsInput = document.querySelector('#detailThoughtsInput');
  if(thoughtsInput){
    thoughtsInput.addEventListener('input', () => {
      t.thoughts = thoughtsInput.value;
      save();
    });
  }

  // Bind subir transcripción directa desde detalle
  const uploadDirectTranscript = document.querySelector('#btnUploadDetailTranscript');
  if(uploadDirectTranscript){
    uploadDirectTranscript.addEventListener('change', async () => {
      const f = uploadDirectTranscript.files?.[0];
      if(f){
        t.transcriptName = f.name;
        t.transcriptSize = f.size;
        t.transcriptData = await dataUrl(f);
        save();
        render();
        openDetail(t.id);
      }
    });
  }

  // Bind abrir archivo o transcripción inmediatamente sin descargar
  document.querySelector('#btnOpenDetailFile')?.addEventListener('click', () => {
    openDataOrUrlImmediately(t.fileData || t.media || t.url, t.fileName || t.title || 'archivo');
  });
  document.querySelectorAll('.btn-open-panel-subfile').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.fileIdx, 10);
      if(Array.isArray(t.files) && t.files[idx]){
        const sub = t.files[idx];
        if(sub.data || sub.url){
          openDataOrUrlImmediately(sub.data || sub.url, sub.name || 'archivo');
        }
      }
    });
  });
  document.querySelector('#btnOpenDetailTranscript')?.addEventListener('click', () => {
    openDataOrUrlImmediately(t.transcriptData, t.transcriptName || 'transcripcion.txt');
  });

  // Bind quitar transcripción
  document.querySelector('#btnRemoveDetailTranscript')?.addEventListener('click', () => {
    t.transcriptName = '';
    t.transcriptData = '';
    t.transcriptSize = 0;
    save();
    render();
    openDetail(t.id);
  });

  // Bind selector de iconos de etapa
  document.querySelectorAll('.detail-stage-btn-mini, .detail-stage-icon-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const stage = btn.dataset.stage;
      const newStage = (t.stage === stage) ? null : stage;
      t.stage = newStage;
      save();

      // Sincronizar inmediatamente con el tablero Trello inferior (pipelineItems)
      if(!pipelineItems) pipelineItems = [];
      const pIdx = pipelineItems.findIndex(p => p.taskId === t.id || p.id === 'p_' + t.id);

      if(newStage){
        const formattedTitle = formatPipelineTaskTitle(t);
        if(pIdx >= 0){
          pipelineItems[pIdx].stage = newStage;
          pipelineItems[pIdx].title = formattedTitle;
          pipelineItems[pIdx].taskId = t.id;
        } else {
          pipelineItems.push({
            id: 'p_' + t.id,
            taskId: t.id,
            title: formattedTitle,
            stage: newStage
          });
        }
      } else {
        if(pIdx >= 0){
          pipelineItems.splice(pIdx, 1);
        }
      }

      savePipeline();
      render();
      openDetail(t.id);
    });
  });

  // Bind botón eliminar (pie y cabecera)
  const handleDetailDelete = () => {
    const delId = t.id;
    closeDetail();
    deleteTaskImmediately(delId);
  };
  document.querySelector('#btnDeleteTaskFromDetail')?.addEventListener('click', handleDetailDelete);
  document.querySelector('#btnDeleteTaskFromHeader')?.addEventListener('click', handleDetailDelete);

  panel.classList.add('open');
  overlay.classList.add('show');
  panel.setAttribute('aria-hidden','false');
}
function closeDetail(){
  currentDetailTaskId = null;
  panel.classList.remove('open');
  overlay.classList.remove('show');
  panel.setAttribute('aria-hidden','true');
}
document.querySelector('#closePanel').addEventListener('click',closeDetail);
overlay.addEventListener('click',closeDetail);

// Atajo de teclado ⌘D o Ctrl+D para duplicar tarjeta seleccionada o abierta en panel

window.addEventListener('keydown', e => {
  if((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd'){
    if(e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
    const p = document.querySelector('#detailPanel');
    if(p && p.classList.contains('open') && currentDetailTaskId){
      e.preventDefault();
      const clone = duplicateTask(currentDetailTaskId);
      if(clone) openDetail(clone.id, false);
      return;
    }
    if(selectedCardId){
      e.preventDefault();
      duplicateTask(selectedCardId);
      return;
    }
  }
  // Tecla Supr / Backspace para eliminar tarjeta seleccionada o abierta en panel
  if(e.key === 'Delete' || e.key === 'Backspace'){
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
    if(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) return;
    const p = document.querySelector('#detailPanel');
    if(p && p.classList.contains('open') && currentDetailTaskId){
      e.preventDefault();
      const idToDel = currentDetailTaskId;
      closeDetail();
      deleteTaskImmediately(idToDel);
      return;
    }
    if(selectedCardId){
      e.preventDefault();
      const idToDel = selectedCardId;
      selectedCardId = null;
      deleteTaskImmediately(idToDel);
      return;
    }
  }
});

// --- GESTIÓN ELEGANTE Y PERSISTENTE DE PROYECTOS ---
function getCustomProjects(){
  try {
    const raw = JSON.parse(localStorage.getItem('mindJeanetteCustomProjects') || '[]');
    return raw.map(p => typeof p === 'string' ? { value: p, label: p } : p);
  } catch(_) {
    return [];
  }
}

function saveCustomProjects(projects){
  try {
    localStorage.setItem('mindJeanetteCustomProjects', JSON.stringify(projects));
  } catch(_) {}
}

function syncProjectSelect(){
  const select = document.querySelector('#projectSelect');
  if(!select) return;
  const standard = [
    { value: 'Todos', label: 'Todos los proyectos' },
    { value: 'NetThinking', label: 'NetThinking' },
    { value: 'Personal Branding', label: 'Personal Branding' },
    { value: 'Branding Corporativo', label: 'Branding Corporativo' }
  ];
  const custom = getCustomProjects();
  const currentVal = selectedProject || select.value || 'Todos';

  select.innerHTML = '';
  [...standard, ...custom].forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.value;
    opt.textContent = item.label;
    if(item.value === currentVal) opt.selected = true;
    select.appendChild(opt);
  });
  if(select.value) selectedProject = select.value;
}

function initProjectDialog(){
  const dialog = document.querySelector('#projectDialog');
  const addBtn = document.querySelector('#addProject');
  const form = document.querySelector('#projectForm');
  const nameInput = document.querySelector('#projectName');
  const storyInput = document.querySelector('#projectStoryInput');
  const cancelBtn = document.querySelector('#cancelProject');
  const closeBtn = document.querySelector('#closeProjectDialog');
  const select = document.querySelector('#projectSelect');

  syncProjectSelect();

  if(select){
    select.addEventListener('change', e => {
      selectedProject = e.target.value;
      render();
    });
  }

  if(addBtn && dialog){
    addBtn.addEventListener('click', () => {
      if(form) form.reset();
      dialog.showModal();
      setTimeout(() => nameInput?.focus(), 60);
    });
  }

  const handleClose = () => {
    try { dialog?.close(); } catch(_) {}
  };

  if(cancelBtn) cancelBtn.addEventListener('click', handleClose);
  if(closeBtn) closeBtn.addEventListener('click', handleClose);
  if(dialog){
    dialog.addEventListener('click', e => {
      if(e.target === dialog) handleClose();
    });
  }

  if(form){
    form.addEventListener('submit', e => {
      e.preventDefault();
      const name = nameInput ? nameInput.value.trim() : '';
      if(!name){
        nameInput?.focus();
        return;
      }

      // 1. Guardar proyecto en localStorage si no existe
      const custom = getCustomProjects();
      if(!custom.some(p => p.value.toLowerCase() === name.toLowerCase())){
        custom.push({ value: name, label: name });
        saveCustomProjects(custom);
      }

      // 2. Guardar historia / descripción
      const story = storyInput ? storyInput.value.trim() : '';
      if(story){
        projectStories[name] = story;
        try {
          const stories = JSON.parse(localStorage.getItem('mindJeanetteProjectStories') || '{}');
          stories[name] = story;
          localStorage.setItem('mindJeanetteProjectStories', JSON.stringify(stories));
        } catch(_) {}
      } else if (!projectStories[name]) {
        projectStories[name] = `Prioridades, compromisos y avances de ${name}.`;
      }

      // 3. Seleccionar el nuevo proyecto y renderizar
      selectedProject = name;
      syncProjectSelect();
      render();
      handleClose();
    });
  }
}

/* --- CARPETA DE STICKERS (BIBLIOTECA PERSONAL) --- */
let userStickersFolder = [];

function svgToDataUri(svgStr) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr.trim());
}

function getDefaultStickers() {
  return [
    {
      id: 'def_star',
      name: 'Estrella dorada',
      url: svgToDataUri("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g1' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='#fbbf24'/><stop offset='100%' stop-color='#f59e0b'/></linearGradient></defs><polygon points='50,5 64,36 98,38 72,61 80,95 50,77 20,95 28,61 2,38 36,36' fill='url(#g1)' stroke='#d97706' stroke-width='3'/></svg>")
    },
    {
      id: 'def_sparkle',
      name: 'Destello mágico',
      url: svgToDataUri("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g2' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='#c084fc'/><stop offset='100%' stop-color='#9333ea'/></linearGradient></defs><path d='M50 0 C50 35 65 50 100 50 C65 50 50 65 50 100 C50 65 35 50 0 50 C35 50 50 35 50 0 Z' fill='url(#g2)'/><circle cx='80' cy='20' r='8' fill='#f472b6'/><circle cx='20' cy='80' r='6' fill='#38bdf8'/></svg>")
    },
    {
      id: 'def_flower',
      name: 'Flor MindFer',
      url: svgToDataUri("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g3' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='#f472b6'/><stop offset='100%' stop-color='#db2777'/></linearGradient></defs><circle cx='50' cy='28' r='18' fill='url(#g3)'/><circle cx='72' cy='50' r='18' fill='url(#g3)'/><circle cx='50' cy='72' r='18' fill='url(#g3)'/><circle cx='28' cy='50' r='18' fill='url(#g3)'/><circle cx='50' cy='50' r='14' fill='#fef08a'/></svg>")
    },
    {
      id: 'def_fire',
      name: 'Foco y Fuego',
      url: svgToDataUri("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='gf' x1='0%' y1='100%' x2='0%' y2='0%'><stop offset='0%' stop-color='#dc2626'/><stop offset='50%' stop-color='#ea580c'/><stop offset='100%' stop-color='#facc15'/></linearGradient></defs><path d='M50 5 C55 25 75 35 75 60 C75 80 62 95 50 95 C38 95 25 80 25 60 C25 45 35 30 45 20 C45 30 52 35 50 5 Z' fill='url(#gf)'/><path d='M50 45 C55 55 62 65 62 75 C62 85 55 90 50 90 C45 90 38 85 38 75 C38 65 45 55 50 45 Z' fill='#fef08a'/></svg>")
    },
    {
      id: 'def_heart',
      name: 'Corazón',
      url: svgToDataUri("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='gh' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='#f43f5e'/><stop offset='100%' stop-color='#be123c'/></linearGradient></defs><path d='M50 88 C40 75 10 55 10 32 C10 18 21 8 35 8 C42 8 47 12 50 18 C53 12 58 8 65 8 C79 8 90 18 90 32 C90 55 60 75 50 88 Z' fill='url(#gh)'/></svg>")
    },
    {
      id: 'def_idea',
      name: 'Gran Idea',
      url: svgToDataUri("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='gi' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='#fef08a'/><stop offset='100%' stop-color='#facc15'/></linearGradient></defs><path d='M32 40 C32 25 40 12 50 12 C60 12 68 25 68 40 C68 48 64 56 60 62 L40 62 C36 56 32 48 32 40 Z' fill='url(#gi)' stroke='#ca8a04' stroke-width='3'/><rect x='41' y='64' width='18' height='5' rx='2' fill='#94a3b8'/><rect x='43' y='71' width='14' height='4' rx='2' fill='#64748b'/><circle cx='50' cy='78' r='3' fill='#475569'/></svg>")
    },
    {
      id: 'def_rocket',
      name: 'Despegue',
      url: svgToDataUri("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='gr' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='#38bdf8'/><stop offset='100%' stop-color='#2563eb'/></linearGradient></defs><path d='M75 25 C55 20 40 35 35 55 L45 65 C65 60 80 45 75 25 Z' fill='url(#gr)'/><path d='M35 55 L20 60 L28 72 L45 65 Z' fill='#f43f5e'/><circle cx='58' cy='42' r='7' fill='#ffffff' stroke='#1e3a8a' stroke-width='2'/><path d='M22 75 C15 85 10 90 10 90 C10 90 15 85 25 78 Z' fill='#facc15' stroke='#ea580c' stroke-width='3'/></svg>")
    },
    {
      id: 'def_target',
      name: 'Objetivo',
      url: svgToDataUri("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='#fee2e2' stroke='#ef4444' stroke-width='4'/><circle cx='50' cy='50' r='30' fill='#ffffff' stroke='#ef4444' stroke-width='4'/><circle cx='50' cy='50' r='15' fill='#ef4444'/></svg>")
    },
    {
      id: 'def_approved',
      name: 'Aprobado',
      url: svgToDataUri("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect x='5' y='25' width='90' height='50' rx='10' fill='#dcfce7' stroke='#16a34a' stroke-width='4'/><text x='50' y='57' font-family='sans-serif' font-weight='900' font-size='18' fill='#15803d' text-anchor='middle' letter-spacing='1'>LISTO ✓</text></svg>")
    },
    {
      id: 'def_coffee',
      name: 'Pausa Café',
      url: svgToDataUri("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M20 35 L70 35 L65 75 C65 82 58 88 50 88 L40 88 C32 88 25 82 25 75 Z' fill='#78350f'/><path d='M70 42 C80 42 85 48 85 55 C85 62 80 68 70 68' fill='none' stroke='#78350f' stroke-width='6' stroke-linecap='round'/><path d='M35 15 C33 22 38 25 35 30' fill='none' stroke='#b45309' stroke-width='3' stroke-linecap='round'/><path d='M50 12 C48 19 53 22 50 28' fill='none' stroke='#b45309' stroke-width='3' stroke-linecap='round'/></svg>")
    }
  ];
}

function loadUserStickersFolder() {
  try {
    const raw = localStorage.getItem('mindJeanetteStickerFolder');
    if (raw) {
      userStickersFolder = JSON.parse(raw);
      // Auto-reparar URLs con formato viejo utf8 o caracteres SVG sin codificar
      let updated = false;
      const defs = getDefaultStickers();
      userStickersFolder = userStickersFolder.map(s => {
        if (!s) return s;
        const needsRepair = s.url && typeof s.url === 'string' && (s.url.includes('utf8') || s.url.includes('<svg') || (s.url.startsWith('data:image/svg') && !s.url.includes('%3C')));
        if (needsRepair) {
          const matchDef = defs.find(d => d.id === s.id || d.name === s.name);
          if (matchDef) {
            s.url = matchDef.url;
            updated = true;
          } else {
            const parts = s.url.split(',');
            if (parts.length > 1) {
              try {
                const rawSvg = decodeURIComponent(parts.slice(1).join(','));
                s.url = svgToDataUri(rawSvg);
                updated = true;
              } catch (_) {}
            }
          }
        }
        return s;
      });
      if (updated) saveUserStickersFolder();
    } else {
      userStickersFolder = getDefaultStickers();
      saveUserStickersFolder();
    }
  } catch (_) {
    userStickersFolder = getDefaultStickers();
  }
}

function saveUserStickersFolder() {
  try {
    localStorage.setItem('mindJeanetteStickerFolder', JSON.stringify(userStickersFolder));
    localStorage.setItem('mindJeanetteLastSavedAt', String(Date.now()));
  } catch (err) {
    console.warn('Error guardando carpeta de stickers:', err);
  }
}

function placeStickerOnBoard(stk, size) {
  const chosenDay = getTodayBoardDayName();
  const boardEl = document.querySelector('#board');
  let spawnX = 40;
  let spawnY = 120;

  if (boardEl) {
    const bRect = boardEl.getBoundingClientRect();
    const scrollTop = boardEl.scrollTop || 0;
    const screenCenterY = (window.innerHeight / 2) - bRect.top + scrollTop;
    spawnY = Math.round(Math.max(60, screenCenterY + ((Math.random() * 40) - 20)));
    spawnX = Math.round(Math.max(10, Math.min(80, 40 + ((Math.random() * 20) - 10))));
  }

  const chosenSize = parseInt(size, 10) || 180;

  const newSticker = {
    id: Date.now(),
    startWeekKey: weekKey(semanaVisible),
    day: chosenDay,
    title: stk.name || 'Sticker',
    description: '',
    channel: 'Yo',
    project: 'Todos los proyectos',
    status: 'pendiente',
    agent: 'Fer',
    count: '🌸',
    color: 'neutral',
    type: 'sticker',
    image: stk.url,
    featured: true,
    highlightSize: 'medium',
    noteWidth: chosenSize,
    noteHeight: chosenSize,
    w: chosenSize,
    h: chosenSize,
    x: spawnX,
    y: spawnY
  };

  tasks.push(newSticker);
  save();
  render();

  setTimeout(() => {
    const createdEl = document.querySelector(`.floating-note[data-id="${newSticker.id}"]`);
    if(createdEl){
      createdEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, 60);

  const dlg = document.querySelector('#stickerFolderDialog');
  if (dlg && dlg.open) dlg.close();
}

function renderStickerFolderGrid() {
  const grid = document.querySelector('#stickerFolderGrid');
  const countEl = document.querySelector('#stickerFolderCount');
  if (!grid) return;

  if (countEl) {
    countEl.textContent = `Mis Stickers (${userStickersFolder.length})`;
  }

  if (userStickersFolder.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 32px 16px; color: #94a3b8">
        <div style="font-size: 32px; margin-bottom: 8px">🌸</div>
        <p style="margin: 0; font-size: 13px; font-weight: 700; color: #64748b">Tu carpeta está vacía</p>
        <p style="margin: 4px 0 0; font-size: 11px">Sube tu primer sticker arriba o pega con Cmd + V</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = userStickersFolder.map((stk, idx) => `
    <div class="sticker-item-card" data-idx="${idx}" title="${esc(stk.name || 'Sticker')} (clic para colocar)">
      <button type="button" class="sticker-item-del" data-idx="${idx}" title="Eliminar de la carpeta" aria-label="Eliminar">×</button>
      <img src="${stk.url}" alt="${esc(stk.name || 'Sticker')}" class="sticker-item-img" loading="lazy">
      <span class="sticker-item-name">${esc(stk.name || 'Sticker')}</span>
    </div>
  `).join('');

  grid.querySelectorAll('.sticker-item-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.sticker-item-del')) return;
      const idx = parseInt(card.dataset.idx, 10);
      const stk = userStickersFolder[idx];
      if (stk) {
        const size = document.querySelector('#stickerSpawnSize')?.value || '180';
        placeStickerOnBoard(stk, size);
      }
    });
  });

  grid.querySelectorAll('.sticker-item-del').forEach(delBtn => {
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = parseInt(delBtn.dataset.idx, 10);
      if (typeof idx === 'number' && userStickersFolder[idx]) {
        userStickersFolder.splice(idx, 1);
        saveUserStickersFolder();
        renderStickerFolderGrid();
      }
    });
  });
}

async function addFilesToStickerFolder(files) {
  if (!files || files.length === 0) return;
  const list = Array.from(files).filter(f => f.type && f.type.startsWith('image/'));
  if (list.length === 0) return;

  const dropArea = document.querySelector('#stickerDropArea');
  if (dropArea) {
    dropArea.style.opacity = '0.5';
    dropArea.style.pointerEvents = 'none';
  }

  for (const file of list) {
    try {
      const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
      const url = await compressImage(file, 800, 800, 0.85, isPng);
      if (url) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').trim() || 'Sticker';
        userStickersFolder.unshift({
          id: 'stk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          name: cleanName,
          url,
          date: Date.now()
        });
      }
    } catch (err) {
      console.warn('Error procesando sticker:', err);
    }
  }

  if (dropArea) {
    dropArea.style.opacity = '1';
    dropArea.style.pointerEvents = 'auto';
  }

  saveUserStickersFolder();
  renderStickerFolderGrid();
}

function openStickerFolder() {
  const dlg = document.querySelector('#stickerFolderDialog');
  if (!dlg) return;
  loadUserStickersFolder();
  renderStickerFolderGrid();
  dlg.showModal();
}

function initStickerFolder() {
  const dlg = document.querySelector('#stickerFolderDialog');
  if (!dlg) return;

  loadUserStickersFolder();

  const closeBtn = document.querySelector('#closeStickerFolder');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => dlg.close());
  }

  dlg.addEventListener('click', e => {
    if (e.target === dlg) dlg.close();
  });

  const dropArea = document.querySelector('#stickerDropArea');
  const fileInput = document.querySelector('#stickerFolderFileInput');

  if (dropArea && fileInput) {
    dropArea.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async () => {
      if (fileInput.files && fileInput.files.length > 0) {
        await addFilesToStickerFolder(fileInput.files);
        fileInput.value = '';
      }
    });

    ['dragenter', 'dragover'].forEach(evt => {
      dropArea.addEventListener(evt, e => {
        e.preventDefault();
        e.stopPropagation();
        dropArea.classList.add('is-dragover');
      });
    });

    ['dragleave', 'drop'].forEach(evt => {
      dropArea.addEventListener(evt, e => {
        e.preventDefault();
        e.stopPropagation();
        dropArea.classList.remove('is-dragover');
      });
    });

    dropArea.addEventListener('drop', async e => {
      e.preventDefault();
      e.stopPropagation();
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length > 0) {
        await addFilesToStickerFolder(dt.files);
      }
    });
  }

  window.addEventListener('paste', async e => {
    if (!dlg.open) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    const imgFiles = [];
    for (const item of items) {
      if (item.type && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) imgFiles.push(f);
      }
    }
    if (imgFiles.length > 0) {
      e.preventDefault();
      await addFilesToStickerFolder(imgFiles);
    }
  });
}

initProjectDialog();
initStickerFolder();
const simplePieces={task:{title:'Tarea por mover',description:'Una acción clara para esta semana.',color:'email',channel:'Email'},text:{title:'Texto libre',description:'Escribe una reflexión, una frase o una dirección.',color:'whatsapp',channel:'WhatsApp'}};
document.querySelectorAll('.maker-tool').forEach(b=>b.addEventListener('click',()=>{
  const type=b.dataset.piece;
  if(type==='draw')return;
  if(type==='task')return openTodoTableDialog();
  if(type==='sticker')return openStickerFolder();
  if(['upload','image','video','audio','meeting','link','note','idea','file','location'].includes(type))return openCapture(type);
  const piece=simplePieces[type];
  if(piece){tasks.push({id:Date.now(),day:'Lunes',status:'pendiente',agent:'Fer',count:'+',type:'note',size:'square',...piece});save();render()}
}));
const captureDialog=document.querySelector('#captureDialog'),captureForm=document.querySelector('#captureForm'),captureBody=document.querySelector('#captureBody');let captureType='upload',editingHighlightedId=null,editingTaskId=null;const captureLabels={sticker:'Sticker',upload:'Subir archivo',file:'Archivos',location:'Ubicación',image:'Imagen',video:'Video',audio:'Nota de voz',meeting:'Reunión',link:'Enlace',note:'Nota',idea:'Nota destacada'};const input=(label,name,extra='')=>`<label class="capture-field">${label}<input name="${name}" ${extra}></label>`;

function getThemeOptions(selected='LinkedIn'){
  const standard=['LinkedIn','WhatsApp','Instagram','TikTok','X','Email','Web','Investigación','Ventas','Yo'];
  let custom=[];
  try{
    custom=JSON.parse(localStorage.getItem('mindJeanetteCustomChannels')||'[]').map(c=>c.name);
  }catch(_){}
  let hidden=[];
  try{
    hidden=JSON.parse(localStorage.getItem('mindJeanetteHiddenChannels')||'[]');
  }catch(_){}
  const allThemes=Array.from(new Set([...standard,...custom])).filter(th=>!hidden.includes(th));
  if(allThemes.length===0) allThemes.push('General');
  const effectiveSelected = allThemes.includes(selected) ? selected : allThemes[0];
  return allThemes.map(th=>`<option value="${esc(th)}" ${th===effectiveSelected?'selected':''}>${esc(th)}</option>`).join('');
}

function getProjectOptions(selected='Todos'){
  const selEl=document.querySelector('#projectSelect');
  const projs=selEl?Array.from(selEl.options).map(o=>o.value).filter(v=>v&&v!=='Todos'&&v!=='Todos los proyectos'):['NetThinking','Personal Branding','Branding Corporativo'];
  const curProj = (selected !== '' && selected !== undefined) ? selected : 'Todos';
  const allProjs = [
    { value: 'Todos', label: 'Todos los proyectos' },
    ...projs.map(p => ({ value: p, label: p }))
  ];
  return allProjs.map(p=>`<option value="${esc(p.value)}" ${p.value===curProj?'selected':''}>${esc(p.label)}</option>`).join('');
}

const themeColors = {
  'LinkedIn': { bg: '#00d8ff', text: '#000', label: 'Cyan / Azul LinkedIn' },
  'WhatsApp': { bg: '#baff00', text: '#000', label: 'Verde lima WhatsApp' },
  'Instagram': { bg: '#ff00a8', text: '#fff', label: 'Magenta Instagram' },
  'TikTok': { bg: '#34363c', text: '#fff', label: 'Gris oscuro TikTok' },
  'X': { bg: '#1f242d', text: '#fff', label: 'Negro X' },
  'Email': { bg: '#ffe500', text: '#000', label: 'Amarillo Email' },
  'Web': { bg: '#1263ff', text: '#fff', label: 'Azul Web' },
  'Investigación': { bg: '#7624ff', text: '#fff', label: 'Morado Investigación' },
  'Prospección': { bg: '#e53935', text: '#fff', label: 'Rojo Prospección' },
  'Ventas': { bg: '#ff5a17', text: '#fff', label: 'Naranja Ventas' },
  'Yo': { bg: '#ff3560', text: '#fff', label: 'Rojo Personal / Yo' },
  'Personal': { bg: '#ff3560', text: '#fff', label: 'Rojo Personal / Yo' }
};

function getThemeColorInfo(channelName){
  if(themeColors[channelName]) return themeColors[channelName];
  try{
    const customChannels=JSON.parse(localStorage.getItem('mindJeanetteCustomChannels')||'[]');
    const match=customChannels.find(c=>c.name===channelName);
    if(match) return { bg: match.fill||'#6178ec', text: '#fff', label: channelName };
  }catch(_){}
  return { bg: '#6178ec', text: '#fff', label: channelName };
}
window.getThemeColorInfo = getThemeColorInfo;

function getTodayBoardDayName(){
  const dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  return dias[new Date().getDay()] || 'Lunes';
}

function renderScopeFields(defaultTheme='LinkedIn', defaultDay='', defaultTime='', defaultRecurrence='none', defaultProject='Todos'){
  const cInfo = getThemeColorInfo(defaultTheme);
  const activeDay = defaultDay || getTodayBoardDayName();
  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
      <label class="capture-field" style="margin:0">Tema
        <select name="channel" class="modal-theme-select" style="width:100%;padding:7px 8px;border:1px solid #d6dade;border-radius:6px;font-weight:700;font-size:12px;background:#fff;margin-top:4px">
          ${getThemeOptions(defaultTheme)}
        </select>
      </label>
      <label class="capture-field" style="margin:0">Proyecto
        <select name="project" class="modal-project-select" style="width:100%;padding:7px 8px;border:1px solid #d6dade;border-radius:6px;font-weight:700;font-size:12px;background:#fff;margin-top:4px">
          ${getProjectOptions(defaultProject)}
        </select>
      </label>
    </div>
    <input type="hidden" name="day" value="${esc(activeDay)}">
    <div class="modal-theme-indicator" style="margin-bottom:10px;padding:5px 9px;border-radius:5px;font-size:11px;font-weight:700;display:flex;align-items:center;gap:6px;background:${cInfo.bg};color:${cInfo.text};transition:background .2s,color .2s">
      <span class="theme-dot" style="width:8px;height:8px;border-radius:50%;background:currentColor;display:inline-block"></span>
      <span class="theme-label">Color: ${cInfo.label}</span>
    </div>
  `;
}

function bindModalThemePreview(container){
  container.querySelectorAll('.modal-theme-select').forEach(sel=>{
    sel.addEventListener('change',()=>{
      const parentForm=sel.closest('form')||container;
      const indicator=parentForm.querySelector('.modal-theme-indicator');
      const dot=parentForm.querySelector('.theme-dot');
      const label=parentForm.querySelector('.theme-label');
      if(!indicator) return;
      const cInfo=getThemeColorInfo(sel.value);
      indicator.style.background=cInfo.bg;
      indicator.style.color=cInfo.text;
      if(label) label.textContent=`Color: ${cInfo.label}`;
    });
  });
}

function openCapture(type){
  if(type === 'sticker') return openStickerFolder();
  editingHighlightedId=null;
  captureType=type;
  document.querySelector('#captureTitle').textContent=captureLabels[type]||'Nota';

  const forms={
    note:`
      ${renderScopeFields('LinkedIn')}
      ${input('Título','title','placeholder="Ej. Idea para guardar" required')}
      <label class="capture-field">Texto o contexto
        <textarea name="description" placeholder="Escribe lo que quieres recordar…"></textarea>
      </label>
    `,
    image:`
      ${renderScopeFields('Instagram')}
      <label class="capture-field">Selecciona la imagen o imágenes
        <input id="captureImageInput" name="file" type="file" accept="image/*" multiple required>
      </label>
      <div id="imagePreviewContainer" style="display:none;margin:8px 0;text-align:center">
        <div id="imagePreviewList" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;max-height:160px;overflow-y:auto;padding:6px 4px"></div>
        <span id="imagePreviewCount" style="display:block;font-size:11px;color:#64748b;margin-top:4px;font-weight:600"></span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <label class="capture-field">Alto de la imagen
          <select name="cardHeight">
            <option value="" selected>Auto (proporción natural)</option>
            <option value="150">Compacto (150px)</option>
            <option value="220">Mediano (220px)</option>
            <option value="320">Grande (320px)</option>
            <option value="450">Extra grande (450px)</option>
          </select>
        </label>
        <label class="capture-field">Descripción centrada (opcional)
          <input name="description" placeholder="Ej. QUERÉTARO, AGENTE…">
        </label>
      </div>
    `,
    video:`
      ${renderScopeFields('TikTok')}
      ${input('Link del video','url','type="url" placeholder="https://youtube.com/… o enlace"')}
      ${input('Archivo de video (opcional)','file','type="file" accept="video/*"')}
      ${input('Título del video','title','placeholder="Ej. Análisis de mercado" required')}
      <label class="capture-field">Descripción (opcional)
        <textarea name="description" placeholder="Resumen o notas del video…"></textarea>
      </label>
    `,
    audio:`
      ${renderScopeFields('WhatsApp')}
      ${input('Nota de voz','file','type="file" accept="audio/*" required')}
      ${input('Título','title','placeholder="Ej. Audio de reunión" required')}
      <label class="capture-field">Notas del audio
        <textarea name="description" placeholder="Puntos clave escuchados…"></textarea>
      </label>
    `,
    meeting:`
      ${renderScopeFields('Ventas')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${input('Nombre de la persona','personName','placeholder="Ej. Carlos Alvarez" required')}
        ${input('Cargo / empresa (opcional)','personRole','placeholder="COO · Nómada Labs"')}
      </div>
      ${input('Enlace o link (opcional)','url','type="url" placeholder="https://..."')}
      <label class="capture-field">Foto de la persona (opcional)
        <input name="photo" id="captureMeetingPhotoInput" type="file" accept="image/*">
        <div id="meetingPhotoPreviewContainer" style="display:none;margin-top:8px;align-items:center;gap:12px;padding:8px 10px;background:#f8f9fb;border:1px solid #e2e8f0;border-radius:6px">
          <img id="meetingPhotoPreviewImg" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid #6178ec" alt="Vista previa">
          <span style="font-size:12px;font-weight:600;color:#475569">Foto seleccionada</span>
        </div>
      </label>
      <label class="capture-field">Transcripción de la cita (archivo adjunto)
        <input name="transcript" id="captureMeetingTranscriptInput" type="file" accept=".txt,.pdf,.doc,.docx,.rtf,.vtt,.srt,.md,text/*">
        <div id="meetingTranscriptPreview" style="display:none;margin-top:6px;font-size:12px;font-weight:600;color:#0284c7;align-items:center;gap:6px">
          <span>📄</span>
          <span id="meetingTranscriptName"></span>
        </div>
      </label>
      <label class="capture-field">Notas de la reunión (opcional)
        <textarea name="description" placeholder="Resumen, acuerdos o notas personales"></textarea>
      </label>
    `,
    link:`
      ${renderScopeFields('Web')}
      ${input('URL del enlace','url','type="url" placeholder="https://ejemplo.com" required')}
      <div style="display:grid;grid-template-columns:1fr auto;gap:8px">
        ${input('Nombre o título','title','placeholder="Ej. Moodboards, Notion" required')}
        <label class="capture-field">Ícono (opcional)
          <input name="icon" maxlength="2" placeholder="⌘" value="⌘" style="width:48px;text-align:center">
        </label>
      </div>
      <label class="capture-field">Subtítulo o notas (opcional)
        <input name="description" placeholder="Ej. 16 tarjetas, 2 archivos o notas">
      </label>
    `,
    sticker:`
      ${renderScopeFields('Yo')}
      <label class="capture-field">Selecciona tu sticker (PNG sin fondo)
        <input id="captureStickerInput" name="file" type="file" accept="image/png,image/*" required>
      </label>
      <div id="stickerPreviewContainer" style="display:none;margin:10px 0;text-align:center;padding:12px;background:repeating-conic-gradient(#f0f0f0 0% 25%, #ffffff 0% 50%) 50% / 16px 16px;border-radius:8px;border:1px dashed #d5d9dd">
        <img id="stickerPreviewImg" style="max-height:140px;max-width:100%;object-fit:contain;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.18))">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <label class="capture-field">Tamaño inicial
          <select name="stickerSize">
            <option value="120">Pequeño (120px)</option>
            <option value="180" selected>Mediano (180px)</option>
            <option value="260">Grande (260px)</option>
            <option value="360">Extra grande (360px)</option>
          </select>
        </label>
        <label class="capture-field">Nombre o referencia (opcional)
          <input name="title" placeholder="Ej. Estrella, Logo, Deco…">
        </label>
      </div>
    `,
    upload:`
      ${renderScopeFields('Personal')}
      ${input('Archivo','file','type="file" accept="image/*,video/*,audio/*,.pdf,.txt,.doc,.docx" required')}
      ${input('Título del archivo','title','placeholder="Ej. Documento" required')}
      <label class="capture-field">Notas (opcional)
        <textarea name="description" placeholder="Descripción del archivo…"></textarea>
      </label>
    `,
    file:`
      ${renderScopeFields('Personal', getTodayBoardDayName(), '', 'none', 'Todos')}
      <div id="fileDropArea" style="border:2px dashed #cbd5e1;border-radius:10px;padding:16px 14px;text-align:center;background:#f8fafc;cursor:pointer;transition:all .2s ease;margin-bottom:12px">
        <input type="file" id="captureDocInput" name="files" multiple accept=".doc,.docx,.ppt,.pptx,.xls,.xlsx,.pdf,.txt,.rtf,.zip,.rar,.pages,.numbers,.key,image/*,application/*" style="display:none">
        <div id="fileUploadPrompt" style="display:flex;flex-direction:column;align-items:center;gap:6px">
          <div style="width:38px;height:38px;border-radius:10px;background:#eef2ff;color:#111111;display:grid;place-items:center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div>
            <strong style="display:block;font-size:13px;color:#1e293b;font-weight:700">Elige tus archivos o arrástralos aquí (hasta 4)</strong>
            <span style="font-size:11px;color:#64748b">Word, PDF, Excel, PowerPoint, TXT…</span>
          </div>
        </div>
        <div id="fileUploadPreviewList" style="display:none;flex-direction:column;gap:6px;margin-top:4px;text-align:left"></div>
      </div>
      <label class="capture-field">Título del grupo o curso
        <input name="title" id="fileTitleInput" placeholder="Ej. Curso Neuroventas, Material módulo 1…" required>
      </label>
      <label class="capture-field">Notas o descripción (opcional)
        <input name="description" id="fileDescInput" placeholder="Ej. 4 archivos, resumen del curso…">
      </label>
    `,
    location:`
      ${renderScopeFields('Web', getTodayBoardDayName(), '', 'none', 'Todos')}
      <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:12px">
        <img src="map-icon.png" alt="Mapa" style="width:42px;height:42px;object-fit:contain">
        <div>
          <strong style="display:block;font-size:13px;color:#0f172a">Nueva Ubicación en la cuadrícula</strong>
          <span style="font-size:11px;color:#64748b">Se ubicará dentro del día elegido y podrás arrastrarla arriba o abajo de cualquier tarjeta.</span>
        </div>
      </div>
      <label class="capture-field">Dirección o Lugar
        <input name="address" id="captureLocationAddress" placeholder="Ej. Av. Vitacura 2670, Las Condes o Café del Parque" required>
      </label>
      <label class="capture-field">Nombre o Título (opcional)
        <input name="title" id="captureLocationTitle" placeholder="Ej. Oficina Central, Punto de encuentro...">
      </label>
      <label class="capture-field">Enlace directo a Google Maps o Waze (opcional)
        <input name="url" type="url" placeholder="https://maps.google.com/... (se autogenera si se omite)">
      </label>
      <label class="capture-field">Notas o referencia (opcional)
        <textarea name="description" placeholder="Instrucciones de llegada, piso, estacionamiento o notas…"></textarea>
      </label>
    `,
    idea:`
      ${renderScopeFields('Yo')}
      ${input('Título','title','placeholder="Ej. Foco de la semana" required')}
      <label class="capture-field">Texto de la nota
        <textarea name="description" placeholder="Escribe lo que quieres destacar…"></textarea>
      </label>
      <div class="highlight-options" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:6px">
        <label class="capture-field">Color libre (opcional)
          <input name="fill" type="color" value="#ff3560" style="padding:2px;height:32px">
        </label>
        <label class="capture-field">Color texto
          <select name="textColor">
            <option value="#ffffff" selected>Blanco</option>
            <option value="#111111">Negro</option>
          </select>
        </label>
        <label class="capture-field">Tamaño
          <select name="highlightSize">
            <option value="small">Pequeño (180px)</option>
            <option value="medium" selected>Mediano (280px)</option>
            <option value="large">Grande (420px)</option>
            <option value="banner">Banner (760px)</option>
          </select>
        </label>
      </div>
    `
  };

  captureBody.innerHTML=forms[type]||forms.note;
  const submitBtn=captureForm.querySelector('button[value="default"]');
  if(submitBtn){
    const labels={sticker:'Colocar sticker',note:'Guardar nota',file:'Colocar archivo',image:'Subir imagen',video:'Guardar video',audio:'Guardar audio',meeting:'Guardar reunión',link:'Guardar link',upload:'Subir archivo',idea:'Crear nota destacada'};
    submitBtn.textContent=labels[type]||'Guardar';
  }
  bindModalThemePreview(captureBody);
  captureDialog.showModal();

  if(type==='file'){
    const dropArea = captureBody.querySelector('#fileDropArea');
    const fileInp = captureBody.querySelector('#captureDocInput');
    const promptWrap = captureBody.querySelector('#fileUploadPrompt');
    const prevList = captureBody.querySelector('#fileUploadPreviewList');
    const titleInp = captureBody.querySelector('#fileTitleInput');
    const descInp = captureBody.querySelector('#fileDescInput');
    captureBody._selectedDocFiles = [];

    const renderDocPreviews = () => {
      const files = captureBody._selectedDocFiles || [];
      if (!prevList || !promptWrap) return;
      if (files.length === 0) {
        prevList.style.display = 'none';
        prevList.innerHTML = '';
        promptWrap.style.display = 'flex';
        dropArea.style.borderColor = '#cbd5e1';
        dropArea.style.background = '#f8fafc';
        try { fileInp.value = ''; } catch(_) {}
        return;
      }

      promptWrap.style.display = 'none';
      prevList.style.display = 'flex';
      dropArea.style.borderColor = '#93c5fd';
      dropArea.style.background = '#eff6ff';

      prevList.innerHTML = files.map((f, idx) => {
        const info = getFileDocInfo({ fileName: f.name });
        return `
          <div class="doc-preview-item" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px;background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;box-shadow:0 1px 2px rgba(0,0,0,0.05)">
            <div style="display:flex;align-items:center;gap:8px;overflow:hidden">
              <span style="font-size:11px;font-weight:800;color:${info.color};padding:2px 5px;background:#f1f5f9;border-radius:4px">${info.ext ? info.ext.toUpperCase() : 'DOC'}</span>
              <span style="font-size:12px;font-weight:600;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px">${esc(f.name)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
              <span style="font-size:11px;color:#64748b;font-family:'DM Mono',monospace">${fileSize(f.size)}</span>
              <button type="button" class="btn-remove-doc-item" data-idx="${idx}" title="Quitar archivo" style="width:18px;height:18px;border-radius:50%;background:#ef4444;color:#fff;border:none;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0">×</button>
            </div>
          </div>
        `;
      }).join('');

      prevList.querySelectorAll('.btn-remove-doc-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const removeIdx = parseInt(btn.getAttribute('data-idx'), 10);
          if (!isNaN(removeIdx) && removeIdx >= 0 && removeIdx < captureBody._selectedDocFiles.length) {
            captureBody._selectedDocFiles.splice(removeIdx, 1);
            try {
              const dt = new DataTransfer();
              captureBody._selectedDocFiles.forEach(fl => dt.items.add(fl));
              fileInp.files = dt.files;
            } catch(_) {}
            renderDocPreviews();
          }
        });
      });

      if (titleInp && !titleInp.value.trim()) {
        titleInp.value = files.length === 1 ? files[0].name.replace(/\.[^/.]+$/, "") : `${files.length} archivos`;
      }
      if (descInp && !descInp.value.trim()) {
        const totalBytes = files.reduce((acc, fl) => acc + (fl.size || 0), 0);
        descInp.value = `${files.length} archivos · ${fileSize(totalBytes)}`;
      }
    };

    if(dropArea && fileInp){
      dropArea.addEventListener('click', (e) => {
        if (!e.target.closest('.btn-remove-doc-item')) {
          fileInp.click();
        }
      });
      dropArea.addEventListener('dragover', e => {
        e.preventDefault();
        dropArea.style.borderColor = '#6178ec';
        dropArea.style.background = '#f0f4ff';
      });
      dropArea.addEventListener('dragleave', () => {
        dropArea.style.borderColor = captureBody._selectedDocFiles?.length ? '#93c5fd' : '#cbd5e1';
        dropArea.style.background = captureBody._selectedDocFiles?.length ? '#eff6ff' : '#f8fafc';
      });
      dropArea.addEventListener('drop', e => {
        e.preventDefault();
        if(e.dataTransfer.files && e.dataTransfer.files.length > 0){
          captureBody._selectedDocFiles = Array.from(e.dataTransfer.files).slice(0, 4);
          try {
            const dt = new DataTransfer();
            captureBody._selectedDocFiles.forEach(fl => dt.items.add(fl));
            fileInp.files = dt.files;
          } catch(_) {}
          renderDocPreviews();
        }
      });
      fileInp.addEventListener('change', () => {
        const newFiles = Array.from(fileInp.files || []);
        if (newFiles.length > 0) {
          captureBody._selectedDocFiles = newFiles.slice(0, 4);
          renderDocPreviews();
        }
      });
    }
  }

  if(type==='link'){
    const urlInp=captureBody.querySelector('input[name="url"]');
    const titleInp=captureBody.querySelector('input[name="title"]');
    if(urlInp&&titleInp){
      urlInp.addEventListener('blur',()=>{
        if(!titleInp.value.trim()&&urlInp.value.trim()){
          const dom=getDomainFromUrl(urlInp.value.trim());
          if(dom){
            const name=dom.split('.')[0];
            titleInp.value=name.charAt(0).toUpperCase()+name.slice(1);
          }
        }
      });
    }
  }

  const imgInput=captureBody.querySelector('#captureImageInput');
  if(imgInput){
    captureBody._selectedImageFiles = [];
    let draggedItemIdx = null;

    const renderImagePreviews = () => {
      const files = captureBody._selectedImageFiles || [];
      const previewCont = captureBody.querySelector('#imagePreviewContainer');
      const previewList = captureBody.querySelector('#imagePreviewList');
      const previewCount = captureBody.querySelector('#imagePreviewCount');
      if (!previewCont) return;

      if (files.length === 0) {
        previewCont.style.display = 'none';
        if (previewList) previewList.innerHTML = '';
        if (previewCount) previewCount.textContent = '';
        try { imgInput.value = ''; } catch(_) {}
        return;
      }

      previewCont.style.display = 'block';
      if (previewList) {
        previewList.innerHTML = files.map((f, idx) => {
          const previewUrl = f._previewUrl || (f._previewUrl = URL.createObjectURL(f));
          return `
            <div class="image-preview-item" draggable="true" data-idx="${idx}" title="Arrastra para cambiar el orden" style="position:relative;display:inline-block;width:64px;height:64px;margin:3px;cursor:grab;user-select:none;transition:transform .15s ease,box-shadow .15s ease">
              <img src="${previewUrl}" alt="${f.name || ''}" draggable="false" style="height:64px;width:64px;border-radius:6px;object-fit:cover;box-shadow:0 1px 4px rgba(0,0,0,0.15);display:block;pointer-events:none;-webkit-user-drag:none">
              <span style="position:absolute;bottom:3px;left:3px;background:rgba(15,23,42,0.78);color:#ffffff;font-size:10px;font-weight:800;padding:1px 5px;border-radius:4px;line-height:1.2;pointer-events:none">${idx + 1}</span>
              <button type="button" class="btn-remove-preview-img" data-idx="${idx}" title="Quitar esta foto" aria-label="Quitar esta foto" style="position:absolute;top:-5px;right:-5px;width:18px;height:18px;border-radius:50%;background:#ef4444;color:#ffffff;border:1.5px solid #ffffff;font-size:12px;font-weight:800;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.3);padding:0;z-index:2">×</button>
            </div>
          `;
        }).join('');

        // Listeners para eliminar foto
        previewList.querySelectorAll('.btn-remove-preview-img').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const removeIdx = parseInt(btn.getAttribute('data-idx'), 10);
            if (!isNaN(removeIdx) && removeIdx >= 0 && removeIdx < captureBody._selectedImageFiles.length) {
              captureBody._selectedImageFiles.splice(removeIdx, 1);
              try {
                const dt = new DataTransfer();
                captureBody._selectedImageFiles.forEach(fl => dt.items.add(fl));
                imgInput.files = dt.files;
              } catch(_) {}
              renderImagePreviews();
            }
          });
        });

        // Listeners para reordenar por arrastre (drag & drop)
        const items = previewList.querySelectorAll('.image-preview-item');
        items.forEach(item => {
          item.addEventListener('dragstart', (e) => {
            draggedItemIdx = parseInt(item.getAttribute('data-idx'), 10);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(draggedItemIdx));
            item.style.opacity = '0.35';
            item.style.cursor = 'grabbing';
          });

          item.addEventListener('dragend', () => {
            item.style.opacity = '1';
            item.style.cursor = 'grab';
            draggedItemIdx = null;
            items.forEach(el => {
              el.style.outline = 'none';
              el.style.transform = 'none';
            });
          });

          item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          });

          item.addEventListener('dragenter', (e) => {
            e.preventDefault();
            const targetIdx = parseInt(item.getAttribute('data-idx'), 10);
            if (draggedItemIdx !== null && draggedItemIdx !== targetIdx) {
              item.style.outline = '2px solid #2563eb';
              item.style.outlineOffset = '2px';
              item.style.borderRadius = '6px';
              item.style.transform = 'scale(1.05)';
            }
          });

          item.addEventListener('dragleave', (e) => {
            if (!item.contains(e.relatedTarget)) {
              item.style.outline = 'none';
              item.style.transform = 'none';
            }
          });

          item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.style.outline = 'none';
            item.style.transform = 'none';
            const targetIdx = parseInt(item.getAttribute('data-idx'), 10);
            if (draggedItemIdx !== null && !isNaN(targetIdx) && draggedItemIdx !== targetIdx) {
              const [movedItem] = captureBody._selectedImageFiles.splice(draggedItemIdx, 1);
              captureBody._selectedImageFiles.splice(targetIdx, 0, movedItem);
              try {
                const dt = new DataTransfer();
                captureBody._selectedImageFiles.forEach(fl => dt.items.add(fl));
                imgInput.files = dt.files;
              } catch(_) {}
              draggedItemIdx = null;
              renderImagePreviews();
            }
          });
        });
      }

      if (previewCount) {
        previewCount.textContent = files.length === 1
          ? '1 foto seleccionada'
          : `${files.length} fotos seleccionadas (arrastra para ordenar el carrusel)`;
      }
    };

    imgInput.addEventListener('change', () => {
      captureBody._selectedImageFiles = Array.from(imgInput.files || []);
      renderImagePreviews();
    });
  }

  const stickerInput=captureBody.querySelector('#captureStickerInput');
  if(stickerInput){
    stickerInput.addEventListener('change',()=>{
      const f=stickerInput.files?.[0];
      if(f){
        const previewCont=captureBody.querySelector('#stickerPreviewContainer');
        const previewImg=captureBody.querySelector('#stickerPreviewImg');
        if(previewCont&&previewImg){
          previewImg.src=URL.createObjectURL(f);
          previewCont.style.display='block';
        }
      }
    });
  }

  const meetingPhotoInput=captureBody.querySelector('#captureMeetingPhotoInput');
  if(meetingPhotoInput){
    meetingPhotoInput.addEventListener('change',()=>{
      const f=meetingPhotoInput.files?.[0];
      if(f){
        const previewCont=captureBody.querySelector('#meetingPhotoPreviewContainer');
        const previewImg=captureBody.querySelector('#meetingPhotoPreviewImg');
        if(previewCont&&previewImg){
          previewImg.src=URL.createObjectURL(f);
          previewCont.style.display='flex';
        }
      }
    });
  }

  const meetingTranscriptInput=captureBody.querySelector('#captureMeetingTranscriptInput');
  if(meetingTranscriptInput){
    meetingTranscriptInput.addEventListener('change',()=>{
      const f=meetingTranscriptInput.files?.[0];
      const preview=captureBody.querySelector('#meetingTranscriptPreview');
      const nameEl=captureBody.querySelector('#meetingTranscriptName');
      if(f&&preview&&nameEl){
        nameEl.textContent=`${f.name} (${fileSize(f.size)})`;
        preview.style.display='flex';
      }
    });
  }
  captureBody.querySelector('input,textarea')?.focus();
}
function openHighlightedEditor(t){
  editingHighlightedId=t.id;
  editingTaskId=null;
  captureType='edit-highlight';
  document.querySelector('#captureTitle').textContent='Editar nota destacada';
  captureBody.innerHTML=`
    <div style="margin-bottom:10px">
      <label class="capture-field" style="margin:0">Proyecto
        <select name="project" class="modal-project-select" style="width:100%;padding:7px 8px;border:1px solid #d6dade;border-radius:6px;font-weight:700;font-size:12px;background:#fff;margin-top:4px">
          ${getProjectOptions(t.project || 'Todos')}
        </select>
      </label>
    </div>
    <label class="capture-field">Título<input name="title" value="${esc(t.title)}"></label>
    <label class="capture-field">Texto<textarea name="description">${esc(t.description||'')}</textarea></label>
    <div class="highlight-options"><label class="capture-field">Color de fondo<input name="fill" type="color" value="${esc(t.fill||'#ff3560')}"></label><label class="capture-field">Color del texto<select name="textColor"><option value="#ffffff" ${t.textColor==='#ffffff'||!t.textColor?'selected':''}>Blanco</option><option value="#111111" ${t.textColor==='#111111'?'selected':''}>Negro</option></select></label><label class="capture-field">Tipografía<select name="fontStyle"><option value="Manrope, sans-serif" ${t.fontStyle==='Georgia, serif'||t.fontStyle==="'DM Mono', monospace"?'':'selected'}>Sans</option><option value="Georgia, serif" ${t.fontStyle==='Georgia, serif'?'selected':''}>Editorial</option><option value="'DM Mono', monospace" ${t.fontStyle==="'DM Mono', monospace"?'selected':''}>Mono</option></select></label><label class="capture-field">Tamaño predeterminado<select name="highlightSize"><option value="small" ${t.highlightSize==='small'?'selected':''}>Pequeño (180px)</option><option value="medium" ${(!t.highlightSize||t.highlightSize==='medium')?'selected':''}>Mediano (280px)</option><option value="large" ${t.highlightSize==='large'?'selected':''}>Grande (420px)</option><option value="banner" ${t.highlightSize==='banner'?'selected':''}>Banner (760px)</option></select></label></div>
    <div style="margin-top:16px;padding-top:12px;border-top:1px solid #eef0f2;display:flex;justify-content:space-between;align-items:center"><button type="button" id="btnDeleteHighlighted" style="border:0;background:#fee2e2;color:#dc2626;padding:8px 14px;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer">🗑 Eliminar nota</button><span style="font-size:11px;color:#888">O arrástrala a la papelera</span></div>`;
  captureDialog.showModal();
  document.querySelector('#btnDeleteHighlighted')?.addEventListener('click',()=>{
    tasks=tasks.filter(x=>x.id!==t.id);
    save();
    render();
    try{captureDialog.close();}catch(_){}
  });
  captureBody.querySelector('[name="title"]')?.focus();
}

function openNoteEditor(t){
  editingTaskId=t.id;
  editingHighlightedId=null;
  captureType='edit-task';
  document.querySelector('#captureTitle').textContent='Editar nota';
  const defaultTheme=t.channel||'LinkedIn';
  const defaultDay=t.day||'Lunes';
  const defaultTime=t.time||'';
  const defaultProject=t.project||'Todos';

  captureBody.innerHTML=`
    ${renderScopeFields(defaultTheme, defaultDay, defaultTime, defaultProject)}
    ${input('Título','title',`value="${esc(t.title)}" placeholder="Ej. Idea para guardar" required`)}
    <label class="capture-field">Texto o contexto
      <textarea name="description" placeholder="Escribe lo que quieres recordar…">${esc(t.description||'')}</textarea>
    </label>
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid #eef0f2;display:flex;justify-content:space-between;align-items:center">
      <button type="button" id="btnDeleteNote" style="border:0;background:#fee2e2;color:#dc2626;padding:8px 14px;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer">🗑 Eliminar nota</button>
      <span style="font-size:11px;color:#888">O arrástrala a la papelera</span>
    </div>
  `;
  bindModalThemePreview(captureBody);
  captureDialog.showModal();
  document.querySelector('#btnDeleteNote')?.addEventListener('click',()=>{
    tasks=tasks.filter(x=>x.id!==t.id);
    removeRecurringTask(t.id);
    save();
    render();
    try{captureDialog.close();}catch(_){}
  });
  captureBody.querySelector('input[name="title"]')?.focus();
}

function openMeetingEditor(t){
  editingTaskId=t.id;
  editingHighlightedId=null;
  captureType='edit-meeting';
  document.querySelector('#captureTitle').textContent='Editar reunión';
  const defaultTheme=t.channel||'Ventas';
  const defaultDay=t.day||'Lunes';
  const defaultTime=t.time||(t.schedule&&!t.schedule.includes(' ')?t.schedule:'');
  const defaultProject=t.project||'Todos';

  captureBody.innerHTML=`
    ${renderScopeFields(defaultTheme, defaultDay, defaultTime, defaultProject)}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${input('Nombre de la persona','personName',`value="${esc(t.personName||t.title||'')}" placeholder="Ej. Carlos Alvarez" required`)}
      ${input('Cargo / empresa (opcional)','personRole',`value="${esc(t.personRole||'')}" placeholder="COO · Nómada Labs"`)}
    </div>
    ${input('Enlace o link (opcional)','url',`value="${esc(t.url||'')}" type="url" placeholder="https://..."`)}
    <label class="capture-field">Foto de la persona (opcional)
      <input name="photo" id="captureMeetingPhotoInput" type="file" accept="image/*">
      <div id="meetingPhotoPreviewContainer" style="display:${t.image?'flex':'none'};margin-top:8px;align-items:center;gap:12px;padding:8px 10px;background:#f8f9fb;border:1px solid #e2e8f0;border-radius:6px">
        <img id="meetingPhotoPreviewImg" src="${t.image||''}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid #6178ec" alt="Foto">
        <div style="display:flex;flex-direction:column;gap:2px">
          <span style="font-size:12px;font-weight:600;color:#475569">Foto actual</span>
          <button type="button" id="btnRemoveMeetingPhoto" style="border:0;background:none;color:#ef4444;font-size:11px;font-weight:700;padding:0;cursor:pointer;text-align:left">Eliminar foto</button>
        </div>
      </div>
      <input type="hidden" name="removePhoto" id="removeMeetingPhotoFlag" value="0">
    </label>
    <label class="capture-field">Transcripción de la cita (archivo adjunto)
      <input name="transcript" id="captureMeetingTranscriptInput" type="file" accept=".txt,.pdf,.doc,.docx,.rtf,.vtt,.srt,.md,text/*">
      <div id="meetingTranscriptPreview" style="display:${t.transcriptName?'flex':'none'};margin-top:6px;font-size:12px;font-weight:600;color:#0284c7;align-items:center;gap:6px">
        <span>📄</span>
        <span id="meetingTranscriptName">${esc(t.transcriptName||'')}</span>
        ${t.transcriptSize ? `<span style="font-size:10px;color:#64748b">(${fileSize(t.transcriptSize)})</span>` : ''}
        <button type="button" id="btnRemoveMeetingTranscript" style="border:0;background:none;color:#ef4444;font-size:11px;font-weight:700;padding:0;cursor:pointer">Quitar</button>
      </div>
      <input type="hidden" name="removeTranscript" id="removeMeetingTranscriptFlag" value="0">
    </label>
    <label class="capture-field">Notas de la reunión (opcional)
      <textarea name="description" placeholder="Resumen, acuerdos o notas personales">${esc(t.description&&t.description!=='Elemento guardado en tu agenda.'?t.description:'')}</textarea>
    </label>
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid #eef0f2;display:flex;justify-content:space-between;align-items:center">
      <button type="button" id="btnDeleteMeeting" style="border:0;background:#fee2e2;color:#dc2626;padding:8px 14px;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer">🗑 Eliminar reunión</button>
      <span style="font-size:11px;color:#888">O arrástrala a la papelera</span>
    </div>
  `;
  const submitBtn=captureForm.querySelector('button[value="default"]');
  if(submitBtn)submitBtn.textContent='Guardar cambios';

  bindModalThemePreview(captureBody);
  captureDialog.showModal();

  const meetingPhotoInput=captureBody.querySelector('#captureMeetingPhotoInput');
  const previewCont=captureBody.querySelector('#meetingPhotoPreviewContainer');
  const previewImg=captureBody.querySelector('#meetingPhotoPreviewImg');
  const removeFlag=captureBody.querySelector('#removeMeetingPhotoFlag');
  const btnRemovePhoto=captureBody.querySelector('#btnRemoveMeetingPhoto');

  if(meetingPhotoInput){
    meetingPhotoInput.addEventListener('change',()=>{
      const f=meetingPhotoInput.files?.[0];
      if(f&&previewCont&&previewImg){
        previewImg.src=URL.createObjectURL(f);
        previewCont.style.display='flex';
        if(removeFlag)removeFlag.value='0';
      }
    });
  }

  if(btnRemovePhoto){
    btnRemovePhoto.addEventListener('click',()=>{
      if(removeFlag)removeFlag.value='1';
      if(previewCont)previewCont.style.display='none';
      if(meetingPhotoInput)meetingPhotoInput.value='';
    });
  }

  const meetingTranscriptInput = captureBody.querySelector('#captureMeetingTranscriptInput');
  const transcriptPreview = captureBody.querySelector('#meetingTranscriptPreview');
  const transcriptNameEl = captureBody.querySelector('#meetingTranscriptName');
  const removeTranscriptFlag = captureBody.querySelector('#removeMeetingTranscriptFlag');
  const btnRemoveTranscript = captureBody.querySelector('#btnRemoveMeetingTranscript');

  if(meetingTranscriptInput){
    meetingTranscriptInput.addEventListener('change', () => {
      const f = meetingTranscriptInput.files?.[0];
      if(f && transcriptPreview && transcriptNameEl){
        transcriptNameEl.textContent = `${f.name} (${fileSize(f.size)})`;
        transcriptPreview.style.display = 'flex';
        if(removeTranscriptFlag) removeTranscriptFlag.value = '0';
      }
    });
  }

  if(btnRemoveTranscript){
    btnRemoveTranscript.addEventListener('click', () => {
      if(removeTranscriptFlag) removeTranscriptFlag.value = '1';
      if(transcriptPreview) transcriptPreview.style.display = 'none';
      if(meetingTranscriptInput) meetingTranscriptInput.value = '';
    });
  }

  document.querySelector('#btnDeleteMeeting')?.addEventListener('click',()=>{
    tasks=tasks.filter(x=>x.id!==t.id);
    removeRecurringTask(t.id);
    save();
    render();
    try{captureDialog.close();}catch(_){}
  });

  captureBody.querySelector('input[name="personName"]')?.focus();
}

function openLocationEditor(t){
  editingTaskId = t.id;
  editingHighlightedId = null;
  captureType = 'edit-location';
  document.querySelector('#captureTitle').textContent = 'Editar Ubicación';
  const defaultTheme = t.channel || 'Web';
  const defaultDay = t.day || 'Lunes';
  const defaultTime = t.time || '';
  const defaultProject = t.project || 'Todos';

  captureBody.innerHTML = `
    ${renderScopeFields(defaultTheme, defaultDay, defaultTime, defaultProject)}
    <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:12px">
      <img src="map-icon.png" alt="Mapa" style="width:40px;height:40px;object-fit:contain">
      <div>
        <strong style="display:block;font-size:13px;color:#0f172a">Editar Ubicación en el mapa</strong>
        <span style="font-size:11px;color:#64748b">Modifica la dirección, nombre o enlace directo.</span>
      </div>
    </div>
    <label class="capture-field">Dirección o Lugar
      <input name="address" id="captureLocationAddress" value="${esc(t.address||t.title||'')}" placeholder="Ej. Av. Providencia 1234, Santiago o Café del Parque" required>
    </label>
    <label class="capture-field">Nombre o Título (opcional)
      <input name="title" id="captureLocationTitle" value="${esc(t.title||'')}" placeholder="Ej. Oficina Central, Punto de encuentro...">
    </label>
    <label class="capture-field">Enlace directo a Google Maps o Waze (opcional)
      <input name="url" type="url" value="${esc(t.url||t.mapUrl||'')}" placeholder="https://maps.google.com/...">
    </label>
    <label class="capture-field">Notas o referencia (opcional)
      <textarea name="description" placeholder="Instrucciones de llegada, piso, estacionamiento o notas…">${esc(t.description&&t.description!==t.address?t.description:'')}</textarea>
    </label>
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid #eef0f2;display:flex;justify-content:space-between;align-items:center">
      <button type="button" id="btnDeleteLocation" style="border:0;background:#fee2e2;color:#dc2626;padding:8px 14px;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer">Eliminar ubicación</button>
      <span style="font-size:11px;color:#888">O arrástrala a la papelera</span>
    </div>
  `;
  bindModalThemePreview(captureBody);
  captureDialog.showModal();
  document.querySelector('#btnDeleteLocation')?.addEventListener('click', () => {
    tasks = tasks.filter(x => x.id !== t.id);
    removeRecurringTask(t.id);
    save();
    render();
    try { captureDialog.close(); } catch(_) {}
  });
  captureBody.querySelector('input[name="address"]')?.focus();
}

function dataUrl(file){return new Promise((resolve,reject)=>{if(!file||!(file instanceof Blob)||file.size===0)return resolve('');const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}

function compressImage(file,maxWidth=680,maxHeight=680,quality=0.74,keepPng=false){
  return new Promise(resolve=>{
    if(!file||!(file instanceof Blob)||file.size===0)return resolve('');
    const timer=setTimeout(()=>resolve(''),2500);
    const reader=new FileReader();
    reader.onerror=()=>{clearTimeout(timer);resolve('');};
    reader.onload=e=>{
      const img=new Image();
      img.onerror=()=>{clearTimeout(timer);resolve(e.target.result);};
      img.onload=()=>{
        clearTimeout(timer);
        let w=img.width,h=img.height;
        if(w>maxWidth||h>maxHeight){
          const ratio=Math.min(maxWidth/w,maxHeight/h);
          w=Math.round(w*ratio);
          h=Math.round(h*ratio);
        }
        try{
          const canvas=document.createElement('canvas');
          canvas.width=w;
          canvas.height=h;
          const ctx=canvas.getContext('2d');
          ctx.drawImage(img,0,0,w,h);
          const isPng = keepPng && (file.type === 'image/png' || file.name?.toLowerCase().endsWith('.png'));
          const mime = isPng ? 'image/png' : 'image/jpeg';
          resolve(canvas.toDataURL(mime, quality));
        }catch(_){
          resolve(e.target.result);
        }
      };
      img.src=e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

captureForm.addEventListener('submit',async e=>{
  e.preventDefault();
  if(captureForm.dataset.submitting === 'true') return;
  captureForm.dataset.submitting = 'true';
  const submitBtn=captureForm.querySelector('button[value="default"]');
  const oldText=submitBtn?submitBtn.textContent:'';
  if(submitBtn){
    submitBtn.disabled = true;
    submitBtn.textContent='Guardando…';
  }
  try{
    const form=new FormData(captureForm);
    if(captureType==='edit-highlight'){
      const note=tasks.find(t=>t.id===editingHighlightedId);
      if(note){
        note.title=String(form.get('title')||'').trim()||'Nota destacada';
        note.description=String(form.get('description')||'').trim();
        note.project=String(form.get('project')||note.project||'Todos');
        note.fill=String(form.get('fill')||note.fill||'#ff3560');
        note.textColor=String(form.get('textColor')||note.textColor||'#ffffff');
        note.fontStyle=String(form.get('fontStyle')||note.fontStyle||'Manrope, sans-serif');
        const chosenSize=String(form.get('highlightSize')||note.highlightSize||'medium');
        note.highlightSize=chosenSize;
        const presetW={small:180,medium:280,large:420,banner:760};
        const presetH={small:100,medium:140,large:190,banner:160};
        if(form.get('highlightSize')&&presetW[chosenSize]){
          note.noteWidth=presetW[chosenSize];
          note.noteHeight=presetH[chosenSize];
        }
        save();
        render();
      }
      try{captureDialog.close();}catch(_){}
      try{captureForm.reset();}catch(_){}
      return;
    }
    if(captureType==='edit-task'){
      const task=tasks.find(t=>t.id===editingTaskId);
      if(task){
        task.title=String(form.get('title')||'').trim()||'Nota';
        task.description=String(form.get('description')||'').trim();
        task.channel=String(form.get('channel')||task.channel||'LinkedIn');
        task.project=String(form.get('project')||task.project||'Todos');
        task.day=String(form.get('day')||task.day||'Lunes');
        const chosenTime=String(form.get('time')||'').trim();
        task.time=chosenTime||undefined;
        delete task.recurrence;
        task.schedule=chosenTime||undefined;

        const channelColorMap = {
          'LinkedIn': 'linkedin',
          'WhatsApp': 'whatsapp',
          'Instagram': 'instagram',
          'TikTok': 'tiktok',
          'X': 'x',
          'Email': 'email',
          'Web': 'web',
          'Investigación': 'research',
          'Prospección': 'prospeccion',
          'Ventas': 'sales',
          'Yo': 'neutral',
          'Personal': 'neutral'
        };
        let noteColor=channelColorMap[task.channel]||'neutral';
        try{
          const customChannels=JSON.parse(localStorage.getItem('mindJeanetteCustomChannels')||'[]');
          const match=customChannels.find(c=>c.name===task.channel);
          if(match){
            noteColor='custom';
            task.fill=match.fill||'#6178ec';
            task.textColor='#ffffff';
          }
        }catch(_){}
        task.color=noteColor;

        save();
        render();
      }
      try{captureDialog.close();}catch(_){}
      try{captureForm.reset();}catch(_){}
      return;
    }
    if(captureType==='edit-meeting'){
      const task=tasks.find(t=>t.id===editingTaskId);
      if(task){
        const personName=String(form.get('personName')||'').trim();
        task.personName=personName;
        task.title=personName||'Reunión';
        task.personRole=String(form.get('personRole')||'').trim();
        task.url=String(form.get('url')||'').trim();
        task.description=String(form.get('description')||'').trim();
        task.channel=String(form.get('channel')||task.channel||'Ventas');
        task.project=String(form.get('project')||task.project||'Todos');
        task.day=String(form.get('day')||task.day||'Lunes');
        const chosenTime=String(form.get('time')||'').trim();
        task.time=chosenTime||undefined;
        delete task.recurrence;
        task.schedule=chosenTime||undefined;

        const photo=form.get('photo');
        const removePhoto=form.get('removePhoto')==='1';
        if(removePhoto){
          task.image='';
        } else if(photo && photo.size>0){
          const isPhotoPng = (photo.type === 'image/png' || photo.name?.toLowerCase().endsWith('.png'));
          task.image=await compressImage(photo, 480, 480, 0.78, isPhotoPng);
        }

        const transcriptFile=form.get('transcript');
        const removeTranscript=form.get('removeTranscript')==='1';
        if(removeTranscript){
          task.transcriptName='';
          task.transcriptData='';
          task.transcriptSize=0;
        } else if(transcriptFile && transcriptFile instanceof Blob && transcriptFile.size>0){
          task.transcriptName=transcriptFile.name;
          task.transcriptSize=transcriptFile.size;
          task.transcriptData=await dataUrl(transcriptFile);
        }

        const channelColorMap = {
          'LinkedIn': 'linkedin',
          'WhatsApp': 'whatsapp',
          'Instagram': 'instagram',
          'TikTok': 'tiktok',
          'X': 'x',
          'Email': 'email',
          'Web': 'web',
          'Investigación': 'research',
          'Prospección': 'prospeccion',
          'Ventas': 'sales',
          'Yo': 'neutral',
          'Personal': 'neutral'
        };
        let noteColor=channelColorMap[task.channel]||'sales';
        try{
          const customChannels=JSON.parse(localStorage.getItem('mindJeanetteCustomChannels')||'[]');
          const match=customChannels.find(c=>c.name===task.channel);
          if(match){
            noteColor='custom';
            task.fill=match.fill||'#6178ec';
            task.textColor='#ffffff';
          }
        }catch(_){}
        task.color=noteColor;

        save();
        render();
      }
      try{captureDialog.close();}catch(_){}
      try{captureForm.reset();}catch(_){}
      return;
    }
    if(captureType==='edit-location'){
      const task=tasks.find(t=>t.id===editingTaskId);
      if(task){
        const address=String(form.get('address')||'').trim();
        const title=String(form.get('title')||address||'Ubicación').trim();
        const userUrl=String(form.get('url')||'').trim();
        const mapUrl=userUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address||title)}`;

        task.address=address;
        task.title=title;
        task.url=mapUrl;
        task.mapUrl=mapUrl;
        task.description=String(form.get('description')||address).trim();
        task.channel=String(form.get('channel')||task.channel||'Web');
        task.project=String(form.get('project')||task.project||'Todos');
        task.day=String(form.get('day')||task.day||'Lunes');
        const chosenTime=String(form.get('time')||'').trim();
        task.time=chosenTime||undefined;
        delete task.recurrence;
        task.featured=false;

        save();
        render();
      }
      try{captureDialog.close();}catch(_){}
      try{captureForm.reset();}catch(_){}
      return;
    }
    if(captureType==='file'){
      const fileInput = captureBody.querySelector('#captureDocInput');
      const filesToProcess = (captureBody._selectedDocFiles && captureBody._selectedDocFiles.length > 0)
        ? captureBody._selectedDocFiles
        : (fileInput && fileInput.files && fileInput.files.length > 0 ? Array.from(fileInput.files) : []);

      if(filesToProcess.length === 0){
        alert('Por favor selecciona al menos un archivo.');
        if(submitBtn){
          submitBtn.disabled=false;
          submitBtn.textContent=oldText||'Guardar';
        }
        delete captureForm.dataset.submitting;
        return;
      }

      if(submitBtn) submitBtn.textContent = filesToProcess.length > 1 ? `Procesando ${filesToProcess.length} archivos…` : 'Procesando…';

      const attachments = [];
      for(const f of filesToProcess){
        let fData = '';
        if(f instanceof Blob && f.size > 0 && f.size <= 4*1024*1024){
          try{ fData = await dataUrl(f); }catch(_){}
        }
        const fExt = (f.name || '').split('.').pop().toLowerCase();
        attachments.push({
          id: 'f_' + Math.random().toString(36).substr(2, 9),
          name: f.name,
          size: f.size || 0,
          ext: fExt,
          data: fData
        });
      }

      const totalSize = attachments.reduce((a, b) => a + (b.size || 0), 0);
      const defaultTitle = attachments.length === 1 ? attachments[0].name.replace(/\.[^/.]+$/, "") : `${attachments.length} archivos`;
      const title = String(form.get('title') || defaultTitle).trim() || defaultTitle;
      const defaultDesc = attachments.length === 1 ? fileSize(attachments[0].size) : `${attachments.length} archivos · ${fileSize(totalSize)}`;
      const description = String(form.get('description') || defaultDesc).trim() || defaultDesc;

      const chosenChannel = String(form.get('channel') || 'Personal');
      const chosenProject = String(form.get('project') || 'Todos');
      const chosenDay = String(form.get('day') || 'Lunes');
      const chosenTime = String(form.get('time') || '').trim();

      const newTask = {
        id: Date.now(),
        type: 'file',
        featured: false,
        title,
        fileName: attachments[0].name,
        fileSize: totalSize,
        fileExt: attachments[0].ext,
        fileData: attachments[0].data,
        files: attachments,
        description,
        channel: chosenChannel,
        project: chosenProject,
        day: chosenDay,
        time: chosenTime || undefined,
        status: 'pendiente',
        agent: 'Fer',
        count: 'DOC',
        color: 'neutral',
        startWeekKey: weekKey(semanaVisible)
      };
      tasks.push(newTask);
      save();
      render();
      delete captureForm.dataset.submitting;
      if(submitBtn){
        submitBtn.disabled=false;
        submitBtn.textContent=oldText||'Guardar';
      }
      try{captureDialog.close();}catch(_){}
      try{captureForm.reset();}catch(_){}
      return;
    }
    if(captureType==='location'){
      const address=String(form.get('address')||'').trim();
      const title=String(form.get('title')||address||'Ubicación').trim();
      const userUrl=String(form.get('url')||'').trim();
      const mapUrl=userUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address||title)}`;

      const chosenChannel=String(form.get('channel')||'Web');
      const chosenProject=String(form.get('project')||'Todos');
      const chosenDay=String(form.get('day')||'Lunes');
      const chosenTime=String(form.get('time')||'').trim();
      const desc=String(form.get('description')||address).trim();

      const newTask={
        id:Date.now(),
        type:'location',
        featured:false,
        title,
        address,
        url:mapUrl,
        mapUrl,
        description:desc,
        channel:chosenChannel,
        project:chosenProject,
        day:chosenDay,
        time:chosenTime||undefined,
        status:'pendiente',
        agent:'Fer',
        count:'MAP',
        color:'neutral',
        startWeekKey:weekKey(semanaVisible)
      };

      tasks.push(newTask);
      save();
      render();
      delete captureForm.dataset.submitting;
      if(submitBtn){
        submitBtn.disabled=false;
        submitBtn.textContent=oldText||'Guardar';
      }
      try{captureDialog.close();}catch(_){}
      try{captureForm.reset();}catch(_){}
      return;
    }
    const file=form.get('file'),photo=form.get('photo'),transcript=form.get('transcript');
    let defaultTitle='Nueva nota';
    if(captureType==='image')defaultTitle='Imagen';
    else if(captureType==='video')defaultTitle='Video guardado';
    else if(captureType==='audio')defaultTitle='Nota de voz';
    else if(captureType==='meeting')defaultTitle=form.get('personName')||'Reunión';
    else if(captureType==='link'){
      const rawUrl = String(form.get('url')||'');
      const dom = getDomainFromUrl(rawUrl);
      defaultTitle = dom ? (dom.charAt(0).toUpperCase() + dom.slice(1)) : 'Enlace';
    }else if(captureType==='upload'){
      defaultTitle=file?.name||'Archivo';
    }else if(captureType==='sticker'){
      defaultTitle='Sticker';
    }else if(captureType==='idea'){
      defaultTitle='Nota destacada';
    }
    const title=captureType==='meeting'?(String(form.get('personName')||'').trim()||defaultTitle):(String(form.get('title')||'').trim()||defaultTitle);
    let type=captureType,image='',media='',color='neutral';
    if(captureType==='upload'){
      if(file?.type==='application/pdf'||file?.name?.toLowerCase().endsWith('.pdf'))type='pdf';
      else if(file?.type?.startsWith('image/'))type='image';
      else if(file?.type?.startsWith('video/'))type='video';
      else if(file?.type?.startsWith('audio/'))type='audio';
      else type='file';
    }
    const isPngFile = (file?.type === 'image/png' || file?.name?.toLowerCase().endsWith('.png'));
    let imagesList = [];
    const imageInput = captureBody.querySelector('#captureImageInput');
    const imageFiles = (captureType === 'image')
      ? (captureBody._selectedImageFiles && captureBody._selectedImageFiles.length > 0
          ? captureBody._selectedImageFiles
          : (imageInput && imageInput.files && imageInput.files.length > 0 ? Array.from(imageInput.files) : []))
      : [];

    if(captureType === 'image'){
      if(imageFiles.length === 0){
        alert('Por favor selecciona al menos una imagen.');
        if(submitBtn) submitBtn.textContent = 'Subir imagen';
        return;
      }
      if(submitBtn) submitBtn.textContent = imageFiles.length > 1 ? `Procesando ${imageFiles.length} fotos…` : 'Procesando…';
      for(const f of imageFiles){
        const isPng = (f.type === 'image/png' || f.name?.toLowerCase().endsWith('.png'));
        const compressed = await compressImage(f, 900, 900, 0.82, isPng);
        if(compressed) imagesList.push(compressed);
      }
      image = imagesList[0] || '';
    } else if(type==='image'||file?.type?.startsWith('image/')){
      image = await compressImage(file, 900, 900, 0.82, isPngFile);
      if(image) imagesList = [image];
    }
    if(type==='sticker')image=await compressImage(file, 800, 800, 0.82, true);
    if(type==='video'||type==='audio')media=await dataUrl(file);
    const isPhotoPng = (photo?.type === 'image/png' || photo?.name?.toLowerCase().endsWith('.png'));
    if(type==='meeting')image=await compressImage(photo, 480, 480, 0.78, isPhotoPng);
    if(type==='link')color='web';

    const channelColorMap = {
      'LinkedIn': 'linkedin',
      'WhatsApp': 'whatsapp',
      'Instagram': 'instagram',
      'TikTok': 'tiktok',
      'X': 'x',
      'Email': 'email',
      'Web': 'web',
      'Investigación': 'research',
      'Prospección': 'prospeccion',
      'Ventas': 'sales',
      'Yo': 'neutral',
      'Personal': 'neutral'
    };

    const chosenChannel = String(form.get('channel') || (type === 'meeting' ? 'Ventas' : type === 'link' ? 'Web' : type === 'image' ? 'Instagram' : type === 'video' ? 'TikTok' : type === 'audio' ? 'WhatsApp' : 'LinkedIn'));
    const chosenProject = String(form.get('project') || 'Todos');
    const chosenDay = String(form.get('day') || getTodayBoardDayName());
    const chosenTime = String(form.get('time') || '').trim();
    let formattedSchedule = String(form.get('schedule') || chosenTime).trim();

    let noteColor = channelColorMap[chosenChannel] || 'neutral';
    let customFill = '';
    let customTextColor = '#ffffff';

    try {
      const customChannels = JSON.parse(localStorage.getItem('mindJeanetteCustomChannels') || '[]');
      const match = customChannels.find(c => c.name === chosenChannel);
      if (match) {
        noteColor = 'custom';
        customFill = match.fill || '#6178ec';
        customTextColor = '#ffffff';
      }
    } catch (_) {}

    color = noteColor;

    const isIdea=captureType==='idea';
    const isSticker=captureType==='sticker';
    const isFeatured=isIdea||isSticker;
    const chosenStickerSize=form.get('stickerSize')?parseInt(form.get('stickerSize'),10):180;
    const chosenSize=String(form.get('highlightSize')||'medium');
    const presetW={small:180,medium:280,large:420,banner:760};
    const presetH={small:100,medium:140,large:190,banner:160};
    const existingFeatured=tasks.filter(x=>x.featured).length;

    const rawHeight=form.get('cardHeight');
    const cardHeight=rawHeight?parseInt(rawHeight,10):null;

    let transcriptData = '';
    if(transcript && transcript instanceof Blob && transcript.size > 0){
      try{ transcriptData = await dataUrl(transcript); }catch(_){}
    }

    let spawnX = 35;
    let spawnY = 120;

    if(isFeatured){
      const boardEl = document.querySelector('#board');
      if(boardEl){
        const bRect = boardEl.getBoundingClientRect();
        const wbEl = document.querySelector('.task-card.type-whiteboard');
        let placedOnWb = false;

        // 1. Si hay un Lienzo visible en el área de trabajo actual de Fer:
        if(wbEl){
          const wbRect = wbEl.getBoundingClientRect();
          if(wbRect.bottom > 90 && wbRect.top < window.innerHeight - 50){
            const visibleTop = Math.max(wbRect.top + 50, 90);
            const visibleBottom = Math.min(wbRect.bottom - 50, window.innerHeight - 50);
            const targetClientY = (visibleTop + visibleBottom) / 2;
            spawnY = Math.round(targetClientY - bRect.top + ((existingFeatured * 20) % 80));

            const visibleLeft = Math.max(wbRect.left + 50, 100);
            const visibleRight = Math.min(wbRect.right - 100, window.innerWidth - 100);
            const targetClientX = (visibleLeft + visibleRight) / 2;
            spawnX = Math.round(((targetClientX - bRect.left) / bRect.width) * 100);
            placedOnWb = true;
          }
        }

        // 2. Si no hay lienzo visible, colocar en el centro de la pantalla que Fer está visualizando:
        if(!placedOnWb){
          const screenCenterY = (window.innerHeight / 2) - bRect.top;
          spawnY = Math.round(Math.max(60, screenCenterY + ((existingFeatured * 20) % 90)));
          spawnX = Math.round(Math.max(5, Math.min(85, 35 + ((existingFeatured * 5) % 25))));
        }
      }
    }

    const newTask = {
      id:Date.now(),
      startWeekKey: weekKey(semanaVisible),
      day:chosenDay,
      title: (captureType === 'image' && form.get('description')) ? String(form.get('description')).trim() : title,
      time:chosenTime||undefined,
      schedule:formattedSchedule||undefined,
      description: String(form.get('description')||form.get('title')||'').trim(),
      channel:chosenChannel,
      project:chosenProject,
      status:'pendiente',
      agent:'Fer',
      count:isSticker?'🌸':(type==='pdf'?'PDF':type==='audio'?'♪':type==='video'?'▶':type==='link'?'⌘':isIdea?'✦':'•'),
      color:noteColor,
      type,
      size:['video','image','meeting'].includes(type)?'wide':'small',
      image,
      images: imagesList.length > 1 ? imagesList : undefined,
      currentImageIdx: 0,
      cardHeight:cardHeight||undefined,
      media,
      url:String(form.get('url')||''),
      icon:String(form.get('icon')||'⌘'),
      squircleColor:String(form.get('squircleColor')||'#c084fc'),
      fileName:file?.name||'',
      fileSize:file?.size||0,
      publication:String(form.get('description')||''),
      personName:String(form.get('personName')||''),
      personRole:String(form.get('personRole')||''),
      transcriptName:transcript?.name||'',
      transcriptSize:transcript?.size||0,
      transcriptData:transcriptData||undefined,
      featured:isFeatured,
      fill:isIdea?String(form.get('fill')||'#ff3560'):(noteColor==='custom'?customFill:undefined),
      textColor:isIdea?String(form.get('textColor')||'#ffffff'):(noteColor==='custom'?customTextColor:undefined),
      fontStyle:String(form.get('fontStyle')||'Manrope, sans-serif'),
      highlightSize:chosenSize,
      noteWidth:isSticker?chosenStickerSize:(presetW[chosenSize]||280),
      noteHeight:isSticker?chosenStickerSize:(presetH[chosenSize]||140),
      x:isFeatured?spawnX:42,
      y:isFeatured?spawnY:42
    };
    window.MindFerMediaVault = window.MindFerMediaVault || {};
    if(image && image.length > 50){
      window.MindFerMediaVault[String(newTask.id)] = image;
    }
    tasks.push(newTask);
    save();
    render();
    setTimeout(() => {
      const createdEl = document.querySelector(`.floating-note[data-id="${newTask.id}"]`);
      if(createdEl){
        createdEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 60);
    try{captureDialog.close();}catch(_){}
    try{captureForm.reset();}catch(_){}
  }catch(err){
    console.error('Error al guardar pieza:',err);
  }finally{
    delete captureForm.dataset.submitting;
    if(submitBtn){
      submitBtn.disabled = false;
      submitBtn.textContent=oldText||'Guardar';
    }
    try{captureDialog.close();}catch(_){}
    try{captureForm.reset();}catch(_){}
  }
});document.querySelector('#closeCapture').addEventListener('click',()=>captureDialog.close());document.querySelector('#cancelCapture').addEventListener('click',()=>captureDialog.close());

function getRecurringTasks(){ return []; }
function saveRecurringTask(_task){}
function removeRecurringTask(_id){}

let semanaVisible=inicioDeSemana(new Date());

function deduplicateWeekTasks(wKey, list){
  if(!Array.isArray(list)) return [];
  const seenIds = new Set();
  return list.filter(item => {
    if(!item || !item.id) return false;
    if(item.startWeekKey && item.startWeekKey !== wKey) return false;
    if(seenIds.has(item.id)) return false;
    seenIds.add(item.id);
    return true;
  });
}

function limpiarTodasLasSemanasDuplicadas(){
  try {
    if(!weeks || typeof weeks !== 'object') return;
    const weekKeys = Object.keys(weeks).sort();
    weekKeys.forEach(k => {
      weeks[k] = deduplicateWeekTasks(k, weeks[k]);
    });

    const idToWeeks = new Map();
    weekKeys.forEach(wk => {
      (weeks[wk] || []).forEach(item => {
        if(!item || !item.id || item.id <= 1000) return;
        if(!idToWeeks.has(item.id)) idToWeeks.set(item.id, []);
        idToWeeks.get(item.id).push({ wk, item });
      });
    });

    idToWeeks.forEach((occurrences, id) => {
      if(occurrences.length <= 1) return;
      let homeWk = null;
      const withStart = occurrences.find(o => o.item.startWeekKey && weeks[o.item.startWeekKey]);
      if(withStart){
        homeWk = withStart.item.startWeekKey;
      } else {
        const ts = Number(id);
        if(!isNaN(ts) && ts > 1700000000000){
          const createdWk = weekKey(inicioDeSemana(new Date(ts)));
          if(occurrences.some(o => o.wk === createdWk)){
            homeWk = createdWk;
          }
        }
        if(!homeWk){
          homeWk = occurrences[0].wk;
        }
      }
      weekKeys.forEach(wk => {
        if(wk !== homeWk && Array.isArray(weeks[wk])){
          weeks[wk] = weeks[wk].filter(t => t && t.id !== id);
        }
      });
    });
  } catch(_) {}
}

limpiarTodasLasSemanasDuplicadas();

function cargarSemana(){
  const wKey = weekKey(semanaVisible);
  let weekList = weeks[wKey] || [];
  tasks = deduplicateWeekTasks(wKey, weekList);

  try {
    const defStickers = (typeof getDefaultStickers === 'function') ? getDefaultStickers() : [];
    let tasksUpdated = false;
    tasks.forEach(t => {
      if(t && (t.type === 'sticker' || t.featured)){
        if(t.image && typeof t.image === 'string' && (t.image.includes('utf8') || t.image.includes('<svg') || (t.image.startsWith('data:image/svg') && !t.image.includes('%3C')))){
          const match = defStickers.find(d => d.id === t.title || d.name === t.title || t.image.includes(d.id));
          if(match){
            t.image = match.url;
            tasksUpdated = true;
          } else {
            const parts = t.image.split(',');
            if(parts.length > 1){
              try {
                const rawSvg = decodeURIComponent(parts.slice(1).join(','));
                t.image = svgToDataUri(rawSvg);
                tasksUpdated = true;
              } catch(_) {}
            }
          }
        }
        if(t.type === 'sticker' && (!t.noteWidth || !t.noteHeight)){
          t.noteWidth = t.w || 180;
          t.noteHeight = t.h || 180;
          tasksUpdated = true;
        }
        if(t.whiteboardId && !tasks.some(w => w.type === 'whiteboard' && w.id === t.whiteboardId)){
          delete t.whiteboardId;
          tasksUpdated = true;
        }
      }
    });
    if(tasksUpdated) save();
  } catch(_) {}

  weeks[wKey] = tasks;
  render();
  enriquecerVideos();
}
function actualizarRangoSemana(){const fin=new Date(semanaVisible),mes=d=>d.toLocaleDateString('es-MX',{month:'long'});fin.setDate(fin.getDate()+6);document.querySelector('#weekRange').textContent=mes(semanaVisible)===mes(fin)?`${semanaVisible.getDate()} — ${fin.getDate()} de ${mes(fin)}, ${fin.getFullYear()}`:`${semanaVisible.getDate()} de ${mes(semanaVisible)} — ${fin.getDate()} de ${mes(fin)}, ${fin.getFullYear()}`}
function cambiarSemana(dias){semanaVisible.setDate(semanaVisible.getDate()+dias);actualizarRangoSemana();cargarSemana()}
async function enriquecerVideos(){const pendientes=tasks.filter(t=>t.type==='video'&&t.url&&!t.videoTitleLoaded&&(!t.title||t.title==='Video guardado'));for(const video of pendientes){try{const respuesta=await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(video.url)}&format=json`);if(!respuesta.ok)continue;const datos=await respuesta.json();if(datos.title){video.title=datos.title;video.videoTitleLoaded=true;save();render();}}catch{}}}
document.querySelector('#prevWeek').addEventListener('click',()=>cambiarSemana(-7));document.querySelector('#nextWeek').addEventListener('click',()=>cambiarSemana(7));
document.querySelector('#newWeek')?.addEventListener('click',()=>{const input=document.querySelector('#weekStart');const proxima=new Date(semanaVisible);proxima.setDate(proxima.getDate()+7);input.value=weekKey(proxima);document.querySelector('#weekDialog').showModal();});
document.querySelector('#cancelWeek').addEventListener('click',()=>document.querySelector('#weekDialog').close());
document.querySelector('#weekForm').addEventListener('submit',event=>{event.preventDefault();const value=document.querySelector('#weekStart').value;if(!value)return;semanaVisible=inicioDeSemana(new Date(`${value}T12:00:00`));const key=weekKey(semanaVisible);if(!weeks[key])weeks[key]=[];save();actualizarRangoSemana();cargarSemana();document.querySelector('#weekDialog').close();});

let selectedColCount=2;
function updateColCount(count){
  selectedColCount=Number(count)||2;
  document.querySelectorAll('.col-btn').forEach(btn=>{
    const isActive = (+btn.dataset.cols === selectedColCount);
    btn.classList.toggle('active', isActive);
    btn.style.setProperty('background', isActive ? '#6178ec' : '#fff', 'important');
    btn.style.setProperty('color', isActive ? '#fff' : '#555d67', 'important');
    btn.style.setProperty('border-color', isActive ? '#6178ec' : '#dadddf', 'important');
    btn.style.setProperty('box-shadow', isActive ? '0 2px 6px rgba(97,120,236,.25)' : 'none', 'important');
  });

  const container=document.querySelector('#colHeadersContainer');
  const h1Wrap=document.querySelector('#colHeader1Wrap');
  const h2Wrap=document.querySelector('#colHeader2Wrap');
  const h3Wrap=document.querySelector('#colHeader3Wrap');
  const h2=document.querySelector('#colHeader2');
  const h3=document.querySelector('#colHeader3');

  if(container){
    container.style.display = 'grid';
    container.style.gridTemplateColumns = selectedColCount === 1 ? '1fr' : (selectedColCount === 2 ? '1fr 1fr' : '1fr 1fr 1fr');
    container.style.gap = '8px';
  }

  if(selectedColCount===1){
    if(h1Wrap)h1Wrap.style.display='block';
    if(h2Wrap)h2Wrap.style.display='none';
    if(h3Wrap)h3Wrap.style.display='none';
  }else if(selectedColCount===2){
    if(h1Wrap)h1Wrap.style.display='block';
    if(h2Wrap)h2Wrap.style.display='block';
    if(h3Wrap)h3Wrap.style.display='none';
    if(h2&&!h2.value)h2.value='Cost';
  }else if(selectedColCount===3){
    if(h1Wrap)h1Wrap.style.display='block';
    if(h2Wrap)h2Wrap.style.display='block';
    if(h3Wrap)h3Wrap.style.display='block';
    if(h2&&!h2.value)h2.value='Cost';
    if(h3&&!h3.value)h3.value='Estado';
  }
}
window.updateColCount=updateColCount;

function openTodoTableDialog(day=getTodayBoardDayName()){
  const dialog=document.querySelector('#todoTableDialog');
  if(!dialog)return;
  const daySelect=document.querySelector('#todoDaySelect');
  if(daySelect)daySelect.value=day || getTodayBoardDayName();
  const projSel=document.querySelector('#todoProjectSelect');
  if(projSel)projSel.innerHTML=getProjectOptions('Todos');
  const timeInput=document.querySelector('#todoTimeInput');
  if(timeInput)timeInput.value='';
  const recSel=document.querySelector('#todoRecurrenceSelect');
  if(recSel)recSel.value='none';
  const titleInput=document.querySelector('#todoTitleInput');
  if(titleInput){
    titleInput.value='';
    titleInput.placeholder='Ej. Presupuesto, Checklist, Potenciales…';
  }
  updateColCount(selectedColCount||2);
  dialog.showModal();
  setTimeout(()=>titleInput?.focus(),60);
}

function initTodoTableDialog(){
  document.querySelectorAll('.col-btn').forEach(btn=>{
    btn.addEventListener('click',(e)=>{
      e.preventDefault();
      e.stopPropagation();
      updateColCount(+btn.dataset.cols);
    });
  });
  document.querySelector('#closeTodoTable')?.addEventListener('click',()=>{
    document.querySelector('#todoTableDialog')?.close();
  });
  document.querySelector('#cancelTodoTable')?.addEventListener('click',()=>{
    document.querySelector('#todoTableDialog')?.close();
  });
  
  const form=document.querySelector('#todoTableForm');
  if(!form)return;

  function createTodoTableFromForm(){
    const title=document.querySelector('#todoTitleInput')?.value.trim()||'Lista de tareas';
    const day=document.querySelector('#todoDaySelect')?.value||getTodayBoardDayName();
    const project=document.querySelector('#todoProjectSelect')?.value||'Todos';
    const time=document.querySelector('#todoTimeInput')?.value?.trim()||'';
    const showTotal=document.querySelector('#todoTotalCheck')?.checked??true;
    const seedData=document.querySelector('#todoSeedDataCheck')?.checked??true;

    let colHeaders=[];
    let colWidths=[];

    if(selectedColCount===1){
      colHeaders=[document.querySelector('#colHeader1')?.value.trim()||'Item'];
      colWidths=['1fr'];
    }else if(selectedColCount===2){
      colHeaders=[
        document.querySelector('#colHeader1')?.value.trim()||'Item',
        document.querySelector('#colHeader2')?.value.trim()||'Cost'
      ];
      colWidths=['1.6fr','1fr'];
    }else{
      colHeaders=[
        document.querySelector('#colHeader1')?.value.trim()||'Item',
        document.querySelector('#colHeader2')?.value.trim()||'Cost',
        document.querySelector('#colHeader3')?.value.trim()||'Estado'
      ];
      colWidths=['1.4fr','1fr','0.9fr'];
    }

    let items=[];
    if(seedData){
      if(selectedColCount===2){
        items=[
          {id:'1',checked:true,cols:['Equipment & Gear','$6,500']},
          {id:'2',checked:true,cols:['Crew & Labor','$8,000']},
          {id:'3',checked:true,cols:['Travel & Locations','$3,000']},
          {id:'4',checked:true,cols:['Production & Soundtrack','$3,000']},
          {id:'5',checked:false,cols:['Marketing & Distribution','$2,500']}
        ];
      }else if(selectedColCount===1){
        items=[
          {id:'1',checked:true,cols:['Revisar entregables prioritarios']},
          {id:'2',checked:false,cols:['Coordinar reunión con equipo']},
          {id:'3',checked:false,cols:['Confirmar entrega final']}
        ];
      }else{
        items=[
          {id:'1',checked:true,cols:['Pre-producción','$4,000','Aprobado']},
          {id:'2',checked:true,cols:['Rodaje principal','$12,500','En curso']},
          {id:'3',checked:false,cols:['Post-producción','$6,500','Pendiente']}
        ];
      }
    }else{
      items=[
        {id:'1',checked:false,cols:new Array(selectedColCount).fill('')}
      ];
    }

    const newTodoTable = {
      id:Date.now(),
      startWeekKey: weekKey(semanaVisible),
      day,
      title,
      type:'todo-table',
      colCount:selectedColCount,
      colHeaders,
      colWidths,
      colSpan:selectedColCount>=3?2:1,
      showTotal,
      currency: '$',
      items,
      channel:'Email',
      project,
      time: time || undefined,
      schedule: time || undefined,
      color:'email',
      agent:'Fer',
      status:'pendiente'
    };

    tasks.push(newTodoTable);
    save();
    render();
    try{document.querySelector('#todoTableDialog')?.close();}catch(_){}
    try{form.reset();}catch(_){}
  }

  form.addEventListener('submit',e=>{
    e.preventDefault();
    createTodoTableFromForm();
  });
}

document.querySelectorAll('dialog').forEach(d=>{
  d.addEventListener('click',e=>{
    if(e.target===d)d.close();
  });
});

var draggedPipelineId = null;
var pipelineStaticEventsInitialized = false;

function getPipelineColAtPoint(x, y){
  const boardEl = document.querySelector('.pipeline-board');
  const cols = Array.from(document.querySelectorAll('.pipeline-col'));
  if(!cols.length) return null;

  if(boardEl){
    const bRect = boardEl.getBoundingClientRect();
    if(y >= bRect.top - 40 && y <= bRect.bottom + 80){
      for(const col of cols){
        const r = col.getBoundingClientRect();
        if(x >= r.left - 12 && x <= r.right + 12){
          return col;
        }
      }
    }
  }

  for(const col of cols){
    const r = col.getBoundingClientRect();
    if(x >= r.left - 12 && x <= r.right + 12 && y >= r.top - 50 && y <= r.bottom + 80){
      return col;
    }
  }
  const targetEl = document.elementFromPoint(x, y);
  return targetEl ? targetEl.closest('.pipeline-col') : null;
}

function updateLinkedTaskStageEverywhere(taskId, newStage){
  if(!taskId) return;
  let updated = false;
  const numId = Number(taskId);
  const strId = String(taskId);
  if(tasks && Array.isArray(tasks)){
    tasks.forEach(t => {
      if(t && (t.id === taskId || t.id === numId || String(t.id) === strId)){
        t.stage = newStage;
        updated = true;
      }
    });
  }
  if(weeks && typeof weeks === 'object'){
    Object.values(weeks).forEach(wList => {
      if(Array.isArray(wList)){
        wList.forEach(item => {
          if(item && (item.id === taskId || item.id === numId || String(item.id) === strId)){
            item.stage = newStage;
            updated = true;
          }
        });
      }
    });
  }
  if(updated) save();
}

actualizarRangoSemana();cargarSemana();abrirBaseMindFer();initTodoTableDialog();initPipelineStaticEvents();

function renderPipeline(){
  const ideasZone = document.querySelector('#pipelineIdeas');
  const conexionesZone = document.querySelector('#pipelineConexiones');
  const accionesZone = document.querySelector('#pipelineAcciones');
  if(!ideasZone || !conexionesZone || !accionesZone) return;

  const ideas = (pipelineItems || []).filter(p => p.stage === 'idea');
  const conexiones = (pipelineItems || []).filter(p => p.stage === 'conexion');
  const acciones = (pipelineItems || []).filter(p => p.stage === 'accion');

  const countIdeasEl = document.querySelector('#countIdeas');
  const countConexionesEl = document.querySelector('#countConexiones');
  const countAccionesEl = document.querySelector('#countAcciones');
  if(countIdeasEl) countIdeasEl.textContent = ideas.length;
  if(countConexionesEl) countConexionesEl.textContent = conexiones.length;
  if(countAccionesEl) countAccionesEl.textContent = acciones.length;

  const renderCard = item => {
    const hasTask = Boolean(item.taskId);

    return `
      <article class="pipeline-card stage-${item.stage} ${hasTask ? 'has-linked-task' : ''}" draggable="false" data-id="${item.id}" data-stage="${item.stage}" title="Arrastra para mover de columna · Doble clic para ver o editar" style="display:flex;flex-direction:row;align-items:center;justify-content:space-between;gap:8px;cursor:grab;user-select:none;-webkit-user-select:none">
        <div class="pipeline-card-title" data-id="${item.id}" style="flex:1;min-width:0;cursor:grab;user-select:none;-webkit-user-select:none">${esc(item.title)}</div>
        <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
          ${hasTask ? `<span class="pipeline-card-link-ico" title="Vinculado a la agenda" style="display:inline-flex;align-items:center;color:#64748b">${linkSvgSmall}</span>` : ''}
          <button type="button" class="pipeline-card-del" data-id="${item.id}" title="Eliminar tarjeta">×</button>
        </div>
      </article>
    `;
  };

  ideasZone.innerHTML = ideas.map(renderCard).join('');
  conexionesZone.innerHTML = conexiones.map(renderCard).join('');
  accionesZone.innerHTML = acciones.map(renderCard).join('');

  bindPipelineDynamicEvents();
}

function bindPipelineDynamicEvents(){
  document.querySelectorAll('.pipeline-card').forEach(el => {
    let pDrag = null;

    const onWindowPointerMove = e => {
      if(!pDrag) return;
      if(e.pointerType === 'mouse' && e.buttons === 0){
        finishPointerDrag(e);
        return;
      }
      pDrag.lastX = e.clientX;
      pDrag.lastY = e.clientY;
      const dx = e.clientX - pDrag.startX;
      const dy = e.clientY - pDrag.startY;
      if(!pDrag.moved && Math.abs(dx) + Math.abs(dy) > 4){
        pDrag.moved = true;
        draggedPipelineId = pDrag.id;
        el.classList.add('is-dragging');
        const ghost = el.cloneNode(true);
        ghost.classList.remove('is-dragging');
        ghost.style.cssText = `position:fixed;left:${e.clientX - pDrag.offsetX}px;top:${e.clientY - pDrag.offsetY}px;width:${pDrag.width}px;z-index:9999;pointer-events:none;box-shadow:0 10px 25px rgba(0,0,0,0.18);transform:rotate(1.2deg);opacity:0.96;background:#fff;border-radius:8px;padding:10px 12px;border:1px solid #111111;display:flex;align-items:center;justify-content:space-between;gap:8px;`;
        document.body.appendChild(ghost);
        pDrag.ghost = ghost;
      }
      if(pDrag.moved && pDrag.ghost){
        pDrag.ghost.style.left = `${e.clientX - pDrag.offsetX}px`;
        pDrag.ghost.style.top = `${e.clientY - pDrag.offsetY}px`;

        document.querySelectorAll('.pipeline-dropzone').forEach(z => z.classList.remove('drag-over'));
        document.querySelectorAll('.pipeline-drop-indicator').forEach(ind => ind.remove());

        const col = getPipelineColAtPoint(e.clientX, e.clientY);
        if(col){
          const zone = col.querySelector('.pipeline-dropzone') || col;
          zone.classList.add('drag-over');
          const cards = [...zone.querySelectorAll('.pipeline-card:not(.is-dragging)')];
          let afterElement = null;
          for(const card of cards){
            const box = card.getBoundingClientRect();
            if(e.clientY < box.top + box.height / 2){
              afterElement = card;
              break;
            }
          }
          const indicator = document.createElement('div');
          indicator.className = 'pipeline-drop-indicator';
          if(afterElement) zone.insertBefore(indicator, afterElement);
          else zone.appendChild(indicator);
        }

        const trash = document.querySelector('#trash');
        if(trash){
          const tr = trash.getBoundingClientRect();
          const overTrash = e.clientX >= tr.left - 35 && e.clientX <= tr.right + 35 && e.clientY >= tr.top - 35 && e.clientY <= tr.bottom + 35;
          trash.classList.toggle('drag-over', overTrash);
        }
      }
    };

    const finishPointerDrag = e => {
      if(!pDrag) return;
      const state = pDrag;
      pDrag = null;
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', finishPointerDrag);
      window.removeEventListener('pointercancel', finishPointerDrag);
      if(state.ghost) state.ghost.remove();
      el.classList.remove('is-dragging');
      document.querySelectorAll('.pipeline-dropzone').forEach(z => z.classList.remove('drag-over'));
      document.querySelectorAll('.pipeline-drop-indicator').forEach(ind => ind.remove());
      const trash = document.querySelector('#trash');
      if(trash) trash.classList.remove('drag-over');
      draggedPipelineId = null;

      if(!state.moved) return;

      const clientX = (typeof e?.clientX === 'number') ? e.clientX : state.lastX;
      const clientY = (typeof e?.clientY === 'number') ? e.clientY : state.lastY;

      if(trash){
        const tr = trash.getBoundingClientRect();
        if(clientX >= tr.left - 35 && clientX <= tr.right + 35 && clientY >= tr.top - 35 && clientY <= tr.bottom + 35){
          const idx = (pipelineItems || []).findIndex(p => p.id === state.id);
          if(idx >= 0){
            const item = pipelineItems[idx];
            if(item.taskId){
              updateLinkedTaskStageEverywhere(item.taskId, null);
            }
            pipelineItems.splice(idx, 1);
            savePipeline();
            render();
          }
          return;
        }
      }

      const col = getPipelineColAtPoint(clientX, clientY);
      if(col && pipelineItems){
        const targetStage = col.dataset.stage || col.querySelector('.pipeline-dropzone')?.dataset.stage;
        const zone = col.querySelector('.pipeline-dropzone') || col;
        const idx = pipelineItems.findIndex(p => p && (String(p.id) === String(state.id) || p.id === state.id || (p.taskId && (String(p.taskId) === String(state.id) || p.taskId === state.id))));
        if(idx >= 0 && targetStage){
          const [item] = pipelineItems.splice(idx, 1);
          item.stage = targetStage;
          if(item.taskId){
            updateLinkedTaskStageEverywhere(item.taskId, targetStage);
          }
          const cards = [...zone.querySelectorAll('.pipeline-card:not(.is-dragging)')];
          let targetSiblingId = null;
          for(const card of cards){
            if(card.dataset.id === state.id) continue;
            const box = card.getBoundingClientRect();
            if(clientY < box.top + box.height / 2){
              targetSiblingId = card.dataset.id;
              break;
            }
          }
          if(targetSiblingId){
            const sibIdx = pipelineItems.findIndex(p => p && (String(p.id) === String(targetSiblingId) || p.id === targetSiblingId));
            if(sibIdx >= 0) pipelineItems.splice(sibIdx, 0, item);
            else pipelineItems.push(item);
          } else {
            pipelineItems.push(item);
          }
          savePipeline();
          render();
        }
      }
    };

    el.addEventListener('pointerdown', e => {
      if(e.target.closest('.pipeline-card-del') || el.querySelector('.pipeline-card-title[contenteditable="true"]')) return;
      if(e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      pDrag = {
        id: el.dataset.id,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        width: rect.width,
        moved: false,
        ghost: null
      };
      window.addEventListener('pointermove', onWindowPointerMove);
      window.addEventListener('pointerup', finishPointerDrag);
      window.addEventListener('pointercancel', finishPointerDrag);
    });

    el.addEventListener('dragstart', e => {
      e.preventDefault();
    });

    el.addEventListener('dblclick', e => {
      if(e.target.closest('.pipeline-card-del')) return;
      e.stopPropagation();
      const id = el.dataset.id;
      const item = (pipelineItems || []).find(p => p.id === id);
      if(item && item.taskId){
        openDetail(item.taskId);
      } else if(item) {
        const titleEl = el.querySelector('.pipeline-card-title');
        if(titleEl){
          titleEl.setAttribute('contenteditable', 'true');
          titleEl.style.userSelect = 'text';
          titleEl.style.cursor = 'text';
          titleEl.focus();
        }
      }
    });

    const titleEl = el.querySelector('.pipeline-card-title');
    if(titleEl){
      titleEl.addEventListener('blur', () => {
        titleEl.removeAttribute('contenteditable');
        titleEl.style.userSelect = 'none';
        titleEl.style.cursor = 'grab';
        const id = titleEl.dataset.id;
        const item = (pipelineItems || []).find(p => p.id === id);
        if(item){
          const newTitle = titleEl.textContent.trim();
          if(newTitle && newTitle !== item.title){
            item.title = newTitle;
            if(item.taskId){
              const t = tasks.find(x => x.id === item.taskId);
              if(t){
                t.title = newTitle;
                save();
              }
            }
            savePipeline();
          } else if(!newTitle){
            titleEl.textContent = item.title;
          }
        }
      });
      titleEl.addEventListener('keydown', e => {
        if(e.key === 'Enter' && !e.shiftKey){
          e.preventDefault();
          titleEl.blur();
        }
      });
    }

    const delBtn = el.querySelector('.pipeline-card-del');
    if(delBtn){
      delBtn.addEventListener('click', e => {
        e.stopPropagation();
        const id = delBtn.dataset.id;
        const idx = (pipelineItems || []).findIndex(p => p.id === id);
        if(idx >= 0){
          const item = pipelineItems[idx];
          if(item.taskId){
            updateLinkedTaskStageEverywhere(item.taskId, null);
          }
          pipelineItems.splice(idx, 1);
          savePipeline();
          render();
        }
      });
    }
  });
}

function initPipelineStaticEvents(){
  if(pipelineStaticEventsInitialized) return;
  pipelineStaticEventsInitialized = true;

  document.querySelectorAll('.pipeline-col').forEach(col => {
    const zone = col.querySelector('.pipeline-dropzone') || col;
    col.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      zone.classList.add('drag-over');

      // Calcular posición del indicador entre tarjetas existentes
      document.querySelectorAll('.pipeline-drop-indicator').forEach(ind => ind.remove());
      const cards = [...zone.querySelectorAll('.pipeline-card:not(.is-dragging)')];
      let afterElement = null;
      for(const card of cards){
        const box = card.getBoundingClientRect();
        if(e.clientY < box.top + box.height / 2){
          afterElement = card;
          break;
        }
      }

      const indicator = document.createElement('div');
      indicator.className = 'pipeline-drop-indicator';
      if(afterElement){
        zone.insertBefore(indicator, afterElement);
      } else {
        zone.appendChild(indicator);
      }
    });

    col.addEventListener('dragleave', e => {
      if(!col.contains(e.relatedTarget)){
        zone.classList.remove('drag-over');
        const ind = zone.querySelector('.pipeline-drop-indicator');
        if(ind) ind.remove();
      }
    });

    col.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      document.querySelectorAll('.pipeline-drop-indicator').forEach(ind => ind.remove());

      const targetStage = col.dataset.stage || zone.dataset.stage;
      const pipeId = draggedPipelineId || e.dataTransfer.getData('text/pipeline-id') || e.dataTransfer.getData('text/plain');

      if(pipeId && (pipelineItems || []).some(p => p.id === pipeId)){
        const idx = pipelineItems.findIndex(p => p.id === pipeId);
        const [item] = pipelineItems.splice(idx, 1);
        item.stage = targetStage;
        if(item.taskId){
          const t = tasks.find(x => x.id === item.taskId);
          if(t){
            t.stage = targetStage;
            save();
          }
        }

        // Calcular posición de inserción según la tarjeta más cercana
        const cards = [...zone.querySelectorAll('.pipeline-card:not(.is-dragging)')];
        let targetSiblingId = null;
        for(const card of cards){
          const box = card.getBoundingClientRect();
          if(e.clientY < box.top + box.height / 2){
            targetSiblingId = card.dataset.id;
            break;
          }
        }

        if(targetSiblingId){
          const sibIdx = pipelineItems.findIndex(p => p.id === targetSiblingId);
          if(sibIdx >= 0){
            pipelineItems.splice(sibIdx, 0, item);
          } else {
            pipelineItems.push(item);
          }
        } else {
          pipelineItems.push(item);
        }

        savePipeline();
        render();
        return;
      }

      if(draggedId){
        const t = tasks.find(x => x.id === draggedId);
        if(t){
          t.stage = targetStage;
          save();
          if(!pipelineItems) pipelineItems = [];
          const pIdx = pipelineItems.findIndex(p => p.taskId === t.id || p.id === 'p_' + t.id);
          const formattedTitle = formatPipelineTaskTitle(t);
          if(pIdx >= 0){
            pipelineItems[pIdx].stage = targetStage;
            pipelineItems[pIdx].title = formattedTitle;
            pipelineItems[pIdx].taskId = t.id;
          } else {
            pipelineItems.push({ id: 'p_' + t.id, taskId: t.id, title: formattedTitle, stage: targetStage });
          }
          savePipeline();
          render();
        }
      }
    });
  });

  // Funciones para el Composer tipo Trello (+ Añadir una tarjeta)
  const openComposerForStage = stage => {
    document.querySelectorAll('.pipeline-composer').forEach(c => {
      c.style.display = 'none';
    });
    document.querySelectorAll('.pipeline-open-composer').forEach(btn => {
      btn.style.display = 'flex';
    });
    const col = document.querySelector(`.pipeline-col[data-stage="${stage}"]`);
    if(!col) return;
    const composer = col.querySelector('.pipeline-composer');
    const openBtn = col.querySelector('.pipeline-open-composer');
    if(composer){
      composer.style.display = 'flex';
      if(openBtn) openBtn.style.display = 'none';
      const input = composer.querySelector('.pipeline-composer-input');
      if(input){
        input.value = '';
        input.focus();
      }
    }
  };

  document.querySelectorAll('.pipeline-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openComposerForStage(btn.dataset.stage);
    });
  });

  document.querySelectorAll('.pipeline-open-composer').forEach(btn => {
    btn.addEventListener('click', () => {
      openComposerForStage(btn.dataset.stage);
    });
  });

  document.querySelectorAll('.pipeline-btn-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      const composer = btn.closest('.pipeline-composer');
      const footer = btn.closest('.pipeline-col-footer');
      if(composer) composer.style.display = 'none';
      if(footer){
        const openBtn = footer.querySelector('.pipeline-open-composer');
        if(openBtn) openBtn.style.display = 'flex';
      }
    });
  });

  const submitComposer = (stage, composerEl) => {
    const input = composerEl.querySelector('.pipeline-composer-input');
    if(!input) return;
    const text = input.value.trim();
    if(!text) return;
    const newId = 'p_' + Date.now();
    if(!pipelineItems) pipelineItems = [];
    pipelineItems.push({
      id: newId,
      title: text,
      stage
    });
    savePipeline();
    render();

    // Mantener abierto el composer para seguir agregando rápido
    setTimeout(() => {
      openComposerForStage(stage);
    }, 50);
  };

  document.querySelectorAll('.pipeline-btn-add').forEach(btn => {
    btn.addEventListener('click', () => {
      const stage = btn.dataset.stage;
      const composer = btn.closest('.pipeline-composer');
      if(stage && composer) submitComposer(stage, composer);
    });
  });

  document.querySelectorAll('.pipeline-composer-input').forEach(input => {
    input.addEventListener('keydown', e => {
      if(e.key === 'Enter' && !e.shiftKey){
        e.preventDefault();
        const composer = input.closest('.pipeline-composer');
        const stage = composer?.dataset.stage;
        if(stage && composer) submitComposer(stage, composer);
      } else if(e.key === 'Escape'){
        const composer = input.closest('.pipeline-composer');
        const footer = input.closest('.pipeline-col-footer');
        if(composer) composer.style.display = 'none';
        if(footer){
          const openBtn = footer.querySelector('.pipeline-open-composer');
          if(openBtn) openBtn.style.display = 'flex';
        }
      }
    });
  });
}
renderPipeline();

// --- FRASE MOTIVADORA ---
function renderMotivationWidget(){
  const widget = document.querySelector('#motivationWidget');
  if(!widget) return;

  const sparkSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;

  if(!motivationQuote || !motivationQuote.trim()){
    widget.innerHTML = `
      <button type="button" id="btnOpenMotivation" class="motivation-empty-btn" title="Frase motivadora (haz clic para escribir)">
        <span class="motivation-icon" style="display:inline-flex;align-items:center;color:#111111">${sparkSvg}</span>
        <span class="motivation-plus">+</span>
        <span style="font-weight:700">Frase motivadora</span>
      </button>
    `;
    document.querySelector('#btnOpenMotivation')?.addEventListener('click', () => {
      openMotivationDialog();
    });
  } else {
    widget.innerHTML = `
      <div id="motivationPhraseCard" class="motivation-phrase-card" title="Clic para editar tu frase motivadora">
        <span class="motivation-badge" style="display:inline-flex;align-items:center;color:#111111">${sparkSvg}</span>
        <p class="motivation-text">${esc(motivationQuote.trim())}</p>
      </div>
    `;
    document.querySelector('#motivationPhraseCard')?.addEventListener('click', () => {
      openMotivationDialog();
    });
  }
}

function openMotivationDialog(){
  const dialog = document.querySelector('#motivationDialog');
  const input = document.querySelector('#motivationInput');
  const charCount = document.querySelector('#motivationCharCount');
  const btnDelete = document.querySelector('#btnDeleteMotivation');
  if(!dialog || !input) return;

  input.value = motivationQuote || '';
  if(charCount) charCount.textContent = `${input.value.length} / 150 caracteres`;
  if(btnDelete) btnDelete.style.display = (motivationQuote && motivationQuote.trim()) ? 'inline-block' : 'none';

  input.oninput = () => {
    if(charCount) charCount.textContent = `${input.value.length} / 150 caracteres`;
  };

  input.onkeydown = (e) => {
    if(e.key === 'Enter' && !e.shiftKey){
      e.preventDefault();
      document.querySelector('#motivationForm')?.requestSubmit();
    }
  };

  try { dialog.showModal(); } catch(_) {}
  input.focus();
}

function initMotivationHandlers(){
  const form = document.querySelector('#motivationForm');
  const dialog = document.querySelector('#motivationDialog');
  const btnClose = document.querySelector('#closeMotivationDialog');
  const btnCancel = document.querySelector('#cancelMotivation');
  const btnDelete = document.querySelector('#btnDeleteMotivation');

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.querySelector('#motivationInput');
    const val = input ? input.value.trim() : '';
    motivationQuote = val;
    try {
      localStorage.setItem('mindJeanetteMotivationQuote', val);
    } catch(_) {}
    try { dialog?.close(); } catch(_) {}
    renderMotivationWidget();
    recordHistoryState();
  });

  btnDelete?.addEventListener('click', () => {
    motivationQuote = '';
    try {
      localStorage.removeItem('mindJeanetteMotivationQuote');
    } catch(_) {}
    try { dialog?.close(); } catch(_) {}
    renderMotivationWidget();
    recordHistoryState();
  });

  btnClose?.addEventListener('click', () => {
    try { dialog?.close(); } catch(_) {}
  });

  btnCancel?.addEventListener('click', () => {
    try { dialog?.close(); } catch(_) {}
  });
}

// --- PERSONALIZACIÓN DEL NOMBRE (MindJeanette) ---
function initBrandPersonalization(){
  try {
    const params = new URLSearchParams(window.location.search);
    const qName = params.get('name') || params.get('user');
    if(qName && qName.trim()){
      localStorage.setItem('mindJeanetteUserName', qName.trim());
    }
  } catch(_) {}

  const updateBrandUI = () => {
    const rawName = localStorage.getItem('mindJeanetteUserName') || 'Jeanette';
    const brandEl = document.querySelector('#brandNameText');
    const avatarEl = document.querySelector('#userAvatarBtn');
    if(brandEl){
      brandEl.innerHTML = `Mind<b>${esc(rawName)}</b>`;
    }
    if(avatarEl){
      avatarEl.textContent = rawName.charAt(0).toUpperCase();
      avatarEl.title = `Perfil de ${rawName} (clic para personalizar nombre)`;
    }
    document.title = `Mind${rawName} · Agenda operativa`;
  };

  updateBrandUI();

  const promptChangeName = (e) => {
    e?.preventDefault();
    const current = localStorage.getItem('mindJeanetteUserName') || 'Jeanette';
    const chosen = prompt('Personaliza el nombre de tu Mind (ej. Jeanette, Fran, Juan):', current);
    if(chosen !== null && chosen.trim()){
      localStorage.setItem('mindJeanetteUserName', chosen.trim());
      updateBrandUI();
    }
  };

  document.querySelector('#userAvatarBtn')?.addEventListener('click', promptChangeName);
  document.querySelector('#brandNameText')?.parentElement?.addEventListener('click', (e) => {
    e.preventDefault();
    promptChangeName(e);
  });
}

initMotivationHandlers();
initBrandPersonalization();
renderMotivationWidget();

// --- HERRAMIENTA DE TRAZO / APPLE PENCIL (ESTRICTAMENTE AISLADA) ---
// Regla crítica: SI NO ESTÁ ACTIVADA EN LA BARRA DE TAREAS, NO FUNCIONA NI INTERCEPTA NADA BAJO NINGÚN MOTIVO.
(function initDrawingTool(){
  const canvas = document.querySelector('#mindFerDrawCanvas');
  const toolbar = document.querySelector('#mindFerDrawToolbar');
  const toggleBtn = document.querySelector('#btnToggleDrawTool');
  const exitBtn = document.querySelector('#btnExitDrawMode');
  const undoBtn = document.querySelector('#btnDrawUndo');
  const redoBtn = document.querySelector('#btnDrawRedo');
  const clearBtn = document.querySelector('#btnDrawClear');
  const appShell = document.querySelector('.app-shell');

  if(!canvas || !toolbar || !toggleBtn || !appShell) return;

  let isDrawModeActive = false;
  let drawMode = 'free'; // 'free' | 'line' | 'erase'
  let drawColor = '#111111';
  let drawStrokeWidth = parseFloat(localStorage.getItem('mindJeanetteDrawStrokeWidth') || '1.6');
  let isDrawingStroke = false;
  let currentStroke = null;
  let strokeRedoStack = [];

  function getStorageKey(){
    const wk = (typeof semanaVisible !== 'undefined' && typeof weekKey === 'function') ? weekKey(semanaVisible) : 'default';
    const pr = (typeof selectedProject !== 'undefined' && selectedProject) ? selectedProject : 'NetThinking';
    return `mindJeanetteDrawStrokes_${wk}_${pr}`;
  }

  function loadStrokes(){
    try {
      return JSON.parse(localStorage.getItem(getStorageKey()) || '[]');
    } catch(_) {
      return [];
    }
  }

  function saveStrokes(strokes){
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(strokes));
      localStorage.setItem('mindJeanetteLastSavedAt', String(Date.now()));
    } catch(_) {}
    if(typeof window.scheduleMindFerCloudSync === 'function'){
      window.scheduleMindFerCloudSync();
    }
    // ESTRICTAMENTE AISLADO: El dibujo sobre el canvas nunca modifica el historial de tarjetas del tablero
  }

  function pointDistanceToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function getCurrentWhiteboardOrigin() {
    const wbEl = document.querySelector('.task-card.type-whiteboard');
    if (!wbEl) return null;
    const curWbRect = wbEl.getBoundingClientRect();
    const curShellRect = appShell.getBoundingClientRect();
    return {
      x: Math.round((curWbRect.left - curShellRect.left) * 10) / 10,
      y: Math.round((curWbRect.top - curShellRect.top) * 10) / 10,
      width: curWbRect.width,
      height: curWbRect.height
    };
  }

  function getStrokeRenderedPoints(stroke, curWbOrigin) {
    if (!stroke || !Array.isArray(stroke.points) || stroke.points.length === 0) return [];
    if (curWbOrigin && (stroke.onWhiteboard || stroke.points[0]?.relX !== undefined)) {
      return stroke.points.map(p => ({
        x: curWbOrigin.x + (p.relX !== undefined ? p.relX : p.x),
        y: curWbOrigin.y + (p.relY !== undefined ? p.relY : p.y)
      }));
    }
    return stroke.points;
  }

  function strokeIntersectsPoint(stroke, px, py, radius = 35) {
    if (!stroke || !Array.isArray(stroke.points) || stroke.points.length === 0) return false;
    const curWbOrigin = getCurrentWhiteboardOrigin();
    const pts = getStrokeRenderedPoints(stroke, curWbOrigin);
    if (!pts || pts.length === 0) return false;
    if (pts.length === 1) {
      return Math.hypot(px - pts[0].x, py - pts[0].y) <= radius;
    }
    for (let i = 0; i < pts.length - 1; i++) {
      if (pointDistanceToSegment(px, py, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) <= radius) {
        return true;
      }
    }
    return false;
  }

  function eraseStrokesAtPoint(pt) {
    let strokes = loadStrokes();
    const origCount = strokes.length;
    strokes = strokes.filter(s => !strokeIntersectsPoint(s, pt.x, pt.y, 35));
    if (strokes.length !== origCount) {
      saveStrokes(strokes);
      syncCanvasSizeAndRedraw(null);
    }
  }

  function drawArrowHeadOnCanvas(ctx, fromX, fromY, toX, toY, width, color){
    const dx = toX - fromX;
    const dy = toY - fromY;
    const dist = Math.hypot(dx, dy);
    if(dist < 4) return;
    const angle = Math.atan2(dy, dx);
    const headLen = Math.max(7, Math.min(22, (width || drawStrokeWidth || 1.6) * 4.4));
    const arrowAngle = Math.PI / 6.5; // ~28 grados

    ctx.save();
    ctx.fillStyle = color || '#111111';
    ctx.strokeStyle = color || '#111111';
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLen * Math.cos(angle - arrowAngle), toY - headLen * Math.sin(angle - arrowAngle));
    ctx.lineTo(toX - (headLen * 0.72) * Math.cos(angle), toY - (headLen * 0.72) * Math.sin(angle));
    ctx.lineTo(toX - headLen * Math.cos(angle + arrowAngle), toY - headLen * Math.sin(angle + arrowAngle));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function syncCanvasSizeAndRedraw(previewStroke = null){
    const dpr = window.devicePixelRatio || 1;
    canvas.style.height = '0px';
    const rect = appShell.getBoundingClientRect();
    const w = Math.max(1, Math.round(appShell.scrollWidth || rect.width));
    let h = Math.max(1, Math.round(appShell.scrollHeight || rect.height));

    const pipelineEl = document.querySelector('.pipeline-section');
    if(pipelineEl){
      const pRect = pipelineEl.getBoundingClientRect();
      const sRect = appShell.getBoundingClientRect();
      const bottomInShell = Math.round((pRect.bottom - sRect.top) + 24);
      if(bottomInShell > 400 && h > bottomInShell + 30){
        h = bottomInShell;
      }
    }

    if(canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)){
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    } else {
      canvas.style.height = `${h}px`;
    }

    const ctx = canvas.getContext('2d');
    if(!ctx) return;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const strokes = loadStrokes();
    const all = previewStroke ? [...strokes, previewStroke] : strokes;

    const wbEl = document.querySelector('.task-card.type-whiteboard');
    let curWbOrigin = null;
    if(wbEl){
      const curWbRect = wbEl.getBoundingClientRect();
      const curShellRect = appShell.getBoundingClientRect();
      curWbOrigin = {
        x: Math.round((curWbRect.left - curShellRect.left) * 10) / 10,
        y: Math.round((curWbRect.top - curShellRect.top) * 10) / 10,
        width: curWbRect.width,
        height: curWbRect.height
      };
    }

    for(const s of all){
      if(!s || !Array.isArray(s.points) || s.points.length === 0) continue;
      if(s.mode === 'erase') continue; // Los trazos borrados no se renderizan
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = s.color || '#111111';
      ctx.lineWidth = s.width || drawStrokeWidth || 1.6;

      // Desplazamiento dinámico si el trazo fue dibujado dentro del lienzo blanco:
      let pts = s.points;
      if(curWbOrigin){
        if(s.onWhiteboard || s.points[0]?.relX !== undefined){
          pts = s.points.map(p => ({
            x: curWbOrigin.x + (p.relX !== undefined ? p.relX : p.x),
            y: curWbOrigin.y + (p.relY !== undefined ? p.relY : p.y)
          }));
        } else if(!s.checkedWb){
          const p0 = s.points[0];
          if(p0 && p0.x >= curWbOrigin.x - 30 && p0.x <= curWbOrigin.x + curWbOrigin.width + 30 &&
             p0.y >= curWbOrigin.y - 40 && p0.y <= curWbOrigin.y + curWbOrigin.height + 40){
            s.onWhiteboard = true;
            s.points.forEach(p => {
              p.relX = Math.round((p.x - curWbOrigin.x) * 10) / 10;
              p.relY = Math.round((p.y - curWbOrigin.y) * 10) / 10;
            });
            pts = s.points.map(p => ({
              x: curWbOrigin.x + p.relX,
              y: curWbOrigin.y + p.relY
            }));
          }
          s.checkedWb = true;
        }
      }

      const isStraight = (s.mode === 'line' || s.mode === 'arrow-right' || s.mode === 'arrow-left' || s.mode === 'arrow-both');

      if(isStraight && pts.length >= 2){
        const first = pts[0];
        const last = pts[pts.length - 1];
        ctx.beginPath();
        ctx.moveTo(first.x, first.y);
        ctx.lineTo(last.x, last.y);
        ctx.stroke();

        if(s.mode === 'arrow-right' || s.mode === 'arrow-both'){
          drawArrowHeadOnCanvas(ctx, first.x, first.y, last.x, last.y, s.width, s.color);
        }
        if(s.mode === 'arrow-left' || s.mode === 'arrow-both'){
          drawArrowHeadOnCanvas(ctx, last.x, last.y, first.x, first.y, s.width, s.color);
        }
      } else if(pts.length === 1){
        const pt = pts[0];
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(pt.x + 0.1, pt.y + 0.1);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for(let i = 1; i < pts.length - 1; i++){
          const midX = (pts[i].x + pts[i + 1].x) / 2;
          const midY = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
        }
        const last = pts[pts.length - 1];
        ctx.lineTo(last.x, last.y);
        ctx.stroke();

        if(s.mode === 'curve-arrow' && pts.length >= 3){
          const pPrev = pts[Math.max(0, pts.length - 5)];
          drawArrowHeadOnCanvas(ctx, pPrev.x, pPrev.y, last.x, last.y, s.width, s.color);
        }
      }
      ctx.restore();
    }
    ctx.restore();
  }

  window.redrawMindFerCanvas = () => syncCanvasSizeAndRedraw(null);

  function setDrawModeActive(active){
    isDrawModeActive = Boolean(active);
    isDrawingStroke = false;
    currentStroke = null;

    if(isDrawModeActive){
      canvas.classList.add('draw-mode-enabled');
      canvas.setAttribute('aria-hidden', 'false');
      toolbar.classList.add('visible');
      toolbar.setAttribute('aria-hidden', 'false');
      toggleBtn.classList.add('is-active-tool');
      syncCanvasSizeAndRedraw();
    } else {
      canvas.classList.remove('draw-mode-enabled');
      canvas.setAttribute('aria-hidden', 'true');
      toolbar.classList.remove('visible');
      toolbar.setAttribute('aria-hidden', 'true');
      toggleBtn.classList.remove('is-active-tool');
    }
  }

  // Por defecto siempre desactivado al cargar
  setDrawModeActive(false);
  setTimeout(() => syncCanvasSizeAndRedraw(), 80);
  window.addEventListener('resize', () => syncCanvasSizeAndRedraw());

  toggleBtn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    setDrawModeActive(!isDrawModeActive);
  });

  exitBtn?.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    setDrawModeActive(false);
  });

  window.addEventListener('keydown', e => {
    if(isDrawModeActive && e.key === 'Escape'){
      setDrawModeActive(false);
    }
  });

  toolbar.querySelectorAll('[data-draw-mode]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      drawMode = btn.dataset.drawMode || 'free';
      toolbar.querySelectorAll('[data-draw-mode]').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  toolbar.querySelectorAll('[data-draw-color]').forEach(dot => {
    dot.addEventListener('click', e => {
      e.stopPropagation();
      drawColor = dot.dataset.drawColor || '#111111';
      if(drawMode === 'erase'){
        drawMode = 'free';
        toolbar.querySelectorAll('[data-draw-mode]').forEach(b => b.classList.toggle('active', b.dataset.drawMode === 'free'));
      }
      toolbar.querySelectorAll('[data-draw-color]').forEach(d => d.classList.toggle('active', d === dot));
    });
  });

  const strokeMenuBtn = document.querySelector('#btnDrawStrokeWidth');
  const strokeMenu = document.querySelector('#drawStrokeMenu');

  function updateStrokeUI(){
    if(!strokeMenu) return;
    strokeMenu.querySelectorAll('.draw-stroke-opt').forEach(opt => {
      const w = parseFloat(opt.dataset.width);
      opt.classList.toggle('active', Math.abs(w - drawStrokeWidth) < 0.2);
    });
  }
  updateStrokeUI();

  strokeMenuBtn?.addEventListener('click', e => {
    e.stopPropagation();
    if(strokeMenu){
      const isOpen = strokeMenu.classList.contains('open');
      strokeMenu.classList.toggle('open', !isOpen);
    }
  });

  strokeMenu?.querySelectorAll('.draw-stroke-opt').forEach(opt => {
    opt.addEventListener('click', e => {
      e.stopPropagation();
      const w = parseFloat(opt.dataset.width) || 1.6;
      drawStrokeWidth = w;
      try { localStorage.setItem('mindJeanetteDrawStrokeWidth', String(w)); } catch(_) {}
      updateStrokeUI();
      strokeMenu.classList.remove('open');
    });
  });

  document.addEventListener('click', e => {
    if(strokeMenu && strokeMenu.classList.contains('open') && !e.target.closest('.draw-stroke-picker-wrap')){
      strokeMenu.classList.remove('open');
    }
  });

  undoBtn?.addEventListener('click', e => {
    e.stopPropagation();
    if(!isDrawModeActive) return;
    const strokes = loadStrokes();
    if(strokes.length > 0){
      const popped = strokes.pop();
      strokeRedoStack.push(popped);
      saveStrokes(strokes);
      syncCanvasSizeAndRedraw(null);
    }
  });

  redoBtn?.addEventListener('click', e => {
    e.stopPropagation();
    if(!isDrawModeActive) return;
    if(strokeRedoStack.length > 0){
      const restored = strokeRedoStack.pop();
      const strokes = loadStrokes();
      strokes.push(restored);
      saveStrokes(strokes);
      syncCanvasSizeAndRedraw(null);
    }
  });

  clearBtn?.addEventListener('click', e => {
    e.stopPropagation();
    if(!isDrawModeActive) return;
    saveStrokes([]);
    syncCanvasSizeAndRedraw();
  });

  const addWhiteboardBtn = document.querySelector('#btnDrawAddWhiteboard');
  addWhiteboardBtn?.addEventListener('click', e => {
    e.stopPropagation();
    // 1. Buscar si ya existe un lienzo en la semana activa
    let wb = tasks.find(x => x.type === 'whiteboard');
    if(!wb || e.shiftKey){
      wb = {
        id: Date.now(),
        type: 'whiteboard',
        title: 'Lienzo mental',
        day: weekdays[0] || 'Lunes',
        project: (typeof selectedProject !== 'undefined' && selectedProject !== 'Todos') ? selectedProject : 'NetThinking',
        cardWidth: 620,
        cardHeight: 420,
        color: '#ffffff',
        createdAt: new Date().toISOString()
      };
      tasks.push(wb);
      save();
      render();
    }
    setTimeout(() => {
      const wbEl = document.querySelector(`.task-card.type-whiteboard[data-id="${wb.id}"]`);
      if(wbEl){
        wbEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        wbEl.style.boxShadow = '0 0 0 3px #3b82f6';
        setTimeout(() => { wbEl.style.boxShadow = ''; }, 1200);
      }
      if(typeof window.redrawMindFerCanvas === 'function'){
        window.redrawMindFerCanvas();
      }
    }, 80);
  });

  function getPointInShell(e){
    const rect = appShell.getBoundingClientRect();
    return {
      x: Math.round((e.clientX - rect.left) * 10) / 10,
      y: Math.round((e.clientY - rect.top) * 10) / 10
    };
  }

  canvas.addEventListener('pointerdown', e => {
    // GUARDIA ESTRICTA: Si no está activo, jamás hace nada
    if(!isDrawModeActive) return;
    if(e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const pt = getPointInShell(e);

    if (drawMode === 'erase') {
      isDrawingStroke = true;
      try { canvas.setPointerCapture(e.pointerId); } catch(_) {}
      eraseStrokesAtPoint(pt);
      return;
    }

    isDrawingStroke = true;
    const pressureWidth = (e.pointerType === 'pen' && e.pressure > 0) ? Math.max(0.8, Math.min(drawStrokeWidth * 2.2, e.pressure * drawStrokeWidth * 2)) : drawStrokeWidth;

    const wbEl = document.querySelector('.task-card.type-whiteboard');
    let onWb = false;
    let wbOrigin = null;
    if(wbEl){
      const curWbRect = wbEl.getBoundingClientRect();
      const curShellRect = appShell.getBoundingClientRect();
      wbOrigin = {
        x: curWbRect.left - curShellRect.left,
        y: curWbRect.top - curShellRect.top,
        w: curWbRect.width,
        h: curWbRect.height
      };
      if(pt.x >= wbOrigin.x && pt.x <= wbOrigin.x + wbOrigin.w && pt.y >= wbOrigin.y && pt.y <= wbOrigin.y + wbOrigin.h){
        onWb = true;
        pt.relX = Math.round((pt.x - wbOrigin.x) * 10) / 10;
        pt.relY = Math.round((pt.y - wbOrigin.y) * 10) / 10;
      }
    }

    currentStroke = {
      mode: drawMode,
      color: drawColor,
      width: pressureWidth,
      onWhiteboard: onWb,
      wbOrigin: onWb ? wbOrigin : null,
      points: [pt]
    };

    try { canvas.setPointerCapture(e.pointerId); } catch(_) {}
    syncCanvasSizeAndRedraw(currentStroke);
  });

  canvas.addEventListener('pointermove', e => {
    if(!isDrawModeActive || !isDrawingStroke) return;
    if(e.pointerType === 'mouse' && e.buttons === 0){
      finishStroke(e);
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    const pt = getPointInShell(e);

    if (drawMode === 'erase') {
      eraseStrokesAtPoint(pt);
      return;
    }

    if (!currentStroke) return;

    if(currentStroke.onWhiteboard && currentStroke.wbOrigin){
      pt.relX = Math.round((pt.x - currentStroke.wbOrigin.x) * 10) / 10;
      pt.relY = Math.round((pt.y - currentStroke.wbOrigin.y) * 10) / 10;
    }

    const isStraight = (currentStroke.mode === 'line' || currentStroke.mode === 'arrow-right' || currentStroke.mode === 'arrow-left' || currentStroke.mode === 'arrow-both');
    if(isStraight){
      currentStroke.points = [currentStroke.points[0], pt];
    } else {
      const last = currentStroke.points[currentStroke.points.length - 1];
      if(!last || Math.hypot(pt.x - last.x, pt.y - last.y) >= 1.5){
        currentStroke.points.push(pt);
      }
    }
    syncCanvasSizeAndRedraw(currentStroke);
  });

  function finishStroke(e){
    if(!isDrawModeActive || !isDrawingStroke) return;
    isDrawingStroke = false;
    if(e?.pointerId !== undefined){
      try { canvas.releasePointerCapture(e.pointerId); } catch(_) {}
    }
    if (drawMode === 'erase') return;
    if (!currentStroke) return;

    const strokes = loadStrokes();
    strokes.push(currentStroke);
    currentStroke = null;
    strokeRedoStack = [];
    saveStrokes(strokes);
    syncCanvasSizeAndRedraw(null);
  }

  canvas.addEventListener('pointerup', finishStroke);
  canvas.addEventListener('pointercancel', finishStroke);
})();

// --- CONTROL GLOBAL DE DESHACER / REHACER (ESTILO CANVA) ---
(function initGlobalHistoryControls(){
  const btnUndo = document.querySelector('#btnUndo');
  const btnRedo = document.querySelector('#btnRedo');

  btnUndo?.addEventListener('click', e => {
    e.preventDefault();
    const isDrawingActive = document.querySelector('#mindFerDrawCanvas')?.classList.contains('draw-mode-enabled');
    if(isDrawingActive){
      document.querySelector('#btnDrawUndo')?.click();
      return;
    }
    undoBoardState();
  });

  btnRedo?.addEventListener('click', e => {
    e.preventDefault();
    const isDrawingActive = document.querySelector('#mindFerDrawCanvas')?.classList.contains('draw-mode-enabled');
    if(isDrawingActive){
      document.querySelector('#btnDrawRedo')?.click();
      return;
    }
    redoBoardState();
  });

  window.addEventListener('keydown', e => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable);
    if(isInput) return;

    const isMod = e.metaKey || e.ctrlKey;
    if(!isMod) return;

    const key = (e.key || '').toLowerCase();
    const isDrawingActive = document.querySelector('#mindFerDrawCanvas')?.classList.contains('draw-mode-enabled');

    if(isDrawingActive){
      if(key === 'z' && !e.shiftKey){
        e.preventDefault();
        document.querySelector('#btnDrawUndo')?.click();
        return;
      } else if((key === 'z' && e.shiftKey) || key === 'y'){
        e.preventDefault();
        document.querySelector('#btnDrawRedo')?.click();
        return;
      }
    }

    if(key === 'z' && !e.shiftKey){
      e.preventDefault();
      undoBoardState();
    } else if((key === 'z' && e.shiftKey) || key === 'y'){
      e.preventDefault();
      redoBoardState();
    }
  });

  // Registrar estado inicial base tras cargar semana
  recordHistoryState();
  updateHistoryButtons();

  // Respaldo físico directo en Mac (.json)
  const btnExport = document.querySelector('#btnExportLocalBackup');
  const btnImport = document.querySelector('#btnImportLocalBackup');
  const inputImport = document.querySelector('#inputImportLocalBackup');

  btnExport?.addEventListener('click', e => {
    e.preventDefault();
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        weeks,
        pipelineItems: pipelineItems || [],
        motivationQuote: motivationQuote || '',
        customProjects: getCustomProjects(),
        projectStories: projectStories || {}
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `MindJeanette-Mac-${dStr}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      updateSaveStatusBadge('✓ Descargado en Mac', true);
    } catch(err) {
      console.error('Error exportando respaldo:', err);
    }
  });

  btnImport?.addEventListener('click', e => {
    e.preventDefault();
    inputImport?.click();
  });

  inputImport?.addEventListener('change', async () => {
    const file = inputImport.files?.[0];
    if(!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if(data && data.weeks && typeof data.weeks === 'object'){
        weeks = data.weeks;
        if(Array.isArray(data.pipelineItems)){
          pipelineItems = data.pipelineItems;
          try { localStorage.setItem('mindJeanettePipeline', JSON.stringify(pipelineItems)); } catch(_) {}
        }
        if(typeof data.motivationQuote === 'string'){
          motivationQuote = data.motivationQuote;
          try { localStorage.setItem('mindJeanetteMotivationQuote', motivationQuote); } catch(_) {}
        }
        guardarSemanas();
        cargarSemana();
        recordHistoryState();
        updateSaveStatusBadge('✓ Restaurado en Mac', true);
      }
    } catch(err) {
      console.error('Error importando respaldo:', err);
    } finally {
      inputImport.value = '';
    }
  });

  // Guardado manual con el botón de la cabecera
  const btnManualSave = document.querySelector('#btnManualSave');
  btnManualSave?.addEventListener('click', async e => {
    e.preventDefault();
    updateSaveStatusBadge('Guardando...', false);
    try {
      save(); // Asegura el guardado inmediato en IndexedDB y localStorage
    } catch(err) {
      console.warn('Error en save() local:', err);
    }
    if(typeof window.syncMindFerToCloud === 'function'){
      try {
        await window.syncMindFerToCloud();
      } catch(err) {
        console.warn('Error en guardado manual en nube:', err);
        const hhmm = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
        updateSaveStatusBadge(`✓ Guardado local ${hhmm}`, true);
      }
    }
  });

  // Autoguardado automático en segundo plano cada 60 segundos (1 minuto prudente y óptimo)
  setInterval(async () => {
    try {
      if(weeks && countRealBoardTasks(weeks) >= 5){
        save();
        if(typeof window.syncMindFerToCloud === 'function'){
          await window.syncMindFerToCloud();
        }
      }
    } catch(err) {
      console.warn('Error en autoguardado de 60s:', err);
    }
  }, 60000);

  // Guardado preventivo al cambiar de pestaña o minimizar la app
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'hidden'){
      try {
        save();
        if(typeof window.syncMindFerToCloud === 'function'){
          window.syncMindFerToCloud();
        }
      } catch(_) {}
    }
  });

  // Guardado preventivo al cerrar la ventana
  window.addEventListener('beforeunload', () => {
    try {
      save();
      if(typeof window.syncMindFerToCloud === 'function'){
        window.syncMindFerToCloud();
      }
    } catch(_) {}
  });

  // Buscador rápido en la barra superior (lupa ⌕)
  const btnSearch = document.querySelector('#btnHeaderSearch');
  const searchBox = document.querySelector('#headerSearchBox');
  const searchInput = document.querySelector('#headerSearchInput');
  const btnClearSearch = document.querySelector('#btnClearHeaderSearch');
  const searchResults = document.querySelector('#headerSearchResults');
  const searchWrap = document.querySelector('#headerSearchWrap');

  function formatSearchWeekLabel(wk){
    try {
      const d = new Date(`${wk}T12:00:00`);
      const fin = new Date(d);
      fin.setDate(d.getDate() + 6);
      const m = x => x.toLocaleDateString('es-MX', { month: 'short' });
      return `${d.getDate()} ${m(d)} – ${fin.getDate()} ${m(fin)}`;
    } catch(_) {
      return wk;
    }
  }

  function renderHeaderSearchResults(rawQuery){
    if(!searchResults) return;
    const q = (rawQuery || '').trim().toLowerCase();
    if(!q){
      searchResults.style.display = 'none';
      searchResults.innerHTML = '';
      return;
    }
    const matches = [];
    if(weeks && typeof weeks === 'object'){
      Object.keys(weeks).sort().reverse().forEach(wk => {
        const list = weeks[wk];
        if(!Array.isArray(list)) return;
        list.forEach(item => {
          if(!item || item.type === 'sticker') return;
          if(getTaskSearchableText(item).includes(q)){
            matches.push({ wk, item });
          }
        });
      });
    }
    searchResults.style.display = 'block';
    if(matches.length === 0){
      searchResults.innerHTML = `<div style="padding:12px 10px;font-size:12px;color:#64748b;text-align:center">No se encontraron resultados para «${esc(rawQuery)}»</div>`;
      return;
    }
    searchResults.innerHTML = matches.slice(0, 20).map(({ wk, item }) => {
      const title = item.personName || item.title || item.fileName || item.address || item.url || 'Elemento';
      const proj = item.project && item.project !== 'Todos' ? item.project : 'Todos';
      const day = item.day || 'Lunes';
      const wkLabel = formatSearchWeekLabel(wk);
      return `<button type="button" class="header-search-hit" data-wk="${esc(wk)}" data-id="${esc(item.id)}" style="display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;text-align:left;padding:8px 10px;border:0;background:transparent;border-radius:8px;cursor:pointer;font-family:inherit;border-bottom:1px solid #f1f5f9">
        <strong style="font-size:12px;color:#0f172a;line-height:1.25;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(title)}</strong>
        <span style="font-size:10.5px;color:#64748b">${esc(day)} · ${esc(wkLabel)} · ${esc(proj)} · ${esc(item.channel || 'Nota')}</span>
      </button>`;
    }).join('');

    searchResults.querySelectorAll('.header-search-hit').forEach(hitBtn => {
      hitBtn.addEventListener('mouseenter', () => { hitBtn.style.background = '#f8fafc'; });
      hitBtn.addEventListener('mouseleave', () => { hitBtn.style.background = 'transparent'; });
      hitBtn.addEventListener('click', e => {
        e.stopPropagation();
        const targetWk = hitBtn.dataset.wk;
        const targetId = +hitBtn.dataset.id;
        activeSearchQuery = '';
        if(searchInput) searchInput.value = '';
        if(searchResults) searchResults.style.display = 'none';
        if(searchBox) searchBox.style.display = 'none';
        if(selectedProject !== 'Todos'){
          selectedProject = 'Todos';
          const projSel = document.querySelector('#projectSelect');
          if(projSel) projSel.value = 'Todos';
        }
        if(targetWk && weekKey(semanaVisible) !== targetWk){
          semanaVisible = inicioDeSemana(new Date(`${targetWk}T12:00:00`));
          actualizarRangoSemana();
          cargarSemana();
        } else {
          render();
        }
        setTimeout(() => {
          const cardEl = document.querySelector(`.task-card[data-id="${targetId}"], .floating-note[data-id="${targetId}"]`);
          if(cardEl){
            cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            cardEl.classList.add('is-selected');
          }
          openDetail(targetId);
        }, 80);
      });
    });
  }

  function closeHeaderSearch(){
    activeSearchQuery = '';
    if(searchInput) searchInput.value = '';
    if(searchBox) searchBox.style.display = 'none';
    if(searchResults) searchResults.style.display = 'none';
    render();
  }

  btnSearch?.addEventListener('click', e => {
    e.stopPropagation();
    if(!searchBox) return;
    const isVisible = searchBox.style.display === 'inline-flex';
    if(isVisible){
      closeHeaderSearch();
    } else {
      searchBox.style.display = 'inline-flex';
      setTimeout(() => searchInput?.focus(), 20);
    }
  });

  btnClearSearch?.addEventListener('click', e => {
    e.stopPropagation();
    closeHeaderSearch();
  });

  searchInput?.addEventListener('input', () => {
    activeSearchQuery = searchInput.value || '';
    render();
    renderHeaderSearchResults(activeSearchQuery);
  });

  searchInput?.addEventListener('keydown', e => {
    if(e.key === 'Escape'){
      e.preventDefault();
      closeHeaderSearch();
    }
  });

  document.addEventListener('click', e => {
    if(searchWrap && !searchWrap.contains(e.target)){
      if(searchResults) searchResults.style.display = 'none';
      if(searchBox && searchBox.style.display === 'inline-flex' && !activeSearchQuery.trim()){
        searchBox.style.display = 'none';
      }
    }
  });

  // Deseleccionar tarjetas y ocultar líneas de edición al hacer clic fuera
  document.addEventListener('pointerdown', e => {
    if(!e.target.closest('.task-card, .floating-note, .draw-floating-toolbar, .maker-strip, .topbar, #detailPanel, .capture-dialog')){
      document.querySelectorAll('.task-card.is-selected, .floating-note.is-selected').forEach(c => c.classList.remove('is-selected'));
    }
  });
})();



