// =============================================
//  script.js — Firebase + Admin + Chat Auth
// =============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged, sendPasswordResetEmail,
  setPersistence, browserLocalPersistence, browserSessionPersistence,
  updatePassword, EmailAuthProvider, reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getDatabase, ref, push, onValue, serverTimestamp, remove, update, get
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ── CONFIGURACIÓN FIREBASE ────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCHznVAG8HyaAwzTMcYXrEjS4ikcgf9Nx0",
  authDomain: "chat-ccrlr.firebaseapp.com",
  databaseURL: "https://chat-ccrlr-default-rtdb.firebaseio.com",
  projectId: "chat-ccrlr",
  storageBucket: "chat-ccrlr.firebasestorage.app",
  messagingSenderId: "832816032978",
  appId: "1:832816032978:web:08721a677cff57b0d9110b",
  measurementId: "G-P71V26NFRE"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getDatabase(app);

const ADMIN_EMAIL = "haroldolmedoanchundia@gmail.com";

// ── PALABRAS RESTRINGIDAS ─────────────────────
const PALABRAS_PROHIBIDAS = ['mierda','verga','mama','pendejo','pendeja','chucha'];
function contienePalabraProhibida(t) {
  return PALABRAS_PROHIBIDAS.some(p => new RegExp(`\\b${p}\\b`,'i').test(t));
}

// ── PANTALLA DE CARGA ─────────────────────────
function ocultarLoader() {
  const el = document.getElementById('loaderScreen');
  if (!el) return;
  el.classList.add('hidden');
  if (window._loaderTimer) clearTimeout(window._loaderTimer);
}
// Ocultar en cuanto el DOM esté listo
document.addEventListener('DOMContentLoaded', () => setTimeout(ocultarLoader, 1200));
// Fallback absoluto
window._loaderTimer = setTimeout(ocultarLoader, 3500);

// ── ESTADO GLOBAL ─────────────────────────────
let currentUser  = null;
let chatNickname = '';
let isAdmin      = false;

// ── AUTH STATE ────────────────────────────────
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  isAdmin = user?.email === ADMIN_EMAIL;

  document.getElementById('adminPanel').classList.toggle('hidden', !isAdmin);
  document.getElementById('btnAdminLogin').classList.toggle('hidden', isAdmin);
  document.getElementById('btnLogout').classList.toggle('hidden', !isAdmin);
  document.getElementById('loginPanel').classList.add('hidden');

  actualizarEstadoChat(user);
  actualizarMenuUsuario(user);
  if (isAdmin) {
    cargarUsuariosAdmin();
    reRenderGaleria(); // mostrar botones admin en imágenes ya cargadas
  } else {
    reRenderGaleria(); // ocultar botones si cerró sesión
  }
});

function actualizarEstadoChat(user) {
  const inputArea  = document.getElementById('chatInputArea');
  const chatLocked = document.getElementById('chatLocked');
  if (user) {
    inputArea.classList.remove('hidden');
    chatLocked.classList.add('hidden');

    const aplicarNick = (nick) => {
      chatNickname = nick;
      localStorage.setItem('chatNickname', nick);
      if (document.getElementById('nameInput'))
        document.getElementById('nameInput').value = nick;
      // Actualizar label del navbar con el nickname real
      const label = document.getElementById('userEmailLabel');
      if (label && !isAdmin) label.textContent = nick;
    };

    const localNick = localStorage.getItem('chatNickname');
    if (localNick) {
      aplicarNick(localNick);
      // Verificar en Firebase si tiene un nickname más actualizado
      get(ref(db, `usuarios/${user.uid}/nickname`)).then(snap => {
        if (snap.val() && snap.val() !== localNick) aplicarNick(snap.val());
      }).catch(() => {});
    } else {
      get(ref(db, `usuarios/${user.uid}/nickname`)).then(snap => {
        aplicarNick(snap.val() || user.email.split('@')[0]);
      }).catch(() => {
        aplicarNick(user.email.split('@')[0]);
      });
    }
  } else {
    inputArea.classList.add('hidden');
    chatLocked.classList.remove('hidden');
    chatNickname = '';
  }
}

function actualizarMenuUsuario(user) {
  const btnUser   = document.getElementById('btnUsuarioMenu');
  const userEmail = document.getElementById('userEmailLabel');
  if (user && !isAdmin) {
    btnUser.classList.remove('hidden');
    userEmail.textContent = chatNickname || user.email;
  } else {
    btnUser.classList.add('hidden');
    document.getElementById('userDropdown').classList.add('hidden');
  }
}

// ── MENÚ USUARIO ─────────────────────────────
window.toggleUserMenu = () =>
  document.getElementById('userDropdown').classList.toggle('hidden');

window.chatUserLogout = () => {
  signOut(auth);
  localStorage.removeItem('chatNickname');
  document.getElementById('userDropdown').classList.add('hidden');
};

// ── LOGIN ADMIN ───────────────────────────────
window.toggleLoginPanel = () => {
  document.getElementById('loginPanel').classList.toggle('hidden');
  document.getElementById('loginError').classList.add('hidden');
};

window.adminLogin = async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.classList.add('hidden');
  try { await signInWithEmailAndPassword(auth, email, pass); }
  catch { errEl.classList.remove('hidden'); }
};

window.adminLogout = () => signOut(auth);

// ── MODAL AUTH CHAT ───────────────────────────
window.abrirModalChat = () => {
  document.getElementById('chatAuthModal').classList.remove('hidden');
  document.getElementById('chatAuthError').classList.add('hidden');
  mostrarTabAuth('registro');
};

window.cerrarModalChat = () =>
  document.getElementById('chatAuthModal').classList.add('hidden');

window.mostrarTabAuth = (tab) => {
  ['registro','login','recuperar','cambiar'].forEach(t => {
    document.getElementById('tab-' + t)?.classList.add('hidden');
    document.getElementById('btnTab-' + t)?.classList.remove('active');
  });
  document.getElementById('tab-' + tab)?.classList.remove('hidden');
  document.getElementById('btnTab-' + tab)?.classList.add('active');
  document.getElementById('chatAuthError').classList.add('hidden');
  document.getElementById('chatAuthSuccess').classList.add('hidden');
};

window.registrarChatUser = async () => {
  const nickname = document.getElementById('regNickname').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const pass     = document.getElementById('regPass').value;
  const recordar = document.getElementById('regRecordar').checked;
  if (!nickname||!email||!pass) return mostrarAuthError('Todos los campos son obligatorios.');
  if (pass.length < 6) return mostrarAuthError('Contraseña mínimo 6 caracteres.');
  try {
    await setPersistence(auth, recordar ? browserLocalPersistence : browserSessionPersistence);
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    // Guardar email en /usuarios para el admin
    await update(ref(db, `usuarios/${cred.user.uid}`), { email, nickname, bloqueado: false });
    localStorage.setItem('chatNickname', nickname);
    chatNickname = nickname;
    document.getElementById('nameInput').value = nickname;
    cerrarModalChat();
  } catch(e) {
    mostrarAuthError(e.code==='auth/email-already-in-use'
      ? 'Este correo ya está registrado.' : 'Error: '+e.message);
  }
};

window.loginChatUser = async () => {
  const email    = document.getElementById('loginChatEmail').value.trim();
  const pass     = document.getElementById('loginChatPass').value;
  const recordar = document.getElementById('loginRecordar')?.checked;
  if (!email||!pass) return mostrarAuthError('Correo y contraseña son obligatorios.');

  // 1. Autenticar con Firebase Auth
  let cred;
  try {
    await setPersistence(auth, recordar ? browserLocalPersistence : browserSessionPersistence);
    cred = await signInWithEmailAndPassword(auth, email, pass);
  } catch(e) {
    if (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found') {
      return mostrarAuthError('Correo o contraseña incorrectos.');
    }
    return mostrarAuthError('Error al iniciar sesión. Intenta de nuevo.');
  }

  // 2. Verificar bloqueo y obtener nickname (cada uno en su propio try/catch)
  try {
    const snap = await get(ref(db, `usuarios/${cred.user.uid}/bloqueado`));
    if (snap.val() === true) {
      await signOut(auth);
      return mostrarAuthError('⛔ Tu cuenta ha sido bloqueada por el administrador.');
    }
  } catch { /* usuario sin permiso de leer bloqueado = no está bloqueado */ }

  try {
    const nickSnap = await get(ref(db, `usuarios/${cred.user.uid}/nickname`));
    const nick = nickSnap.val() || localStorage.getItem('chatNickname') || email.split('@')[0];
    localStorage.setItem('chatNickname', nick);
    chatNickname = nick;
    document.getElementById('nameInput').value = nick;
  } catch {
    // Si no puede leer Firebase, usar localStorage o email
    const nick = localStorage.getItem('chatNickname') || email.split('@')[0];
    chatNickname = nick;
    document.getElementById('nameInput').value = nick;
  }

  cerrarModalChat();
};

