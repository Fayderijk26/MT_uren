# Werkplan voor Monkey Town Uren v2

1. Bouw op v2-eenvoud met een aparte opslag voor fictieve gegevens. De ingang is index.html. Gebruik het bestaande logo en de begroetingsbanner. Zet de primaire actie bij de dienst.
2. Gebruik één record per gepubliceerd tijdsblok. Bewaar conceptwijzigingen en voorstellen apart. Publicatie, akkoord en verlofbesluiten maken in één transactie een nieuwe geldige planning. Controleer overlap per persoon en datum met halfopen intervallen. Behoud de originele dienst bij afwijzing of uitblijvend antwoord.
3. Bewaar uren per dienst, inclusief pauze, status en eventuele controlereden. De medewerker kan dezelfde tijden bevestigen. Goedgekeurde uren zijn vergrendeld. Leid taken rechtstreeks af uit de registraties en aanvragen.
4. Maak een module per pagina. Vandaag toont de eigen dienst of het dagteam, vervolgens maximaal drie open beoordelingen. Een vrije dagleider ziet de eigen volgende dienst en eventuele oude beoordelingen. De bedrijfsleider ziet op Vandaag de uren van vandaag zonder dagleiding. De volledige lijst bevat alle bevoegd beoordeelbare diensten.
5. Bouw Mijn rooster en Teamrooster met datumkeuze. Bouw Gewerkte uren met maandkeuze. Toon bij de bedrijfsleider een conceptweek met publiceren per dag of week.
6. Bouw Vrij & beschikbaarheid met vrij vragen (hele dag, periode of tijdvak), extra beschikbaar en vaste week. Elke wijziging van de vaste week vereist goedkeuring. Bij verlof toont de bedrijfsleider per getroffen dienst de mogelijke overblijvende blokken. Het gekozen resultaat wordt samen met de goedkeuring opgeslagen.
7. Houd de acties gestructureerd. Redenen horen bij een hercontrole, aanvraag of afwijzing. Een gepubliceerd tijdstip buiten de beschikbaarheid vereist een geaccepteerd voorstel. Toon wijzigingen en voorstellen op Vandaag.
8. Test de domeinregels en rolgrenzen en open de nieuwe schermen op telefoonbreedte. Beoordeel de branchdemo vóór het aansluiten van echte accounts. Voor die aansluiting zijn serverautorisatie, transacties en een geteste migratie van bestaande gegevens nodig.

## Demo openen

Kies de branch v2-eenvoud. Voer met Node 24 de volgende opdrachten uit en open http://localhost:5173.

```sh
npm test
npm run build
npm run dev
```

Het demoprofiel bovenaan wisselt tussen Mila (medewerker), Bram (dagleiding) en Noor (bedrijfsleider). De profielen gebruiken dezelfde fictieve planning binnen deze browser. De demo begint op de dag van het eerste bezoek.
