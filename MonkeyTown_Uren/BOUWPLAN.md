# Monkey Town · Bouwplan en testchecklist urenregistratie

**Versie 1 · 12 november 2026 · Ter beoordeling door Fay**  
**Status:** ontwerp. Alle vakjes staan open. Afvinken gebeurt pas bij de bouw, op basis van een uitgevoerde controle. De eerste oplevering is een testversie met fictieve medewerkers voor één vestiging.

## 1. Wat gaat Fay straks openen?

| Onderdeel | Waarvoor dient het? | Wie gebruikt het? |
|---|---|---|
| GitHub-repository met uitsluitend publiceerbare code en fictieve voorbeelden | Bewaart de broncode, databasewijzigingen, automatische tests en deze checklist. Elke oplevering krijgt een herkenbare versie. | Fay en de ontwikkelaar |
| Supabase Free, regio Frankfurt | Bewaart accounts, planning, registraties, goedkeuringen en wijzigingshistorie. Hier controleert de database wie iets mag lezen of wijzigen. | De app. Technisch beheer via het dashboard. |
| Demo op GitHub Pages | Serveert de interface via één HTTPS-testlink. Voorgestelde techniek is React, TypeScript en Vite. | Medewerkers, dagleiding en bedrijfsleider |
| Excel | Levert het huidige rooster aan. Aan het einde van de maand levert de app een nieuw bestand op met goedgekeurde uren. | Bedrijfsleider |

**Voor jouw eerste test:** open de testlink in Safari op je iPhone, log in als testmedewerker en vul een dienst in. Open de link op je laptop met een apart testaccount voor de dagleiding. Je ziet zo aan beide kanten precies wat er gebeurt. Je laptop hoeft niet aan te blijven om de gedeelde website te gebruiken.

## 2. Wie mag wat?

Iedereen logt in met een eigen account. De app zoekt de actieve rol op. Een gebruiker kiest zijn rol nooit zelf bij het inloggen. Een leidinggevende die vandaag als gewone medewerker werkt, behoudt toegang tot de eigen uren. De extra dagrechten gelden voor de toegewezen datum.

| Handeling | Medewerker | Dagleiding | Bedrijfsleider / baas |
|---|---|---|---|
| Eigen rooster, uren en status bekijken | Ja | Ja | Ja |
| Eigen dienst indienen of corrigeren | Ja | Ja | Ja |
| Daglijst met uren van collega’s zien | Nee | Toegewezen dag | Alle dagen van de vestiging |
| Uren van anderen goedkeuren of terugsturen | Nee | Toegewezen dag | Alle dagen van de vestiging |
| Eigen uren goedkeuren | Nee | Nee | Nee, tweede bevoegde beoordelaar |
| Feitelijke ruil, invaller of vervallen dienst op daglijst verwerken | Nee | Toegewezen dag, met historie | Ja |
| Rooster importeren, vooraf wijzigen en dagleiding aanwijzen | Nee | Nee | Ja |
| Medewerkers uitnodigen, deactiveren, contracten en rollen beheren | Nee | Nee | Ja |
| Maand afsluiten, heropenen en vestigingsoverzicht exporteren | Nee | Nee | Ja |

- [ ] De eerste bedrijfsleider wordt eenmalig via technisch beheer ingesteld. Volgende rolwijzigingen zijn beperkt tot een actieve bedrijfsleider en worden gelogd. De laatste actieve bedrijfsleider kan zichzelf niet verwijderen of degraderen.
- [ ] Een bedrijfsleider die zelf uren schrijft, krijgt een tweede bevoegde beoordelaar. Als die ontbreekt, blijven de uren zichtbaar openstaan.
- [ ] Dezelfde persoon kan vaste uren of een nulurencontract hebben bij elke rol. Bewaar contracttype, uren en ingangsdatum apart. Een contractwijziging mag historische maanden niet herschrijven.

## 3. Rooster en daglijst

