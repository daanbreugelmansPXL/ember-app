# BLUEPRINT — Ember (v3 — Dynamic Quest Radar)

## 1. Visie & Kernprincipe
Ember is een lichtgewicht, gratis Progressive Web App (PWA) die studenten en drukbezette gebruikers met wisselende roosters helpt om lege tijd effectief om te zetten in voortgang — zónder de frictie en weerstand van rigide time-blocking. Eenvoudige voorkant, slimme rekenmotor achteraan, en een volwassen Dark Cozy Life RPG-laag.

### 2-App Architectuur (Leidend)
- **Ember (Radar, Quests & Spel):** Eigen taken-, budget- en RPG-beheer in **Firebase Firestore** (met lokale offline-persistentie voor directe opstart op iPhone/PC).
- **Google Agenda (Logistieke Radar):**
  - **Schrijven (minimaal):** Ember schrijft **uitsluitend harde deadlines** naar de primaire agenda (`primary`). Geen opgedrongen werkmoment-blokken meer.
  - **Lezen (slim):** Ember leest geselecteerde Google Agenda's van de gebruiker uit om automatisch de echte beschikbare focustijd te berekenen.
- **Auth & Token-vernieuwing:** Multi-user **Cloudflare Worker + KV** beheert veilig per Firebase-gebruiker (`uid`) het Google OAuth Refresh Token, zodat herverbinden op Brave en iPhone PWA nooit meer nodig is.

## 2. Tech Stack (100% Gratis)
- **Frontend:** React + Vite + Tailwind CSS (mobiel-first PWA + 2-koloms desktop layout).
- **Hosting:** GitHub Pages.
- **Database & Auth:** Firebase Spark Plan (Google Auth + Firestore met offline cache).
- **Backend Proxy:** Cloudflare Workers + KV (Free Tier, multi-user OAuth token refresh).
- **Agenda API:** Google Calendar API v3 (`calendar.events` + `calendar.calendarlist.readonly`).

## 3. Visuele Stijl & Schermhiërarchie
- **Esthetiek:** Dark Cozy / Obsidian aesthetic (diep antraciet, subtiele glas-kaarten, warme kampvuur-accenten).
- **Strikte regels:** Geen pastelkleuren, geen emoji's in UI of Google Agenda, geen drukke badge-overload. Gebruik uitsluitend `lucide-react` iconen in de app en strakke typografie in Google Agenda.
- **Taalscheiding:** Vaste UI-labels, knoppen en meldingen in het **Engels**; gebruikersdata, categorieën en eigen instellingen vrij (standaard Nederlands/aanpasbaar).
- **Mobiel-first Hiërarchie (geen scroll-muur):**
  - Bovenaan: slanke **Statusbalk** (compacte levende vlam + Level + 5 hartjes) + één klikbare **Radar-pil** (bufferstatus + directe toegang tot `Shift Check`).
  - Direct daaronder: **Smart Quest Board (Top 3)** zonder eerst te hoeven scrollen.
- **Desktop:** 2-koloms layout (vaste zijbalk links met Hearth-status, Week Radar, filters en `New Task`; hoofdwerkruimte rechts met Quest Board, Deadlines/Boss Quests en Weekly Budgets).

## 4. Accountinstellingen (Zero Hardcoding)
Alle persoonlijke voorkeuren worden per gebruiker opgeslagen in Firestore (`users/{uid}/settings`), met slimme standaardwaarden bij eerste login:
- **Beschikbaarheid:** Actieve uren (bijv. `09:00 – 22:00`) en een realistische **Max Focus Cap per dag** (bijv. `5u`).
- **Vaste Rustblokken:** Terugkerende onbeschikbare uren (bijv. `12:00 – 13:00` lunch). **Harde regel:** echte Google Calendar-events worden wiskundig samengevoegd met rustblokken en overschrijven deze altijd waar ze uitlopen.
- **Agenda-beheer (uit echte Google-agendalijst):** Per agenda instelbaar:
  - Meerekenen als bezet (`aan`/`uit`).
  - Optioneel trefwoordfilter (bijv. alleen events met `"Daan"` in de titel).
  - Eigen **reistijd-buffer** in minuten (toegepast vóór en ná elk event uit die agenda).
- **Online-uitzondering (0 min reistijd):** Aanpasbare lijst trefwoorden (standaard: `online, teams, zoom, remote`). Komt een trefwoord voor in titel of locatie van een event, dan vervalt de reistijd voor dat blok automatisch.
- **Eigen Categorieën / Skills:** Gebruiker kan categorieën zelf aanmaken, hernoemen en verwijderen (met suggesties bij start: `Studie`, `Projecten`, `Health`, `Sociaal`, `Thuis`).

## 5. Google Calendar Radar, Shift Simulator & Taken
### Google Calendar Sync (Deadlines only)
- Alleen taken met een harde deadline syncen naar `primary` als hele-dag-event bovenaan de dag met `colorId: "11"` (Tomaat).
- **Titel-notatie:** `[!] (<size>) <volledige titel>` — **geen** kunstmatige karakter-afkapping.
- **Beschrijving:** Bevat uitsluitend het `notes`-veld van de gebruiker (anders volledig leeg — nooit de titel herhalen).
- Bij afvinken of verwijderen verdwijnt het agenda-event direct; klikken op **Undo** (`Ctrl+Z`, 6 sec) herstelt Firestore én Google Calendar volledig.

