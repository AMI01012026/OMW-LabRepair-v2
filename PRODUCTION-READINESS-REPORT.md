# Production Readiness Report — OMW LabRepair v2.2.0
**ALS Prøveforberedelse Platform · prva produkcijska aplikacija**
Datum pregleda: 6. srpnja 2026. · Pregledao: završni audit cijelog koda (1 687 linija, 9 datoteka)

---

## PRESUDA

### ⚠️ USLOVNO SPREMNO — GO nakon 3 obavezne akcije pri deployu

Kod je spreman: svi pronađeni bugovi su ispravljeni i pokriveni testovima (118/118 prolazi). Tri stavke se **ne mogu obaviti iz koda** — moraju se napraviti u Supabase-u i na mreži pri deployu (točke D1–D3 dolje). Bez njih aplikacija radi, ali bez zaštite od brisanja podataka na razini baze.

---

## 1. PREGLED CIJELOG KODA — ✅ obavljeno

Pregledana svaka linija: `app.js` (546), `ui.js` (190), `print.js` (200), `supabaseClient.js` (135), `dashboard.js` (102), `data.js` (46), `index.html` (81), `style.css` + `style-fluent.css`. Rezultat: 8 nalaza (B1–B8), svi ispravljeni u ovoj verziji.

## 2. BUGOVI — ✅ 8 pronađeno, 8 ispravljeno

| # | Ozbiljnost | Nalaz | Ispravak | Test |
|---|---|---|---|---|
| B1 | **VISOKA (gubitak podataka)** | "Print A4 + Arkivér" arhivirao je redove *prije* nego što se print dijalog uopće otvorio — otkazani print = zadaci nestali s radne liste, bez povratka | Arhiviranje sada čeka zatvaranje print dijaloga (`printRows` vraća Promise); dodano **"Gendan"** u Arkivu (admin lozinka) kao sigurnosna mreža za svaku pogrešnu arhivaciju | ✅ prod.js |
| B2 | **VISOKA (gubitak podataka)** | Uneseni redovi (kladice) postojali su samo u memoriji — refresh/slučajno zatvaranje = sve utipkano izgubljeno | Kladice se automatski spremaju u localStorage pri svakom unosu, vraćaju pri pokretanju, brišu tek nakon uspješnog slanja | ✅ prod.js |
| B3 | SREDNJA | Korisnik je čuo zvučnu notifikaciju za **vlastito** upravo poslano — realtime event stiže prije ručnog ažuriranja poznatih ID-jeva | 6-sekundni mute prozor nakon vlastitog slanja; vanjski zadaci i dalje sviraju | ✅ prod.js |
| B4 | NISKA (XSS obrana u dubinu) | JSON s ID-jevima umetan neescapiran u onclick atribut (UUID-ovi su danas sigurni, ali princip je princip) | `escapeHtml` na JSON | ✅ prod.js |
| B5 | NISKA | `grams` polje moglo poslati NaN → null u bazi | Validacija: konačan broj > 0 | ✅ prod.js |
| B6 | SREDNJA (performanse) | Vidi točku 4 | Vidi točku 4 | ✅ prod.js |
| B7 | SREDNJA (sigurnost) | Vidi točku 5 | Vidi točku 5 | ✅ prod.js |
| B8 | NISKA (robusnost) | Login bez konfigurirane baze ostavljao korisnika na praznom viewu s crvenom greškom | Preusmjerenje na Opsætning s jasnom porukom | ✅ prod.js |

## 3. DEVELOPMENT KOD — ✅ čisto

- `console.log` / `TODO` / `FIXME` / `debugger`: **0 pronađeno** (grep cijelog koda).
- Zadržana su 3 namjerna `console.warn/error` (logiranje pada realtime-a i mrežnog printa — ispravno za produkciju).
- `test/`, `node_modules`, `package.json` **isključeni iz produkcijskog paketa** (provjereno u ZIP-u).
- Mock/demo podaci: nema ih.
- ⚠️ `ADMIN_PASSWORD` ("admin123") u `data.js` — **nije sigurnosna granica** (klijentski kod je čitljiv svakome); služi samo kao brava protiv slučajnih izmjena tehničkih postavki i slučajnog vraćanja iz arhiva. Prava kontrola pristupa dolazi s platformom (SSO + role). **Preporuka: promijenite vrijednost prije objave.**