- [ ] Bewaar per geplande dienst een vaste dienst-ID, medewerker-ID, datum, begintijd, eindtijd en status. Twee losse diensten op één dag zijn mogelijk.
- [ ] In Excel betekent een **lege eindtijd 18.00 uur**. Een expliciete eindtijd, bijvoorbeeld 15.30 uur, blijft 15.30 uur. Controleer de tijdvolgorde bij diensten met tijden. Kantoor zonder tijd, vrij gevraagd en stand-by zijn geldige roostervermeldingen.
- [ ] Toon vóór import een voorbeeld met datum, gekoppelde medewerker, tijden en eventuele fouten. Bij twee medewerkers met dezelfde voornaam kiest de bedrijfsleider de juiste persoon. Onbekende namen krijgen geen automatisch account.
- [ ] Gebruik de weekmatrix uit Rooster_Week41.xlsx als referentie. Op Blad1 staan medewerkers onder elkaar en maandag tot en met zondag naast elkaar. Lees de echte datum onder de dagnaam (hier 8–14 oktober 2018). Sla lege werkbladen, de titel en aantallen partijtjes over. Een lege dagcel geeft geen geplande dienst.
- [ ] Herken Excel-tijdwaarden en tekst met spaties. Voorbeelden zijn 11:00 → 11:00–18:00, 08:30/15:00 → 08:30–15:00 en 10:00-15:00 → 10:00–15:00. Bewaar “openen” uit 09:30/openen als roosterinformatie. Dit kent geen rechten toe.
- [ ] Herken onderstaande roostercodes automatisch in de importpreview. Behoud de oorspronkelijke celtekst. Laat onbekende combinaties beoordelen voordat ze een urenherinnering veroorzaken.

| Roostercel | Verwerking |
|---|---|
| x | Niet beschikbaar wegens vrij gevraagd. Er wordt geen dienst verwacht. De import boekt geen verlofuren. |
| K:10:00 | Geplande keukendienst van 10.00 tot 18.00 uur. |
| SB of K SB | Stand-by, bij K SB voor de keuken. De daglijst toont de stand-bystatus. |
| SB met tijd, eventueel met K | Bewaar de tijd als uiterste moment waarop de medewerker hoort of die moet komen werken. Houd dit los van de begintijd. Pas bij oproep met afgesproken werktijden wordt een dienst verwacht. Zonder oproep ontstaan geen ontbrekende inzending of gewerkte uren. |
| kantoor | De medewerker staat als aanwezig op kantoor op de daglijst. Laat de werkelijke tijden bij indiening invullen. Zonder gepland einde kan de dienst geen tijdgestuurde herinnering opleveren. |
| 15:00-sluit of kantoor 15:00-sluit | Start om 15.00 uur, einde op sluitingstijd (standaard 18.00 uur), met verantwoordelijkheid voor afsluiten. Bewaar kantoor als werkplek wanneer vermeld. |
| kantoor/vloer v.a 12:00 | Neem kantoor/vloer over als werkplek en 12.00 uur als start. De gebruikelijke eindtijdregel geldt. |

- [ ] Openen en sluiten zijn taken op de dienst. Alleen de afzonderlijke aanwijzing als dagleiding geeft de bijbehorende bevoegdheden.
- [ ] Maak voor de deelbare demo een nieuw fictief werkboek met dezelfde indeling en notaties. Houd het oorspronkelijke personeelsrooster buiten de repository, build en gedeelde demo.
- [ ] Bij herimport toont de app welke diensten nieuw, gewijzigd of onduidelijk zijn. Een identieke tweede import voegt niets toe. Ambigue wijzigingen en verdwenen regels vragen een expliciete keuze. De bevestigde import slaagt in één keer of laat de oude planning intact.
- [ ] Bewaar ingediende uren apart van de planning. Bij een ruil na indiening blijven de oorspronkelijke inzending en persoon gekoppeld. De dagleiding krijgt de uitzondering te zien.
- [ ] Een invaller zonder rooster kan een extra dienst indienen. Deze krijgt het label ‘Ongepland’ en volgt dezelfde goedkeuring. Vervallen of overgedragen diensten veroorzaken geen herinnering voor de oorspronkelijke medewerker.
- [ ] Een ontbrekende registratie wordt afgeleid uit de planning. Vóór het geplande einde staat ‘Verwacht’. Daarna staat ‘Ontbreekt’ zolang er geen inzending of afgehandelde uitzondering is. Een teruggestuurde inzending krijgt een eigen status.
- [ ] Wijs per dag een verantwoordelijke aan. Bij ontbreken van een aanwijzing ziet de bedrijfsleider de open dag. Bij overdracht verhuizen de dagrechten en openstaande taken mee.

