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
9. Terugdateren van ongeplande diensten en het invullen van ontbrekende uren kan **zolang de maand nog niet is afgesloten**, dus ook in de eerste dagen van de volgende maand. Er is verder geen limiet.
10. Tijden blijven **per kwartier**.
11. Uren heropenen mag **alleen de bedrijfsleider**, met een reden, en **nooit na het afsluiten van de maand**.
12. De knop **"Herinner via WhatsApp"** komt er, voor de bedrijfsleider én voor de dagleiding. Hij opent WhatsApp met een ingevulde tekst. Telefoonnummers worden bewaard, zijn alleen zichtbaar voor leiding en bedrijfsleider, staan alleen in de echte database en **nooit in de repository**.
13. **Openingstijden:** elke dag 09:00–17:30 (voor bezoekers). Medewerkers werken vaak van 08:30 (openen) tot 18:00 (opruimen en schoonmaak). Daarom is de **werkdag** 08:30–18:00: dat is de standaardtijd van een nieuwe dienst en van "hele dag beschikbaar". Wie korter werkt, past de tijden aan.
14. **Ingediend is ingediend.** De medewerker kan ingediende uren niet zelf aanpassen. Dat kan alleen nadat de leiding "Aanpassen vragen" heeft gedaan (zo werkt het nu al). Eindigen de uren vóór het geplande einde van de dienst, dan krijgt de leiding een **waarschuwing** (niet blokkeren).
15. Voor later: pushmeldingen (wens), collega's zien in het rooster, ziek en verlof, toeslagen.

## 5. Nog niet besloten (vraag het de eigenaar, bouw niet op een gok)
- Op dit moment geen open vragen voor de bouw.

**Te bespreken met het bedrijf** (voorlopig gebouwd zoals hieronder; aanpassen zodra het bedrijf beslist):
- **Maandnorm:** nu contracturen per week × 52 ÷ 12 (elke maand gelijk). Klopt dat met hoe het bedrijf rekent?
- **Ziekte en verlof:** tellen nu niet mee voor de norm (vrij verandert de norm niet). Hoe wil het bedrijf dit?
- **Loonperiode en afsluiten:** nu per kalendermaand; een maand kan dicht vanaf de 1e van de volgende maand. Mogelijk loopt de loonperiode van de 21e tot de 20e. Navragen.

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
- Bij elke persoon met ontbrekende uren een knop **"Herinner"** voor de bedrijfsleider en de dagleiding. Die opent WhatsApp met de tekst "Hoi {naam}, wil je je uren van {dag} nog invullen?". Een persoon in `db.people` kan een veld `phone` hebben (nieuw veld). In de demo is dat leeg: "Herinner" opent WhatsApp dan met de tekst maar zonder ontvanger, en je kiest zelf het contact. Zo kan een verzonnen nummer nooit bij een echt persoon uitkomen. Echte nummers komen via ronde 7 en 8, nooit in de repository.
- Ontbrekende uren kunnen worden ingevuld zolang de maand niet is afgesloten.
- *Scenario:* Elise vergeet haar uren van dinsdag. Woensdag ziet zij "Nog in te vullen"; Eva (bedrijfsleider) en Sylvia (leiding die dinsdag werkte) zien "Uren ontbreken (1)". Als Elise invult, verdwijnt het bij iedereen.

**Ronde 3: regels rond uren** (in twee delen: 3a goedkeuren en heropenen, 3b tijdregels en waarschuwingen)
- Uren mogen al **tijdens de dienst** worden ingediend, maar de **eindtijd mag niet later zijn dan het huidige tijdstip** (`Europe/Amsterdam`). Voorbeeld: iemand staat tot 16:00 ingepland en wil om 13:00 al uren invullen. Dat kan, maar dan tot en met 13:00 en niet tot 16:00. Er is **15 minuten speling**: om 12:50 mag 13:00 al worden ingevuld. Voor een dag in het verleden mag de eindtijd elke tijd zijn. Hetzelfde geldt voor een ongeplande dienst: het einde mag niet in de toekomst liggen.
- *Scenario:* het is 13:00 en Elise staat tot 18:00 ingepland. Zij vult 08:30–13:00 in en dat lukt. 08:30–16:00 wordt geweigerd met de uitleg dat de eindtijd niet later kan zijn dan nu.
- De bedrijfsleider (alleen die) kan goedgekeurde uren heropenen, met reden. Dat kan nooit meer nadat de maand is afgesloten (zie ronde 4). Leidinggevenden kunnen niet heropenen.
- Bewaar bij goedkeuring door wie en wanneer, en laat dat zien. Dat geldt ook als iemand zijn eigen uren goedkeurt.
  Nieuwe velden bij ingediende uren (`db.hours`): `approvedBy` (wie), `approvedAt` (wanneer), `reopenedBy` (wie heropende). Bij heropenen en opnieuw indienen blijven `approvedBy` en `approvedAt` staan, zodat de leiding ziet wie eerder goedkeurde.
