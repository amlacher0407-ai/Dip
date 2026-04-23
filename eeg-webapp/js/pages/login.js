/**
 * Login / Registrierung – Seitenlogik
 *
 * Ablauf nach erfolgreichem Login:
 *   1. ?next= Parameter aus der URL lesen (gesetzt von guard.js)
 *   2. Admin → immer admin/index.html (außer ?next= zeigt auf eine andere Admin-Seite)
 *   3. User  → ?next= Ziel, Fallback dashboard.html
 */

// ============================================================
// Initialisierung
// ============================================================

// Copyright-Jahr
const yearEl = document.getElementById('current-year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Wenn bereits eingeloggt, Login-Seite überspringen
// (guard.js ist hier nicht eingebunden – direkt AuthService nutzen)
if (AuthService.isLoggedIn()) {
  window.location.replace(AuthService.isAdmin() ? '/admin/index.html' : '/dashboard.html');
}

// Redirect-Ziel aus Query-Parameter lesen (?next=/pfad)
const urlParams  = new URLSearchParams(window.location.search);
const rawNext    = urlParams.get('next') || '';
// Sicherheit: nur relative Pfade (starten mit /) akzeptieren
const redirectTo = rawNext.startsWith('/') ? rawNext : '/dashboard.html';


// ============================================================
// Hilfsfunktionen
// ============================================================

/**
 * Setzt einen Fehlertext unter einem Input-Feld.
 * Leerer Text = Fehler entfernen.
 */
function zeigeInputFehler(inputEl, errorEl, meldung) {
  if (meldung) {
    inputEl.classList.add('is-invalid');
    inputEl.classList.remove('is-valid');
    errorEl.textContent = meldung;
  } else {
    inputEl.classList.remove('is-invalid');
    errorEl.textContent = '';
  }
}

/** Zeigt oder versteckt den allgemeinen Fehler-Alert oben im Panel. */
function zeigeAlertFehler(alertEl, textEl, meldung) {
  if (meldung) {
    textEl.textContent = meldung;
    alertEl.hidden = false;
    alertEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    alertEl.hidden = true;
    textEl.textContent = '';
  }
}

/** Setzt einen Submit-Button in den Lade-Zustand (oder zurück). */
function setzeButtonLaden(btn, laden) {
  const text    = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.btn-spinner');
  btn.disabled = laden;
  if (text)    text.hidden    = laden;
  if (spinner) spinner.hidden = !laden;
}

/** Passwort-Sichtbarkeit toggeln. */
function togglePwSichtbarkeit(inputEl, btn) {
  const istText = inputEl.type === 'text';
  inputEl.type = istText ? 'password' : 'text';
  btn.querySelector('.icon-eye').style.display     = istText ? '' : 'none';
  btn.querySelector('.icon-eye-off').style.display = istText ? 'none' : '';
  btn.setAttribute('aria-label', istText ? 'Passwort anzeigen' : 'Passwort verbergen');
}

/**
 * Bewertet die Passwort-Stärke.
 * Gibt 'weak' | 'medium' | 'strong' zurück.
 */
function bewertePasswortStaerke(pw) {
  if (pw.length < 6)  return 'weak';
  let punkte = 0;
  if (pw.length >= 10)              punkte++;
  if (/[A-Z]/.test(pw))            punkte++;
  if (/[0-9]/.test(pw))            punkte++;
  if (/[^A-Za-z0-9]/.test(pw))    punkte++;
  if (punkte >= 3) return 'strong';
  if (punkte >= 1) return 'medium';
  return 'weak';
}

/** Aktualisiert den Stärke-Indikator unter dem Passwort-Feld. */
function aktualisierePwStaerke(pw) {
  const fill  = document.getElementById('pw-strength-fill');
  const label = document.getElementById('pw-strength-label');
  if (!fill || !label) return;

  if (!pw) {
    fill.className = 'pw-strength__fill';
    label.className = 'pw-strength__label';
    label.textContent = '';
    return;
  }

  const staerke = bewertePasswortStaerke(pw);
  const texte = { weak: 'Schwach', medium: 'Mittel', strong: 'Stark' };
  fill.className  = `pw-strength__fill pw-strength__fill--${staerke}`;
  label.className = `pw-strength__label pw-strength__label--${staerke}`;
  label.textContent = texte[staerke];
}

/**
 * Nach erfolgreichem Login weiterleiten.
 * Admin → admin/index.html (es sei denn ?next= zeigt auf Admin-Unterseite)
 */
function nachLoginWeiterleiten(session) {
  if (session.role === 'admin') {
    // Wenn kein spezifisches Ziel oder Ziel ist dashboard → Admin-Bereich
    const ziel = (redirectTo === '/dashboard.html') ? '/admin/index.html' : redirectTo;
    window.location.replace(ziel);
  } else {
    window.location.replace(redirectTo);
  }
}


// ============================================================
// Tab-Switcher
// ============================================================

const tabLogin    = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const panelLogin  = document.getElementById('panel-login');
const panelReg    = document.getElementById('panel-register');

function wechslTab(aktiv) {
  const istLogin = aktiv === 'login';

  tabLogin.classList.toggle('auth-tab--active', istLogin);
  tabLogin.setAttribute('aria-selected', String(istLogin));

  tabRegister.classList.toggle('auth-tab--active', !istLogin);
  tabRegister.setAttribute('aria-selected', String(!istLogin));

  panelLogin.hidden  = !istLogin;
  panelReg.hidden    = istLogin;

  // Ersten Input des aktiven Panels fokussieren
  const ersterInput = (istLogin ? panelLogin : panelReg).querySelector('input, select');
  if (ersterInput) setTimeout(() => ersterInput.focus(), 50);
}

tabLogin.addEventListener('click',    () => wechslTab('login'));
tabRegister.addEventListener('click', () => wechslTab('register'));

// URL-Hash: #register öffnet direkt das Registrierungs-Tab
if (window.location.hash === '#register') wechslTab('register');


// ============================================================
// LOGIN-FORMULAR
// ============================================================

const formLogin       = document.getElementById('form-login');
const loginEmailEl    = document.getElementById('login-email');
const loginPwEl       = document.getElementById('login-password');
const loginEmailErr   = document.getElementById('login-email-error');
const loginPwErr      = document.getElementById('login-password-error');
const loginAlert      = document.getElementById('login-error');
const loginAlertText  = document.getElementById('login-error-text');
const loginSubmitBtn  = document.getElementById('login-submit');

// Passwort-Toggle
document.getElementById('login-pw-toggle')
  .addEventListener('click', () => togglePwSichtbarkeit(loginPwEl, document.getElementById('login-pw-toggle')));

// Live-Validierung beim Verlassen des Felds
loginEmailEl.addEventListener('blur', () => {
  if (!loginEmailEl.value.trim()) return;
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmailEl.value.trim());
  zeigeInputFehler(loginEmailEl, loginEmailErr, ok ? '' : 'Bitte eine gültige E-Mail-Adresse eingeben.');
  if (ok) loginEmailEl.classList.add('is-valid');
});

