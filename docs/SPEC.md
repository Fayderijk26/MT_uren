# Monkey Town Uren: wat de app doet en wat er nog moet gebeuren

Dit is het ontwerp. Wijzigt iets in het gedrag van de app, pas dan eerst dit bestand aan (met toestemming van de eigenaar) en bouw daarna.

Bron: de eenvoudige versie (`v2/`), samen met de beslissingen uit de gesprekken met de eigenaar. De delen onder "Nog te bouwen" zijn **nog niet gebouwd**.

---

## 1. Doel
Medewerkers vullen hun gewerkte uren in. De leiding keurt ze goed. Niemand vergeet iets, en aan het eind van de maand staan de uren klaar voor de loonadministratie. Het moet snel en overzichtelijk zijn op een telefoon.

**Ontwerpprincipe voor de schermen:** wat wil je zien als je de app opent? Eerst: *wanneer heb ik dienst?* Dan: *wat moet ik nog doen en welke aanvragen lopen er?*

## 2. Rollen
| Rol | Wat mag die |
|---|---|
| **Medewerker** | Eigen rooster, uren invullen, vrij vragen, beschikbaarheid doorgeven, reageren op voorstellen. Ziet alleen eigen gegevens. |
| **Leidinggevende** | Als Medewerker. Is **dagleiding** op de dagen dat hij of zij zelf dienst heeft: beoordeelt dan de uren van iedereen die dag. Kan niet plannen of publiceren. Mag ook de eigen uren goedkeuren. |
| **Bedrijfsleider** (meerdere mogelijk) | Alles. Maakt het rooster, publiceert, beoordeelt altijd (op elke dag), beslist over aanvragen. Mag de eigen uren goedkeuren. |

**Dagleiding** wordt uitgerekend: wie leidinggevende is en die dag een dienst heeft. Er wordt niets handmatig aangewezen. Er mogen op één dag **meerdere dagleidingen** zijn. Zij kunnen allemaal de uren van iedereen van die dag goedkeuren, ook de eigen uren.

## 3. Wat de app nu doet (gebouwd)
- **Rooster:** de bedrijfsleider maakt concept-diensten en publiceert ze per dag. Medewerkers zien alleen gepubliceerde diensten. Diensten mogen aansluiten maar niet overlappen.
- **Uren:** een medewerker vult begin, eind en pauze in (pauzeknoppen 0, 15, 30, 45, 60 minuten). De leiding keurt goed of vraagt aanpassen, met een reden. Goedgekeurde uren zijn vergrendeld. Afwijkingen van het rooster zijn zichtbaar ("Volgens rooster" als het klopt).
- **Ongeplande dienst:** een medewerker kan een extra gewerkte dienst met uren indienen. De leiding keurt goed of wijst af, met reden.
- **Stand-by:** een stand-bydienst heeft een uiterste tijd voor een besluit en wordt eenmalig afgehandeld (oproepen of vrijgeven).
- **Vrij vragen:** voor een dag of periode. De bedrijfsleider keurt goed of wijst af. Bij bestaande diensten in die periode wordt bij goedkeuren gekozen wat ermee gebeurt. Te late aanvragen (minder dan drie weken vooruit) worden niet geblokkeerd maar gemarkeerd voor de bedrijfsleider.
- **Beschikbaarheid:** vaste dagen en tijden per medewerker (ook om de week), en "extra beschikbaar" voor een losse dag. Een wijziging van de vaste dagen moet door de bedrijfsleider worden goedgekeurd.
- **Voorstellen:** is een dienst buiten iemands beschikbaarheid, dan staat er een basisdienst binnen de beschikbaarheid en een voorstel voor de rest. De medewerker antwoordt ja, nee of met andere tijden.
- **Tijden** zijn altijd op een kwartier. Tijdzone `Europe/Amsterdam`.
- **Pagina's:** Vandaag, Rooster (voor medewerkers: Mijn rooster met kalender), Uren, Vrij en beschikbaarheid.
- De gegevens staan nu in de browser (`localStorage`) en zijn **niet gedeeld** tussen mensen. Dat is alleen geschikt voor een demo (zie ronde 8).

