# Monkey Town · Werkplek v2

Eenvoudige proefapp voor één vestiging, op de branch `v2-eenvoud`. Eva is bedrijfsleider, Iris en Sylvia zijn dagleiding, Elise en Isis zijn medewerkers. Gegevens blijven lokaal in de browser. De profielkeuze is een demonstratiefunctie, geen beveiligde login.

## Starten en testen

Node.js 24, zonder pakketafhankelijkheden:

```sh
npm test
npm run build
npm run dev
```

De build bevat alleen index.html, style.css, ui.js, assets en v2. GitHub Pages publiceert de actieve branch via de bestaande workflow. De oude implementatie en bijbehorende tests staan in `legacy/` en worden niet gebouwd of getest.

## Wat is beschikbaar

- Vandaag: eigen ontbrekende uren voor iedere rol; leiding ziet ook ontbrekende teamuren en beoordelingen.
- Uren: maandtotalen, wekelijkse regels, beoordeling, aanpassing met reden en versiegeschiedenis. Goedkeuring bewaart persoon en tijdstip. Alleen bedrijfsleider kan goedgekeurde uren heropenen.
- Maandadministratie: CSV met totalen en uurregels, contractnorm en verschil, afsluiten en heropenen met reden. Norm is contracturen per week / 7 per kalenderdag, rekening houdend met ingangsdatums. Dit is een expliciete proefberekening, geen cao-engine.
- Teamrooster: weekraster op grote schermen en daglijst op smalle schermen; conceptweek uit vaste beschikbaarheid of vorige week, publicatie, toestemming buiten beschikbaarheid.
- Mijn rooster: rustige maandkalender met dagdetails; weekweergave.
- Beschikbaarheid: vrij vragen, vaste dagen en aanvragen. Redenen blijven zichtbaar.
- Medewerkers: naam, rol, actiefstatus, telefoon, e-mail en contracturen. Openingstijden per weekdag staan centraal.

## Indeling

`model.js` valideert acties. `planning.js` regelt concepten en voorstellen. `administration.js` regelt personen, maandafsluiting en export. `storage.js` verzorgt opslag en migraties. Pagina's en dialogen hebben eigen kleine modules. `settings.js` is de bron voor openingstijden.

## Grenzen van de proefapp

Er is geen gedeelde database of persoonlijke login aangesloten in v2. Rollen en contactgegevens zijn alleen in de interface afgeschermd; lokale opslag is geen beveiligingsgrens. Gebruik nog geen echte personeelsadministratie. 'Uitnodiging voorbereiden' opent een concept in je eigen mailprogramma en maakt geen account. Bel- en WhatsApp-knoppen openen de betreffende app; ze versturen niets automatisch. Vul telefoonnummers zelf in bij Medewerkers.

Voor gelijktijdig gebruik op verschillende apparaten moeten authenticatie, gedeelde opslag en serverrechten nog worden aangesloten. De oude Supabase-code in `legacy/` wordt niet gebruikt door v2.
