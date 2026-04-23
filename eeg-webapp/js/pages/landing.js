/**
 * Landing Page – Interaktivität
 *
 * 1. Hamburger-Menü öffnen/schließen
 * 2. Stats-Band: Live-Daten aus DataService laden
 * 3. Zahlen-Sektion: einmalige Hochzähl-Animation via Intersection Observer
 *    (respektiert prefers-reduced-motion)
 */

// ============================================================
// 1. Copyright-Jahr dynamisch
// ============================================================

const yearEl = document.getElementById('current-year');
if (yearEl) yearEl.textContent = new Date().getFullYear();


// ============================================================
// 2. Hamburger-Menü + Overlay
// ============================================================

const hamburgerBtn  = document.getElementById('hamburger-btn');
const mobileMenu    = document.getElementById('mobile-menu');
const mobileOverlay = document.getElementById('mobile-overlay');

function schliessMobileMenu() {
  mobileMenu.classList.remove('mobile-menu--open');
  hamburgerBtn.classList.remove('hamburger--open');
  hamburgerBtn.setAttribute('aria-expanded', 'false');
  if (mobileOverlay) mobileOverlay.classList.remove('mobile-overlay--active');
  document.body.classList.remove('menu-open');
}

function oeffneMobileMenu() {
  mobileMenu.classList.add('mobile-menu--open');
  hamburgerBtn.classList.add('hamburger--open');
  hamburgerBtn.setAttribute('aria-expanded', 'true');
  if (mobileOverlay) mobileOverlay.classList.add('mobile-overlay--active');
  document.body.classList.add('menu-open');
}

if (hamburgerBtn && mobileMenu) {
  hamburgerBtn.addEventListener('click', () => {
    const istOffen = mobileMenu.classList.contains('mobile-menu--open');
    istOffen ? schliessMobileMenu() : oeffneMobileMenu();
  });

  // Klick auf Overlay schließt Menü
  if (mobileOverlay) {
    mobileOverlay.addEventListener('click', schliessMobileMenu);
  }

  // Escape-Taste schließt Menü
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') schliessMobileMenu();
  });
}


// ============================================================
// 3. Stats-Band: Live Community-Daten
// ============================================================

async function ladeStatsBand() {
  try {
    const stats = await DataService.getCommunityStats();

    const elMembers    = document.getElementById('stat-members');
    const elKwp        = document.getElementById('stat-kwp');
    const elAutarkie   = document.getElementById('stat-autarkie');
    const elGeneration = document.getElementById('stat-generation');

    if (elMembers)    elMembers.textContent    = stats.mitgliederAnzahl;
    if (elKwp)        elKwp.textContent        = stats.gesamtPvKwp.toFixed(1);
    if (elAutarkie)   elAutarkie.textContent   = stats.autarkieGrad + ' %';
    if (elGeneration) elGeneration.textContent = stats.aktuelleErzeugung.toFixed(1);
  } catch (err) {
    console.warn('Stats-Band konnte nicht geladen werden:', err);
  }
}

ladeStatsBand();


// ============================================================
// 4. Zahlen-Sektion: animiertes Hochzählen
// ============================================================

/**
 * Zählt eine Zahl von 0 auf den Zielwert hoch.
 * Wird übersprungen wenn prefers-reduced-motion aktiv ist.
 *
 * @param {HTMLElement} element    - Das Ziel-DOM-Element
 * @param {number}      zielwert   - Endzahl
 * @param {number}      dauer      - Animation in ms (Standard: 1200)
 * @param {number}      nachkomma  - Dezimalstellen (Standard: 0)
 */
function animiereZahl(element, zielwert, dauer = 1200, nachkomma = 0) {
  // Reduzierte Bewegung: Zahl direkt setzen, keine Animation
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    element.textContent = zielwert.toFixed(nachkomma);
    return;
  }

  const startzeit = performance.now();

  function schritt(jetzt) {
    const vergangen = jetzt - startzeit;
    const fortschritt = Math.min(vergangen / dauer, 1);

    // Ease-out-Kurve: am Anfang schnell, am Ende langsam
    const eased = 1 - Math.pow(1 - fortschritt, 3);
    const aktuell = eased * zielwert;

    element.textContent = aktuell.toFixed(nachkomma);

    if (fortschritt < 1) {
      requestAnimationFrame(schritt);
    }
  }

  requestAnimationFrame(schritt);
}

/**
 * Lädt die Community-Daten und startet die Zähl-Animationen.
 * Wird nur einmal aufgerufen (wenn die Sektion sichtbar wird).
 */
async function starteZaehlerAnimationen() {
  try {
    const stats = await DataService.getCommunityStats();
    const members = await DataService.getMembers();

    const prosumerAnzahl = members.filter(m => m.hasPV).length;
    const gesamtKwp      = members.reduce((sum, m) => sum + m.pvPeakKw, 0);

    animiereZahl(document.getElementById('num-members'),  stats.mitgliederAnzahl, 800,  0);
    animiereZahl(document.getElementById('num-kwp'),      gesamtKwp,              1200, 1);
    animiereZahl(document.getElementById('num-prosumer'), prosumerAnzahl,         800,  0);
    animiereZahl(document.getElementById('num-autarkie'), stats.autarkieGrad,     1000, 0);

    // Gesamtzahl für "X von Y" aktualisieren
    const elTotal = document.getElementById('num-total');
    if (elTotal) elTotal.textContent = stats.mitgliederAnzahl;

  } catch (err) {
    console.warn('Zähler-Animation fehlgeschlagen:', err);
  }
}

// Intersection Observer: Animation nur beim ersten Sichtbarwerden starten
const zahlenSektion = document.getElementById('zahlen');

if (zahlenSektion) {
  const observer = new IntersectionObserver(
    (eintraege, beobachter) => {
      eintraege.forEach(eintrag => {
        if (eintrag.isIntersecting) {
          starteZaehlerAnimationen();
          beobachter.unobserve(eintrag.target); // Nur einmal!
        }
      });
    },
    { threshold: 0.2 } // Animation startet wenn 20% der Sektion sichtbar sind
  );

  observer.observe(zahlenSektion);
}