## 4. Uren invullen en betrouwbaar bewaren

- [ ] Het scherm toont datum, start, einde, werkelijke onbetaalde pauze in minuten, netto werktijd en één knop ‘Indienen’. Geplande tijden worden vooraf ingevuld en blijven aanpasbaar. De medewerker hoeft geen werkzaamheden te omschrijven.
- [ ] Een pauze van nul is toegestaan. Een leeg veld vraagt om een keuze. Gebruik hele minuten. Weiger negatieve pauzes en pauzes die even lang of langer zijn dan de totale dienst. Bij een dienst zonder gewerkte minuten kan de dagleiding de afwezigheid of annulering registreren.
- [ ] Bereken op de server: werkelijk einde min werkelijk begin min werkelijke onbetaalde pauze. Een kortere dienst verandert de pauze alleen als de medewerker ook daadwerkelijk korter pauze hield. Geen automatische aftrek op grond van het rooster.
- [ ] Eis een positieve duur, geen werkelijke eindtijd in de toekomst en geen overlappende werkregistraties van dezelfde medewerker. Aansluitende diensten mogen wel. Voor het prototype vallen begin en einde op dezelfde lokale kalenderdag. Bij een nachtdienst volgt een duidelijke melding.
- [ ] Gebruik Europe/Amsterdam voor roosterdatums, daggrenzen, meldingen en de maandindeling. Bewaar tijdstippen met tijdzone en totalen in gehele minuten. Weiger bij een klokverzet een dubbelzinnig of niet-bestaand lokaal tijdstip tot het tijdstip expliciet kan worden vastgesteld.
- [ ] De server bepaalt medewerker-ID, indienmoment en status uit de ingelogde sessie. Manipulatie van netto-uren, eigenaar of status in een browseraanvraag levert geen boeking op.
- [ ] Bij dubbel tikken, verversen of opnieuw versturen na een verbroken verbinding ontstaat één inzending. Toon ‘Ingediend’ na bevestiging door de server. Bij een fout blijven de ingevulde velden beschikbaar zolang het scherm open is.
- [ ] Zorg dat een dubbele import, tweede tab, gelijktijdige correctie of twee beoordelaars geen uren verdubbelen. Gebruik unieke sleutels, transacties en een versienummer voor wijzigingen.

## 5. Goedkeuren, terugsturen en melden

- [ ] Dagcontrole toont per persoon gepland en werkelijk begin/einde, pauze, netto-uren, afwijking en status. Een dag met open punten blijft herkenbaar, ook nadat alle beschikbare inzendingen zijn goedgekeurd.
- [ ] Een beoordelaar keurt een specifieke versie goed. Als een collega ondertussen iets wijzigt, moet de beoordelaar eerst de nieuwe tijden zien. Goedkeuring en historievermelding worden samen opgeslagen.
- [ ] Bij terugsturen kiest de beoordelaar een korte reden, bijvoorbeeld ‘Controleer je pauze’. De medewerker ziet wat aangepast moet worden. Een wijziging na goedkeuring maakt een nieuwe versie met status ‘Te beoordelen’. De oude goedkeuring blijft terugvindbaar. Alleen de actuele goedgekeurde versie telt.
- [ ] Bewaar per gebeurtenis de handelende persoon, dienst, versienummer, tijdstip, actie en gewijzigde waarden. Gewone accounts kunnen de historie niet aanpassen of wissen.
- [ ] Voorgesteld voor versie 1: een melding in de app én een afsluitmail aan de dagverantwoordelijke op een instelbaar lokaal tijdstip na sluiting. Een herinnering aan een medewerker verwijst alleen naar de eigen ontbrekende dienst. Een mail bevat een link naar de app, zonder de urenlijst van collega’s.
- [ ] Een geplande servertaak werkt ook als alle telefoons dicht zijn. Controleer kort voor verzending opnieuw op ruil, annulering en alsnog ingediende uren. Registreer de verzendstatus per ontvanger en taak. Bij tijdelijke mailstoring blijven daglijst en in-appmelding bruikbaar. Voorkom dubbele meldingen bij herhaling van de taak.
- [ ] Een late inzending na de afsluitmelding opent opnieuw een beoordelingstaak. Laat die aan de huidige verantwoordelijke zien. Een ontbrekende dagverantwoordelijke valt terug op de bedrijfsleider.