window.recuperarContrasena = async () => {
  const email = document.getElementById('recEmail').value.trim();
  if (!email) return mostrarAuthError('Ingresa tu correo.');
  try {
    await sendPasswordResetEmail(auth, email);
    mostrarAuthSuccess('✅ Correo de recuperación enviado. Revisa tu bandeja.');
  } catch(e) {
    mostrarAuthError(e.code==='auth/user-not-found'
      ? 'No existe cuenta con ese correo.' : 'Error: '+e.message);
  }
};

window.abrirCambiarContrasena = () => {
  if (!currentUser) return;
  document.getElementById('chatAuthModal').classList.remove('hidden');
  mostrarTabAuth('cambiar');
};

window.cambiarContrasena = async () => {
  const actual  = document.getElementById('passActual').value;
  const nueva   = document.getElementById('passNueva').value;
  const confirm = document.getElementById('passConfirm').value;
  if (!actual||!nueva||!confirm) return mostrarAuthError('Completa todos los campos.');
  if (nueva.length < 6) return mostrarAuthError('Mínimo 6 caracteres.');
  if (nueva !== confirm) return mostrarAuthError('Las contraseñas nuevas no coinciden.');
  try {
    const cred = EmailAuthProvider.credential(currentUser.email, actual);
    await reauthenticateWithCredential(currentUser, cred);
    await updatePassword(currentUser, nueva);
    mostrarAuthSuccess('✅ Contraseña actualizada correctamente.');
    ['passActual','passNueva','passConfirm'].forEach(id => document.getElementById(id).value='');
  } catch(e) {
    mostrarAuthError(e.code==='auth/wrong-password'
      ? 'La contraseña actual es incorrecta.' : 'Error: '+e.message);
  }
};

function mostrarAuthError(msg) {
  const el = document.getElementById('chatAuthError');
  el.textContent = msg; el.classList.remove('hidden');
  document.getElementById('chatAuthSuccess').classList.add('hidden');
}
function mostrarAuthSuccess(msg) {
  const el = document.getElementById('chatAuthSuccess');
  el.textContent = msg; el.classList.remove('hidden');
  document.getElementById('chatAuthError').classList.add('hidden');
}

// ── TABS ADMIN ────────────────────────────────
window.switchTab = (tabId) => {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  event.target.classList.add('active');
};

// ── PUBLICAR IMAGEN (Cloudinary) ─────────────
window.publicarImagen = async () => {
  const file       = document.getElementById('imgFile').files[0];
  const caption    = document.getElementById('imgCaption').value.trim();
  const ministerio = document.getElementById('imgMinisterio')?.value || '';
  const msg        = document.getElementById('msgImg');
  if (!file) { msg.textContent = 'Selecciona una imagen.'; return; }
  msg.textContent = 'Subiendo imagen... ⏳';
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'ccrlr_preset');
    const res  = await fetch('https://api.cloudinary.com/v1_1/dqxmetnvm/image/upload', { method:'POST', body:formData });
    const data = await res.json();
    if (!data.secure_url) throw new Error(data.error?.message || 'Error al subir');
    const payload = { url:data.secure_url, publicId:data.public_id, caption, fecha:serverTimestamp() };
    if (ministerio) payload.ministerio = ministerio;
    await push(ref(db,'imagenes'), payload);
    msg.textContent = '✅ ¡Imagen publicada!';
    document.getElementById('imgFile').value    = '';
    document.getElementById('imgCaption').value = '';
    if (document.getElementById('imgMinisterio')) document.getElementById('imgMinisterio').value = '';
  } catch(e) { msg.textContent = '❌ Error: ' + e.message; }
};

// ── PUBLICAR LIBRO ────────────────────────────
window.publicarLibro = async () => {
  const titulo = document.getElementById('libroTitulo').value.trim();
  const autor  = document.getElementById('libroAutor').value.trim();
  const desc   = document.getElementById('libroDesc').value.trim();
  const url    = document.getElementById('libroUrl').value.trim();
  const color  = document.getElementById('libroColor').value.trim() || '#1d3557';
  const msg    = document.getElementById('msgLibro');
  if (!titulo||!autor) { msg.textContent='Título y autor obligatorios.'; return; }
  try {
    await push(ref(db,'libros'), {titulo,autor,desc,url,color,fecha:serverTimestamp()});
    msg.textContent = '¡Libro publicado!';
    ['libroTitulo','libroAutor','libroDesc','libroUrl','libroColor'].forEach(id=>document.getElementById(id).value='');
  } catch(e) { msg.textContent='Error: '+e.message; }
};

// ── PUBLICAR VIDEO (Cloudinary) ───────────────
window.publicarVideo = async () => {
  const file   = document.getElementById('videoFile').files[0];
  const titulo = document.getElementById('videoTitulo').value.trim();
  const desc   = document.getElementById('videoDesc').value.trim();
  const msg    = document.getElementById('msgVideo');
  const progWrap = document.getElementById('videoProgress');
  const progFill = document.getElementById('progressFill');
  const progTxt  = document.getElementById('progressTxt');

  if (!file)   { msg.textContent = 'Selecciona un video.'; return; }
  if (!titulo) { msg.textContent = 'El título es obligatorio.'; return; }

  msg.textContent = '';
  progWrap.classList.remove('hidden');
  progFill.style.width = '0%';
  progTxt.textContent = '0%';

  try {
    // XMLHttpRequest para mostrar progreso real
    const url = await subirVideoCloudinary(file, progFill, progTxt);

    await push(ref(db,'videos'), { url, titulo, desc, fecha:serverTimestamp() });
    msg.textContent = '✅ ¡Video publicado!';
    progWrap.classList.add('hidden');
    document.getElementById('videoFile').value  = '';
    document.getElementById('videoTitulo').value = '';
    document.getElementById('videoDesc').value   = '';
  } catch(e) {
    progWrap.classList.add('hidden');
    msg.textContent = '❌ Error: ' + e.message;
  }
};

// ── PUBLICAR INSPIRACIÓN (video) ─────────────
window.publicarInspiracion = async () => {
  const file   = document.getElementById('inspFile').files[0];
  const titulo = document.getElementById('inspTitulo').value.trim();
  const desc   = document.getElementById('inspDesc').value.trim();
  const msg    = document.getElementById('msgInsp');
  const progWrap = document.getElementById('inspProgress');
  const progFill = document.getElementById('inspProgressFill');
  const progTxt  = document.getElementById('inspProgressTxt');
  if (!file)   { msg.textContent='Selecciona un video.'; return; }
  if (!titulo) { msg.textContent='El título es obligatorio.'; return; }
  msg.textContent=''; progWrap.classList.remove('hidden'); progFill.style.width='0%'; progTxt.textContent='0%';
  try {
    const url = await subirVideoCloudinary(file, progFill, progTxt);
    await push(ref(db,'inspiracion'), { url, titulo, desc, fecha:serverTimestamp() });
    msg.textContent='✅ ¡Mensaje de inspiración publicado!';
    progWrap.classList.add('hidden');
    document.getElementById('inspFile').value='';
    document.getElementById('inspTitulo').value='';
    document.getElementById('inspDesc').value='';
  } catch(e) { progWrap.classList.add('hidden'); msg.textContent='❌ Error: '+e.message; }
};

function subirVideoCloudinary(file, progFill, progTxt) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'ccrlr_preset');
    formData.append('resource_type', 'video');
    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.cloudinary.com/v1_1/dqxmetnvm/video/upload');
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        progFill.style.width = pct + '%';
        progTxt.textContent  = pct + '%';
      }
    });
    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText);
      if (data.secure_url) resolve(data.secure_url);
      else reject(new Error(data.error?.message || 'Error'));
    };
    xhr.onerror = () => reject(new Error('Error de red'));
    xhr.send(formData);
  });
}

