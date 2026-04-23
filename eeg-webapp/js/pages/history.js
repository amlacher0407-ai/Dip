/**
 * Verläufe-Seite
 *
 * Chart-Update-Strategie: chart.destroy() + neu erstellen statt chart.update().
 * Beim Zeitraum-Wechsel ändern sich Labels-Anzahl, Datenpunkte und Y-Achsen-Einheit
 * (kW beim Tag, kWh bei Woche/Monat/Jahr). chart.update() kann zwar Daten tauschen,
 * aber destroy() + neu vermeidet Animationsartefakte und Scale-Reste beim Einheitenwechsel.
 */

const HistoryPage = (() => {

  // --- Zustand ---
  let aktiverZeitraum = 'day';
  let verlaufChart = null;
  let mitgliedId = null;
  let hatPV = false;
  let aktuellesDatum = new Date();

  // Generischer Titel je Zeitraum (das spezifische Datum zeigt die Datums-Navigation)
  const ZEITRAUM_TITEL = {
    day:   'Tagesverlauf',
    week:  'Wochenverlauf',
    month: 'Monatsverlauf',
    year:  'Jahresverlauf',
  };

  const MONATE = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];

  // --- Datums-Hilfsfunktionen ---

  function gleichesDatum(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() &&
           a.getDate() === b.getDate();
  }

  // Montag der Woche von datum (Wochenbeginn für Vergleiche)
  function getMontag(datum) {
    const d = new Date(datum);
    const tag = d.getDay() || 7; // Sonntag (0) → 7
    d.setDate(d.getDate() - tag + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // ISO-8601-Wochennummer und zugehöriges ISO-Jahr (kann vom Kalenderjahr abweichen)
  function getISOWocheInfo(datum) {
    const d = new Date(Date.UTC(datum.getFullYear(), datum.getMonth(), datum.getDate()));
    const tag = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - tag); // Donnerstag der Woche
    const jahresBeginn = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const woche = Math.ceil((((d - jahresBeginn) / 86400000) + 1) / 7);
    return { woche, jahr: d.getUTCFullYear() };
  }

  // Text in der Mitte der Datums-Navigation je nach aktivem Zeitraum
  function formatDatumText(datum, zeitraum) {
    const heute = new Date();

    if (zeitraum === 'day') {
      if (gleichesDatum(datum, heute)) return 'Heute';
      const gestern = new Date(heute);
      gestern.setDate(gestern.getDate() - 1);
      if (gleichesDatum(datum, gestern)) return 'Gestern';
      return `${datum.getDate()}. ${MONATE[datum.getMonth()]} ${datum.getFullYear()}`;
    }

    if (zeitraum === 'week') {
      const datumMontag = getMontag(datum);
      const heuteMontag = getMontag(heute);
      const diffTage = Math.round((heuteMontag - datumMontag) / 86400000);
      if (diffTage === 0) return 'Diese Woche';
      if (diffTage === 7) return 'Letzte Woche';
      const { woche, jahr } = getISOWocheInfo(datum);
      return `KW ${woche}, ${jahr}`;
    }

    if (zeitraum === 'month') {
      return `${MONATE[datum.getMonth()]} ${datum.getFullYear()}`;
    }

    if (zeitraum === 'year') {
      return `${datum.getFullYear()}`;
    }

    return '';
  }

  // Prüft ob aktuellesDatum bereits dem aktuellen Zeitraum entspricht (kein Vorwärts-Navigieren)
  function istZukunftOderHeute(datum, zeitraum) {
    const heute = new Date();
    if (zeitraum === 'day') {
      return gleichesDatum(datum, heute) || datum > heute;
    }
    if (zeitraum === 'week') {
      return getMontag(datum) >= getMontag(heute);
    }
    if (zeitraum === 'month') {
      return datum.getFullYear() > heute.getFullYear() ||
             (datum.getFullYear() === heute.getFullYear() && datum.getMonth() >= heute.getMonth());
    }
    if (zeitraum === 'year') {
      return datum.getFullYear() >= heute.getFullYear();
    }
    return false;
  }

  // Datums-Text und Nächster-Button-Status aktualisieren
  function aktualisiereNavigation() {
    const textEl = document.getElementById('datumText');
    const naechsterBtn = document.getElementById('naechsterBtn');
    if (textEl) textEl.textContent = formatDatumText(aktuellesDatum, aktiverZeitraum);
    if (naechsterBtn) naechsterBtn.disabled = istZukunftOderHeute(aktuellesDatum, aktiverZeitraum);
  }

  function onVorherigKlick() {
    // JS passt Monatsgrenzen automatisch an (z.B. 31. März − 1 Monat = 28. Februar)
    if (aktiverZeitraum === 'day')   aktuellesDatum.setDate(aktuellesDatum.getDate() - 1);
    if (aktiverZeitraum === 'week')  aktuellesDatum.setDate(aktuellesDatum.getDate() - 7);
    if (aktiverZeitraum === 'month') aktuellesDatum.setMonth(aktuellesDatum.getMonth() - 1);
    if (aktiverZeitraum === 'year')  aktuellesDatum.setFullYear(aktuellesDatum.getFullYear() - 1);
    aktualisiereNavigation();
    ladeVerlauf(aktiverZeitraum);
  }

  function onNaechsterKlick() {
    if (aktiverZeitraum === 'day')   aktuellesDatum.setDate(aktuellesDatum.getDate() + 1);
    if (aktiverZeitraum === 'week')  aktuellesDatum.setDate(aktuellesDatum.getDate() + 7);
    if (aktiverZeitraum === 'month') aktuellesDatum.setMonth(aktuellesDatum.getMonth() + 1);
    if (aktiverZeitraum === 'year')  aktuellesDatum.setFullYear(aktuellesDatum.getFullYear() + 1);
    aktualisiereNavigation();
    ladeVerlauf(aktiverZeitraum);
  }

  // --- Chart neu aufbauen ---
  function renderChart(daten) {
    const canvas = document.getElementById('verlaufChart');
    if (!canvas) return;

    // Vorherigen Chart zerstören damit Canvas sauber ist
    if (verlaufChart) {
      verlaufChart.destroy();
      verlaufChart = null;
    }

    const datasets = [];

    // PV-Linie nur bei Prosumern anzeigen
    if (hatPV) {
      datasets.push({
        label: `PV-Erzeugung (${daten.unit})`,
        data: daten.pvGeneration,
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.08)',
        fill: true,
        tension: 0.4,
        // Bei vielen Datenpunkten (Tag: 96) Punkte ausblenden, sonst zu unübersichtlich
        pointRadius: daten.labels.length > 30 ? 0 : 3,
        pointHoverRadius: 5,
        borderWidth: 2,
      });
    }

    datasets.push({
      label: `Verbrauch (${daten.unit})`,
      data: daten.consumption,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.08)',
      fill: true,
      tension: 0.4,
      pointRadius: daten.labels.length > 30 ? 0 : 3,
      pointHoverRadius: 5,
      borderWidth: 2,
    });

    verlaufChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: daten.labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              boxWidth: 12,
              font: { size: 12 },
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} ${daten.unit}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 11 },
              maxTicksLimit: 8,
              maxRotation: 0,
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: {
              font: { size: 11 },
              callback: (val) => `${val} ${daten.unit}`,
            },
          },
        },
      },
    });
  }

  // --- Statistik-Box aktualisieren ---
  function aktualisiereStatistik(daten) {
    // Tag: Daten in kW, 15-min-Intervalle → ×0,25 für kWh
    // Woche/Monat/Jahr: Daten bereits in kWh → ×1
    const faktor = daten.unit === 'kW' ? 0.25 : 1;

    let pvGesamt = 0, verbrauchGesamt = 0, eigenverbrauchGesamt = 0;
    for (let i = 0; i < daten.pvGeneration.length; i++) {
      pvGesamt        += daten.pvGeneration[i] * faktor;
      verbrauchGesamt += daten.consumption[i]  * faktor;
      // Tag: 15-min-Intervalle in kW → min() korrekt, dann ×0,25h
      // Woche/Monat/Jahr: Tagessummen → min(Tag-PV, Tag-Cons) wäre falsch (PV > Cons),
      //   stattdessen vorberechnetes eigenverbrauch-Feld aus data.js (Intervall-Ebene)
      if (daten.period === 'day') {
        eigenverbrauchGesamt += Math.min(daten.pvGeneration[i], daten.consumption[i]) * faktor;
      } else {
        eigenverbrauchGesamt += daten.eigenverbrauch[i];
      }
    }

    const autarkie = verbrauchGesamt > 0
      ? Math.round(eigenverbrauchGesamt / verbrauchGesamt * 100)
      : 0;

    const fmtKwh = (kwh) => `${kwh.toFixed(1)} kWh`;

    document.getElementById('statPV').textContent             = fmtKwh(pvGesamt);
    document.getElementById('statVerbrauch').textContent      = fmtKwh(verbrauchGesamt);
    document.getElementById('statEigenverbrauch').textContent = fmtKwh(eigenverbrauchGesamt);
    document.getElementById('statAutarkie').textContent       = `${autarkie} %`;
  }

  // --- Verlaufsdaten laden und Chart aktualisieren ---
  async function ladeVerlauf(zeitraum) {
    const titelEl = document.getElementById('chartTitel');
    if (titelEl) titelEl.textContent = ZEITRAUM_TITEL[zeitraum];

    try {
      const daten = await DataService.getEnergyHistory(mitgliedId, zeitraum, aktuellesDatum);
      renderChart(daten);
      aktualisiereStatistik(daten);
    } catch (fehler) {
      console.error('Verlaufsdaten konnten nicht geladen werden:', fehler);
    }
  }

  // --- Tab-Klick: aktiven Tab wechseln und Daten neu laden ---
  function onTabKlick(event) {
    const tab = event.currentTarget;
    const neuerZeitraum = tab.dataset.period;

    if (neuerZeitraum === aktiverZeitraum) return;
    aktiverZeitraum = neuerZeitraum;

    document.querySelectorAll('.zeitraum-tab').forEach(t => {
      t.classList.remove('zeitraum-tab--active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('zeitraum-tab--active');
    tab.setAttribute('aria-selected', 'true');

    // aktuellesDatum bleibt, nur Darstellung und Chart ändern sich
    aktualisiereNavigation();
    ladeVerlauf(aktiverZeitraum);
  }

  // --- Seite initialisieren ---
  async function init() {
    const session = AuthService.getSession();
    if (!session) return;

    // Mitglied laden für Avatar, Name und PV-Status
    try {
      const mitglied = await DataService.getMember(session.memberId);
      if (mitglied) {
        mitgliedId = mitglied.id;
        hatPV = mitglied.hasPV;

        const nameEl = document.getElementById('userName');
        if (nameEl) nameEl.textContent = mitglied.name;

        const avatarEl = document.getElementById('userAvatar');
        if (avatarEl) {
          const teile = mitglied.name.trim().split(' ');
          avatarEl.textContent = teile.length >= 2
            ? (teile[0][0] + teile[teile.length - 1][0]).toUpperCase()
            : mitglied.name.slice(0, 2).toUpperCase();
        }
      }
    } catch (fehler) {
      console.error('Mitglied konnte nicht geladen werden:', fehler);
    }

    // Abmelden
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        AuthService.logout();
        window.location.href = '/login.html';
      });
    }

    // Tab-Listener registrieren
    document.querySelectorAll('.zeitraum-tab').forEach(tab => {
      tab.addEventListener('click', onTabKlick);
    });

    // Datums-Navigation verdrahten
    const vorherigBtn = document.getElementById('vorherigBtn');
    const naechsterBtn = document.getElementById('naechsterBtn');
    if (vorherigBtn) vorherigBtn.addEventListener('click', onVorherigKlick);
    if (naechsterBtn) naechsterBtn.addEventListener('click', onNaechsterKlick);

    // Navigation initial aufbauen (Nächster-Button deaktivieren da wir bei Heute starten)
    aktualisiereNavigation();

    // Standardmäßig Tagesverlauf laden
    await ladeVerlauf('day');
  }

  document.addEventListener('DOMContentLoaded', init);

})();