## 6. Maandstaat en contracturen

- [ ] Toon goedgekeurde uren, nog te beoordelen uren en ontbrekende diensten afzonderlijk. Een open maand kan een voorlopige export hebben. Definitief afsluiten lukt pas als open punten zijn opgelost of als uitzondering met reden zijn verantwoord.
- [ ] Nulurencontract: tel de actuele goedgekeurde werkminuten per persoon op. Vaste contracturen: toon daarnaast de periodennorm, bevestigde meetellende afwezigheidsuren en het verschil. Toon het verschil als saldo. Besluit over uitbetalen of tijd voor tijd valt buiten dit prototype.
- [ ] De bedrijfsleider kan voor de demo per medewerker en maand een expliciete norm en apart bevestigde afwezigheidsuren vastleggen, met historie. Een ontbrekende norm geeft ‘Norm ontbreekt’. Gebruik geen vaste aanname van 160 uur per maand. Bij een contractwissel geldt een expliciet vastgestelde norm voor de betreffende periode.
- [ ] Voorbeeld: norm 160 uur, 154 uur goedgekeurd gewerkt en 8 uur meetellend verlof geeft +2 uur. Afwezigheidsuren verschijnen in een eigen kolom. Het totaal ‘gewerkt’ blijft 154 uur.
- [ ] Excel-export bevat een tab per-dienst met medewerker-ID, naam, datum, begin, einde, pauze en netto werktijd en een samenvatting per medewerker. Maak uren boven 24 uur leesbaar als duur. Exporteer numerieke tijdwaarden, controleer sommen en schrijf namen als tekst, ook wanneer ze met een formuleteken beginnen.
- [ ] Afgesloten maanden zijn vergrendeld voor invoer, importwijzigingen met effect op de maand en correcties. Heropening is alleen mogelijk door de bedrijfsleider met reden. Bewaar de vorige afsluitversie en onderscheid een herziene export.
- [ ] Volgende fase: vrije dagen aanvragen, goedkeuren, terugkoppelen en saldo bijwerken. Neem ‘niet beschikbaar’ en ‘betaald verlof’ als verschillende keuzes op. Gebruik één bron voor verlofuren om dubbeltelling met de handmatig vastgelegde afwezigheid te voorkomen.

## 7. Beveiligingscheck voor de codeschrijver

- [ ] Gebruik persoonlijke accounts op uitnodiging. Zet openbare registratie uit. Controleer de actieve rol en eventuele dagtoewijzing bij elke gevoelige actie, ook zolang een oudere sessie nog geldig is.
- [ ] Gebruik Supabase Auth voor wachtwoorden, sessies, uitnodigingen en wachtwoordherstel. Beperk toegestane terugkeeradressen tot de bedoelde testomgeving. Test verlopen, hergebruikte en ongeldige links, afmelden en inloggen na een reset.
- [ ] Zet Row Level Security aan op alle via de API toegankelijke bedrijfstabellen. Definieer lezen en schrijven per rol en eigenaar. Controleer ook views, exports en databasefuncties. Een verborgen knop is slechts interfacegedrag.
- [ ] Houd rol, goedkeuring, contractnorm en auditvelden buiten direct door medewerkers schrijfbare gegevens. Leid identiteit af uit de servercontext. Controleer bij beheerdersfuncties de aanvrager vóór gebruik van verhoogde rechten. Beperk uitvoerrechten op zulke functies.
- [ ] De frontend krijgt uitsluitend de project-URL en de publieke sleutel. Bewaar geheime server- en mailsleutels in beheerde secrets. Controleer Git-geschiedenis, build en logs op geheimen. Plaats geen wachtwoorden, herstelcodes of volledige personeelslijsten in logs.
- [ ] Deactiveren beëindigt toegang tot bedrijfsgegevens, ook met een eerder verkregen token. Behoud eerder geregistreerde uren. Test wisselen van account op dezelfde telefoon op achtergebleven persoonsgegevens.
- [ ] Voer zowel positieve als negatieve tests uit met echte, afzonderlijke testsessies. Probeer ook direct via de API met andermans ID te lezen, wijzigen, goedkeuren en exporteren. Controleer na elke weigering dat de gegevens gelijk zijn gebleven.
- [ ] Gebruik fictieve namen en testadressen. Beperk exports tot bevoegde gebruikers en sla ze niet op als openbaar bestand. Herstel een proefback-up in een aparte testomgeving en vergelijk diensten, historie en maandsommen.