// ── PUBLICAR EVENTO ───────────────────────────
window.publicarEvento = async () => {
  const titulo     = document.getElementById('eventoTitulo').value.trim();
  const desc       = document.getElementById('eventoDesc').value.trim();
  const fecha      = document.getElementById('eventoFecha').value;
  const lugar      = document.getElementById('eventoLugar').value.trim();
  const enlace     = document.getElementById('eventoEnlace').value.trim();
  const ministerio = document.getElementById('eventoMinisterio').value;
  const msg        = document.getElementById('msgEvento');
  if (!titulo||!fecha) { msg.textContent='Título y fecha son obligatorios.'; return; }
  try {
    await push(ref(db,'eventos'), { titulo, desc, lugar, enlace, ministerio, fechaISO:fecha, fecha:serverTimestamp() });
    msg.textContent='✅ ¡Evento publicado!';
    ['eventoTitulo','eventoDesc','eventoFecha','eventoLugar','eventoEnlace'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('eventoMinisterio').value='';
  } catch(e) { msg.textContent='Error: '+e.message; }
};

// ── BORRAR EVENTO (admin) ─────────────────────
window.borrarEvento = async (key) => {
  if (!confirm('¿Borrar este evento?')) return;
  try { await remove(ref(db,`eventos/${key}`)); }
  catch(e) { alert('Error: '+e.message); }
};

// ── BORRAR INSPIRACIÓN (admin) ────────────────
window.borrarInspiracion = async (key) => {
  if (!confirm('¿Borrar este mensaje?')) return;
  try { await remove(ref(db,`inspiracion/${key}`)); }
  catch(e) { alert('Error: '+e.message); }
};

// ── CARGAR INSPIRACIÓN ────────────────────────
onValue(ref(db,'inspiracion'), (snap) => {
  const grid = document.getElementById('inspiracionGrid');
  grid.innerHTML='';
  const data = snap.val();
  if (!data) { grid.innerHTML='<p class="loading-txt">Aún no hay mensajes publicados.</p>'; return; }
  Object.entries(data).reverse().forEach(([key, vid]) => {
    const div = document.createElement('div');
    div.className='video-card';
    div.innerHTML=`
      ${isAdmin?`<button class="btn-delete-media btn-delete-video" onclick="borrarInspiracion('${key}')" title="Borrar">🗑️</button>`:''}
      <div class="video-wrap"><video src="${vid.url}" controls preload="metadata" playsinline></video></div>
      <div class="video-info">
        <h3>${escapeHTML(vid.titulo)}</h3>
        ${vid.desc?`<p class="desc">${escapeHTML(vid.desc)}</p>`:''}
      </div>`;
    grid.appendChild(div);
  });
  observeCards();
});

// ── CARGAR EVENTOS Y RECORDATORIOS ───────────
onValue(ref(db,'eventos'), (snap) => {
  const lista = document.getElementById('eventosLista');
  lista.innerHTML = '';
  const data  = snap.val();
  const ahora = Date.now();
  const unDia = 24 * 60 * 60 * 1000;

  if (!data) { lista.innerHTML = '<p class="loading-txt">No hay eventos próximos.</p>'; return; }

  const eventos = Object.entries(data)
    .map(([key, e]) => ({ key, ...e, ts: new Date(e.fechaISO).getTime() }))
    .filter(e => e.ts >= ahora - unDia)
    .sort((a, b) => a.ts - b.ts);

  if (!eventos.length) { lista.innerHTML = '<p class="loading-txt">No hay eventos próximos.</p>'; return; }

  eventos.forEach(e => {
    const fecha     = new Date(e.fechaISO);
    const diffMs    = e.ts - ahora;
    const diffDias  = Math.ceil(diffMs / unDia);
    const etiqueta  = diffDias <= 0 ? '¡Hoy!' : diffDias === 1 ? 'Mañana' : `En ${diffDias} días`;
    const urgente   = diffDias <= 1;

    // Google Calendar URL
    const gcStart = e.fechaISO.replace(/[-:]/g,'').slice(0,13) + '00Z';
    const gcEnd   = new Date(e.ts + 2*3600000).toISOString().replace(/[-:]/g,'').slice(0,13) + '00Z';
    const gcUrl   = `https://calendar.google.com/calendar/render?action=TEMPLATE`
      + `&text=${encodeURIComponent(e.titulo)}`
      + `&dates=${gcStart}/${gcEnd}`
      + `&details=${encodeURIComponent((e.desc||'') + (e.enlace ? '\n\nEnlace: ' + e.enlace : ''))}`
      + `&location=${encodeURIComponent(e.lugar||'')}`;

    // Estado botones guardado en localStorage
    const notifActiva = !!localStorage.getItem('notif_' + e.key);
    const gcGuardado  = !!localStorage.getItem('gcal_' + e.key);

    // Detectar si lugar o enlace es URL (Meet, Zoom, etc.)
    const esEnlace = (str) => str && (str.startsWith('http://') || str.startsWith('https://'));
    const lugarHtml = e.lugar
      ? esEnlace(e.lugar)
        ? `<a href="${escapeHTML(e.lugar)}" target="_blank" class="evento-meet-btn">🎥 Unirse al Meet</a>`
        : `<span class="evento-lugar">📍 ${escapeHTML(e.lugar)}</span>`
      : '';
    const enlaceHtml = e.enlace
      ? esEnlace(e.enlace)
        ? `<a href="${escapeHTML(e.enlace)}" target="_blank" class="evento-meet-btn">🔗 Unirse al evento</a>`
        : `<span class="evento-lugar">🔗 ${escapeHTML(e.enlace)}</span>`
      : '';

    const div = document.createElement('div');
    div.className = `evento-card ${urgente ? 'evento-urgente' : ''}`;
    div.id = `evento-${e.key}`;
    div.innerHTML = `
      <div class="evento-fecha-bloque">
        <span class="evento-dia">${fecha.getDate()}</span>
        <span class="evento-mes">${fecha.toLocaleString('es',{month:'short'}).toUpperCase()}</span>
      </div>
      <div class="evento-info">
        <div class="evento-etiqueta ${urgente?'etq-urgente':''}">${etiqueta}</div>
        <h3>${escapeHTML(e.titulo)}</h3>
        ${e.desc ? `<p>${escapeHTML(e.desc)}</p>` : ''}
        ${lugarHtml}
        ${enlaceHtml}
        <span class="evento-hora">🕐 ${fecha.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}</span>
        ${e.ministerio ? `<span class="evento-min-tag">⛪ ${MINISTERIO_NOMBRES[e.ministerio]||e.ministerio}</span>` : ''}
        <div class="evento-acciones">
          <a href="${gcUrl}" target="_blank"
             class="btn-gcal ${gcGuardado?'btn-gcal-ok':''}"
             id="gcal-${e.key}"
             onclick="marcarGcal('${e.key}',this)"
             title="Agregar a Google Calendar">
            <img src="https://ssl.gstatic.com/calendar/images/dynamiclogo_2020q4/calendar_${fecha.getDate()}_2x.png"
                 onerror="this.src='calendario.png'" class="gcal-icon" alt=""/>
            ${gcGuardado ? '✅ Agregado al calendario' : 'Agregar a Google Calendar'}
          </a>
          <button
            class="btn-notif-push ${notifActiva?'btn-notif-ok':''}"
            id="notif-${e.key}"
            onclick="toggleNotifEvento('${e.key}','${escapeHTML(e.titulo).replace(/'/g,"\\'")}','${e.fechaISO}',this)">
            ${notifActiva ? '🔔 Recordatorio activo' : '🔔 Recordatorio'}
          </button>
        </div>
      </div>
      <div class="evento-admin-btns">
        ${isAdmin ? `
          <button class="btn-mini btn-edit-evento" onclick="abrirEditarEvento('${e.key}')" title="Editar">✏️</button>
          <button class="btn-mini btn-mover-media" onclick="abrirMoverMedia('${e.key}','evento')" title="Asignar ministerio">📂</button>
          <button class="btn-mini btn-delete-media" onclick="borrarEvento('${e.key}')" title="Borrar">🗑️</button>
        ` : ''}
      </div>`;
    lista.appendChild(div);

    if (diffDias === 1) mostrarRecordatorio(e);
  });
});

const MINISTERIO_NOMBRES = {
  jovenes:'ECORESTAURACIÓN', alabanza:'HEREDAD', danza:'HIJAS DE SION',
  mujeres:'MUJERES CON PROPÓSITO', ninos:'FORJADORES DEL MAÑANA',
  teatro:'Ministerio de Teatro', ujieres:'Ministerio de Ujieres'
};

// ── EDITAR EVENTO ─────────────────────────────
window.abrirEditarEvento = async (key) => {
  const snap = await get(ref(db, `eventos/${key}`));
  const e    = snap.val();
  if (!e) return;

  const modal = document.createElement('div');
  modal.className = 'edit-evento-overlay';
  modal.id = 'editEventoModal';
  modal.innerHTML = `
    <div class="edit-evento-box">
      <button class="yo-close" onclick="document.getElementById('editEventoModal').remove()">✕</button>
      <h3>✏️ Editar Evento</h3>
      <input type="text"          id="eeT"  value="${escapeHTML(e.titulo)}"    placeholder="Título"/>
      <textarea                   id="eeD"  placeholder="Descripción">${escapeHTML(e.desc||'')}</textarea>
      <label style="color:var(--muted);font-size:.85rem">Fecha y hora:</label>
      <input type="datetime-local" id="eeF" value="${e.fechaISO}"/>
      <input type="text"          id="eeL"  value="${escapeHTML(e.lugar||'')}"  placeholder="Lugar o enlace de Meet/Zoom"/>
      <input type="text"          id="eeE"  value="${escapeHTML(e.enlace||'')}" placeholder="Enlace adicional (opcional)"/>
      <select id="eeM">
        <option value="">— Sin ministerio —</option>
        <option value="jovenes"  ${e.ministerio==='jovenes'  ?'selected':''}>ECORESTAURACIÓN — Jóvenes</option>
        <option value="alabanza" ${e.ministerio==='alabanza' ?'selected':''}>HEREDAD — Alabanza</option>
        <option value="danza"    ${e.ministerio==='danza'    ?'selected':''}>HIJAS DE SION — Danza</option>
        <option value="mujeres"  ${e.ministerio==='mujeres'  ?'selected':''}>MUJERES CON PROPÓSITO</option>
        <option value="ninos"    ${e.ministerio==='ninos'    ?'selected':''}>FORJADORES DEL MAÑANA</option>
        <option value="teatro"   ${e.ministerio==='teatro'   ?'selected':''}>Teatro</option>
        <option value="ujieres"  ${e.ministerio==='ujieres'  ?'selected':''}>Ujieres</option>
      </select>
      <button onclick="guardarEditEvento('${key}')">Guardar cambios</button>
      <p class="admin-msg" id="msgEditEvento"></p>
    </div>`;
  document.body.appendChild(modal);
};

window.guardarEditEvento = async (key) => {
  const titulo     = document.getElementById('eeT').value.trim();
  const desc       = document.getElementById('eeD').value.trim();
  const fechaISO   = document.getElementById('eeF').value;
  const lugar      = document.getElementById('eeL').value.trim();
  const enlace     = document.getElementById('eeE').value.trim();
  const ministerio = document.getElementById('eeM').value;
  const msg        = document.getElementById('msgEditEvento');
  if (!titulo || !fechaISO) { msg.textContent = 'Título y fecha son obligatorios.'; return; }
  try {
    const payload = { titulo, desc, fechaISO, lugar, enlace, ministerio };
    await update(ref(db, `eventos/${key}`), payload);
    document.getElementById('editEventoModal')?.remove();
  } catch(err) { msg.textContent = 'Error: ' + err.message; }
};

// ── ESTADOS BOTONES GCAL / NOTIF ──────────────
window.marcarGcal = (key, el) => {
  localStorage.setItem('gcal_' + key, '1');
  el.classList.add('btn-gcal-ok');
  el.textContent = '✅ Agregado al calendario';
};

window.toggleNotifEvento = async (key, titulo, fechaISO, btn) => {
  const activa = !!localStorage.getItem('notif_' + key);
  if (activa) {
    // Desactivar
    localStorage.removeItem('notif_' + key);
    const ev = JSON.parse(localStorage.getItem('eventos_push') || '{}');
    delete ev[key];
    localStorage.setItem('eventos_push', JSON.stringify(ev));
    btn.classList.remove('btn-notif-ok');
    btn.textContent = '🔔 Recordatorio';
  } else {
    await suscribirNotifEvento(key, titulo, fechaISO, btn);
  }
};

function mostrarRecordatorio(evento) {
  const visto = localStorage.getItem('recordatorio_' + evento.key);
  if (visto) return;
  localStorage.setItem('recordatorio_' + evento.key, '1');
  const fecha = new Date(evento.fechaISO);
  document.getElementById('toastTitulo').textContent = '📅 ' + evento.titulo;
  document.getElementById('toastMsg').textContent =
    `Mañana ${fecha.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}${evento.lugar?' — '+evento.lugar:''}`;
  document.getElementById('toastRecordatorio').classList.remove('hidden');
  setTimeout(() => cerrarToast(), 8000);
}

window.cerrarToast = () =>
  document.getElementById('toastRecordatorio').classList.add('hidden');

// ── NOTIFICACIONES PUSH (Service Worker) ──────
async function registrarServiceWorker() {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
  try {
    await navigator.serviceWorker.register('sw.js');
  } catch(e) { console.warn('SW no registrado:', e); }
}

window.suscribirNotifEvento = async (key, titulo, fechaISO, btn) => {
  if (!('Notification' in window)) {
    alert('Tu navegador no soporta notificaciones.'); return;
  }
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') {
    alert('Debes permitir las notificaciones para recibir recordatorios.'); return;
  }
  const eventos = JSON.parse(localStorage.getItem('eventos_push') || '{}');
  eventos[key] = { titulo, fechaISO };
  localStorage.setItem('eventos_push', JSON.stringify(eventos));
  localStorage.setItem('notif_' + key, '1');

  if (btn) { btn.classList.add('btn-notif-ok'); btn.textContent = '🔔 Recordatorio activo'; }

  const fechaEvento  = new Date(fechaISO).getTime();
  const ahora        = Date.now();
  const unDia        = 24 * 60 * 60 * 1000;
  const msHastaNotif = (fechaEvento - unDia) - ahora;

  if (msHastaNotif <= 0) {
    mostrarNotifInmediata(titulo, fechaISO);
  } else {
    setTimeout(() => mostrarNotifInmediata(titulo, fechaISO), msHastaNotif);
    const horas = Math.round(msHastaNotif / 3600000);
    alert(`✅ Recordatorio activado. Recibirás una notificación 1 día antes (en ~${horas} horas).`);
  }
};