### Week Radar & Shift Simulator
- Berekent voor de komende 14 dagen de echte vrije focustijd minus geactiveerde agenda-events, reistijden, rustblokken en openstaande Weekly Budgets, begrensd op de dagelijkse Max Focus Cap.
- Vergelijkt per deadline het totaal openstaande werk tot die datum met de vrije focustijd en toont de bufferstatus (`Safe` / `Tight` / `Critical`).
- **Shift Simulator (`Shift Check`):** Gebruiker tikt op een dag en test tijdelijk een extra bezet blok (bijv. `+4u` voor een werkshift) om direct zonder op te slaan de impact op alle deadlines te zien.
- **Snel Blok Bezet (`+ Quick Busy Block`):** Tijdelijke handmatige bezet-override in Ember om vertragingen van externe `.ics`-agenda's (zoals Apple → Google) direct op te vangen.

### Taken, Subtaken & Kanban Quest Board
- **Snelle *New Task* modal:** Toont direct alleen de kern (`Title`, `Size`, `Category`, `Priority`). Extra velden (`Hard Deadline`, `Notes`) zitten direct daaronder achter één compacte toggle.
- **Subtaken:** Inklapbaar aan de linkerzijde met voortgangsteller. Deadline is standaard leeg en optioneel (met subtiele hint naar de deadline van de hoofdtaak). Afgevinkte subtaken blijven zichtbaar zolang de hoofdtaak openstaat. Bij laatste subtaak volgt een bevestigingstoast voor de hoofdtaak. Veilige 48u-opschoning verwijdert nooit subtaken van openstaande hoofdtaken.
- **Smart Quest Board (Kanban-principe — max 3 slots):**
  - Berekening op basis van deadline-urgentie, prioriteit (`Low`/`Normal`/`High`), **Aging-boost** (taken zonder deadline klimmen per wachtdag omhoog) en match met het huidige vrije tijdsgat.
  - Slot 1 & 2 kiezen de hoogste urgentie; Slot 3 houdt ruimte voor een prioriteit/no-deadline/quick-win zodra de buffer niet op `Critical` staat. Bij weinig openstaande deadline-taken vullen taken zonder deadline automatisch alle vrije Kanban-plekken op.
  - 1-tik energiefilter bovenaan (`Deep Focus`, `Quick Wins`, `Body/Social`).
- **Keyboard Shortcuts (PC):** `N` (New Task), `Ctrl+Z` (Undo), `Esc` (Sluiten).

## 6. Spelmotor & Psychologie (Fase 2)
Gebaseerd op *Self-Determination Theory* (autonomie boven dwang), *Goal Gradient* en *Flow Theory*:
- **Grootte, Duur & XP:** `XS` (15m · 15 XP), `S` (30m · 35 XP), `M` (1u · 75 XP), `L` (2u · 150 XP), `XL` (3u · 300 XP).
- **Post-Session Focus Slider (`L` / `XL`):** Eerlijke 0–100% focus-slider bij afvinken bepaalt de XP-multiplier.
- **Progressie:** Algemeen Level (`100 * (Level ^ 1.35)`, afgerond op veelvoud van 50) + per categorie een eigen Skill Rank (`Bronze` → `Silver` → `Gold` → `Diamond`).
- **5 Hartjes (HP) & Auto-Hibernate:**
  - HP-verlies uitsluitend bij een echte gemiste harde deadline (`-1`) of een als streng gemarkeerde gemiste Weekly Budget (`-0,5`).
  - **Geen Curses, geen Campfire-boete en geen Sick Day-knop.** Bij afwezigheid/ziekte bevriest **Auto-Hibernate** de HP-klok automatisch; de streak reset eerlijk naar 0 en de speler keert zonder schuldgevoel terug via **`Relight the Fire`**.
  - Herstel: `+0,5` hartje bij een 3-dagen streak of het verslaan van een Boss Quest; vol herstel bij een 7-dagen streak.
- **Boss Quests:** Grote hoofdtaken (`L`/`XL` met subtaken) kunnen als Boss Quest worden gemarkeerd. Elke afgevinkte subtaak slaat zichtbaar HP van de Boss-balk af.
- **Weekly Budgets (Variabele trainingen & Sociaal):** Flexibele weekdoelen (bijv. `Thuistraining · 3x 1u`, `Sociaal · 1x`) die automatisch als tijdsbudget in de Week Radar meetellen. 1-tik `[+ Log]` geeft direct XP en verlaagt het resterende weekbudget. Met een *Light Week*-schakelaar voor examenweken of blessures.
- **The Hearth, Campfire Check-in & Chronicle:**
  - Subtiel levend kampvuur dat meebeweegt met je momentum.
  - Avondlijke **Campfire Check-in** (uitnodiging/buff, geen straf): 2 sliders (`Productivity` & `Energy`, 1–5) + korte 1-regel toelichting.
  - **Chronicle (`users/{uid}/chronicle`):** Permanente opslag van check-ins + dagmetadata (voltooide taken, XP, bufferstatus), inclusief 14-dagen patroongrafiek en JSON-export.

## 7. Bouwfasen (Strikt aanhouden)
- **Fase 1 (Fundering & Model B Motor):** Multi-user Cloudflare Worker (OAuth refresh), Accountinstellingen (Zero Hardcoding), Google Calendar Reader + Deadline Writer, Week Radar, Shift Simulator en Kanban Quest Board.
- **Fase 2 (Spelmotor & Psychologie):** The Hearth, XP/Levels, Skill Ranks, 5 Hartjes + Auto-Hibernate, Boss Quests, Post-Session Slider, Weekly Budgets en Campfire Check-in + Chronicle.
- **Fase 3 (Polish & Juice):** Verfijnde kampvuur-animaties, micro-interacties, subtiele optionele sound-feedback, uitgebreide Chronicle-inzichten en PWA-finishing touch.