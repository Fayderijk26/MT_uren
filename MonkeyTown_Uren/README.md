# Monkey Town Uithoorn · Werkplek

Mobiele urenregistratie voor één vestiging. De demo opent met Mila Vos. Selecteer rechtsboven een fictief profiel om dezelfde dienst vanuit een andere rol te bekijken. De vrij uitprobeerbare demonstratie bewaart gegevens in deze browser. Via **Inloggen met een persoonlijk account** (of `?live=1`) gebruik je gedeelde gegevens in Supabase. Deze routes gebruiken gescheiden gegevensopslag.

## Zelf testen in drie minuten

1. Kies bij **Mijn werkweek** de dienst van gisteren. Klik op het pijltje, neem 09.00 als begintijd, vul 17.45 als eindtijd en 30 minuten pauze in. Dien de **8u 15m** in.
2. Open het profielmenu en kies **Bram Meijer · Dagleiding**. Open **Dagcontrole** op dezelfde datum. Bij Mila zie je het verschil met de geplande 18.00. Keur haar inzending goed.
3. Kies **Noor Post · Bedrijfsleider → Maandstaat → Excel downloaden**. De dienst staat op het tabblad Diensten en telt mee in Mila’s totaal.
4. Test de import via **Noor → Rooster → Excel importeren → Download voorbeeldrooster**. Het voorbeeld heeft als week 9–15 november 2026. Controleer de gekoppelde namen en de codes, sla op en kies die week in het rooster.

## Lokaal op een Mac

Installeer Node.js 24, download de repository en open Terminal in de uitgepakte map. Voor de fictieve demo zijn er geen pakketafhankelijkheden of accounts nodig.

```sh
npm test
npm run build
npm run dev
```

Open http://localhost:5173. Houd de terminal open. De webinterface gebruikt standaard HTML, CSS en JavaScript-modules. Dezelfde bestanden draaien rechtstreeks op GitHub Pages onder de repositorynaam. Logo, illustratie, pictogrammen en Excel-lezer worden lokaal meegestuurd.

## GitHub Pages

Kies in de repository **Settings → Pages**. Bij **Build and deployment** is **Deploy from a branch → main → /(root) → Save** voldoende. De app gebruikt relatieve paden en bevat een .nojekyll-bestand. Het alternatief **GitHub Actions** bouwt uitsluitend de publieke interface naar dist en publiceert met de meegeleverde workflow. Stel bij die route de Source in op GitHub Actions. Voor een bewuste verhuizing naar een nieuw project stel je de publieke variabelen SUPABASE_URL en SUPABASE_KEY in. Geheime API-, SMTP- en serversleutels horen alleen op de server.

## Gedeelde omgeving

Project **Monkey Town Uren Demo** staat in de organisatie **Fayderijk**, regio Frankfurt. De geversioneerde migraties en functies staan in supabase/. Nieuwe inschrijvingen zonder uitnodiging krijgen een inactief profiel. Een bedrijfsleider moet de eerste keer via technisch beheer worden aangewezen. De app heeft een aparte live-modus voor echte accounts. Begin met fictieve namen en eigen testadressen. Voor de mailinstellingen, uitnodigingen, Auth-URL’s, lokale teststack en geplande afsluitmail zie [integratiehandleiding](integration/README.md).

De browserdemo is bruikbaar zonder mail. Voor dagelijkse inzet moeten de live login, roltoewijzing, ontvangst van mails en de verbinding tussen twee apparaten eerst in de bedoelde omgeving zijn gecontroleerd.

[Bouwplan](BOUWPLAN.md) · [Testresultaten](TEST-RAPPORT.md)