function mostrarNotifInmediata(titulo, fechaISO) {
  const fecha = new Date(fechaISO);
  const hora  = fecha.toLocaleTimeString('es', {hour:'2-digit', minute:'2-digit'});
  if (Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification('📅 CCRLR — Recordatorio de evento', {
        body: `"${titulo}" es mañana a las ${hora}. ¡No faltes!`,
        icon: 'ICONO.png',
        badge: 'ICONO.png',
        vibrate: [200, 100, 200],
        tag: 'evento-' + titulo,
        requireInteraction: true
      });
    }).catch(() => {
      // Fallback: notificación directa si SW no está listo
      new Notification('📅 CCRLR — Recordatorio', {
        body: `"${titulo}" es mañana a las ${hora}`,
        icon: 'ICONO.png'
      });
    });
  }
}

// Restaurar recordatorios pendientes al cargar la página
function restaurarRecordatoriosPendientes() {
  if (Notification.permission !== 'granted') return;
  const eventos = JSON.parse(localStorage.getItem('eventos_push') || '{}');
  const ahora   = Date.now();
  const unDia   = 24 * 60 * 60 * 1000;
  Object.entries(eventos).forEach(([key, e]) => {
    const fechaEvento  = new Date(e.fechaISO).getTime();
    const msHastaNotif = (fechaEvento - unDia) - ahora;
    if (msHastaNotif > 0) {
      setTimeout(() => mostrarNotifInmediata(e.titulo, e.fechaISO), msHastaNotif);
    } else if (fechaEvento > ahora) {
      // El evento no ha pasado pero ya es el día — notificar
      mostrarNotifInmediata(e.titulo, e.fechaISO);
    }
    // Limpiar eventos ya pasados
    if (fechaEvento < ahora) {
      delete eventos[key];
      localStorage.setItem('eventos_push', JSON.stringify(eventos));
    }
  });
}

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', () => {
  registrarServiceWorker();
  restaurarRecordatoriosPendientes();
});

// ── AUTO-BORRAR MENSAJES CHAT +30 DÍAS ────────
function limpiarChatAntiguo(entries) {
  if (!isAdmin) return; // solo el admin ejecuta la limpieza
  const unMes = 30 * 24 * 60 * 60 * 1000;
  const ahora = Date.now();
  entries.forEach(([key, m]) => {
    const fechaMsg = m.fecha || 0;
    if (ahora - fechaMsg > unMes) {
      remove(ref(db, `chat/${key}`)).catch(() => {});
    }
  });
}
window.publicarMensajeAdmin = async () => {
  const texto = document.getElementById('adminMsgText').value.trim();
  const msg   = document.getElementById('msgChat');
  if (!texto) { msg.textContent='Escribe un mensaje.'; return; }
  try {
    await push(ref(db,'chat'), { nombre:'Administrador', texto, esAdmin:true, uid:currentUser.uid, fecha:serverTimestamp() });
    msg.textContent = '¡Mensaje publicado!';
    document.getElementById('adminMsgText').value = '';
  } catch(e) { msg.textContent='Error: '+e.message; }
};

