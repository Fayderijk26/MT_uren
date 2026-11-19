# Monkey Town Uren: werkregels voor Claude Code

Dit bestand wordt bij elke sessie gelezen. Lees daarna `docs/SPEC.md` (wat de app doet, wat besloten is, en de lijst met rondes).

## Wat dit project is
Een kleine web-app waarmee medewerkers van Monkey Town Uithoorn hun uren invullen en leidinggevenden die goedkeuren. Drie rollen: Medewerker, Leidinggevende en Bedrijfsleider. De eigenaar is geen programmeur. Leg wijzigingen dus uit in gewone taal.

## Waar staat wat
- `v2/model.js`: **alle regels van de app** in één functie, `apply(db, actorId, actie, gegevens)`. Hier staat wie wat mag, wat geldig is en wat er gebeurt. Gebruik de hulpfuncties (`today`, `add`, `mayReview`, `leads`, `check`, enzovoort) die er al zijn.
- `v2/app.js`: de schil (opslaan, laden, navigatie). `v2/today.js`, `hours.js`, `roster.js`, `week.js`, `calendar.js`, `availability.js`, `view.js`: de pagina's. Ze maken HTML uit de data en bevatten **geen regels**.
- `v2/pilot.js`: demodata voor de proef.
- `tests/v2.test.mjs`: de tests van het model.
- `index.html`, `style.css`, `v2/style.css`, `ui.js`, `assets/`: de pagina en opmaak.
- `legacy/`: de oude versie (sinds ronde 1). **Niet aanraken**, niet gebruiken en niet kopiëren.
- `excel/`: de Excel-parser voor roosters. Blijft staan, want die komt terug bij de import (ronde 6).

## Commando's
- `npm test`: alle tests. Moet groen zijn voor elke commit.
- `npm run dev`: de site lokaal.
- `npm run build`: bouwt de site (`dist`) voor GitHub Pages.

## Werkregels
1. **Regels staan alleen in `model.js`.** Pagina's laten alleen zien en roepen `apply` aan. Zet nooit een regel (wie mag wat, wat is toegestaan) in een pagina.
2. **Eén ding, één plek.** Reken uit wat uit te rekenen is (ontbrekende uren, wie dagleiding is, wie vrij is) in plaats van het op te slaan. Sla geen afgeleide dingen op.
3. **Geen nieuwe lagen.** Pas bestaande functies aan en vervang ze niet door een kopie. Voeg geen wrapper, compatibiliteitslaag of tweede systeem toe voor iets dat al bestaat. Komt er een nieuw veld of nieuwe tabel/lijst in `db`, zeg dat dan eerst en zet het in `docs/SPEC.md`.
4. **Eerst de test, dan de code.** Elke wijziging in gedrag krijgt een scenariotest in `tests/` met een zin in gewone taal als naam ("Elise vergeet haar uren: leiding ziet het"). Geen wijziging zonder test.
5. **Klein werken.** Eén taak per sessie en per pull request. Maak eerst een kort plan en wacht op goedkeuring van de eigenaar. Gaat een taak groter worden dan gevraagd, stop dan en meld het.
6. **Tijd:** alles in `Europe/Amsterdam`, tijden op een kwartier. Gebruik `today()` uit `model.js`.
7. **Geen geheimen en geen echte persoonsgegevens in de repository.** Geen wachtwoorden, sleutels, telefoonnummers of echte namen. Gebruik nepnamen in `pilot.js`.
8. **Taal:** alle teksten voor gebruikers in het Nederlands. Korte, duidelijke zinnen. Gebruik "Aanpassen vragen" (niet "terugsturen").
9. **Code:** korte regels (maximaal ±120 tekens), geen lange samengeplakte strings, kleine functies, en laat bestanden één taak houden. Verander geen opmaak van code die je niet aanpast.
10. **Bij twijfel vragen.** Verzin geen regel. Staat iets niet in `docs/SPEC.md`, vraag het aan de eigenaar.

## Als je klaar bent
- Draai `npm test`.
- Leg in 3 tot 6 zinnen uit wat er veranderd is, wat de eigenaar zelf moet proberen (concreet: welke pagina, welke knop, wat hoort er te gebeuren) en wat je niet hebt kunnen controleren.
- Noem wat je bewust niet hebt gedaan.