- De bedrijfsleider opent uren van anderen via het weekrooster: dienst aantikken, dan "Uren bekijken".
- Een leidinggevende mag de eigen uren goedkeuren. **Nu is dat geblokkeerd** (`mayReview` in `model.js` weigert dat voor een leidinggevende). Pas dat aan. Meerdere dagleidingen op één dag werken al: controleer met een test dat ze allebei de uren van iedereen kunnen goedkeuren.
- *Scenario:* Iris en Sylvia hebben allebei dienst. Iris keurt de uren van Elise goed, Sylvia de uren van Iris, en Iris mag ook haar eigen uren goedkeuren.
- Waarschuwing (niet blokkeren) bij pauze 0 bij een lange dag: **meer dan 5,5 uur** gewerkt (Arbeidstijdenwet).
- Waarschuwing voor de leiding (niet blokkeren) als de uren eindigen vóór het geplande einde van de dienst (besluit 14).
- *Scenario:* om 13:00 dient Elise 08:30–13:00 in en werkt daarna door. Zij kan haar ingediende uren niet zelf aanpassen. De leiding ziet een waarschuwing dat de uren eerder eindigen dan het rooster en kiest "Aanpassen vragen". Daarna past Elise de eindtijd aan en dient opnieuw in.
- *Scenario:* Eva heropent goedgekeurde uren van Elise met reden "pauze klopte niet". Elise ziet "Aanpassen", past aan, dient opnieuw in. De leiding ziet wie eerder goedkeurde.

**Ronde 4: maandoverzicht**
- Contracturen per medewerker (nodig voor de norm). Bedrijfsleider ziet per persoon: goedgekeurd, nog open, norm, verschil.
- Export (CSV of Excel) voor de loonadministratie. Maand afsluiten: vergrendelt de uren van die maand. Daarna kan niemand (ook de bedrijfsleider niet) uren van die maand nog invullen, aanpassen, goedkeuren of heropenen.
- Twee delen: **4a** maandoverzicht, norm en Excel-export (alleen goedgekeurde uren); **4b** maand afsluiten.
- **Norm:** contracturen per week × 52 ÷ 12. De bedrijfsleider kan de norm per persoon per maand overschrijven, met reden.
- **Afsluiten:** alleen de bedrijfsleider, en pas vanaf de 1e van de volgende maand. Staan er nog uren open, dan eerst een waarschuwing met wie; daarna bevestigen.
- **Noodknop:** een afgesloten maand gaat niet meer open, behalve via een noodknop voor de bedrijfsleider, met reden. Dat wordt vastgelegd.
- **Nieuwe velden:** `contractHours` bij een persoon (uren per week); `db.normOverrides` (lijst van `{user, month, minutes, reason, by}`); `db.closedMonths` (lijst van `{month, by, at}`); `db.monthReopens` (lijst van `{month, by, at, reason}`, het logboek van de noodknop).
- *Scenario:* de bedrijfsleider sluit november af. Er staan nog uren open: de app waarschuwt en toont wie.

**Ronde 5: interface** (in drie delen: 5a tabbalk en Vandaag, 5b teamrooster, 5c statuslabels)
- Tabbalk onderaan op een telefoon (Vandaag, Rooster, Uren, Aanvragen), met aantal-bolletjes. **Uren:** eigen uren nog in te vullen of aan te passen, plus voor leiding en bedrijfsleider de uren die zij moeten beoordelen. **Aanvragen:** voor een medewerker de voorstellen om te beantwoorden; voor de bedrijfsleider de aanvragen en voorstellen om over te beslissen.
- **Vandaag** is voor iedere rol op dezelfde manier opgebouwd, vanuit de vraag *wat wil je zien als je de app opent?*
  1. **Bovenaan: wanneer heb ik dienst.** Eerst "Mijn dienst vandaag" of, als er vandaag geen is, "Eerstvolgende dienst". Dit staat altijd als eerste.
  2. **Daaronder: wat moet ik nog doen en welke aanvragen lopen er.** Bijvoorbeeld uren invullen, een voorstel beantwoorden, een lopende vrij-aanvraag, en voor leiding en bedrijfsleider uren die ontbreken, uren die beoordeeld moeten worden en aanvragen waarop ze moeten reageren.
  3. **Daarna de rest**, zoals voor leiding wie er vandaag werkt en de roosterwijzigingen.