## 8. Acceptatietests vóór overdracht

Elke rij krijgt na uitvoering een resultaat, datum, geteste versie en bewijs. Onderstaande getallen zijn de verwachte uitkomsten.

| ID | Wat ik daadwerkelijk moet proberen | Verwachte uitkomst |
|---|---|---|
| T01 | Importeer testrooster. Fay 09.00 met leeg einde, Sam 10.00–15.30. Importeer opnieuw. | Eindtijden 18.00 en 15.30. Exact twee diensten. |
| T02 | Importeer twee keer dezelfde voornaam, fout tijdstip en gewijzigde rij met bestaande inzending. | Onduidelijke rij zichtbaar, geen stille overschrijving of half verwerkte import. |
| T03 | Dien als Fay via het telefoonscherm 09.00–18.00 met 30 minuten pauze in. Log opnieuw in. | 510 minuten, zichtbaar als 8 u 30. Dezelfde waarden na herladen. |
| T04 | Wijzig einde naar 17.45 met 30 minuten pauze. Probeer daarna 15 minuten pauze. | Eerst 495 minuten (8 u 15), daarna 510 minuten (8 u 30). |
| T05 | Test 12.00–12.30 met pauze 0, 29, 30, 31, −1, 2,5 en leeg. | Alleen 0 en 29 geldig, respectievelijk 30 minuten en 1 minuut gewerkt. |
| T06 | Probeer gelijke tijden, einde vóór begin, toekomstig einde en een dienst over middernacht. | Duidelijke foutmelding en geen opgeslagen registratie. |
| T07 | Registreer twee aansluitende diensten en probeer een derde die overlapt. | Eerste twee tellen elk eenmaal, overlap geweigerd. |
| T08 | Tik twee keer, onderbreek het netwerk na versturen en probeer opnieuw. | Eén registratie en één indienactie. Status komt overeen met de database. |
| T09 | Laat één ingeplande persoon niets invullen, ruil een dienst en registreer een invaller. | Alleen de werkelijk ontbrekende persoon krijgt een herinnering. Invaller zichtbaar ter controle. |
| T10 | Draai de afsluitcontrole tweemaal, wissel de dagleiding, simuleer mailstoring en dien laat in. | Juiste ontvanger, geen dubbele taak, fout zichtbaar en late inzending beoordeelbaar. |
| T11 | Medewerker, niet-ingelogde bezoeker en dagleider van morgen proberen via directe API andermans gegevens te lezen/wijzigen of te exporteren. | Geen personeelsgegevens of mutatie. Eigen gegevens voor de ingelogde medewerker wel toegankelijk. |
| T12 | Manipuleer rol, eigenaar, netto-uren, auditvelden en status. Probeer zelfgoedkeuring met elk roltype. | Geen extra rechten, valse boeking of zelfgoedkeuring. Tweede bevoegde beoordelaar kan wel aftekenen. |
| T13 | Meld aan via uitnodiging, herstel wachtwoord, hergebruik link, deactiveer medewerker bij open sessie. | Uitnodiging en herstel werken één keer. Oude sessie toont na deactivatie geen bedrijfsgegevens meer. |
| T14 | Open een dienst in twee vensters. Wijzig of accordeer gelijktijdig. Stuur terug en dien opnieuw in. | Geen verloren wijziging, laatste versie krijgt eigen goedkeuring en geschiedenis klopt. |
| T15 | Boek 510 en 345 minuten voor dezelfde medewerker plus één open dienst. | Export geeft 855 minuten = 14 u 15. De open dienst zit niet in het goedgekeurde totaal. |
| T16 | Test vaste norm 160 uur met 154 + 8 uur, nulurencontract, ontbrekende norm en een contractwissel. | +2 uur volgens de voorbeeldnorm, apart gewerkt totaal, ontbrekende norm zichtbaar en historie intact. |
| T17 | Sluit een maand, probeer alsnog te wijzigen, heropen met reden en maak een herziene export. | Wijziging eerst geweigerd. Oude en nieuwe afsluiting zijn afzonderlijk herkenbaar. |
| T18 | Test lokale maandgrens, klokverzet, totaal boven 24 uur en een naam die begint met =. | Dienst in juiste maand, ongeldige tijd geweigerd, Excel toont duur en letterlijke naam. |
| T19 | Test dagleiding zonder toewijzing, bedrijfsleider die het rooster wijzigt en overdracht bij afwezigheid. | Dagrechten volgen de actuele toewijzing, bedrijfsleider kan alle dagen beheren. |
| T20 | Open de gedeelde HTTPS-link op mobiel formaat en desktop. Doorloop aanmelden, indienen, aftekenen en downloaden. | Alle acties werken op de gedeelde versie. Export heropend en vergeleken met bronregistraties. |
| T21 | Herstel de testdatabase uit een proefback-up. Controleer de belangrijkste rollen, diensten en maandstaat. | Dezelfde gegevens en restricties na herstel. Beschrijf apart hoe accounts en secrets worden hersteld. |
| T22 | Importeer het fictieve weekrooster met de notaties uit week 41, lege cellen en vrije tekst. Herhaal dezelfde import. | Juiste kalenderdatums en tijden, onduidelijke cellen expliciet afgehandeld, nul dubbele diensten of spookmeldingen. |
| T23 | Controleer de publieke demo op een iPhone vanaf de project-URL, met een testcode en een verlopen code. Inspecteer repository en gepubliceerde bestanden. | Juiste rol en scherm na geldige login, verlopen code geweigerd. Alleen fictieve voorbeelden en publieke configuratie zichtbaar. |
| T24 | Importeer x, K:10:00, SB, K SB en SB 12:00. Roep één stand-by-medewerker op voor 13.00–17.00 en laat een ander vrij. | x geeft geen verwachte dienst of verlofboeking. Keuken staat op 10.00–18.00. De berichtdeadline 12.00 blijft apart. Alleen de opgeroepen medewerker wordt voor de afgesproken tijden verwacht. |
| T25 | Importeer kantoor, 09:30/openen en kantoor 15:00-sluit voor medewerkers zonder dagtoewijzing. | Kantoor toont aanwezigheid zonder verzonnen begintijd. De sluitdienst loopt standaard van 15.00 tot 18.00. Zowel openen als sluiten blijven zichtbaar zonder extra goedkeuringsrechten. |

