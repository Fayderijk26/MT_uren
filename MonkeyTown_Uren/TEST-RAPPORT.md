# Testresultaten · 12 november 2026 · prototype 0.1.0

De lokale browserproef gebruikte de demoprofielen. De PostgreSQL-proeven gebruikten verschillende databasesubjecten in de rol authenticated. Dat toetst de serverautorisatie. Het versturen van echte e-mails en inloggen met een door Supabase uitgegeven e-mailcode hebben afzonderlijke praktijktests nodig.

| Test | Uitkomst en bewijs |
|---|---|
| T01 | Eindtijdregel en herimport gecontroleerd in roostercode- en demo-tests. Voorbeeld bevat 18 vakken. |
| T02 | Onbekende codes en atomair terugdraaien gecontroleerd. De preview biedt naamkoppeling en controle op dubbele keuzes. Een volledige handmatige dubbele-voornaamproef staat open. |
| T03 | Rekenproef 510 minuten geslaagd. Browseruitvoering op telefoonhardware en herlogin met persoonlijke code staan open. |
| T04 | 495 en 510 minuten gecontroleerd. Browserproef met 30 minuten leverde 8u 15m. |
| T05–T07 | Pauzegrenzen, ongeldige tijden, toekomstige eindtijd, klokverzet, overlap en aansluitende diensten getest in tests/demo.test.mjs. |
| T08 | Herhaling met hetzelfde aanvraagnummer in PostgreSQL leverde één registratie en versie op. Een echte netwerkonderbreking op een telefoon staat open. |
| T09 | Afwezigheid, ruil en ongeplande dienst getest in lokale scenario’s. |
| T10 | Wisseling van dagleiding, storing, deduplicatie, annulering en retry gecontroleerd met SQL en een gesimuleerde maildienst. Echte bezorging staat open. |
| T11–T12 | Directe tabellen ontoegankelijk, anonieme functies geblokkeerd, andere dienst afgeschermd, rolverhoging en zelfgoedkeuring geweigerd, tweede beoordelaar toegestaan. Zie supabase/tests/permissions.sql. Aanvallen met echte Auth-sessies via HTTP blijven een aparte proef. |
| T13 | Sessie- en herstelgedrag getest met gesimuleerde Auth. Open zijn uitnodiging, herstel en opnieuw aanmelden met de echte mailbox. |
| T14 | Versieconflicten, correctie na akkoord, terugsturen en historie gecontroleerd. |
| T15 | Browserproef van indienen tot Excel, met maandtotaal 37u → 45u 15m. Excel-bestanden onafhankelijk heropend. Combinatietest met 510 + 345 minuten en één open dienst gaf exact 855 goedgekeurde minuten. |
| T16 | Contracthistorie, vaste norm en maandvergrendeling getest met lokale scenario’s. |
| T17 | Sluiten, reden voor heropening en verschillende exportversies gecontroleerd. |
| T18 | Klokverzet in rekentests, Excel-uren boven 24 uur en namen met formuleteken gecontroleerd. |
| T19 | Dagleiding per datum, overdracht en beheerdersrechten gecontroleerd. |
| T20 | Volledige browserproef in de ontwikkelpreview. Openstaande afzonderlijke proef met iPhone/Safari en persoonlijke accounts op twee apparaten. |
| T21 | Lokale PostgreSQL-proefdatabase gedumpt en in nieuwe database teruggezet. Data vergeleken, drie auditregels en 510 actuele minuten teruggevonden. Anonieme RPC en directe authenticated-tabeltoegang bleven geweigerd. Auth-providerinstellingen vereisen apart herstel. |
| T22 | Origineel weekrooster bevatte 39 ingevulde vakken, alle 39 herkend. Fictief bestand met 18 vakken en lege testweek gecontroleerd. |
| T23 | Publieke bestanden bevatten fictieve voorbeelden en de publieke clientsleutel. Fysieke iPhone, echte OTP en verlopen OTP op Pages staan open. |
| T24–T25 | Stand-by met deadline, daadwerkelijke oproep, kantoor zonder tijden, openen en sluiten getest. Geen dagrechten door een taaklabel. |

## Herhalen

- Node.js 24: npm test controleert roostercodes, demogegevens, Auth en mailfuncties.
- In een lege PostgreSQL-testdatabase: laad supabase/tests/auth-fixture.sql, daarna supabase/migrations/*.sql op volgorde. Voer permissions.sql en notifications.sql met psql -v ON_ERROR_STOP=1 uit. De twee scenario’s draaien hun wijzigingen terug. Gebruik de auth-fixture uitsluitend op kale PostgreSQL, omdat Supabase zelf het auth-schema levert.
- integration/check-local-auth.mjs is beschikbaar voor de lokale Supabase-stack met Mailpit. De actuele externe mail- en apparaatproeven staan hierboven expliciet open.
