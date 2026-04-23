'use strict';

// Dashboard-Logik: Header befüllen, Begrüßung, Logout, Live-Werte
const Dashboard = (() => {

  // Deutsche Wochentage und Monate für die Datumsanzeige
  const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch',
                      'Donnerstag', 'Freitag', 'Samstag'];
  const MONATE     = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

  // Datum als deutschen Langtext formatieren, z.B. "Donnerstag, 17. April 2026"
  function formatDatumDeutsch(datum) {
    const wochentag = WOCHENTAGE[datum.getDay()];
    const tag       = datum.getDate();
    const monat     = MONATE[datum.getMonth()];
    const jahr      = datum.getFullYear();
    return `${wochentag}, ${tag}. ${monat} ${jahr}`;
  }

  // ------------------------------------------------------------------
  // Live-Werte: Kacheln befüllen
  // ------------------------------------------------------------------

  // Wert als "X.XX kW" formatieren
  function formatKw(wert) {
    return wert.toFixed(2) + ' kW';
  }

  // Kachel auf "ausgegraut / kein Wert" setzen (reine Verbraucher)
  function kachelInaktiv(cardEl, valueEl) {
    valueEl.textContent = '—';
    cardEl.classList.add('live-card--inactive');
  }

  // Kachel mit echtem Wert befüllen
  function kachelAktiv(cardEl, valueEl, wert) {
    valueEl.textContent = formatKw(wert);
    cardEl.classList.remove('live-card--inactive');
  }

  // Live-Werte vom DataService holen und in die Kacheln schreiben
  async function liveWerteAktualisieren(memberId) {
    let daten;
    try {
      daten = await DataService.getLiveValues(memberId);
    } catch (fehler) {
      console.error('Live-Werte konnten nicht geladen werden:', fehler);
      return;
    }
    if (!daten) return;

    // Kein PV vorhanden: PV-Kachel und Einspeisungs-Kachel ausgrauen
    const keinePV = daten.pvErzeugung === 0;

    const cardPv          = document.getElementById('cardPv');
    const valPv           = document.getElementById('valPv');
    const cardEinspeisung = document.getElementById('cardEinspeisung');
    const valEinspeisung  = document.getElementById('valEinspeisung');

    if (keinePV) {
      kachelInaktiv(cardPv, valPv);
      kachelInaktiv(cardEinspeisung, valEinspeisung);
    } else {
      kachelAktiv(cardPv, valPv, daten.pvErzeugung);
      kachelAktiv(cardEinspeisung, valEinspeisung, daten.einspeisung);
    }

    // Verbrauch und Netzbezug werden immer angezeigt
    document.getElementById('valVerbrauch').textContent  = formatKw(daten.verbrauch);
    document.getElementById('valNetzbezug').textContent  = formatKw(daten.netzbezug);
  }

  // ------------------------------------------------------------------
  // Tagesverlauf-Chart (Schritt 4c)
  // ------------------------------------------------------------------

  // Hex-Farbe (#rrggbb) in rgba(r, g, b, alpha) umwandeln
  function hexZuRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // CSS-Variable vom Root-Element auslesen
  function cssFarbe(variable) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(variable).trim();
  }

  // Chart-Instanz für spätere Nutzung merken
  let tagesverlaufInstanz = null;

  async function tagesverlaufLaden(memberId) {
    let verlauf;
    try {
      verlauf = await DataService.getEnergyHistory(memberId, 'day', new Date());
    } catch (fehler) {
      console.error('Tagesverlauf konnte nicht geladen werden:', fehler);
      return;
    }
    if (!verlauf) return;

    const pvFarbe         = cssFarbe('--green-500');
    const verbrauchFarbe  = cssFarbe('--blue-500');

    // PV-Linie weglassen wenn der Nutzer kein PV hat (alle Werte 0)
    const pvIstNull = verlauf.pvGeneration.every(v => v === 0);

    const datasets = [];

    if (!pvIstNull) {
      datasets.push({
        label:           'PV-Erzeugung',
        data:            verlauf.pvGeneration,
        borderColor:     pvFarbe,
        backgroundColor: hexZuRgba(pvFarbe, 0.15),
        fill:            true,
        tension:         0.3,
        pointRadius:     0,
        pointHoverRadius: 4,
        borderWidth:     2,
      });
    }

    datasets.push({
      label:           'Verbrauch',
      data:            verlauf.consumption,
      borderColor:     verbrauchFarbe,
      backgroundColor: hexZuRgba(verbrauchFarbe, 0.15),
      fill:            true,
      tension:         0.3,
      pointRadius:     0,
      pointHoverRadius: 4,
      borderWidth:     2,
    });

    const canvas = document.getElementById('tagesverlaufChart');
    if (!canvas) return;

    // Vorherige Instanz zerstören, falls vorhanden
    if (tagesverlaufInstanz) {
      tagesverlaufInstanz.destroy();
    }

    tagesverlaufInstanz = new Chart(canvas, {
      type: 'line',
      data: {
        labels:   verlauf.labels,   // 96 × "HH:MM"
        datasets,
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font:      { size: 11 },
              boxWidth:  12,
              padding:   12,
            },
          },
          tooltip: {
            callbacks: {
              // Tooltip: "HH:MM — X.XX kW"
              title(items) {
                return items[0]?.label ?? '';
              },
              label(item) {
                return ` ${item.dataset.label}: ${item.parsed.y.toFixed(2)} kW`;
              },
            },
          },
        },
        scales: {
          x: {
            grid:  { display: false },
            ticks: {
              font:      { size: 10 },
              color:     cssFarbe('--gray-400'),
              maxRotation: 0,
              // Nur alle 3 Stunden beschriften (jedes 12. Intervall: 0, 12, 24, …, 84)
              callback(val, index) {
                return index % 12 === 0 ? this.getLabelForValue(val) : '';
              },
            },
          },
          y: {
            min:   0,
            grid:  { color: cssFarbe('--gray-100') || 'rgba(0,0,0,0.06)' },
            ticks: {
              font:  { size: 10 },
              color: cssFarbe('--gray-400'),
              callback(val) {
                return val + ' kW';
              },
            },
          },
        },
      },
    });
  }

  // ------------------------------------------------------------------
  // Community-Übersicht (Schritt 4d)
  // ------------------------------------------------------------------

  async function communityStatsAktualisieren() {
    let stats;
    try {
      stats = await DataService.getCommunityStats();
    } catch (fehler) {
      console.error('Community-Daten konnten nicht geladen werden:', fehler);
      return;
    }
    if (!stats) return;

    // Autarkiegrad (groß, grün)
    document.getElementById('valAutarkie').textContent = stats.autarkieGrad + ' %';

    // Kontextueller Satz abhängig vom Autarkie-Wert
    let kontextSatz;
    if (stats.autarkieGrad === 0) {
      kontextSatz = 'Keine PV-Erzeugung (außerhalb der Sonnenstunden)';
    } else if (stats.autarkieGrad > 60) {
      kontextSatz = 'Starke Eigenversorgung gerade 🌞';
    } else if (stats.autarkieGrad >= 30) {
      kontextSatz = 'Gute Eigenversorgung';
    } else {
      kontextSatz = 'Überwiegend Netzbezug';
    }
    document.getElementById('autarkieKontext').textContent = kontextSatz;

    // Aktive Prosumer "X von Y"
    document.getElementById('valProsumer').textContent =
      stats.prosumerAnzahl + ' von ' + stats.mitgliederAnzahl;

    // Community-PV gesamt (kW, grün)
    document.getElementById('valCommunityPv').textContent =
      stats.aktuelleErzeugung.toFixed(2) + ' kW';

    // Community-Verbrauch gesamt (kW, blau)
    document.getElementById('valCommunityVerbrauch').textContent =
      stats.aktuellerVerbrauch.toFixed(2) + ' kW';
  }

  // ------------------------------------------------------------------
  // Initialisierung
  // ------------------------------------------------------------------

  function init() {
    const name     = AuthService.getUserName();
    const initials = AuthService.getUserInitials();

    // Header: Avatar-Initialen und Benutzername
    document.getElementById('userAvatar').textContent = initials;
    document.getElementById('userName').textContent   = name;

    // Begrüßung mit vollem Namen
    document.getElementById('greetingTitle').textContent =
      `Willkommen zurück, ${name}!`;

    // Heutiges Datum auf Deutsch
    document.getElementById('greetingDate').textContent =
      formatDatumDeutsch(new Date());

    // Logout-Button
    document.getElementById('logoutBtn').addEventListener('click', () => {
      AuthService.logout();
    });

    // memberId aus der Session holen
    const session  = AuthService.getSession();
    const memberId = session ? session.memberId : null;

    // Community-Übersicht: für alle User laden (auch Admin, kein memberId nötig)
    communityStatsAktualisieren();
    setInterval(communityStatsAktualisieren, 10000);

    if (!memberId) {
      // Admin-Account oder Session ohne memberId – Kacheln bleiben auf "—"
      console.warn('Keine memberId in der Session – Live-Werte werden nicht geladen.');
      return;
    }

    // Live-Kacheln: sofort laden, danach alle 10 Sekunden aktualisieren
    liveWerteAktualisieren(memberId);
    setInterval(() => liveWerteAktualisieren(memberId), 10000);

    // Tagesverlauf einmalig laden (kein Auto-Refresh nötig)
    tagesverlaufLaden(memberId);
  }

  document.addEventListener('DOMContentLoaded', init);

  return {};
})();