## 9. Hoe bouwen, starten en opleveren na akkoord?

1. **Lokaal ontwikkelen.** Na akkoord maak ik de app, een fictief rooster en afzonderlijke testaccounts. De repository krijgt een Nederlandstalige README met exacte ondersteunde versies en commando’s voor installatie, starten en testen.
2. **Lokaal draaien op een Mac.** Beoogde route vanuit de projectmap: installeer Node.js en een Docker-compatibele omgeving, start die omgeving, voer vervolgens afzonderlijk npm ci, npx supabase start en npm run dev uit. Vul in .env.local de lokale project-URL en publieke sleutel uit de startuitvoer in. Open de lokale URL uit de terminal. Het project krijgt één gedocumenteerde stap voor fictieve accounts en het voorbeeldrooster. Een reset met testdata is uitsluitend bedoeld voor de wegwerpbare lokale database.
3. **Automatisch testen.** Controleer databasewijzigingen vanaf een lege lokale database. Draai reken-, rol- en beleidstests, browserproeven en de productiebuild. Corrigeer gevonden fouten en herhaal de betrokken tests plus de volledige basisflow.
4. **Gedeelde testomgeving aansluiten.** Gebruik één apart Supabase Free-project in Frankfurt. Pas de geversioneerde databasewijzigingen toe op het gecontroleerde testproject, installeer serverfuncties en de meldingstaak, en stel de toegestane website-URL in. De dashboardlogin blijft bij de technisch beheerder.
5. **Demo publiceren.** GitHub Free ondersteunt Pages voor een openbare repository. Maak daarvoor na akkoord een repository met uitsluitend publiceerbare bestanden. Bouw de interface via GitHub Actions met npm run build en publiceer dist met het juiste repository-basispad. Alleen de publieke Supabase-configuratie gaat mee in de browser. Gebruik fictieve profielen en voor de Pages-demo een persoonlijke eenmalige inlogcode per e-mail via Supabase. Test uitnodiging en wachtwoordherstel met de afgesproken wachtwoordflow lokaal. Bij overstap naar Cloudflare Pages kan hetzelfde Supabase-testproject blijven bestaan. Werk basispad, site-URL en toegestane terugkeerlinks bij en test uitnodiging, login en herstel opnieuw op het nieuwe domein.
6. **Mail testen.** Lokaal testen we uitnodiging en herstel in een testpostvak. Voor aflevering aan externe testadressen configureren we eigen SMTP voor Supabase Auth. De afsluitmail krijgt een aparte verzendactie met servergeheim. Test echte ontvangst bij een aangewezen testadres, inclusief openen van de link. Op Free kan een inactief project pauzeren. Bij een gepauzeerde testomgeving opent de beheerder het Supabase-dashboard en kiest Resume.
7. **Overdracht aan Fay.** Je krijgt de geteste HTTPS-link, toegang tot afzonderlijke testrollen via een veilige route, voorbeeldrooster, korte testinstructies en ingevuld testrapport. Daarin staat per test wat lokaal en wat op de gehoste versie is gecontroleerd, met versie, datum en bewijs. Een controle die externe accounttoegang vereist en niet uitgevoerd kon worden, blijft expliciet ‘geblokkeerd’. Zolang een vereiste controle openstaat, is het prototype niet volledig getest.