// ── BORRAR IMAGEN (admin) ─────────────────────
window.borrarImagen = async (key) => {
  if (!confirm('¿Borrar esta imagen permanentemente?')) return;
  try { await remove(ref(db,`imagenes/${key}`)); }
  catch(e) { alert('Error: '+e.message); }
};

// ── BORRAR LIBRO (admin) ──────────────────────
window.borrarLibro = async (key) => {
  if (!confirm('¿Borrar este libro permanentemente?')) return;
  try { await remove(ref(db,`libros/${key}`)); }
  catch(e) { alert('Error: '+e.message); }
};

// ── BORRAR VIDEO (admin) ──────────────────────
window.borrarVideo = async (key) => {
  if (!confirm('¿Borrar este video permanentemente?')) return;
  try { await remove(ref(db,`videos/${key}`)); }
  catch(e) { alert('Error: '+e.message); }
};

// ── CARGAR IMÁGENES FIREBASE ──────────────────
// ── CARGAR IMÁGENES FIREBASE ──────────────────
let _imagenesCache = {};

function reRenderGaleria() {
  // ── Imágenes Firebase ──
  document.querySelectorAll('.gallery-item.firebase-img').forEach(el => el.remove());
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;

  Object.entries(_imagenesCache).reverse().forEach(([key, img]) => {
    if (img.ministerio) return;
    const div = document.createElement('div');
    div.className = 'gallery-item firebase-img';
    div.dataset.key = key;
    div.innerHTML = `
      <img src="${img.url}" data-src="${img.url}" alt="${img.caption||'Imagen'}"/>
      <div class="overlay"><span>${img.caption||'Ver imagen'}</span></div>
      ${isAdmin ? `
        <div class="admin-img-btns">
          <button onclick="event.stopPropagation();borrarImagen('${key}')" title="Borrar">🗑️</button>
          <button onclick="event.stopPropagation();abrirMoverMedia('${key}','imagen')" title="Asignar ministerio">📂</button>
        </div>` : ''}`;
    div.onclick = () => openModalUrl(img.url, img.caption||'', '.gallery-item');
    grid.appendChild(div);
  });

  // ── Imágenes locales: agregar/quitar botón 📤 según estado admin ──
  document.querySelectorAll('.gallery-item.local-img').forEach(item => {
    item.querySelectorAll('.admin-img-btns').forEach(b => b.remove());
    // click para abrir modal
    const imgEl  = item.querySelector('img');
    const url    = imgEl?.getAttribute('data-src') || imgEl?.src || '';
    const caption = item.dataset.caption || imgEl?.alt || '';
    item.onclick = () => openModalUrl(url, caption, '.gallery-item');

    if (!isAdmin) return;
    const btns = document.createElement('div');
    btns.className = 'admin-img-btns';
    btns.innerHTML = `
      <button onclick="event.stopPropagation();subirLocalAFirebase('${url}','${caption.replace(/'/g,"\\'")}')"
        title="Subir a Firebase (para borrar o asignar ministerio)">📤</button>`;
    item.appendChild(btns);
  });

  observeCards();
}

onValue(ref(db,'imagenes'), (snap) => {
  _imagenesCache = snap.val() || {};
  reRenderGaleria();
});

// Subir imagen local a Cloudinary + Firebase para poder gestionarla
window.subirLocalAFirebase = async (url, caption) => {
  if (!confirm(`¿Subir "${caption}" a Firebase?\nLuego podrás borrarla o asignarle un ministerio, y eliminar el archivo .jpg del repositorio.`)) return;
  try {
    const res  = await fetch(url);
    const blob = await res.blob();
    const form = new FormData();
    form.append('file', blob, url.split('/').pop());
    form.append('upload_preset', 'ccrlr_preset');
    const up   = await fetch('https://api.cloudinary.com/v1_1/dqxmetnvm/image/upload', {method:'POST', body:form});
    const data = await up.json();
    if (!data.secure_url) throw new Error('Error Cloudinary: ' + (data.error?.message||''));
    await push(ref(db,'imagenes'), { url:data.secure_url, publicId:data.public_id, caption, fecha:serverTimestamp() });
    alert(`✅ "${caption}" subida exitosamente.\nYa aparece en Firebase con botones 🗑️ y 📂.\nPuedes borrar el archivo ${url} del repositorio cuando quieras.`);
  } catch(e) { alert('❌ Error: ' + e.message); }
};

// ── CARGAR LIBROS ─────────────────────────────
onValue(ref(db,'libros'), (snap) => {
  const grid = document.getElementById('booksGrid');
  grid.innerHTML = '';
  const data = snap.val();
  if (!data) { grid.innerHTML='<p class="loading-txt">Aún no hay libros publicados.</p>'; return; }
  Object.entries(data).reverse().forEach(([key, libro]) => {
    const div = document.createElement('div');
    div.className = 'book-card';
    div.innerHTML = `
      <div class="book-cover" style="background:linear-gradient(135deg,${libro.color},#111);">
        <span>${libro.titulo}</span>
        ${isAdmin ? `<button class="btn-delete-media btn-delete-book" onclick="borrarLibro('${key}')" title="Borrar libro">🗑️</button>` : ''}
      </div>
      <div class="book-info">
        <h3>${libro.titulo}</h3>
        <p class="author">${libro.autor}</p>
        <p class="desc">${libro.desc||''}</p>
        ${libro.url ? `<a href="${libro.url}" target="_blank" class="btn-libro">Leer más →</a>` : ''}
      </div>`;
    grid.appendChild(div);
  });
  observeCards();
});

// ── CARGAR VIDEOS ─────────────────────────────
onValue(ref(db,'videos'), (snap) => {
  const grid = document.getElementById('videosGrid');
  grid.innerHTML = '';
  const data = snap.val();
  if (!data) { grid.innerHTML='<p class="loading-txt">Aún no hay prédicas publicadas.</p>'; return; }
  Object.entries(data).reverse().forEach(([key, vid]) => {
    const div = document.createElement('div');
    div.className = 'video-card';
    div.innerHTML = `
      ${isAdmin ? `<div class="admin-media-btns">
        <button class="btn-mini btn-mover-media" onclick="abrirMoverMedia('${key}','video')" title="Asignar ministerio">📂</button>
        <button class="btn-mini btn-delete-media" onclick="borrarVideo('${key}')" title="Borrar">🗑️</button>
      </div>` : ''}
      <div class="video-wrap"><video src="${vid.url}" controls preload="metadata" playsinline></video></div>
      <div class="video-info">
        <h3>${escapeHTML(vid.titulo)}</h3>
        ${vid.desc ? `<p class="desc">${escapeHTML(vid.desc)}</p>` : ''}
      </div>`;
    grid.appendChild(div);
  });
  observeCards();
});