## 4. PERFORMANSE — ✅ ispravljeno (B6)

- **Nalaz:** `fetchRepairs` je dovlačio *cijelu* tablicu zauvijek → s godinama bi svako osvježavanje (svakih 30 s na svakoj stanici!) postajalo sve teže.
- **Ispravak:** dohvaćaju se svi aktivni + arhiv zadnjih ~13 mjeseci (`or(status.eq.ny, created_at.gte.cutoff)`) — 12-mjesečni graf ostaje potpun, promet ograničen.
- Uz `migration.sql` indekse (`status`, `created_at`, `status+sample_type`) upiti su pokriveni indeksima.
- Ostalo provjereno: rendering je full-innerHTML (prihvatljivo za ovu veličinu ekrana podataka), arhiv pretraga debounced, autocomplete O(n) na 60 stavki, nema memory leakova u intervalu/kanalu (kanal se uklanja pri ponovnom povezivanju).

## 5. SIGURNOST — ✅ kod čist · ⚠️ 1 akcija pri deployu (D1)

| Provjera | Rezultat |
|---|---|
| XSS: svaka interpolacija podataka u HTML | ✅ 100 % kroz `escapeHtml` (ručno provjereno svih ~45 mjesta u tablicama, formama, popupu, printu, autocompleteu) |
| ZPL injekcija u etikete | ✅ `^ ~ \` sanitizirani |
| `service_role` ključ u browseru (katastrofalan propust ako se dogodi) | ✅ novi guard: ključ se dekodira i **odbija** s objašnjenjem (B7) |
| Anon/publishable ključ u localStorage | ✅ standardna Supabase praksa — ali ključ je javan po dizajnu, pa zaštita podataka MORA biti RLS u bazi → **akcija D1** |
| Ovisnosti (CDN: supabase-js@2, jsbarcode@3.11.6) | ✅ pinnane verzije; ⚠️ zahtijevaju internet — boot-watchdog javlja ako ne dođu |
| HTTPS | ⚠️ svjesna odluka: hosting preko **http na internom LAN-u** zbog direktnog Zebra printa (mixed content); Supabase promet je i dalje TLS prema *.supabase.co |

## 6. AUTENTIFIKACIJA I ROLE — ⚠️ dokumentirano ograničenje (prihvaćeno za v2.2)

- Aplikacija **nema pravu autentifikaciju**: inicijali su identifikacija (tko je što napravio), ne autorizacija. To je svjesni dizajn za internu LAN aplikaciju i dogovoreni model do migracije u platformu (SSO + admin/supervisor/employee/readonly, tjedni 5–8 plana).
- Što jest zaštićeno već sada: tehničke postavke i vraćanje iz arhiva iza admin lozinke; **DELETE potpuno onemogućen na razini baze** (RLS bez delete politike — akcija D1); insert ne može stvoriti "rođeno arhivirane" redove.
- **GO uvjet:** aplikacija smije biti dostupna samo na internom LAN-u (ne izlagati javno na internet).

## 7. BAZA PODATAKA I MIGRACIJE — ✅ isporučen `migration.sql`

Do sada shema nije postojala kao kod (rizik!). Sada postoji **idempotentna migracija** (može se pokrenuti više puta bez štete):
- `repairs` tablica s CHECK ograničenjima (`request_type`, `sample_type`, `status`), UUID pk, `created_at` default.
- `ADD COLUMN IF NOT EXISTS` za postojeće instalacije — bez diranja podataka.
- 3 indeksa za stvarne upite aplikacije.
- RLS politike (select/insert/update, **bez delete**).
- `audit_log` tablica + trigger (`security definer`): svaka promjena statusa (arhiviranje/vraćanje) trajno zapisana s korisnikom — klijent to ne može zaobići ni pisati lažne zapise.
- Realtime publikacija za `repairs` (zvuk + popup).
- Verifikacijski upit na dnu — pokrenuti i provjeriti: `rls_enabled=true`, `delete_allowed=false`, `realtime_on=true`.

## 8. GUBITAK PODATAKA — ✅ svi vektori zatvoreni

| Vektor | Status |
|---|---|
| Otkazani print arhivira zadatke (B1) | ✅ arhiviranje tek nakon dijaloga + "Gendan" povrat |
| Refresh briše utipkane kladice (B2) | ✅ localStorage autosave |
| DELETE iz klijenta (ukraden/izvučen anon ključ) | ✅ nemoguć nakon D1 (RLS bez delete politike) |
| Hard delete iz koda | ✅ ne postoji nijedan `delete()` poziv u kodu (grep verificirano) — samo soft delete kroz `status` |
| Tihi gubitak kroz NaN grams (B5) | ✅ validacija |
| Nestanak zapisa o tome tko je što arhivirao | ✅ audit trigger u bazi |
| Katastrofa na razini baze | ⚠️ akcija D2: uključiti Supabase backupe |

## 9. PLAN DEPLOYA U PRODUKCIJU

**Preduvjeti (obavezno, redom):**
- **D1 — Baza:** u Supabase SQL Editoru pokrenuti `migration.sql`; pokrenuti verifikacijski upit s dna i potvrditi `rls_enabled=true`, `delete_allowed=false`, `realtime_on=true`.
- **D2 — Backup:** Supabase Dashboard → Database → Backups: potvrditi da su dnevni backupi aktivni (Pro plan: PITR). Zabilježiti tko smije raditi restore.
- **D3 — Mreža:** aplikaciju hostati kao statične datoteke na **internom web serveru preko http** (npr. IIS/nginx na lab serveru); potvrditi da NIJE dostupna izvan LAN-a. Zapisati IP Zebra ZD421 printera (statička adresa ili DHCP rezervacija!).

**Deploy koraci:**
1. Raspakirati `omw-labrepair-v2.2.0.zip` u **novu** mapu na serveru (npr. `omw/v2.2.0/`), preusmjeriti web root na nju. Stara verzija ostaje na disku = trenutni rollback (samo vratiti web root).
2. Promijeniti `ADMIN_PASSWORD` u `data.js` (preporuka iz točke 3).
3. Na jednoj stanici: otvoriti app → Opsætning → admin → unijeti Supabase URL + **publishable** ključ (service_role guard će odbiti krivi) + Zebra IP → "Gem og test" mora javiti "Forbindelse OK".
4. Smoke test u produkciji (15 min): poslati 1 testnu reparaciju s bestems "2+3" → provjeriti zvuk+popup na drugoj stanici → Print etiketter (2 etikete iz Zebre, Code128 skenirati čitačem!) → Print A4 + Arkivér → provjeriti da je red u Arkivu s ispravnim inicijalima → "Gendan" red → ponovno arhivirati "uden print".
5. Na svakoj radnoj stanici: otvoriti URL, Ctrl+F5 jednom, odabrati radnu stanicu, bookmark/kiosk shortcut.
6. Objaviti korisnicima + zadržati stari OMW (ako postoji) read-only tjedan dana.

**Rollback plan:** web root natrag na prethodnu mapu (v2.1.2). Baza je kompatibilna unatrag (migracija samo dodaje), pa rollback ne zahtijeva ništa u bazi.

## 10. TESTOVI — ✅ 118/118

`test/smoke.js` 61 · `test/smoke2.js` 36 · `test/prod.js` 16 (novi, pokriva B1–B8) · `test/boot.js` 5 scenarija. Svi prolaze na v2.2.0.

---

## Sažetak otvorenih stavki

| # | Stavka | Blokira GO? |
|---|---|---|
| D1 | Pokrenuti `migration.sql` + verifikacija | **DA** |
| D2 | Potvrditi Supabase backupe | **DA** |
| D3 | Interni LAN hosting (http) + statički IP printera | **DA** |
| P1 | Promijeniti admin lozinku u `data.js` | preporuka |
| P2 | Prava autentifikacija i role | ne — dolazi s platformom (plan tjedni 5–8) |
| P3 | HTTPS | ne — svjesna LAN odluka dok postoji direktan Zebra print |

**Nakon D1–D3: GO za produkciju.**