- Teamrooster: dagweergave op een telefoon, weekraster op een groter scherm. Het weekraster mag onderaan de huidige dag niet afgekapt lijken.
- Kalender: blijft zoals hij is (besluit eigenaar: het huidige overzicht is duidelijk). Geen stippen.
- Eén set statuschips met kleur en tekst. Tijdkeuze: Van en Tot blijven keuzelijsten per kwartier, met live "Netto" (al gebouwd). Geen −15/+15-knoppen (besluit eigenaar).
- De keuzelijst "Demoprofiel" blijft tot ronde 8 en verdwijnt daar door het inloggen.
- **5d (na proef eigenaar):** een dienst is *bezig* (oranje label "Dienst bezig") van de begintijd tot de eindtijd uit het rooster. Daarna is hij voorbij: zonder uren is het "Ontbreekt", voor de medewerker én direct voor de leiding. Subkopjes onder Uren krijgen bolletjes: **Mijn uren** = eigen uren in te vullen of aan te passen; **Uren goedkeuren** = te beoordelen + ontbrekende uren van het team. Het bolletje bij Uren is de som.
- **5e (na proef eigenaar):** Aanvragen krijgt voor de bedrijfsleider de subkopjes **Mijn aanvragen** en **Beoordelen** (vrije dagen en roostervoorstellen). Medewerkers zien hun voorstellen ook bij Aanvragen. Beoordelen toont naam, datum, hoe lang vrij en de reden, met de knoppen Aanvraag goedkeuren en Aanvraag afwijzen; de reden verschijnt pas na Afwijzen. De medewerker ziet het besluit op Vandaag (goedgekeurd groen, afgewezen grijs met reden) tot hij op **Gezien** tikt. Nieuw veld bij een aanvraag: `seen` (de medewerker heeft het besluit gezien). Onder Mijn aanvragen staan alleen aanvragen die nog open zijn of waarvan de datum nog komt.
- **5f (na proef eigenaar):** extra beschikbaarheid op een dag waarvan het rooster al gepubliceerd is, komt bij de bedrijfsleider op Vandaag en onder Aanvragen › Beoordelen (telt mee in het bolletje). Keuze: **Inplannen** (hele opgegeven tijd of andere tijden daarbinnen, plus werkplek; de dienst staat meteen in het rooster) of **Niet inplannen**. De medewerker krijgt een melding ("Extra ingepland: …, naar aanleiding van je opgegeven beschikbaarheid." of "Je bent niet extra ingepland.") en ziet bij Extra beschikbaar een label: Wacht op bedrijfsleider, Ingepland of Niet ingepland. Op een nog niet gepubliceerde dag blijft het zoals het was (zichtbaar in het rooster). Nieuw veld bij extra beschikbaarheid: `declined` (bedrijfsleider koos Niet inplannen). Of er al is ingepland wordt uitgerekend.
- Extra beschikbaarheid opgeven voor een dag waarop je al bent ingepland kan niet: je krijgt "Je bent op deze dag al ingepland." Onder Mijn aanvragen staan alleen eigen aanvragen en beschikbaarheid (ook voor de bedrijfsleider).
- **5g (na proef eigenaar):** ontbrekende uren staan per medewerker bij elkaar, met één herinnering voor alle dagen.

**Ronde 6: rooster-gemak**
- **6a Alles goedkeuren:** bovenaan Uren goedkeuren de knop "Alles goedkeuren (n)" voor uren die precies volgens rooster zijn: zelfde begin- en eindtijd en geen waarschuwing. De pauze telt niet mee (besluit eigenaar). Eerst een bevestiging met de lijst.
- **6b Vorige week kopiëren:** gebouwd en daarna weer weggehaald (besluit eigenaar: alleen Concept uit vaste beschikbaarheid). Wel gebleven: botst een concept met de opgegeven beschikbaarheid, dan staat dat eronder.
- Teamrooster heeft dezelfde bovenbalk als Mijn rooster: rechts ‹ Vandaag ›, links de knoppen.
- **6c Concept uit vaste beschikbaarheid:** iedereen als concept op de vaste dagen en tijden; goedgekeurde vrije dagen worden overgeslagen.
- Excel-import als concept: overgeslagen (besluit eigenaar). `excel/` blijft voor de export.

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
