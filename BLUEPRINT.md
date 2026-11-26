# BLUEPRINT — Ember (Gamified Productivity App) — v2

## 1. Visie & Kernprincipe
Een lichtgewicht, gratis Progressive Web App (PWA) die het echte leven (school, werk, training en sociaal) gamifiet via een strakke dopamine-loop. Geen saaie to-do lijst met een pixel-art laagje, maar een volwassen, dynamische Life RPG.

### 2-App Architectuur (Leidend)
- **Ember (Doen & Spelen):** Eigen taken-, gewoonte- en RPG-beheer opgeslagen in **Firebase Firestore** (`users/{uid}/tasks`, habits & profiel).
- **Google Agenda (Overzicht):** One-way sync vanuit Ember naar de primaire Google Agenda (`primary`) via de **Google Calendar API** (`calendar.events` scope). Google Tasks API wordt **niet** meer gebruikt.

## 2. Tech Stack (100% Gratis)
- **Frontend:** React + Vite + Tailwind CSS (mobiel-first, responsive voor PC en iPhone PWA).
- **Hosting:** GitHub Pages.
- **Database & Auth:** Firebase (Spark Plan — Firestore Database + Google Authentication).
- **Agenda-sync:** Google Calendar API (one-way sync van Ember naar primaire Google Agenda).

## 3. Visuele Stijl & Vibe
- **Esthetiek:** "Dark Cozy" Pixel Art gecombineerd met een strakke, volwassen Dark Mode UI (diep donkerblauw, antraciet, obsidian glas-kaarten, warme oranje/koperen kampvuur-accenten, dunne gouden/zilveren randen).
- **Verboden:** Geen pastelkleuren, geen kinderachtige ronde cartoon-knoppen, geen drukke tabbladenbalk onderaan en **geen emoji's** in agenda-titels of UI-labels. Gebruik strakke, universele tekst-notaties (`[DL]`, `[ ]`, `[✓]`) in Google Agenda en Lucide-iconen in de app.
- **Microcopy:** Kort, scherp, motiverend en direct (bijv. *"Boss fight verloren. Tijd voor je Revenge Quest."*).

## 4. Taken, Dagdelen & Google Agenda Sync
In plaats van handmatig tags intypen in een externe app, selecteert de gebruiker bij het aanmaken van een taak in Ember direct een grootte, categorie, optionele werkdag + dagdeel en/of harde deadline (twee aparte velden). Taken ondersteunen geneste subtaken, een Undo-toast bij afvinken en automatisch mee-afvinken van de hoofdtaak zodra de laatste subtaak af is.

### Google Agenda Weergave (in primaire agenda `primary`)
- **Harde Deadlines:** Syncen als hele-dag-event bovenaan de deadline-dag met titel `[DL] <titel>` en vaste Google Calendar kleur `colorId: "11"` (Tomaat).
- **Werkmomenten:** Syncen als concreet tijdsblok met titel `[ ] <titel>` zonder losse `colorId` (zodat het blok automatisch de custom HEX-kleur `#C97B4B` van de primaire agenda overneemt). Bij afvinken verandert de titel naar `[✓] <titel>`.
- Eén taak met zowel een werkdag als een harde deadline maakt dus twee gekoppelde agenda-items aan die synchroon blijven bij bewerken, swappen of afvinken.

### Slimme Dagdelen & Automatische Duur
- **Voormiddag:** `09:00 – 12:00` (3u)
- **Namiddag:** `13:00 – 16:00` (3u)
- **Avond:** `18:30 – 22:00` (3u30)
- **Nacht:** `22:00 – 24:00` (2u)
- **Automatische duur op basis van taakgrootte:** `XS` = 15 min, `S` = 30 min, `M` = 1u, `L` = 2u, `XL` = 3u.
- **Automatisch aansluiten & Vol-dagdeel bescherming:** Taken binnen hetzelfde dagdeel sluiten automatisch achter elkaar aan. Past een nieuwe taak niet meer in het venster, dan stopt de app netjes met een melding en twee keuzes: **Ander dagdeel kiezen** of **Passend maken (Auto-fit)** (blokken proportioneel verkleinen op stappen van 15 min, met een harde ondergrens van 15 min per taak).
- **Directe 1-op-1 Swap:** Klik op Swap bij Taak A en tik op Taak B om direct hun dagdeel, positie en Google Agenda-tijden om te wisselen zonder de rest van de lijst te verschuiven.

## 5. Grootte, XP, Gewoontes & Straffen
Taken krijgen een grootte (`XS` t/m `XL`) en categorie (bijv. `Studie`, `Health`, `Projecten`, `Sociaal`, `Thuis`).

| Grootte | Automatische Duur | Voorbeeld | XP Beloning |
| :--- | :--- | :--- | :--- |
| `XS` | 15 min | Kleine routine (bed opmaken, vitamines) | 15 XP |
| `S` | 30 min | Korte mail, kleine opdracht | 35 XP |
| `M` | 1 uur | Hoofdstuk leren, oefeningenreeks | 75 XP |
| `L` | 2 uur | Zware opdracht, groot stuk project | 150 XP |
| `XL` | 3 uur | Mega Quest (examen-voorbereiding, volledig deelproject) | 300 XP |