// Formular absenden
formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  zeigeAlertFehler(loginAlert, loginAlertText, '');

  const email    = loginEmailEl.value.trim();
  const passwort = loginPwEl.value;
  let hatFehler  = false;

  // Validierung
  if (!email) {
    zeigeInputFehler(loginEmailEl, loginEmailErr, 'Bitte E-Mail-Adresse eingeben.');
    hatFehler = true;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    zeigeInputFehler(loginEmailEl, loginEmailErr, 'Ungültige E-Mail-Adresse.');
    hatFehler = true;
  } else {
    zeigeInputFehler(loginEmailEl, loginEmailErr, '');
  }

  if (!passwort) {
    zeigeInputFehler(loginPwEl, loginPwErr, 'Bitte Passwort eingeben.');
    hatFehler = true;
  } else {
    zeigeInputFehler(loginPwEl, loginPwErr, '');
  }

  if (hatFehler) return;

  // Login über AuthService
  setzeButtonLaden(loginSubmitBtn, true);

  // Kleines Timeout simuliert Netzwerk-Latenz (realistischer Eindruck)
  await new Promise(r => setTimeout(r, 400));

  const ergebnis = AuthService.login(email, passwort);
  setzeButtonLaden(loginSubmitBtn, false);

  if (ergebnis.success) {
    // Kurz Erfolg anzeigen, dann weiterleiten
    const successDiv = document.createElement('div');
    successDiv.className = 'auth-success';
    successDiv.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      Angemeldet als <strong>${ergebnis.session.name}</strong> – wird weitergeleitet …
    `;
    formLogin.replaceWith(successDiv);
    setTimeout(() => nachLoginWeiterleiten(ergebnis.session), 800);
  } else {
    zeigeAlertFehler(loginAlert, loginAlertText, ergebnis.error);
    loginPwEl.value = ''; // Passwort-Feld leeren bei Fehler
    loginPwEl.focus();
  }
});


// ============================================================
// REGISTRIERUNGS-FORMULAR
// ============================================================

const formReg     = document.getElementById('form-register');
const regNameEl   = document.getElementById('reg-name');
const regEmailEl  = document.getElementById('reg-email');
const regTypeEl   = document.getElementById('reg-type');
const regPwEl     = document.getElementById('reg-password');
const regPw2El    = document.getElementById('reg-password2');
const regNameErr  = document.getElementById('reg-name-error');
const regEmailErr = document.getElementById('reg-email-error');
const regTypeErr  = document.getElementById('reg-type-error');
const regPwErr    = document.getElementById('reg-password-error');
const regPw2Err   = document.getElementById('reg-password2-error');
const regAlert    = document.getElementById('register-error');
const regAlertTxt = document.getElementById('register-error-text');
const regSubmit   = document.getElementById('register-submit');

// Passwort-Toggles
document.getElementById('reg-pw-toggle')
  .addEventListener('click', () => togglePwSichtbarkeit(regPwEl, document.getElementById('reg-pw-toggle')));
document.getElementById('reg-pw2-toggle')
  .addEventListener('click', () => togglePwSichtbarkeit(regPw2El, document.getElementById('reg-pw2-toggle')));

// Live-Passwort-Stärke
regPwEl.addEventListener('input', () => aktualisierePwStaerke(regPwEl.value));

// Live-Match-Check beim zweiten Passwort-Feld
regPw2El.addEventListener('input', () => {
  if (!regPw2El.value) { zeigeInputFehler(regPw2El, regPw2Err, ''); return; }
  const ok = regPw2El.value === regPwEl.value;
  zeigeInputFehler(regPw2El, regPw2Err, ok ? '' : 'Passwörter stimmen nicht überein.');
  if (ok) regPw2El.classList.add('is-valid');
});

// Formular absenden
formReg.addEventListener('submit', async (e) => {
  e.preventDefault();
  zeigeAlertFehler(regAlert, regAlertTxt, '');

  const name     = regNameEl.value.trim();
  const email    = regEmailEl.value.trim();
  const typ      = regTypeEl.value;
  const pw       = regPwEl.value;
  const pw2      = regPw2El.value;
  let   hatFehler = false;

  // --- Validierung ---
  if (!name || name.length < 2) {
    zeigeInputFehler(regNameEl, regNameErr, 'Bitte vollständigen Namen eingeben (mind. 2 Zeichen).');
    hatFehler = true;
  } else { zeigeInputFehler(regNameEl, regNameErr, ''); }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    zeigeInputFehler(regEmailEl, regEmailErr, 'Bitte eine gültige E-Mail-Adresse eingeben.');
    hatFehler = true;
  } else { zeigeInputFehler(regEmailEl, regEmailErr, ''); }

  if (!typ) {
    zeigeInputFehler(regTypeEl, regTypeErr, 'Bitte Mitglieds-Typ auswählen.');
    hatFehler = true;
  } else { zeigeInputFehler(regTypeEl, regTypeErr, ''); }

  if (!pw || pw.length < 6) {
    zeigeInputFehler(regPwEl, regPwErr, 'Passwort muss mindestens 6 Zeichen lang sein.');
    hatFehler = true;
  } else { zeigeInputFehler(regPwEl, regPwErr, ''); }

  if (!pw2) {
    zeigeInputFehler(regPw2El, regPw2Err, 'Bitte Passwort bestätigen.');
    hatFehler = true;
  } else if (pw !== pw2) {
    zeigeInputFehler(regPw2El, regPw2Err, 'Passwörter stimmen nicht überein.');
    hatFehler = true;
  } else { zeigeInputFehler(regPw2El, regPw2Err, ''); }

  if (hatFehler) {
    // Erstes fehlerhaftes Feld fokussieren
    formReg.querySelector('.is-invalid')?.focus();
    return;
  }

  // Registrierung über AuthService
  setzeButtonLaden(regSubmit, true);
  await new Promise(r => setTimeout(r, 500));

  const ergebnis = AuthService.register(name, email, pw);
  setzeButtonLaden(regSubmit, false);

  if (ergebnis.success) {
    const successDiv = document.createElement('div');
    successDiv.className = 'auth-success';
    successDiv.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      Konto erstellt! Willkommen, <strong>${ergebnis.session.name}</strong> – wird weitergeleitet …
    `;
    formReg.replaceWith(successDiv);
    setTimeout(() => nachLoginWeiterleiten(ergebnis.session), 900);
  } else {
    zeigeAlertFehler(regAlert, regAlertTxt, ergebnis.error);
    // Wenn E-Mail bereits vergeben → Feld markieren
    if (ergebnis.error.includes('E-Mail')) {
      zeigeInputFehler(regEmailEl, regEmailErr, ergebnis.error);
      regEmailEl.focus();
    }
  }
});


