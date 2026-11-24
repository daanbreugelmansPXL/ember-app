# BLUEPRINT — Gamified Productivity App

## 1. Visie & Kernprincipe
Een lichtgewicht, gratis Progressive Web App (PWA) die Google Tasks als taken-backend gebruikt en het echte leven gamifiet via een strakke dopamine-loop. Geen saaie to-do lijst met een pixel-art laagje, maar een volwassen, dynamische game-hub.

## 2. Tech Stack (100% Gratis)
- **Frontend:** React + Vite + Tailwind CSS (mobiel-first, responsive voor PC en iPhone PWA).
- **Hosting:** GitHub Pages.
- **Database & Auth:** Firebase (Spark Plan — Firestore Database + Google Authentication).
- **Taken-sync:** Google Tasks API (two-way sync: lezen en afvinken).

## 3. Visuele Stijl & Vibe
- **Esthetiek:** "Dark Cozy" Pixel Art gecombineerd met een strakke, volwassen Dark Mode UI (diep donkerblauw, antraciet, obsidian glas-kaarten, warme oranje kampvuur-accenten, dunne gouden/zilveren randen).
- **Verboden:** Geen pastelkleuren, geen kinderachtige ronde cartoon-knoppen, geen drukke tabbladenbalk onderaan.
- **Microcopy:** Kort, scherp, motiverend en direct (bijv. *"Boss fight verloren. Tijd voor je Revenge Quest."*).

## 4. Tags, XP & Omgekeerde Straffen
Taken worden in Google Tasks getagd met een grootte (`#XS` t/m `#XL`) en een categorie (bijv. `#studie`, `#health`, `#projecten`, `#sociaal`). De app stript deze tags in de weergave.

| Tag | Voorbeeld | XP Beloning | Straf bij gemiste deadline |
| :--- | :--- | :--- | :--- |
| `#XS` | Kleine routine (bed opmaken, vitamines) | 15 XP | -1 vol hartje |
| `#S` | Korte mail, kleine opdracht | 35 XP | -1 vol hartje |
| `#M` | Workout, Muay Thai, hoofdstuk leren | 75 XP | -1 vol hartje |
| `#L` | Zware opdracht, groot stuk project | 150 XP | -0,5 hartje |
| `#XL` | Mega Quest (examen, volledig project) | 300 XP | -0,5 hartje |

- **Grote taken (`#L` / `#XL`):** Geen verplichte Pomodoro-timer. Bij afvinken volgt een **Post-Session Review** (eerlijkheidsslider 0–100% focus) die de uiteindelijke XP-multiplier bepaalt.

## 5. Progressie, HP & Game Over
- **Algemeen Level:** Eén groot getal. Exponentiële curve: `Benodigde XP = 100 * (Level ^ 1.35)`, afgerond op het dichtstbijzijnde veelvoud van 50.
- **Categorie Tiers:** Per categorie een badge/rank (Brons, Zilver, Goud, Diamant) zichtbaar op de Player Card.
- **HP-systeem:** 5 hartjes (met halve hartjes = 10 stappen).
  - Gemist Campfire Checkpoint = -1 vol hartje.
  - Herstel: Boss Fight winnen of 7-dagen streak halen. (Géén 'streak freezes' of items die luiheid belonen).
- **Boss Fights:** Op algemene level-mijlpalen (bijv. elke 10 levels). Dynamische challenge op basis van openstaande taken binnen 24–48 uur. Falen = **Curse** (-50% XP tot een Redemption Task is gehaald).
- **0 HP (Game Over):** Harde reset (terug naar bodem van huidige tier/level-straf + actieve buffs weg). De **Legacy Player Card** (hoogste level, langste streak, badges) blijft behouden, en de speler krijgt direct een makkelijke **Revenge Quest** om weer op gang te komen.

## 6. De Dagelijkse Loop & Meta-Game
- **Anti-Cheat Streak:** Minstens 1 taak afvinken ÉN het Campfire Checkpoint voltooien = Streak +1.
- **Drie-eenheid op de vaste 2D Map (geen oneindig scrollen):**
  1. **Tussendoor (Actief):** 1 Daily Encounter op de map na de eerste voltooide taak.
  2. **'s Avonds (Ritueel):** **Campfire Checkpoint** (inhaalslag kleine taken + 2 sliders 1–5 voor *Productiviteit* en *Energie/Gevoel* + subtiele *Chronicle*-knop voor 14-dagen grafiek & JSON-export) + **De Reizende Handelaar** (wisselende gear/upgrades kopen met verdiend goud).
  3. **Altijd zichtbaar (Passief):** Gebouwen en paden upgraden visueel van ruïne naar fort op dezelfde vaste map, met automatische seizoenseffecten op basis van de datum.
- **Character:** Simpele basiskeuze bij start (huidskleur, silhouet, basiskleur); status-gear vrijspelen via goud. Waypoint-beweging over paden naar locaties (Kampvuur, Bibliotheek, Gym, etc.).

## 7. Bouwfasen (Strikt aanhouden)
- **Fase 1 (Skelet & Sync):** Google Login, Google Tasks inladen/afvinken, basisprofiel opslaan in Firestore.
- **Fase 2 (Spelmotor):** Tag-parser, XP/Level-curve, 5 hartjes, straffen, categorie-tiers, Post-Session Review, Campfire Checkpoint & Chronicle.
- **Fase 3 (De Map & Juice):** Vaste 2D Dark Cozy Map, wandelend poppetje, Reizende Handelaar, Daily Encounters, Boss Fights, seizoenen en Player Card.