- **Grote taken (`L` / `XL`):** Geen verplichte Pomodoro-timer. Bij afvinken volgt een **Post-Session Review** (eerlijkheidsslider 0–100% focus) die de uiteindelijke XP-multiplier bepaalt.
- **Tactical Shift (Geplande werkdag gemist, deadline nog niet voorbij):**
  - 1e keer verplaatsen tijdens het Campfire Checkpoint = **gratis** (geen HP-verlies).
  - 2e keer verplaatsen van exact dezelfde taak = **-0,5 hartje** (rem op uitstelgedrag).
- **Harde deadline gemist:** Altijd **-1 vol hartje**, ongeacht de grootte van de taak.
- **Vaste Gewoontes & Wekelijkse Quests (puur in Ember, geen agenda-vervuiling):**
  - **Vaste Gewoontes:** Terugkerende afspraken op vaste dagen (bijv. Muay Thai) met 1-tik afvinken voor XP en een *Rustdag*-optie bij ziekte.
  - **Wekelijkse Quests:** Flexibele weekdoelen zonder vaste uren (bijv. `Thuistraining 0/3`, `Sociaal / Iets leuks doen 0/1`) met een 1-tik `[+ Log]` knop voor directe XP, een kleine weekbonus bij behalen, en een optionele HP-straf (`-0,5` of `-1` hartje) bij de zondagse weekreset als het doel niet gehaald is.

## 6. Progressie, HP & Game Over
- **Algemeen Level:** Eén groot getal. Exponentiële curve: `Benodigde XP = 100 * (Level ^ 1.35)`, afgerond op het dichtstbijzijnde veelvoud van 50.
- **Categorie Tiers:** Per categorie een badge/rank (Brons, Zilver, Goud, Diamant) zichtbaar op de Player Card.
- **HP-systeem:** 5 hartjes (met halve hartjes = 10 stappen).
  - Gemist Campfire Checkpoint = -1 vol hartje.
  - Herstel: Boss Fight winnen of 7-dagen streak halen. (Géén 'streak freezes' of items die luiheid belonen).
- **Boss Fights:** Op algemene level-mijlpalen (bijv. elke 10 levels). Dynamische challenge op basis van openstaande taken binnen 24–48 uur. Falen = **Curse** (-50% XP tot een Redemption Task is gehaald).
- **0 HP (Game Over):** Harde reset (terug naar bodem van huidige tier/level-straf + actieve buffs weg). De **Legacy Player Card** (hoogste level, langste streak, badges) blijft behouden, en de speler krijgt direct een makkelijke **Revenge Quest** om weer op gang te komen.

## 7. De Dagelijkse Loop & Meta-Game
- **Anti-Cheat Streak:** Minstens 1 taak/quest afvinken ÉN het Campfire Checkpoint voltooien = Streak +1.
- **Drie-eenheid op de vaste 2D Map (geen oneindig scrollen):**
  1. **Tussendoor (Actief):** 1 Daily Encounter op de map na de eerste voltooide taak.
  2. **'s Avonds (Ritueel):** **Campfire Checkpoint** (Tactical Shifts bepalen, inhaalslag kleine taken + 2 sliders 1–5 voor *Productiviteit* en *Energie/Gevoel* + subtiele *Chronicle*-knop voor 14-dagen grafiek & JSON-export) + **De Reizende Handelaar** (wisselende gear/upgrades kopen met verdiend goud).
  3. **Altijd zichtbaar (Passief):** Gebouwen en paden upgraden visueel van ruïne naar fort op dezelfde vaste map, met automatische seizoenseffecten op basis van de datum.
- **Character:** Simpele basiskeuze bij start (huidskleur, silhouet, basiskleur); status-gear vrijspelen via goud. Waypoint-beweging over paden naar locaties (Kampvuur, Bibliotheek, Gym, etc.).

## 8. Bouwfasen (Strikt aanhouden)
- **Fase 1 (Skelet, Eigen Taken & Agenda Sync):** Google Login, Firestore profiel, eigen takenbeheer in Firestore (met subtaken, dagdelen, harde deadlines, Undo, auto-complete hoofdtaak, vol-dagdeel bescherming en 1-op-1 Swap) + one-way sync naar Google Agenda.
- **Fase 2 (Spelmotor):** XP/Level-curve, 5 hartjes, Tactical Shift & deadline-straffen, categorie-tiers, Post-Session Review, Vaste Gewoontes & Wekelijkse Quests, Campfire Checkpoint & Chronicle.
- **Fase 3 (De Map & Juice):** Vaste 2D Dark Cozy Map, wandelend poppetje, Reizende Handelaar, Daily Encounters, Boss Fights, seizoenen, animaties/juice en Player Card.