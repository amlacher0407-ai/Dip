/**
 * Authentifizierungs-Modul der EEG Ropper Web-App
 *
 * Aktuell: Mock-Backend via LocalStorage
 * Umstieg auf echtes Backend: login() und register() auf
 * fetch()-Calls gegen die REST-API umschreiben.
 *
 * Session-Schlüssel in LocalStorage:
 *   eeg_ropper_session  – aktive Sitzung (Objekt)
 *   eeg_ropper_users    – selbst-registrierte User (Array)
 */

const AuthService = (() => {

  const SESSION_KEY = 'eeg_ropper_session';
  const USERS_KEY   = 'eeg_ropper_users';

  /** Alle registrierten User aus LocalStorage laden */
  function getRegisteredUsers() {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  /** Registrierte User in LocalStorage speichern */
  function saveRegisteredUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  /** Session-Objekt erstellen und speichern */
  function createSession(email, memberId, role, name) {
    const session = {
      email,
      memberId,
      role,
      name,
      loginAt: new Date().toISOString(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  const api = {

    // ------------------------------------------------------------------
    // Einloggen
    // ------------------------------------------------------------------
    login(email, password) {
      const normalizedEmail = email.toLowerCase().trim();

      // 1. Mock-Zugangsdaten prüfen (vordefinierte Testnutzer)
      const mockCreds = DataService._getMockCredentials();
      if (mockCreds[normalizedEmail]) {
        const cred = mockCreds[normalizedEmail];
        if (cred.password !== password) {
          return { success: false, error: 'E-Mail oder Passwort falsch.' };
        }
        const members = DataService._getMockMembers();
        const member = cred.memberId
          ? members.find(m => m.id === cred.memberId)
          : null;
        const session = createSession(
          normalizedEmail,
          cred.memberId,
          cred.role,
          member?.name || 'Administrator'
        );
        return { success: true, session };
      }

      // 2. Selbst-registrierte User prüfen
      const registeredUsers = getRegisteredUsers();
      const user = registeredUsers.find(u => u.email === normalizedEmail);
      if (user) {
        if (user.password !== password) {
          return { success: false, error: 'E-Mail oder Passwort falsch.' };
        }
        const session = createSession(normalizedEmail, user.memberId, 'user', user.name);
        return { success: true, session };
      }

      return { success: false, error: 'E-Mail oder Passwort falsch.' };
    },

    // ------------------------------------------------------------------
    // Registrieren (neuen Nutzer anlegen)
    // ------------------------------------------------------------------
    register(name, email, password) {
      if (!name || name.trim().length < 2) {
        return { success: false, error: 'Bitte gib einen vollständigen Namen an.' };
      }
      if (!email || !email.includes('@')) {
        return { success: false, error: 'Bitte gib eine gültige E-Mail-Adresse an.' };
      }
      if (!password || password.length < 6) {
        return { success: false, error: 'Das Passwort muss mindestens 6 Zeichen lang sein.' };
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Prüfen ob E-Mail bereits vergeben
      const mockCreds = DataService._getMockCredentials();
      const registeredUsers = getRegisteredUsers();

      if (mockCreds[normalizedEmail] || registeredUsers.find(u => u.email === normalizedEmail)) {
        return { success: false, error: 'Diese E-Mail-Adresse ist bereits registriert.' };
      }

      // Neuen User speichern
      const newUser = {
        name:         name.trim(),
        email:        normalizedEmail,
        password,             // Hinweis: In Produktion nur Hashes speichern!
        role:         'user',
        memberId:     null,   // Wird vom Admin einem Mitglied zugeordnet
        registeredAt: new Date().toISOString(),
      };

      registeredUsers.push(newUser);
      saveRegisteredUsers(registeredUsers);

      // Nach Registrierung direkt einloggen
      return this.login(normalizedEmail, password);
    },

    // ------------------------------------------------------------------
    // Ausloggen
    // ------------------------------------------------------------------
    logout() {
      localStorage.removeItem(SESSION_KEY);
      window.location.replace('/login.html');
    },

    // ------------------------------------------------------------------
    // Session abfragen
    // ------------------------------------------------------------------

    /** Aktuelle Session zurückgeben oder null wenn nicht eingeloggt */
    getSession() {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    },

    /** Ist der User aktuell eingeloggt? */
    isLoggedIn() {
      return this.getSession() !== null;
    },

    /** Hat der User die angegebene Rolle? */
    hasRole(role) {
      return this.getSession()?.role === role;
    },

    /** Ist der User ein Administrator? */
    isAdmin() {
      return this.hasRole('admin');
    },

    /** Name des eingeloggten Users (oder leerer String) */
    getUserName() {
      return this.getSession()?.name || '';
    },

    /** Initialen für Avatar (z.B. "FB" für "Familie Berger") */
    getUserInitials() {
      const name = this.getUserName();
      if (!name) return '?';
      const parts = name.trim().split(' ');
      if (parts.length === 1) return parts[0][0].toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    },
  };

  return api;
})();