// ── CARGAR CHAT ───────────────────────────────
onValue(ref(db,'chat'), (snap) => {
  const box = document.getElementById('chatMessages');
  box.innerHTML='';
  const data = snap.val();
  if (!data) return;
  const entries = Object.entries(data);

  // Auto-limpiar mensajes de más de 30 días (solo admin)
  limpiarChatAntiguo(entries);

  entries.forEach(([key, m]) => {
    const esMio    = currentUser && m.uid === currentUser.uid;
    const puedeEdit   = esMio && !m.esAdmin;
    const puedeBorrar = esMio || isAdmin;

    const div = document.createElement('div');
    div.className = `msg ${m.esAdmin?'msg-admin':'msg-other'} ${esMio&&!m.esAdmin?'msg-own':''}`;
    div.dataset.key = key;

    div.innerHTML = `
      <div class="msg-header">
        <span class="msg-name">${escapeHTML(m.nombre)}${m.esAdmin?' ✦':''}</span>
        ${m.editado?'<span class="msg-editado">(editado)</span>':''}
        <div class="msg-acciones">
          ${puedeEdit?`<button class="msg-btn msg-btn-edit" title="Editar" onclick="editarMensaje('${key}','${escapeHTML(m.texto).replace(/'/g,"\\'")}')">✏️</button>`:''}
          ${puedeBorrar?`<button class="msg-btn msg-btn-del" title="Borrar" onclick="borrarMensaje('${key}')">🗑️</button>`:''}
          ${isAdmin&&!m.esAdmin?`<button class="msg-btn msg-btn-block" title="Bloquear usuario" onclick="bloquearUsuario('${m.uid}','${escapeHTML(m.nombre)}')">🚫</button>`:''}
        </div>
      </div>
      <div class="msg-bubble" id="bubble-${key}">${escapeHTML(m.texto)}</div>
      <span class="msg-time">${formatTime(m.fecha)}</span>`;

    box.appendChild(div);
  });

  box.scrollTop = box.scrollHeight;
  checkNuevoMensaje(entries.length);
});

// ── EDITAR MENSAJE ────────────────────────────
window.editarMensaje = (key, textoActual) => {
  const bubble = document.getElementById('bubble-' + key);
  if (!bubble || bubble.querySelector('.edit-input')) return;

  const textoDecodificado = textoActual
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"').replace(/&#039;/g,"'");

  bubble.innerHTML = `
    <div class="edit-wrap">
      <input class="edit-input" type="text" value="${escapeHTML(textoDecodificado)}" maxlength="200"/>
      <div class="edit-btns">
        <button class="edit-ok" onclick="guardarEdicion('${key}')">Guardar</button>
        <button class="edit-cancel" onclick="cancelarEdicion('${key}','${escapeHTML(textoDecodificado).replace(/'/g,"\\'")}')">Cancelar</button>
      </div>
    </div>`;
  bubble.querySelector('.edit-input').focus();
};

window.guardarEdicion = async (key) => {
  const bubble = document.getElementById('bubble-' + key);
  const input  = bubble?.querySelector('.edit-input');
  if (!input) return;
  const nuevoTexto = input.value.trim();
  if (!nuevoTexto) return;
  if (contienePalabraProhibida(nuevoTexto)) {
    input.style.borderColor = '#e63946';
    input.placeholder = '⚠️ Palabras no permitidas';
    return;
  }
  try {
    await update(ref(db,`chat/${key}`), { texto: nuevoTexto, editado: true });
  } catch(e) { console.error(e); }
};

window.cancelarEdicion = (key, textoOriginal) => {
  const bubble = document.getElementById('bubble-' + key);
  if (bubble) bubble.innerHTML = escapeHTML(textoOriginal);
};

// ── BORRAR MENSAJE ────────────────────────────
window.borrarMensaje = async (key) => {
  if (!confirm('¿Seguro que deseas borrar este mensaje?')) return;
  try { await remove(ref(db,`chat/${key}`)); }
  catch(e) { console.error(e); }
};

// ── BLOQUEAR USUARIO (solo admin) ─────────────
window.bloquearUsuario = async (uid, nombre) => {
  if (!isAdmin || !uid) return;
  if (!confirm(`¿Bloquear al usuario "${nombre}"? No podrá iniciar sesión.`)) return;
  try {
    await update(ref(db,`usuarios/${uid}`), { bloqueado: true });
    alert(`Usuario "${nombre}" bloqueado correctamente.`);
  } catch(e) { alert('Error: '+e.message); }
};

// ── PANEL USUARIOS ADMIN ──────────────────────
function cargarUsuariosAdmin() {
  onValue(ref(db,'usuarios'), (snap) => {
    const data = snap.val();
    const lista = document.getElementById('adminUserList');
    if (!lista) return;
    lista.innerHTML = '';
    if (!data) { lista.innerHTML='<p class="loading-txt">No hay usuarios registrados.</p>'; return; }

    Object.entries(data).forEach(([uid, u]) => {
      const row = document.createElement('div');
      row.className = `admin-user-row ${u.bloqueado?'bloqueado':''}`;
      row.innerHTML = `
        <div class="admin-user-info">
          <span class="admin-user-nick">👤 ${escapeHTML(u.nickname||'—')}</span>
          <span class="admin-user-email">📧 ${escapeHTML(u.email||'—')}</span>
          ${u.bloqueado?'<span class="admin-user-tag blocked">Bloqueado</span>':'<span class="admin-user-tag active">Activo</span>'}
        </div>
        <div class="admin-user-btns">
          ${u.bloqueado
            ? `<button class="btn-desbloquear" onclick="desbloquearUsuario('${uid}','${escapeHTML(u.nickname||u.email)}')">Desbloquear</button>`
            : `<button class="btn-bloquear-admin" onclick="bloquearUsuario('${uid}','${escapeHTML(u.nickname||u.email)}')">🚫 Bloquear</button>`
          }
        </div>`;
      lista.appendChild(row);
    });
  });
}

window.desbloquearUsuario = async (uid, nombre) => {
  if (!confirm(`¿Desbloquear a "${nombre}"?`)) return;
  try {
    await update(ref(db,`usuarios/${uid}`), { bloqueado: false });
    alert(`"${nombre}" desbloqueado.`);
  } catch(e) { alert('Error: '+e.message); }
};

// ── ENVIAR MENSAJE ────────────────────────────
window.sendMessage = async () => {
  if (!currentUser) { abrirModalChat(); return; }
  // Prioridad: nickname guardado > campo de nombre > email sin dominio
  const nombre = chatNickname
    || localStorage.getItem('chatNickname')
    || document.getElementById('nameInput').value.trim()
    || currentUser.email.split('@')[0];
  const texto  = document.getElementById('msgInput').value.trim();
  if (!texto) return;
  if (contienePalabraProhibida(texto)) {
    const warn = document.getElementById('chatWarning');
    warn.classList.remove('hidden');
    setTimeout(()=>warn.classList.add('hidden'),4000);
    return;
  }
  try {
    await push(ref(db,'chat'), {
      nombre, texto, uid: currentUser.uid, esAdmin: isAdmin, fecha: serverTimestamp()
    });
    document.getElementById('msgInput').value='';
  } catch(e) {
    console.error('sendMessage error:', e);
    if (e.code === 'PERMISSION_DENIED') {
      mostrarAuthError('No tienes permiso para enviar mensajes. Intenta cerrar sesión e ingresar de nuevo.');
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('msgInput')?.addEventListener('keydown', e=>{
    if (e.key==='Enter') sendMessage();
  });
  document.getElementById('chatLocked')?.addEventListener('click', abrirModalChat);
});

// ── MODAL IMAGEN CON NAVEGACIÓN ───────────────
let galeriaActual = [];
let galeriaIndex  = 0;
let touchStartX   = 0;

function construirGaleria(contexto) {
  // contexto: selector del contenedor de imágenes (defecto: galería principal)
  const selector = contexto || '.gallery-item';
  galeriaActual = Array.from(document.querySelectorAll(selector)).map(item => {
    const img = item.querySelector('img');
    return { url: img?.getAttribute('data-src') || img?.src || '', alt: img?.alt || '' };
  }).filter(i => i.url);
}

window.openModalUrl = (url, alt, contexto) => {
  construirGaleria(contexto);
  // Buscar por URL exacta (no por src procesado por el navegador)
  let idx = galeriaActual.findIndex(i => i.url === url);
  if (idx < 0) idx = 0;
  galeriaIndex = idx;
  mostrarImagenModal(galeriaIndex);
  document.getElementById('imgModal').classList.add('active');
  document.body.style.overflow = 'hidden';
};

function mostrarImagenModal(idx) {
  const item = galeriaActual[idx];
  if (!item) return;
  const img     = document.getElementById('modalImg');
  const caption = document.getElementById('modalCaption');
  const counter = document.getElementById('modalCounter');

  // Animación de transición
  img.style.opacity = '0';
  img.style.transform = 'scale(0.96)';
  setTimeout(() => {
    img.src = item.url;
    img.alt = item.alt;
    if (caption) caption.textContent = item.alt;
    if (counter) counter.textContent = `${idx + 1} / ${galeriaActual.length}`;
    img.style.opacity = '1';
    img.style.transform = 'scale(1)';
  }, 150);

  // Mostrar/ocultar flechas en extremos
  document.getElementById('btnPrev').style.opacity = idx === 0 ? '0.3' : '1';
  document.getElementById('btnNext').style.opacity = idx === galeriaActual.length - 1 ? '0.3' : '1';
}

window.modalPrev = () => {
  if (galeriaIndex > 0) { galeriaIndex--; mostrarImagenModal(galeriaIndex); }
};

window.modalNext = () => {
  if (galeriaIndex < galeriaActual.length - 1) { galeriaIndex++; mostrarImagenModal(galeriaIndex); }
};

window.closeModal = () => {
  document.getElementById('imgModal').classList.remove('active');
  document.body.style.overflow = '';
};

// Teclado: flechas y Escape
document.addEventListener('keydown', e => {
  if (document.getElementById('imgModal').classList.contains('active')) {
    if (e.key === 'ArrowLeft')  modalPrev();
    if (e.key === 'ArrowRight') modalNext();
    if (e.key === 'Escape')     closeModal();
  } else if (e.key === 'Escape') {
    cerrarModalChat();
  }
});

// Touch: deslizar en móvil
document.getElementById('imgModal')?.addEventListener('touchstart', e => {
  touchStartX = e.changedTouches[0].screenX;
}, { passive: true });

document.getElementById('imgModal')?.addEventListener('touchend', e => {
  const diff = touchStartX - e.changedTouches[0].screenX;
  if (Math.abs(diff) > 50) {
    if (diff > 0) modalNext(); else modalPrev();
  }
}, { passive: true });


// ── CHAT FLOTANTE ─────────────────────────────
let chatMaximizado = false;
let chatAbierto    = false;

window.abrirChat = () => {
  chatAbierto = true;
  const floatEl   = document.getElementById('chatFloat');
  const welcomeEl = document.getElementById('chatWelcome');
  floatEl.classList.remove('hidden');
  document.getElementById('chatBubble').classList.add('hidden');
  document.getElementById('bubbleNotif').classList.add('hidden');
  welcomeEl.classList.remove('hidden','welcome-done');
  welcomeEl.classList.add('welcome-playing');
  void welcomeEl.offsetWidth;
  setTimeout(() => {
    welcomeEl.classList.add('welcome-done');
    welcomeEl.classList.remove('welcome-playing');
    document.getElementById('chatMessages').scrollTop = 99999;
  }, 1800);
};

window.minimizarChat = () => {
  document.getElementById('chatFloat').classList.add('hidden');
  document.getElementById('chatBubble').classList.remove('hidden');
};
window.restaurarChat = () => {
  document.getElementById('chatFloat').classList.remove('hidden');
  document.getElementById('chatBubble').classList.add('hidden');
  document.getElementById('bubbleNotif').classList.add('hidden');
  document.getElementById('chatMessages').scrollTop = 99999;
};
window.cerrarChat = () => {
  chatAbierto = false; chatMaximizado = false;
  document.getElementById('chatFloat').classList.add('hidden','chat-maximizado');
  document.getElementById('chatBubble').classList.add('hidden');
  document.getElementById('btnMaximizar').textContent='⛶';
};
window.maximizarChat = () => {
  const floatEl = document.getElementById('chatFloat');
  const btnMax  = document.getElementById('btnMaximizar');
  chatMaximizado = !chatMaximizado;
  floatEl.classList.toggle('chat-maximizado', chatMaximizado);
  btnMax.textContent = chatMaximizado ? '❐' : '⛶';
  document.getElementById('chatMessages').scrollTop = 99999;
};

let lastMsgCount = 0;
function checkNuevoMensaje(count) {
  if (!chatAbierto) return;
  const floatVisible = !document.getElementById('chatFloat').classList.contains('hidden');
  if (!floatVisible && count > lastMsgCount) {
    document.getElementById('bubbleNotif').classList.remove('hidden');
    document.getElementById('chatBubble').classList.remove('hidden');
  }
  lastMsgCount = count;
}

// ── ANIMACIÓN SCROLL ──────────────────────────
function observeCards() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.opacity='1';
        e.target.style.transform='translateY(0)';
      }
    });
  }, {threshold:0.1});
  document.querySelectorAll('.gallery-item,.book-card').forEach(el=>{
    el.style.opacity='0';
    el.style.transform='translateY(24px)';
    el.style.transition='opacity 0.5s ease,transform 0.5s ease';
    obs.observe(el);
  });
}

// ── HELPERS ───────────────────────────────────
function escapeHTML(str='') {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// ── PANEL "YO" ────────────────────────────────
window.togglePanelYo = () => {
  const panel   = document.getElementById('yoPanel');
  const overlay = document.getElementById('yoOverlay');
  const abierto = !panel.classList.contains('hidden');
  panel.classList.toggle('hidden', abierto);
  overlay.classList.toggle('hidden', abierto);
  document.body.style.overflow = abierto ? '' : 'hidden';
};

window.cerrarPanelYo = () => {
  document.getElementById('yoPanel').classList.add('hidden');
  document.getElementById('yoOverlay').classList.add('hidden');
  document.body.style.overflow = '';
};

// ── MINISTERIOS ───────────────────────────────
const MINISTERIOS = {
  jovenes:  { nombre:'ECORESTAURACIÓN',        categoria:'Ministerio de Jóvenes',  icono:'JOVENES_N.png',               tag:'jovenes'  },
  alabanza: { nombre:'HEREDAD',                categoria:'Ministerio de Alabanza',  icono:'ALABANZA_N.png',              tag:'alabanza' },
  danza:    { nombre:'HIJAS DE SION',          categoria:'Ministerio de Danza',     icono:'DANZA_N.png',                 tag:'danza'    },
  mujeres:  { nombre:'MUJERES CON PROPÓSITO',  categoria:'Ministerio de Damas',     icono:'MUJERES_CON_PROPOSITO_N.png', tag:'mujeres'  },
  ninos:    { nombre:'FORJADORES DEL MAÑANA',  categoria:'Ministerio de Niños',     icono:'NIÑOS_N.png',                 tag:'ninos'    },
  teatro:   { nombre:'MINISTERIO DE TEATRO',   categoria:'Teatro',                  icono:'TEATRO_N.png',                tag:'teatro'   },
  ujieres:  { nombre:'MINISTERIO DE UJIERES',  categoria:'Ujieres',                 icono:'UJIERES_N.png',               tag:'ujieres'  },
};

window.abrirMinisterio = (id) => {
  const m = MINISTERIOS[id];
  if (!m) return;

  const temaClaro = document.body.classList.contains('tema-claro');
  const iconoSrc  = temaClaro ? m.icono.replace('_N.png', '.png') : m.icono;
  document.getElementById('minIcon').src            = iconoSrc;
  document.getElementById('minIcon').alt            = m.nombre;
  document.getElementById('minNombre').textContent     = m.nombre;
  document.getElementById('minCategoria').textContent  = m.categoria;

  const gallery = document.getElementById('minGallery');
  gallery.innerHTML = '<p class="loading-txt">Cargando contenido...</p>';

  cerrarPanelYo();
  document.getElementById('ministerioModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  // Scroll al top del modal al abrirlo
  document.querySelector('.ministerio-modal-inner').scrollTop = 0;

  let imgData = {}, evtData = {}, vidData = {};
  let cargados = 0;

  // Helper: crea una sección acordeón
  function crearAcordeon(emoji, titulo, count, contenidoFn) {
    const sec = document.createElement('div');
    sec.className = 'min-acordeon open'; // abierto por defecto
    const header = document.createElement('div');
    header.className = 'min-acordeon-header';
    header.innerHTML = `
      <div class="min-acordeon-titulo">
        <span>${emoji}</span>
        <span>${titulo}</span>
        <span class="min-acordeon-count">${count}</span>
      </div>
      <span class="min-acordeon-arrow">▼</span>`;
    header.addEventListener('click', () => {
      sec.classList.toggle('open');
    });
    const body = document.createElement('div');
    body.className = 'min-acordeon-body';
    contenidoFn(body);
    sec.appendChild(header);
    sec.appendChild(body);
    return sec;
  }

  function renderTodo() {
    cargados++;
    if (cargados < 3) return;
    gallery.innerHTML = '';

    const imgs = Object.entries(imgData).filter(([,i]) => i.ministerio === m.tag).reverse();
    const ahora = Date.now();
    const evts  = Object.entries(evtData)
      .filter(([,e]) => e.ministerio === m.tag && new Date(e.fechaISO).getTime() >= ahora - 86400000)
      .sort((a,b) => new Date(a[1].fechaISO) - new Date(b[1].fechaISO));
    const vids  = Object.entries(vidData).filter(([,v]) => v.ministerio === m.tag).reverse();

    if (!imgs.length && !evts.length && !vids.length) {
      gallery.innerHTML = '<p class="loading-txt">Aún no hay contenido en este ministerio.</p>';
      return;
    }

    // ── IMÁGENES ──────────────────────────────────
    if (imgs.length) {
      gallery.appendChild(crearAcordeon('🖼️', 'Imágenes', imgs.length, (body) => {
        const grid = document.createElement('div');
        grid.className = 'min-imgs-grid';
        imgs.forEach(([key, img], arrIdx) => {
          const div = document.createElement('div');
          div.className = 'min-img-item';
          div.innerHTML = `
            <img src="${img.url}" data-src="${img.url}" alt="${escapeHTML(img.caption||'')}" loading="lazy"/>
            ${img.caption ? `<span>${escapeHTML(img.caption)}</span>` : ''}
            ${isAdmin ? `<div class="min-admin-btns">
              <button onclick="event.stopPropagation();borrarImagen('${key}')" title="Borrar">🗑️</button>
              <button onclick="event.stopPropagation();abrirMoverMedia('${key}','imagen')" title="Quitar de ministerio">📂</button>
            </div>` : ''}`;
          div.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            // Abrir modal con la galería del ministerio
            galeriaActual = imgs.map(([,i]) => ({ url: i.url, alt: i.caption||'' }));
            galeriaIndex  = arrIdx;
            mostrarImagenModal(galeriaIndex);
            document.getElementById('imgModal').classList.add('active');
            document.body.style.overflow = 'hidden';
          });
          grid.appendChild(div);
        });
        body.appendChild(grid);
      }));
    }

    // ── ACTIVIDADES ───────────────────────────────
    if (evts.length) {
      gallery.appendChild(crearAcordeon('📅', 'Actividades', evts.length, (body) => {
        evts.forEach(([key, e]) => {
          const fecha = new Date(e.fechaISO);
          const esURL = s => s && (s.startsWith('http://') || s.startsWith('https://'));
          const card  = document.createElement('div');
          card.className = 'min-evento-card';
          // Google Calendar URL
          const gcStart = e.fechaISO.replace(/[-:]/g,'').slice(0,13) + '00Z';
          const gcEnd   = new Date(new Date(e.fechaISO).getTime() + 2*3600000).toISOString().replace(/[-:]/g,'').slice(0,13) + '00Z';
          const gcUrl   = `https://calendar.google.com/calendar/render?action=TEMPLATE`
            + `&text=${encodeURIComponent(e.titulo)}`
            + `&dates=${gcStart}/${gcEnd}`
            + `&details=${encodeURIComponent((e.desc||'') + (e.enlace ? '\n\nEnlace: ' + e.enlace : ''))}`
            + `&location=${encodeURIComponent(e.lugar||'')}`;
          const gcGuardado = !!localStorage.getItem('gcal_' + key);

          card.innerHTML = `
            <div class="min-evento-fecha">
              <span>${fecha.getDate()}</span>
              <small>${fecha.toLocaleString('es',{month:'short'}).toUpperCase()}</small>
            </div>
            <div class="min-evento-info">
              <strong>${escapeHTML(e.titulo)}</strong>
              ${e.desc ? `<p>${escapeHTML(e.desc)}</p>` : ''}
              ${e.lugar ? esURL(e.lugar)
                ? `<a href="${escapeHTML(e.lugar)}" target="_blank" class="evento-meet-btn">🎥 Unirse al Meet</a>`
                : `<em>📍 ${escapeHTML(e.lugar)}</em>` : ''}
              ${e.enlace && esURL(e.enlace) ? `<a href="${escapeHTML(e.enlace)}" target="_blank" class="evento-meet-btn">🔗 Enlace</a>` : ''}
              <em>🕐 ${fecha.toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}</em>
              <a href="${gcUrl}" target="_blank"
                 class="btn-gcal ${gcGuardado?'btn-gcal-ok':''}"
                 id="gcal-${key}"
                 onclick="marcarGcal('${key}',this)"
                 style="margin-top:8px;display:inline-flex;font-size:0.78rem;padding:5px 10px;"
                 title="Agregar a Google Calendar">
                <img src="https://ssl.gstatic.com/calendar/images/dynamiclogo_2020q4/calendar_${fecha.getDate()}_2x.png"
                     onerror="this.src='calendario.png'" class="gcal-icon" alt="" style="width:16px;height:16px;margin-right:5px;"/>
                ${gcGuardado ? '✅ Agregado' : '📅 Google Calendar'}
              </a>
            </div>
            ${isAdmin ? `<div class="min-admin-btns-col">
              <button onclick="abrirEditarEvento('${key}')" title="Editar">✏️</button>
              <button onclick="abrirMoverMedia('${key}','evento')" title="Quitar de ministerio">📂</button>
              <button onclick="borrarEvento('${key}')" title="Borrar">🗑️</button>
            </div>` : ''}`;
          body.appendChild(card);
        });
      }));
    }

    // ── VIDEOS ────────────────────────────────────
    if (vids.length) {
      gallery.appendChild(crearAcordeon('🎬', 'Videos', vids.length, (body) => {
        vids.forEach(([key, vid]) => {
          const card = document.createElement('div');
          card.className = 'min-video-card';
          card.innerHTML = `
            <video src="${vid.url}" controls preload="metadata" playsinline></video>
            <div class="min-video-info">
              <strong>${escapeHTML(vid.titulo)}</strong>
              ${vid.desc ? `<p>${escapeHTML(vid.desc)}</p>` : ''}
            </div>
            ${isAdmin ? `<div style="display:flex;gap:6px;padding:0 12px 10px;">
              <button onclick="abrirMoverMedia('${key}','video')" class="btn-secondary" style="font-size:0.8rem;padding:5px 10px;">📂 Quitar</button>
              <button onclick="borrarVideo('${key}')" class="btn-danger" style="font-size:0.8rem;padding:5px 10px;">🗑️ Borrar</button>
            </div>` : ''}`;
          body.appendChild(card);
        });
      }));
    }
  }

  onValue(ref(db,'imagenes'), s => { imgData = s.val()||{}; renderTodo(); }, {onlyOnce:true});
  onValue(ref(db,'eventos'),  s => { evtData = s.val()||{}; renderTodo(); }, {onlyOnce:true});
  onValue(ref(db,'videos'),   s => { vidData = s.val()||{}; renderTodo(); }, {onlyOnce:true});
};
window.cerrarMinisterio = () => {
  document.getElementById('ministerioModal').classList.add('hidden');
  document.body.style.overflow = '';
};

