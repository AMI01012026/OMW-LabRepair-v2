# OMW LabRepair v2.2.0 (Production)

Produktionsversion til ALS Environmental. HTML + CSS + vanilla JavaScript, Supabase som backend. Ingen frameworks, ingen build-steps — filerne hostes som statiske filer, præcis som før.

## Nyt i v2.0

- **Login ved hver opstart:** initialer bekræftes hver gang appen åbnes. Arbejdsstation (Lab / Afvejning Jord / Afvejning Materialer) vælges kun første gang og gemmes i localStorage; appen åbner direkte på den rigtige visning.
- **To separate print-knapper** i Afvejning: *Print etiketter* (uden arkivering) og *Print A4 + Arkivér* (Reparationer + Send til på ét A4, arkiveres automatisk efter print). De kombineres aldrig.
- **Etiketter (Zebra ZD421, 52×25 mm):** ægte Code128 via JsBarcode (SVG). Hver etiket er sin egen side. Send til-etiketter viser `→ Destination` (fx `→ Aarhus`). HASTER vises øverst.
- **ZPL-eksport:** knappen *Download ZPL* genererer en `.zpl`-fil hvor hver etiket er sit eget `^XA…^XZ`-printjob — send filen direkte til printeren (fx delt Zebra-printer eller Zebra Setup Utilities) for garanteret ét job pr. etiket.
- **Bestems-dropdown:** 2, 3, 2+3, 3+4, 4+5, 5+6 + *Manuel indtastning*. `2+3` giver automatisk etiketterne `12345-2` og `12345-3`.
- **Realtime:** Supabase realtime på tabellen `repairs`. Ved nye opgaver afspilles en lyd og ét popup vises (JORD/MATERIALE × Haster/Ikke haster, kun aktive). Popup'et opdateres — der åbnes aldrig flere — og forsvinder når alt er arkiveret. 30-sekunders polling er bevaret som fallback.
- **Arkiv med alle data:** sample, box, analyse, bestems, gram, destination, årsag, kommentar, initialer, 1. vejedato, haster, status, oprettet, printet, printet kl., arkiveret af, arkiveret kl. + søgefelt. `archive_by` er nu brugerens initialer (før: hardkodet "Afvejning").
- **Dashboard i Fluent/Power BI-stil:** kun ALS-blå + neutrale farver. Aktive, arkiveret i dag, haster/ikke haster, pr. lab, pr. måned, top analyser, top årsager, gennemsnitlig behandlingstid, antal printede etiketter og A4-udskrifter. Fuldt responsivt.
- **Ægte autocomplete** (ikke browser-datalist) på Analyse og Årsag med piletaster/Enter. Analyselisten er dedupliceret; "TK" findes ikke, "TotalKulB" er bevaret.
- **Logo:** kun det runde ALS-logo overalt; al gammel "hvid firkant"-CSS er fjernet.

## Rettede fejl fra v1.9