## 4. Besluiten van de eigenaar (blijven staan)
1. Berichten tussen mensen in de app zijn **bewust weggelaten**. Bij problemen bellen of WhatsAppen ze.
2. Kantoordienst bestaat niet als aparte soort: een dienst is een dienst.
3. Bedrijfsleiders en leidinggevenden mogen hun eigen uren goedkeuren. Op één dag mogen meerdere dagleidingen de uren van iedereen goedkeuren.
4. Bij uren heet de actie **"Aanpassen vragen"** (niet terugsturen). Afwijzen is alleen voor ongeplande diensten en voorstellen.
5. Vrij vragen: minimaal drie weken vooruit. Alleen een goedgekeurde aanvraag telt als vrij.
6. Voor uren die precies met het rooster overeenkomen komt een knop **"Alles goedkeuren"**.
7. De maandnorm wordt berekend uit de contracturen en is niet handmatig in te typen (een bedrijfsleider mag overschrijven, met reden).
8. Herinneringen: een overzichtsmail aan de leiding en medewerkers op dagen dat ze dienst hebben, en een tweede herinnering de volgende dag om 09:00.
9. Terugdateren van ongeplande diensten en het invullen van ontbrekende uren kan **zolang de maand nog niet is afgesloten**. Er is verder geen limiet.
10. Tijden blijven **per kwartier**.
11. Uren heropenen mag **alleen de bedrijfsleider**, met een reden, en **nooit na het afsluiten van de maand**.
12. De knop **"Herinner via WhatsApp"** komt er, voor de bedrijfsleider én voor de dagleiding. Hij opent WhatsApp met een ingevulde tekst. Telefoonnummers worden bewaard, zijn alleen zichtbaar voor leiding en bedrijfsleider, staan alleen in de echte database en **nooit in de repository**.
13. **Openingstijden:** elke dag 09:00–17:30 (voor bezoekers). Medewerkers werken vaak van 08:30 (openen) tot 18:00 (opruimen en schoonmaak). Daarom is de **werkdag** 08:30–18:00: dat is de standaardtijd van een nieuwe dienst en van "hele dag beschikbaar". Wie korter werkt, past de tijden aan.
14. Voor later: pushmeldingen (wens), collega's zien in het rooster, ziek en verlof, toeslagen.

## 5. Nog niet besloten (vraag het de eigenaar, bouw niet op een gok)
- Als iemand om 13:00 uren tot 13:00 indient en daarna doorwerkt: mag hij de uren dan nog **aanpassen zolang ze niet zijn beoordeeld**? (Nu kan een ingediende regel pas worden aangepast nadat de leiding "Aanpassen vragen" heeft gedaan.) En krijgt de leiding een waarschuwing als uren eindigen vóór het geplande einde van de dienst?
- Besluit 9 gaat ervan uit dat ontbrekende uren ingevuld mogen worden tot het afsluiten van de maand (dus ook in de eerste dagen van de volgende maand). Klopt dat?

## 6. Nog te bouwen, in rondes
Eén ronde is één pull request (of een paar kleine). Na elke ronde probeert de eigenaar het zelf en loopt de tests door.

**Ronde 1: opruimen**
- Oude code naar `legacy/` (`app.js`, `manager.js`, `demo.js`, `availability.js`, `contract.js` in de hoofdmap, `supabase/`, `integration/`, `tests/demo.test.mjs`). `excel/` blijft.
- De tijden als **één instelling** (`TIMES` in `model.js`) in plaats van losse tekst `'08:30'` en `'18:00'` in meerdere bestanden: openingstijden voor bezoekers 09:00–17:30, werkdag 08:30–18:00 (zie besluit 13). De namen in `pilot.js` blijven zoals ze zijn (besluit van de eigenaar).
- Oude migratiecode (`read()` en `migratePilot` in de schil) eruit, zodra de eigenaar bevestigt dat oude browserdata niet nodig is. (Nog niet gedaan: blijft voorlopig staan.)
- *Klaar als:* `npm test` groen, de site werkt, geen verwijzing meer naar `legacy/`.

**Ronde 2: ontbrekende uren zichtbaar**
- Leiding en bedrijfsleider zien op Vandaag een kaart "Uren ontbreken (N)": per persoon de dag en hoeveel dagen te laat. Ook de eigen ontbrekende uren (nu zien leiding en bedrijfsleider die niet).
- Op de tab Uren een lijst "Ontbreekt".
- Bij elke persoon met ontbrekende uren een knop **"Herinner"** voor de bedrijfsleider en de dagleiding. Die opent WhatsApp met de tekst "Hoi {naam}, wil je je uren van {dag} nog invullen?". Telefoonnummers staan in de demo als nepnummers. Echte nummers komen via ronde 7 en 8, nooit in de repository.
- Ontbrekende uren kunnen worden ingevuld zolang de maand niet is afgesloten.
- *Scenario:* Elise vergeet haar uren van dinsdag. Woensdag ziet zij "Nog in te vullen"; Eva (bedrijfsleider) en Sylvia (leiding die dinsdag werkte) zien "Uren ontbreken (1)". Als Elise invult, verdwijnt het bij iedereen.