// Cerrar modal ministerio con Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') cerrarMinisterio();
});

// ── MOVER MEDIA A MINISTERIO ──────────────────
const MINISTERIO_OPTS = [
  {v:'',       l:'— Galería general / sin ministerio —'},
  {v:'jovenes', l:'ECORESTAURACIÓN — Jóvenes'},
  {v:'alabanza',l:'HEREDAD — Alabanza'},
  {v:'danza',   l:'HIJAS DE SION — Danza'},
  {v:'mujeres', l:'MUJERES CON PROPÓSITO — Damas'},
  {v:'ninos',   l:'FORJADORES DEL MAÑANA — Niños'},
  {v:'teatro',  l:'Ministerio de Teatro'},
  {v:'ujieres', l:'Ministerio de Ujieres'},
];

window.abrirMoverMedia = (key, tipo) => {
  document.getElementById('moverMediaModal')?.remove();
  const opts = MINISTERIO_OPTS.map(o => `<option value="${o.v}">${o.l}</option>`).join('');
  const modal = document.createElement('div');
  modal.className = 'edit-evento-overlay';
  modal.id = 'moverMediaModal';
  modal.innerHTML = `
    <div class="edit-evento-box">
      <button class="yo-close" onclick="document.getElementById('moverMediaModal').remove()">✕</button>
      <h3>📂 Asignar a ministerio</h3>
      <p style="color:var(--muted);font-size:.85rem;margin-bottom:12px">
        Selecciona el ministerio al que pertenece este contenido.
      </p>
      <select id="moverSelect">${opts}</select>
      <button onclick="confirmarMoverMedia('${key}','${tipo}')">Guardar</button>
      <p class="admin-msg" id="msgMover"></p>
    </div>`;
  document.body.appendChild(modal);
};