1. A4-print blev udskrevet på 52×25 mm-papir (fire modstridende `@media print`-blokke; sidste `@page` vandt). Løst med dynamisk `@page`-injektion pr. print-type.
2. To `window.print()`-dialoger i kaskade og arkivering selv ved annulleret print (den gamle kombinerede knap). Fjernet.
3. Manglende HTML-escaping i flere tabeller (XSS-risiko). Alt output escapes nu.
4. Send til fik aldrig etiketter. Rettet.
5. ZPL-generatoren sanitizer nu `^`, `~` og `\` i feltdata.
6. Duplikater i analyselisten fjernet.

## Filstruktur

| Fil | Ansvar |
|---|---|
| `index.html` | Skelet + script-rækkefølge |
| `config.js` | Standard-Supabase-config (uændret) |
| `data.js` | Šifrarnici: labs, typer, destinationer, analyser, bestems, årsager |
| `supabaseClient.js` | Config i localStorage, Supabase-klient, realtime, CRUD |
| `ui.js` | Toast, lyd (WebAudio), autocomplete, notifikations-popup, print-statistik |
| `print.js` | Etiketter (Code128), A4, dynamisk `@page`, ZPL-eksport |
| `dashboard.js` | Dashboard-beregninger og -visning |
| `app.js` | State, views, login, formularer, arbejdslister, arkiv |
| `style.css` | Én samlet stylesheet (Fluent, ALS-blå) |

## Nyt i v2.2.0 — Production Readiness

Fuld produktionsgennemgang (se `PRODUCTION-READINESS-REPORT.md`): 8 fund rettet, heraf to data-tab-risici (arkivering før printdialog; kladder mistet ved refresh — nu autosave i localStorage + "Gendan" i Arkivet), lyd-mute for egne indsendelser, grams-validering, service_role-nøglevagt, tidsvinduet datahentning (aktive + 13 mdr.) og `migration.sql` med RLS (DELETE umulig fra klienten), indekser, audit-trigger og realtime-publikation. 118/118 tests grønne. Deploy-plan og GO-betingelser (D1–D3) står i rapporten.

## Nyt i v2.1.2 — officielt ALS-logo

`als-logo.svg` er nu det fulde ALS-emblem i farver (blå trekant, gul flamme, gråblå brænder, hvid swoosh med blåt "(ALS)"), vektoriseret fra det officielle mærke og verificeret mod kilden (IoU ≥ 0,97 pr. element). Det passer til den lyse Soft-tema uden den tunge blå cirkel. Den runde badge-variant ligger som `als-logo-round.svg`, hvis den ønskes i stedet (omdøb filerne). PNG-fallback og favicon er genereret fra den nye vektor.

## Vigtigt: sådan åbnes appen

1. **Udpak HELE zip-filen først** (højreklik → *Udpak alle…*). Åbn aldrig `index.html` direkte inde fra zip'en — så mangler alle øvrige filer, og siden bliver blank.
2. Åbn `index.html` fra den udpakkede mappe (dobbeltklik virker; alle filer skal ligge sammen).
3. Til daglig drift anbefales hosting via en webserver over **http** på det lokale netværk (kræves også for direkte Zebra-print). Internetadgang er nødvendig for Supabase- og stregkode-bibliotekerne (CDN).

Fra v2.1.1 kan siden aldrig være helt blank: starter appen ikke, vises et fejlpanel der fortæller præcis hvilke filer der mangler, og hvordan det løses.

## Nyt i v2.1.0 — "Soft" tema

Hele appen er restylet i et blødt claymorphism-look (creme baggrund, pastel-rosa og mint, pill-former, bløde dobbeltskygger). **Ingen funktionalitet er ændret** — kun `style.css`.

- `style.css` = Soft-temaet (aktivt)
- `style-fluent.css` = den tidligere ALS-blå enterprise-tema

**Skift tema:** omdøb filerne (eller ret `<link rel="stylesheet">` i `index.html`). Alle CSS-selektorer er identiske i begge temaer (verificeret: 76/76 klasser dækket i begge). Print-CSS (etiketter + A4) er uændret sort/hvid i begge temaer.

## Nyt i v2.0.1 (fejlrettelser)

1. **Zebra-netværksprint (primær vej):** sæt printerens IP under *Opsætning → teknisk opsætning*. "Print etiketter" sender så ZPL direkte til ZD421 via printerens indbyggede webserver (`POST http://<ip>/pstprnt`) — ingen printdialog, hver etiket sit eget printjob, perfekt Code128. Uden IP (eller hvis printeren ikke svarer) bruges browserens printdialog som fallback.
   *Bemærk:* direkte netværksprint kræver at appen hostes over **http** (eller at browseren tillader "usikkert indhold" for siden) — https-sider må ikke kalde http-printere.
2. **Browser-etiketfejlen rettet:** JsBarcode-SVG'en manglede `viewBox`, så CSS'ens mm-størrelse **klippede** stregkoden i stedet for at skalere den — derfor så man kun en del af teksten og ingen stregkode. SVG'en får nu viewBox + `preserveAspectRatio` og skaleres korrekt til 48×8,8 mm.
3. **Popup-fejlen rettet:** et lukket popup blev ved med at være skjult. Nu: lukket popup forbliver lukket ved almindelige opdateringer, men **genåbnes automatisk når en ny opgave ankommer** (+ lyd). Åbent popup opdaterer kun tallene. Ved 0 aktive forsvinder det.
4. **Logo:** `als-logo.svg` — original-PNG'en (48×48 px) er vektoriseret (verificeret: 0,00 % afvigelse i silhuet ved 48 px). Skarpt i alle størrelser, samme fil på welcome og i sidebar; PNG bruges som fallback.
5. **To tydelige print-knapper** øverst i Afvejning med undertekster ("uden arkivering" / "arkiveres automatisk"). *Download ZPL* og *Arkivér uden print* er sekundære.
6. **Cache-busting** (`?v=2.0.1` på alle lokale filer) — årsagen til at kun én print-knap kunne ses var med stor sandsynlighed en cached v1.9-`app.js`. Fremover tvinger versionsparameteren browseren til at hente nye filer.

## Opsætning

1. Host mappen som statiske filer (som hidtil).
2. Første start: Opsætning → admin-kode (`admin123`) → indsæt Supabase URL + publishable key.
3. **Realtime:** i Supabase-dashboardet: *Database → Replication → supabase_realtime* → tilføj tabellen `repairs`. Uden dette virker appen stadig (polling hvert 30. sek.), men uden øjeblikkelig lyd/popup.
4. **Zebra ZD421 (netværk):** find printerens IP (printerens config-label eller router), indtast den under teknisk opsætning. Test med "Print etiketter". Ved browser-fallback: driverens papirstørrelse sættes til 52×25 mm; i browserens printdialog vælges Zebra-printeren, margin "Ingen", skalering 100 %.

## Noter

- Browseren kan ikke sende ét separat printjob pr. etiket via `window.print()` (etiketterne ligger som én side pr. etiket i ét job). Skal hver etiket være et fysisk separat job, brug *Download ZPL*.
- Tællerne "Etiketter printet" og "A4-udskrifter" gemmes pr. station (localStorage).
- Admin-adgangskoden ligger i `data.js` og beskytter kun mod utilsigtede ændringer — den er ikke en sikkerhedsgrænse (klient-side kode).
