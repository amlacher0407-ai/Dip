# EEG Ropper – Web-App Projektkontext für Claude

## Was ist das?
Diplomarbeit an einer HTL in Kärnten (Abgabe März/April 2027).
Web-App für die **Energiegemeinschaft "EEG Ropper"**.
Fabian verantwortet: Datenerfassung, Datenbank, Visualisierung (diese Web-App).
Team: Patrick (Recht, PV-Anlage), Alexander (Verrechnung).

---

## Tech-Stack – NICHT abweichen
- **Vanilla HTML, CSS, JavaScript** – kein Framework (kein React, Vue, Angular)
- **Three.js** (CDN) für 3D, **Chart.js** (CDN) für Diagramme
- **Keine Build-Tools** (kein Webpack, Vite, npm build)
- Entwicklung mit **VS Code Live Server** (http://localhost:5500)

---

## Konventionen
- **Kommentare im Code:** Deutsch
- **Variablennamen/Funktionsnamen:** Deutsch bevorzugt, Englisch okay bei Standardbegriffen
- **CSS:** BEM-ähnlich (`.card`, `.card__title`, `.card--active`)
- **JS-Pattern:** IIFE-Module statt ES-Module: `const ServiceName = (() => { ... return api; })();`
- **CSS-Variablen** für Farben, niemals hart kodierte Hex-Werte

---

## Datenschicht – KRITISCH
**`js/data.js` ist die EINZIGE Stelle für Datenzugriff.**

`DataService`-API:
- `getMembers()`, `getMember(id)`
- `getLiveValues(memberId)` → `{pvErzeugung, verbrauch, einspeisung, netzbezug}` in kW
- `getEnergyHistory(memberId, period, date)` → `period` ist `'day'/'week'/'month'/'year'`
- `getCommunityStats()` → `{autarkieGrad, prosumerAnzahl, mitgliederAnzahl, aktuelleErzeugung, aktuellerVerbrauch}`

Alle Funktionen geben **Promises** zurück.
Umschaltung auf echte API: nur `config.useApi = true` + `config.apiBase` setzen.

**Bekannter Bug (zu fixen):** Bei `period='week'/'month'/'year'` gibt die Mock-Daten-Funktion
aktuell einen konstanten Tagesverbrauch zurück (keine Tag-zu-Tag-Variation). Autarkie rechnet
dann fälschlich 100%. Fix steht an.

---

## Mitglieder & Testnutzer
| ID | Name            | Typ        | PV     | Login                               |
|----|-----------------|------------|--------|-------------------------------------|
| 1  | Familie Huber   | prosumer   | 8,5 kWp| –                                   |
| 2  | Familie Müller  | consumer   | –      | hans.mueller@example.at / user123   |
| 3  | Familie Berger  | prosumer   | 12 kWp | maria.berger@example.at / user123   |
| 4  | Familie Wagner  | consumer   | –      | –                                   |
| 5  | Familie Koller  | prosumer   | 6,2 kWp| –                                   |
| 6  | Familie Steiner | consumer   | –      | –                                   |
| –  | Admin           | admin      | –      | admin@eeg-ropper.at / admin123       |

Typen: `household_consumer`, `household_prosumer`, `commercial_consumer`, `commercial_prosumer`

---

## Authentifizierung
- `js/auth.js` + LocalStorage (Keys: `eeg_ropper_session`, `eeg_ropper_users`)
- Rollen: `'user'`, `'admin'`
- `js/guard.js` schützt Seiten. Einbindung am Seitenanfang:
  - Normale User-Seiten: `<script src="/js/guard.js"></script>`
  - Admin-Seiten: `<script src="/js/guard.js" data-admin="true"></script>`
  - **`login.html` bindet `guard.js` NICHT ein** (Endlosschleife).

---

## Seitenstruktur

---

## Design-System
**Farben (CSS-Variablen):**
- `--green-500: #22c55e` = PV, positiv, Eigenverbrauch
- `--blue-500: #3b82f6` = Verbrauch, Netzbezug
- `--amber-500: #f59e0b` = Einspeisung, Überschuss

**Font:** Inter (Google Fonts) + `system-ui` als Fallback
**Breakpoints:** 640px / 768px / 1024px
**Navigation:** Desktop horizontal, Mobile eingeloggt Bottom-Nav, Mobile öffentlich Hamburger

**Wichtig:** `[hidden] { display: none !important; }` in `base.css` – überschreibt `display: flex`.

---

## Fortschritt

### Fertig
- ✅ Schritt 1: Projektstruktur, CSS-Basis, Mock-Daten, Auth-Logik, Git
- ✅ Schritt 2: Landing Page (Hero, Vorteile, 3-Schritte, Live-Zahlen, CTA, Footer, Hamburger)
- ✅ Schritt 3: Login + Registrierung (Tabs, Validierung, Passwort-Stärke, Dev-Hinweis)
- ✅ Schritt 4: Dashboard (Grundgerüst, Live-Werte-Kacheln, Tagesverlauf-Chart, Community-Übersicht)
- ✅ Schritt 5: Verläufe-Seite (Zeitraum-Tabs, Datums-Navigation, Statistik-Zusammenfassung)

### Als nächstes
- **Bug-Fix:** Woche/Monat/Jahr-Statistik in `data.js` (konstanter Verbrauch + 100%-Autarkie-Bug)
- **Schritt 6:** Kosten (`costs.html`), Profil (`profile.html`), Dokumente (`documents.html`)

### Danach
- Schritt 7: 3D-Visualisierung öffentlich (`visualization.html`, Three.js)
- Schritt 8: Admin-Bereich
- Schritt 9: 3D-Visualisierung personalisiert
- Schritt 10: PWA (Service Worker, Offline)

---

## Wichtige Entscheidungen
- Ortsangabe: nur "Kärnten"
- Autarkiegrad: tageszeitabhängig, kumuliert ab Mitternacht
- Mobile-Menü: Overlay schließt bei Klick/Escape, Body scroll-lock
- Copyright-Jahr: `new Date().getFullYear()`, nie hardcoden
- Navigation: "Einloggen" (Button), "Mitglieder-Login" (Menü-Link)

---

## Arbeitsweise mit Fabian
- **Scope strikt halten:** nur bauen was explizit gefragt ist
- **Nur die im Prompt genannten Dateien** ändern, keine anderen
- **Keine Screenshots** machen (Fabian testet selbst im Browser)
- **Bei Unklarheiten:** STOP und fragen, nicht raten
- **Keine spekulativen Features, keine unnötigen Abstraktionen**
- **Nach Abschluss:** 3-Sätze-Zusammenfassung, keine Screenshots
- Commits macht Fabian selbst im Terminal