window.confirmarMoverMedia = async (key, tipo) => {
  const ministerio = document.getElementById('moverSelect').value;
  const rutas = { imagen:'imagenes', video:'videos', inspiracion:'inspiracion', evento:'eventos' };
  const ruta  = rutas[tipo];
  if (!ruta) return;
  try {
    await update(ref(db, `${ruta}/${key}`), { ministerio: ministerio || null });
    document.getElementById('moverMediaModal')?.remove();
  } catch(e) {
    document.getElementById('msgMover').textContent = 'Error: ' + e.message;
  }
};

// ── TOGGLE TEMA CLARO / OSCURO ────────────────
(function initTema() {
  const guardado = localStorage.getItem('tema') || 'oscuro';
  aplicarTema(guardado);
})();

function aplicarTema(tema) {
  const body   = document.body;
  const icono  = document.getElementById('temaIcono');
  const label  = document.getElementById('temaLabel');

  if (tema === 'claro') {
    body.classList.add('tema-claro');
    if (icono) icono.textContent = '☀️';
    if (label) label.textContent = 'Oscuro';
  } else {
    body.classList.remove('tema-claro');
    if (icono) icono.textContent = '🌙';
    if (label) label.textContent = 'Claro';
  }
  localStorage.setItem('tema', tema);
}

window.toggleTema = () => {
  const actual = localStorage.getItem('tema') || 'oscuro';
  aplicarTema(actual === 'oscuro' ? 'claro' : 'oscuro');
};

// ── MENÚ HAMBURGUESA MÓVIL ────────────────────
window.toggleNavMenu = () => {
  const links = document.querySelector('.nav-links');
  const btn   = document.getElementById('navHamburger');
  links.classList.toggle('menu-open');
  btn.classList.toggle('open');
};

// Cerrar menú al hacer clic en cualquier enlace del nav
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
      document.querySelector('.nav-links')?.classList.remove('menu-open');
      document.getElementById('navHamburger')?.classList.remove('open');
    });
  });
});