// ============================================================
// PASSWORT-VERGESSEN-HINWEIS
// ============================================================

const forgotToggle = document.getElementById('forgot-toggle');
const forgotHint   = document.getElementById('forgot-hint');

forgotToggle.addEventListener('click', () => {
  const istSichtbar = !forgotHint.hidden;
  forgotHint.hidden = istSichtbar;
  forgotToggle.textContent = istSichtbar
    ? 'Passwort vergessen?'
    : 'Hinweis ausblenden';
});


// ============================================================
// ENTWICKLER-HINWEIS: Demo-Zugangsdaten
// ============================================================

const devToggle  = document.getElementById('dev-hint-toggle');
const devContent = document.getElementById('dev-hint-content');

devToggle.addEventListener('click', () => {
  const offen = devContent.hidden;
  devContent.hidden = !offen;
  devToggle.setAttribute('aria-expanded', String(offen));
});

// Klick auf Tabellenzeile → E-Mail ins Login-Feld eintragen + Tab wechseln
document.querySelectorAll('.dev-hint__table tbody tr').forEach(row => {
  row.addEventListener('click', () => {
    const email = row.querySelector('td:first-child')?.textContent?.trim();
    if (!email) return;
    wechslTab('login');
    loginEmailEl.value = email;
    loginPwEl.focus();
    // Grünen Rahmen zeigen
    loginEmailEl.classList.remove('is-invalid');
    loginEmailEl.classList.add('is-valid');
  });
});