**Jouw eerste praktijktest:** open de link als medewerker, kort de dienst in tot 17.45, vul 30 minuten pauze in en verstuur. Keur op de laptop als dagleiding de 8 u 15 goed. Open als bedrijfsleider de export en controleer of diezelfde 8 u 15 terugkomt. Probeer daarna als medewerker je goedgekeurde dienst te corrigeren en kijk of de dagleiding opnieuw moet aftekenen.

## 10. Voorstellen die Fay bij beoordeling kan wijzigen

De werkafspraken in deze versie zijn één vestiging zonder vestigingsveld, locatiekeuze of vestigingsbeheer, diensten binnen dezelfde kalenderdag, één dagverantwoordelijke met de bedrijfsleider als vervanger, controle van de eigen uren door een tweede persoon en een instelbare afsluitmail naast de melding in de app. Voor vaste contracten voeren we de norm eerst expliciet in. Vrije dagen aanvragen volgt na de urenpilot. Voor het voorbeeldrooster en de tests gebruiken we fictieve gegevens.

## Technische bronnen

- [Supabase · regio’s](https://supabase.com/docs/guides/platform/regions)
- [Supabase · Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase · lokale ontwikkeling](https://supabase.com/docs/guides/local-development) en [databasetests](https://supabase.com/docs/guides/local-development/cli/testing-and-linting)
- [Supabase · mail en eigen SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase · pauzeren van gratis projecten](https://supabase.com/docs/guides/platform/free-project-pausing) en [back-ups](https://supabase.com/docs/guides/platform/backups)
- [Cloudflare Pages · Git-integratie](https://developers.cloudflare.com/pages/get-started/git-integration/)

- [GitHub Pages · beschikbaarheid en gebruiksgrenzen](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