**Ronde 3: regels rond uren**
- Uren mogen al **tijdens de dienst** worden ingediend, maar de **eindtijd mag niet later zijn dan het huidige tijdstip** (`Europe/Amsterdam`). Voorbeeld: iemand staat tot 16:00 ingepland en wil om 13:00 al uren invullen. Dat kan, maar dan tot en met 13:00 en niet tot 16:00. Voor een dag in het verleden mag de eindtijd elke tijd zijn. Hetzelfde geldt voor een ongeplande dienst: het einde mag niet in de toekomst liggen.
- *Scenario:* het is 13:00 en Elise staat tot 18:00 ingepland. Zij vult 08:30–13:00 in en dat lukt. 08:30–16:00 wordt geweigerd met de uitleg dat de eindtijd niet later kan zijn dan nu.
- De bedrijfsleider (alleen die) kan goedgekeurde uren heropenen, met reden. Dat kan nooit meer nadat de maand is afgesloten (zie ronde 4). Leidinggevenden kunnen niet heropenen.
- Bewaar bij goedkeuring door wie en wanneer, en laat dat zien. Dat geldt ook als iemand zijn eigen uren goedkeurt.
- Een leidinggevende mag de eigen uren goedkeuren. **Nu is dat geblokkeerd** (`mayReview` in `model.js` weigert dat voor een leidinggevende). Pas dat aan. Meerdere dagleidingen op één dag werken al: controleer met een test dat ze allebei de uren van iedereen kunnen goedkeuren.
- *Scenario:* Iris en Sylvia hebben allebei dienst. Iris keurt de uren van Elise goed, Sylvia de uren van Iris, en Iris mag ook haar eigen uren goedkeuren.
- Waarschuwing (niet blokkeren) bij pauze 0 bij een lange dag.
- *Scenario:* Eva heropent goedgekeurde uren van Elise met reden "pauze klopte niet". Elise ziet "Aanpassen", past aan, dient opnieuw in. De leiding ziet wie eerder goedkeurde.

**Ronde 4: maandoverzicht**
- Contracturen per medewerker (nodig voor de norm). Bedrijfsleider ziet per persoon: goedgekeurd, nog open, norm, verschil.
- Export (CSV of Excel) voor de loonadministratie. Maand afsluiten: vergrendelt de uren van die maand. Daarna kan niemand (ook de bedrijfsleider niet) uren van die maand nog invullen, aanpassen of heropenen.
- *Scenario:* de bedrijfsleider sluit november af. Er staan nog uren open: de app waarschuwt en toont wie.

**Ronde 5: interface**
- Tabbalk onderaan op een telefoon, met aantal-bolletjes (Uren, Aanvragen).
- **Vandaag** is voor iedere rol op dezelfde manier opgebouwd, vanuit de vraag *wat wil je zien als je de app opent?*
  1. **Bovenaan: wanneer heb ik dienst.** Eerst "Mijn dienst vandaag" of, als er vandaag geen is, "Eerstvolgende dienst". Dit staat altijd als eerste.
  2. **Daaronder: wat moet ik nog doen en welke aanvragen lopen er.** Bijvoorbeeld uren invullen, een voorstel beantwoorden, een lopende vrij-aanvraag, en voor leiding en bedrijfsleider uren die ontbreken, uren die beoordeeld moeten worden en aanvragen waarop ze moeten reageren.
  3. **Daarna de rest**, zoals voor leiding wie er vandaag werkt en de roosterwijzigingen.
- Teamrooster: dagweergave op een telefoon, weekraster op een groter scherm.
- Kalender: in de maandweergave alleen een stip en het dagnummer. Tekst in het venster bij tikken.
- Eén set statuschips met kleur en tekst. Tijdkeuze: begin en eind vooraf ingevuld met rooster, met −15 en +15 minuten, live "Netto 8u 30m".
- De keuzelijst "Demoprofiel" alleen in de demo.

**Ronde 6: rooster-gemak**
- Kopieer vorige week als concept. Maak concept uit vaste beschikbaarheid. Excel-import (met `excel/`) als concept. "Alles goedkeuren" voor uren die exact met het rooster overeenkomen.

**Ronde 7: medewerkers beheren**
- Toevoegen, rol wijzigen, op inactief zetten, contracturen en telefoonnummer invullen (nummer alleen zichtbaar voor leiding en bedrijfsleider). Meerdere bedrijfsleiders netjes ondersteunen (meldingen niet alleen naar de eerste).

**Ronde 8: gedeelde opslag en inloggen (apart project)**
- Nu staat alles in de browser. Voor echt gebruik: Supabase met inloggen en één plek voor de gegevens. Dezelfde `model.js` draait op de server (de gebruiker wordt bepaald uit het login-token, niet uit een keuzelijst) en de server stuurt alleen terug wat die rol mag zien. Versienummer tegen tegelijk schrijven. Een testproject met nepgegevens.
- Daarna de mails (dagoverzicht en 09:00-herinnering) en eventueel pushmeldingen.
- **Tot dit klaar is, mogen er geen echte medewerkersgegevens in de app.**

## 7. Woordenlijst
- **Concept:** diensten die nog niet zichtbaar zijn voor medewerkers. **Publiceren** maakt ze zichtbaar.
- **Dagleiding:** de leidinggevende met een dienst op die dag.
- **Aanpassen vragen:** de leiding vraagt de medewerker de uren te corrigeren.
- **Voorstel:** een vraag aan een medewerker of zij ook (op andere tijden) wil werken.
- **Ongeplande dienst:** een dienst die niet in het rooster stond maar wel is gewerkt.
