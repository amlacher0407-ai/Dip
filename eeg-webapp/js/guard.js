/**
 * Seitenschutz – Einbindung am Anfang jeder geschützten Seite.
 * Leitet nicht-authentifizierte User zur Login-Seite weiter.
 *
 * Voraussetzung: data.js und auth.js müssen VOR diesem Skript geladen sein.
 *
 * Verwendung in HTML (normale User-Seite):
 *   <script src="/js/data.js"></script>
 *   <script src="/js/auth.js"></script>
 *   <script src="/js/guard.js"></script>
 *
 * Verwendung in HTML (Admin-Seite):
 *   <script src="/js/data.js"></script>
 *   <script src="/js/auth.js"></script>
 *   <script src="/js/guard.js" data-admin="true"></script>
 */

const GuardService = (() => {

  /** Sofortige Weiterleitung (ersetzt History-Eintrag) */
  function redirect(url) {
    window.location.replace(url);
  }

  const api = {

    /**
     * Prüft ob der User eingeloggt ist.
     * Bei nicht eingeloggtem User: Weiterleitung zu /login.html
     * mit ?next= Parameter für Rückkehr nach dem Login.
     */
    requireAuth() {
      if (!AuthService.isLoggedIn()) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        redirect(`/login.html?next=${next}`);
      }
    },

    /**
     * Prüft ob der User als Admin eingeloggt ist.
     * Nicht eingeloggt → /login.html
     * Eingeloggt aber kein Admin → /dashboard.html
     */
    requireAdmin() {
      if (!AuthService.isLoggedIn()) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        redirect(`/login.html?next=${next}`);
        return;
      }
      if (!AuthService.isAdmin()) {
        redirect('/dashboard.html');
      }
    },

    /**
     * Wenn bereits eingeloggt, von der Login-Seite wegweiterleiten.
     * Verhindert dass eingeloggte User die Login-Seite sehen.
     * @param {string} [ziel='/dashboard.html'] - Wohin nach dem Login
     */
    redirectIfLoggedIn(ziel = '/dashboard.html') {
      if (AuthService.isLoggedIn()) {
        redirect(ziel);
      }
    },
  };

  return api;
})();

// Sofort ausführen beim Laden des Skripts
(function () {
  const script = document.currentScript;
  if (script && script.dataset.admin === 'true') {
    GuardService.requireAdmin();
  } else {
    GuardService.requireAuth();
  }
}());
