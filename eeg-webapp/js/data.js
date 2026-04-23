/**
 * Zentrale Datenschicht der EEG Ropper Web-App
 *
 * WICHTIG: Diese Datei ist die EINZIGE Stelle für Datenzugriff.
 * Um auf das echte Backend umzuschalten:
 *   1. config.useApi = true setzen
 *   2. config.apiBase auf die korrekte Backend-URL setzen
 *   3. Fertig – das restliche Frontend bleibt unverändert.
 *
 * Alle Funktionen geben Promises zurück, damit der Wechsel
 * von Mock zu echtem fetch() transparent ist.
 */

const DataService = (() => {

  // --- Konfiguration ---
  const config = {
    useApi: false,                         // true = echtes Backend verwenden
    apiBase: 'http://localhost:8000/api/v1', // Backend-URL (später anpassen)
  };

  // --- Mitglieder-Typen ---
  // Erweiterbar: neue Typen einfach hier hinzufügen
  const MEMBER_TYPES = {
    HOUSEHOLD_CONSUMER:  'household_consumer',
    HOUSEHOLD_PROSUMER:  'household_prosumer',
    COMMERCIAL_CONSUMER: 'commercial_consumer',
    COMMERCIAL_PROSUMER: 'commercial_prosumer',
  };

  // --- Mock-Mitgliederdaten ---
  const mockMembers = [
    {
      id: 1,
      name: 'Familie Huber',
      email: 'hans.huber@example.at',
      type: MEMBER_TYPES.HOUSEHOLD_PROSUMER,
      hasPV: true,
      pvPeakKw: 8.5,            // kWp installierte Leistung
      avgConsumptionKwh: 12.4,  // durchschnittlicher Tagesverbrauch in kWh
      address: 'Drautalstraße 12, 9800 Spittal an der Drau',
      meterId: 'AT0010000000000000001EAL000000',
      joinedAt: '2023-03-15',
      role: 'user',
    },
    {
      id: 2,
      name: 'Familie Müller',
      email: 'hans.mueller@example.at',
      type: MEMBER_TYPES.HOUSEHOLD_CONSUMER,
      hasPV: false,
      pvPeakKw: 0,
      avgConsumptionKwh: 9.8,
      address: 'Bergstraße 4, 9800 Spittal an der Drau',
      meterId: 'AT0010000000000000002EAL000000',
      joinedAt: '2023-03-15',
      role: 'user',
    },
    {
      id: 3,
      name: 'Familie Berger',
      email: 'maria.berger@example.at',
      type: MEMBER_TYPES.HOUSEHOLD_PROSUMER,
      hasPV: true,
      pvPeakKw: 12.0,
      avgConsumptionKwh: 11.2,
      address: 'Sonnleiten 7, 9800 Spittal an der Drau',
      meterId: 'AT0010000000000000003EAL000000',
      joinedAt: '2023-04-01',
      role: 'user',
    },
    {
      id: 4,
      name: 'Familie Wagner',
      email: 'peter.wagner@example.at',
      type: MEMBER_TYPES.HOUSEHOLD_CONSUMER,
      hasPV: false,
      pvPeakKw: 0,
      avgConsumptionKwh: 8.5,
      address: 'Hauptplatz 3, 9800 Spittal an der Drau',
      meterId: 'AT0010000000000000004EAL000000',
      joinedAt: '2023-04-01',
      role: 'user',
    },
    {
      id: 5,
      name: 'Familie Koller',
      email: 'anna.koller@example.at',
      type: MEMBER_TYPES.HOUSEHOLD_PROSUMER,
      hasPV: true,
      pvPeakKw: 6.2,
      avgConsumptionKwh: 10.1,
      address: 'Rosenweg 2, 9800 Spittal an der Drau',
      meterId: 'AT0010000000000000005EAL000000',
      joinedAt: '2023-05-10',
      role: 'user',
    },
    {
      id: 6,
      name: 'Familie Steiner',
      email: 'thomas.steiner@example.at',
      type: MEMBER_TYPES.HOUSEHOLD_CONSUMER,
      hasPV: false,
      pvPeakKw: 0,
      avgConsumptionKwh: 7.3,
      address: 'Kirchgasse 9, 9800 Spittal an der Drau',
      meterId: 'AT0010000000000000006EAL000000',
      joinedAt: '2023-05-10',
      role: 'user',
    },
  ];

  // --- Zugangsdaten (nur für auth.js, NIE an den Browser weitergeben) ---
  // In Produktion: Passwörter nur als Hash auf dem Backend speichern!
  const mockCredentials = {
    'hans.mueller@example.at':  { password: 'user123',  memberId: 2, role: 'user' },
    'maria.berger@example.at':  { password: 'user123',  memberId: 3, role: 'user' },
    'admin@eeg-ropper.at':      { password: 'admin123', memberId: null, role: 'admin' },
  };

  // ===================================================================
  // Hilfsfunktionen für realistische Energiedaten
  // ===================================================================

  /**
   * Erzeugt ein realistisches PV-Erzeugungsprofil für einen Tag.
   * Sinus-Kurve von Sonnenaufgang (~6 Uhr) bis Sonnenuntergang (~20 Uhr).
   * @param {Date}   date    - Datum des Profils (bestimmt Saisonfaktor)
   * @param {number} peakKw  - Installierte PV-Leistung in kWp
   * @returns {number[]} 96 Werte (15-min-Intervalle), Einheit: kW
   */
  function generatePVProfile(date, peakKw) {
    const values = new Array(96).fill(0);

    // Intervall-Indizes: 0 = 00:00, 24 = 06:00, 52 = 13:00, 80 = 20:00
    const sunriseIdx = 24;
    const sunsetIdx  = 80;

    // Saisonaler Faktor: Sommer ~1.0, Winter ~0.45
    const month = date.getMonth(); // 0=Jan … 11=Dez
    const seasonFactor = 0.45 + 0.55 * Math.sin((month - 2) * Math.PI / 6);

    // Zufälliger Bewölkungsfaktor für diesen Tag (60–100%)
    const cloudFactor = 0.60 + Math.random() * 0.40;

    for (let i = sunriseIdx; i <= sunsetIdx; i++) {
      const winkelFraktion = (i - sunriseIdx) / (sunsetIdx - sunriseIdx);
      const basisWert = Math.sin(winkelFraktion * Math.PI) * peakKw * seasonFactor * cloudFactor;
      // Kleines Rauschen (±5%) für natürlichere Kurve
      const rauschen = 1 + (Math.random() - 0.5) * 0.10;
      values[i] = Math.max(0, basisWert * rauschen);
    }
    return values;
  }

  /**
   * Erzeugt ein realistisches Verbrauchsprofil für einen Tag.
   * Morgenspitze ~7–9 Uhr, Abendspitze ~18–21 Uhr.
   * @param {number} avgDailyKwh - Durchschnittlicher Tagesverbrauch in kWh
   * @returns {number[]} 96 Werte (15-min-Intervalle), Einheit: kW
   */
  function generateConsumptionProfile(avgDailyKwh) {
    // Basis-Lastprofil (normierter Verlauf, Index = 15-min-Intervall)
    // Werte sind relative Faktoren – werden danach auf avgDailyKwh skaliert
    const baseProfil = [
      // 00:00–05:45 (Nacht, Grundlast)
      0.30, 0.30, 0.25, 0.25, 0.28, 0.28, 0.25, 0.25,
      0.28, 0.28, 0.25, 0.25, 0.28, 0.28, 0.25, 0.25,
      0.30, 0.30, 0.32, 0.32, 0.35, 0.38, 0.42, 0.48,
      // 06:00–09:45 (Morgenroutine, Spitze ~07:00–08:30)
      0.65, 0.80, 1.05, 1.25, 1.40, 1.50, 1.45, 1.35,
      1.20, 1.05, 0.90, 0.80, 0.75, 0.72, 0.70, 0.68,
      // 10:00–13:45 (Mittag, leicht erhöht)
      0.70, 0.72, 0.75, 0.80, 0.85, 0.90, 0.88, 0.85,
      0.82, 0.80, 0.82, 0.85, 0.88, 0.90, 0.88, 0.85,
      // 14:00–17:45 (Nachmittag, steigend)
      0.75, 0.72, 0.70, 0.72, 0.78, 0.85, 0.95, 1.05,
      1.15, 1.25, 1.35, 1.42, 1.48, 1.52, 1.55, 1.55,
      // 18:00–21:45 (Abendspitze)
      1.60, 1.70, 1.75, 1.78, 1.75, 1.70, 1.60, 1.48,
      1.35, 1.20, 1.05, 0.92, 0.80, 0.72, 0.65, 0.58,
      // 22:00–23:45 (Abend, abfallend)
      0.55, 0.50, 0.45, 0.40, 0.38, 0.35, 0.32, 0.30,
    ];

    // Profil auf tatsächlichen Tagesverbrauch skalieren
    // Summe × 0.25h = Tagesenergie in kWh
    const profilSumme = baseProfil.reduce((a, b) => a + b, 0) * 0.25;
    const skalierung = avgDailyKwh / profilSumme;

    return baseProfil.map(v => {
      const rauschen = 1 + (Math.random() - 0.5) * 0.15;
      return Math.max(0, v * skalierung * rauschen);
    });
  }

  // ===================================================================
  // Verbrauchsprofil als Modul-Konstante (wird in getCommunityStats
  // und generateConsumptionProfile wiederverwendet)
  // ===================================================================

  // 96 Faktoren (15-min-Intervalle), normiert auf relativen Tagesverlauf.
  // Morgenspitze 07–09 Uhr, Abendspitze 18–21 Uhr, Nacht = Grundlast ~0.3.
  const VERBRAUCH_BASISPROFIL = [
    0.30,0.30,0.25,0.25,0.28,0.28,0.25,0.25,
    0.28,0.28,0.25,0.25,0.28,0.28,0.25,0.25,
    0.30,0.30,0.32,0.32,0.35,0.38,0.42,0.48,
    0.65,0.80,1.05,1.25,1.40,1.50,1.45,1.35,
    1.20,1.05,0.90,0.80,0.75,0.72,0.70,0.68,
    0.70,0.72,0.75,0.80,0.85,0.90,0.88,0.85,
    0.82,0.80,0.82,0.85,0.88,0.90,0.88,0.85,
    0.75,0.72,0.70,0.72,0.78,0.85,0.95,1.05,
    1.15,1.25,1.35,1.42,1.48,1.52,1.55,1.55,
    1.60,1.70,1.75,1.78,1.75,1.70,1.60,1.48,
    1.35,1.20,1.05,0.92,0.80,0.72,0.65,0.58,
    0.55,0.50,0.45,0.40,0.38,0.35,0.32,0.30,
  ];

  /**
   * Deterministischer Tagesfaktor für den Verbrauch (Wochentag + Datums-Rauschen).
   * Werktag = 0.95, Wochenende = 1.15, multipliziert mit pseudo-zufälligem
   * Rauschen 0.85–1.15 das nur vom Datum abhängt (reproduzierbar).
   */
  function tagesFaktor(datum) {
    const wochentag = datum.getDay(); // 0=So, 6=Sa
    const wochentagFaktor = (wochentag === 0 || wochentag === 6) ? 1.15 : 0.95;
    const seed = datum.getFullYear() * 10000 + (datum.getMonth() + 1) * 100 + datum.getDate();
    const rauschen = 0.85 + (Math.sin(seed * 9301 + 49297) * 0.5 + 0.5) * 0.30;
    return wochentagFaktor * rauschen;
  }

  /**
   * Gibt den relativen Verbrauchsfaktor für eine Uhrzeit zurück.
   * Wird für den Momentanverbrauch in getCommunityStats verwendet.
   * @param {number} stundenFraktion - z.B. 13.5 für 13:30 Uhr
   */
  function berechneTagesVerbrauchsFaktor(stundenFraktion) {
    const idx = Math.min(Math.floor(stundenFraktion * 4), 95);
    // Normieren: Profil-Durchschnitt → Faktor 1.0
    const durchschnitt = VERBRAUCH_BASISPROFIL.reduce((a, b) => a + b, 0) / 96;
    return VERBRAUCH_BASISPROFIL[idx] / durchschnitt;
  }

  // ===================================================================
  // Öffentliche API (wird nach außen gegeben)
  // ===================================================================
  const api = {

    // Typen-Konstanten öffentlich zugänglich
    MEMBER_TYPES,

    // ------------------------------------------------------------------
    // Mitglieder
    // ------------------------------------------------------------------

    /** Alle Mitglieder abrufen */
    async getMembers() {
      if (config.useApi) {
        const res = await fetch(`${config.apiBase}/members`);
        if (!res.ok) throw new Error('Fehler beim Laden der Mitglieder');
        return res.json();
      }
      return mockMembers.map(m => ({ ...m }));
    },

    /** Ein Mitglied anhand ID abrufen */
    async getMember(id) {
      if (config.useApi) {
        const res = await fetch(`${config.apiBase}/members/${id}`);
        if (!res.ok) throw new Error(`Mitglied ${id} nicht gefunden`);
        return res.json();
      }
      return mockMembers.find(m => m.id === id) || null;
    },

    // ------------------------------------------------------------------
    // Live-Werte (simuliert – später per WebSocket oder SSE ersetzen)
    // ------------------------------------------------------------------

    /**
     * Aktuelle Energiewerte für ein Mitglied.
     * Simuliert den aktuellen Zeitpunkt des Tages.
     */
    async getLiveValues(memberId) {
      if (config.useApi) {
        const res = await fetch(`${config.apiBase}/live/${memberId}`);
        if (!res.ok) throw new Error('Live-Daten nicht verfügbar');
        return res.json();
      }

      const member = mockMembers.find(m => m.id === memberId);
      if (!member) return null;

      const jetzt = new Date();
      const stundenFraktion = jetzt.getHours() + jetzt.getMinutes() / 60;

      // PV-Erzeugung (tagsüber, Sinus-Kurve)
      let pvErzeugung = 0;
      if (member.hasPV && stundenFraktion >= 6 && stundenFraktion <= 20) {
        const winkel = (stundenFraktion - 6) / 14 * Math.PI;
        pvErzeugung = Math.max(0, Math.sin(winkel) * member.pvPeakKw * 0.75);
        pvErzeugung += (Math.random() - 0.5) * 0.3; // Schwankung durch Wolken
        pvErzeugung = Math.max(0, pvErzeugung);
      }

      // Verbrauch (vereinfacht auf Basis Tagesdurchschnitt)
      const verbrauch = Math.max(0.2,
        member.avgConsumptionKwh / 24 * 1.5 * (0.8 + Math.random() * 0.4)
      );

      // Bilanz: positiv = Einspeisung, negativ = Netzbezug
      const bilanz = pvErzeugung - verbrauch;
      const einspeisung = bilanz > 0 ? bilanz : 0;
      const netzbezug   = bilanz < 0 ? -bilanz : 0;

      return {
        timestamp:       jetzt.toISOString(),
        pvErzeugung:     Math.round(pvErzeugung * 100) / 100,   // kW
        verbrauch:       Math.round(verbrauch   * 100) / 100,   // kW
        einspeisung:     Math.round(einspeisung * 100) / 100,   // kW
        netzbezug:       Math.round(netzbezug   * 100) / 100,   // kW
        eigenverbrauch:  pvErzeugung > 0
          ? Math.round(Math.min(verbrauch, pvErzeugung) / verbrauch * 100)
          : 0,  // Prozent
      };
    },

    // ------------------------------------------------------------------
    // Energieverlauf
    // ------------------------------------------------------------------

    /**
     * Historische Energiedaten für einen Zeitraum.
     * @param {number} memberId
     * @param {'day'|'week'|'month'|'year'} period
     * @param {Date} [referenzDatum] - Standardmäßig heute
     * @returns {{ period, labels, pvGeneration, consumption, unit }}
     */
    async getEnergyHistory(memberId, period = 'day', referenzDatum = new Date()) {
      if (config.useApi) {
        const params = new URLSearchParams({
          period,
          date: referenzDatum.toISOString(),
        });
        const res = await fetch(`${config.apiBase}/history/${memberId}?${params}`);
        if (!res.ok) throw new Error('Verlaufsdaten nicht verfügbar');
        return res.json();
      }

      const member = mockMembers.find(m => m.id === memberId);
      if (!member) return null;

      // --- Tages-Verlauf (96 × 15min-Werte) ---
      if (period === 'day') {
        const pvProfil = member.hasPV
          ? generatePVProfile(referenzDatum, member.pvPeakKw)
          : new Array(96).fill(0);
        const verbrauchProfil = generateConsumptionProfile(member.avgConsumptionKwh);

        const labels = [];
        for (let i = 0; i < 96; i++) {
          const h = String(Math.floor(i / 4)).padStart(2, '0');
          const m = String((i % 4) * 15).padStart(2, '0');
          labels.push(`${h}:${m}`);
        }
        return {
          period, labels,
          pvGeneration: pvProfil.map(v => Math.round(v * 100) / 100),
          consumption:  verbrauchProfil.map(v => Math.round(v * 100) / 100),
          unit: 'kW',
        };
      }

      // --- Wochen-Verlauf (7 Tageswerte) ---
      if (period === 'week') {
        const labels = [], pvSummen = [], verbrauchSummen = [], eigenverbrauchSummen = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(referenzDatum);
          d.setDate(d.getDate() - i);
          labels.push(d.toLocaleDateString('de-AT', {
            weekday: 'short', day: 'numeric', month: 'numeric',
          }));
          const pvProfil = member.hasPV
            ? generatePVProfile(d, member.pvPeakKw)
            : new Array(96).fill(0);
          const consProfil = generateConsumptionProfile(
            member.avgConsumptionKwh * tagesFaktor(d)
          );
          let pvSum = 0, consSum = 0, evSum = 0;
          for (let j = 0; j < 96; j++) {
            pvSum   += pvProfil[j]  * 0.25;
            consSum += consProfil[j] * 0.25;
            evSum   += Math.min(pvProfil[j], consProfil[j]) * 0.25;
          }
          pvSummen.push(Math.round(pvSum * 10) / 10);
          verbrauchSummen.push(Math.round(consSum * 10) / 10);
          eigenverbrauchSummen.push(Math.round(evSum * 10) / 10);
        }
        return {
          period, labels,
          pvGeneration: pvSummen,
          consumption:  verbrauchSummen,
          eigenverbrauch: eigenverbrauchSummen,
          unit: 'kWh',
        };
      }

      // --- Monats-Verlauf (ein Wert pro Tag) ---
      if (period === 'month') {
        const labels = [], pvSummen = [], verbrauchSummen = [], eigenverbrauchSummen = [];
        const tageImMonat = new Date(
          referenzDatum.getFullYear(),
          referenzDatum.getMonth() + 1,
          0
        ).getDate();
        for (let tag = 1; tag <= tageImMonat; tag++) {
          const d = new Date(referenzDatum.getFullYear(), referenzDatum.getMonth(), tag);
          labels.push(String(tag));
          const pvProfil = member.hasPV
            ? generatePVProfile(d, member.pvPeakKw)
            : new Array(96).fill(0);
          const consProfil = generateConsumptionProfile(
            member.avgConsumptionKwh * tagesFaktor(d)
          );
          let pvSum = 0, consSum = 0, evSum = 0;
          for (let j = 0; j < 96; j++) {
            pvSum   += pvProfil[j]  * 0.25;
            consSum += consProfil[j] * 0.25;
            evSum   += Math.min(pvProfil[j], consProfil[j]) * 0.25;
          }
          pvSummen.push(Math.round(pvSum * 10) / 10);
          verbrauchSummen.push(Math.round(consSum * 10) / 10);
          eigenverbrauchSummen.push(Math.round(evSum * 10) / 10);
        }
        return {
          period, labels,
          pvGeneration: pvSummen,
          consumption:  verbrauchSummen,
          eigenverbrauch: eigenverbrauchSummen,
          unit: 'kWh',
        };
      }

      // --- Jahres-Verlauf (ein Wert pro Monat) ---
      if (period === 'year') {
        const monatsNamen = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
        const pvSummen = [], verbrauchSummen = [], eigenverbrauchSummen = [];
        for (let monat = 0; monat < 12; monat++) {
          const tage = new Date(referenzDatum.getFullYear(), monat + 1, 0).getDate();
          let pvSumme = 0, consSumme = 0, evSumme = 0;
          for (let tag = 1; tag <= tage; tag++) {
            const d = new Date(referenzDatum.getFullYear(), monat, tag);
            const pvProfil = member.hasPV
              ? generatePVProfile(d, member.pvPeakKw)
              : new Array(96).fill(0);
            const consProfil = generateConsumptionProfile(
              member.avgConsumptionKwh * tagesFaktor(d)
            );
            for (let j = 0; j < 96; j++) {
              pvSumme   += pvProfil[j]  * 0.25;
              consSumme += consProfil[j] * 0.25;
              evSumme   += Math.min(pvProfil[j], consProfil[j]) * 0.25;
            }
          }
          pvSummen.push(Math.round(pvSumme));
          verbrauchSummen.push(Math.round(consSumme));
          eigenverbrauchSummen.push(Math.round(evSumme));
        }
        return {
          period,
          labels: monatsNamen,
          pvGeneration: pvSummen,
          consumption:  verbrauchSummen,
          eigenverbrauch: eigenverbrauchSummen,
          unit: 'kWh',
        };
      }

      throw new Error(`Unbekannter Zeitraum: ${period}`);
    },

    // ------------------------------------------------------------------
    // Community-Gesamtstatistiken
    // ------------------------------------------------------------------

    /** Aktueller Zustand der gesamten EEG */
    async getCommunityStats() {
      if (config.useApi) {
        const res = await fetch(`${config.apiBase}/community/stats`);
        if (!res.ok) throw new Error('Community-Daten nicht verfügbar');
        return res.json();
      }

      const jetzt = new Date();
      const stundenFraktion = jetzt.getHours() + jetzt.getMinutes() / 60;
      const month = jetzt.getMonth(); // 0=Jan … 11=Dez

      // Saisonaler Faktor: Sommer ~1.0, Winter ~0.45
      const saisonFaktor = 0.45 + 0.55 * Math.sin((month - 2) * Math.PI / 6);

      // --- Momentanleistung (für Live-Anzeige) ---
      let gesamtPV = 0, gesamtVerbrauch = 0;
      for (const member of mockMembers) {
        if (member.hasPV && stundenFraktion >= 6 && stundenFraktion <= 20) {
          const winkel = (stundenFraktion - 6) / 14 * Math.PI;
          gesamtPV += Math.max(0, Math.sin(winkel) * member.pvPeakKw * 0.75 * saisonFaktor);
        }
        // Verbrauch zeitabhängig (Morgen-/Abendspitze), nicht flacher Durchschnitt
        const verbrauchFaktor = berechneTagesVerbrauchsFaktor(stundenFraktion);
        gesamtVerbrauch += member.avgConsumptionKwh / 24 * verbrauchFaktor;
      }

      // --- Tages-Autarkiegrad (realistisch, 0-100%) ---
      // Berechnet den Anteil des bisherigen Tagesverbrauchs, der durch eigene PV gedeckt wurde.
      // Pro 15-min-Intervall: Eigenverbrauch = min(PV_t, Verbrauch_t)
      // Das ist der Standard-Kennwert für EEGs (kein Momentanwert, sondern Tagesbilanz).
      const maxInterval = jetzt.getHours() * 4 + Math.floor(jetzt.getMinutes() / 15);

      // Normierungsfaktor des Verbrauchsprofils (Summe aller Faktoren × 0,25h = 1 Tag)
      const profilSumme = VERBRAUCH_BASISPROFIL.reduce((a, b) => a + b, 0) * 0.25;

      let eigenverbrauchKwh = 0, tagesverbrauchKwh = 0;

      for (const member of mockMembers) {
        for (let i = 0; i <= Math.min(maxInterval, 95); i++) {
          const stundeI = i / 4;

          // PV-Erzeugung in diesem 15-min-Slot [kW]
          let pvI = 0;
          if (member.hasPV && stundeI >= 6 && stundeI <= 20) {
            const winkel = (stundeI - 6) / 14 * Math.PI;
            pvI = Math.max(0, Math.sin(winkel) * member.pvPeakKw * 0.75 * saisonFaktor);
          }

          // Verbrauch in diesem Slot aus Basisprofil [kW]
          const faktor = VERBRAUCH_BASISPROFIL[i] || 0.30;
          const verbrauchI = (member.avgConsumptionKwh / profilSumme) * faktor;

          // Eigenverbrauch = was direkt lokal konsumiert wird (max. eigener Bedarf)
          eigenverbrauchKwh += Math.min(pvI, verbrauchI) * 0.25; // × 0,25h = kWh
          tagesverbrauchKwh += verbrauchI * 0.25;
        }
      }

      const autarkieGrad = tagesverbrauchKwh > 0
        ? Math.round(eigenverbrauchKwh / tagesverbrauchKwh * 100)
        : 0;

      return {
        timestamp:          jetzt.toISOString(),
        mitgliederAnzahl:   mockMembers.length,
        prosumerAnzahl:     mockMembers.filter(m => m.hasPV).length,
        gesamtPvKwp:        mockMembers.reduce((sum, m) => sum + m.pvPeakKw, 0),
        aktuelleErzeugung:  Math.round(gesamtPV * 100) / 100,
        aktuellerVerbrauch: Math.round(gesamtVerbrauch * 100) / 100,
        autarkieGrad,
      };
    },

    // ------------------------------------------------------------------
    // Interne Schnittstellen (nur für auth.js)
    // ------------------------------------------------------------------

    /** Zugangsdaten für auth.js – nicht in UI verwenden! */
    _getMockCredentials() { return mockCredentials; },
    _getMockMembers()     { return mockMembers; },
  };

  return api;
})();
