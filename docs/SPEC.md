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

Bij elke rol kan straks **Uren bijhouden: nee** (ronde 10). Bijvoorbeeld de eigenaar van Monkey Town: bedrijfsleider met alle rechten, maar niet op uurbasis betaald.

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
15. Voor later: pushmeldingen (zie ronde 11), collega's zien in het rooster, toeslagen. Ziek en verlof: zie ronde 9 (voorstel).
16. **Inloggen met e-mail en wachtwoord** (niet met telefoonnummer en sms: dat kost geld). De bedrijfsleider zet een medewerker erin met e-mailadres. Die krijgt een uitnodigingsmail en kiest daarmee een wachtwoord. Daarna blijft de medewerker ingelogd op die telefoon tot hij of zij uitlogt. Wachtwoord vergeten gaat via een mail met een link. Wie niet door een bedrijfsleider is toegevoegd of op inactief staat, komt er niet in. Advies aan medewerkers: zet de app op het beginscherm (Safari › Delen › Zet op beginscherm), dan blijft de login bewaard. Uitwerking in ronde 8.

## 5. Nog niet besloten (vraag het de eigenaar, bouw niet op een gok)
- Op dit moment geen open vragen voor de bouw.

**Te bespreken met het bedrijf** (voorlopig gebouwd zoals hieronder; aanpassen zodra het bedrijf beslist):
- **Maandnorm:** nu contracturen per week × 52 ÷ 12 (elke maand gelijk). Klopt dat met hoe het bedrijf rekent?
- **Ziekte en verlof:** voorlopig gebouwd in ronde 9 (9a ziek melden). Zie de tabel "Te overleggen met het bedrijf" in ronde 9.
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
- **6c Concept uit vaste beschikbaarheid:** iedereen als concept op de vaste dagen en tijden (extra beschikbaarheid en om-de-week tellen mee). Goedgekeurd vrij: hele dag overgeslagen, deels vrij krijgt een concept voor de rest van de dag. Vrij dat nog wacht: concept blijft, met rood "Let op: vrij gevraagd, nog beoordelen". Wordt het later goedgekeurd, dan staat er "Let op: vrij (goedgekeurd)" en haalt de bedrijfsleider de dienst zelf weg.
- Excel-import als concept: overgeslagen (besluit eigenaar). `excel/` blijft voor de export.

**Ronde 7: medewerkers beheren**
- Toevoegen, rol wijzigen, op inactief zetten, contracturen en telefoonnummer invullen (nummer alleen zichtbaar voor leiding en bedrijfsleider). Meerdere bedrijfsleiders netjes ondersteunen (meldingen niet alleen naar de eerste).
- **7a:** onder Rooster de subkopjes Teamrooster en Medewerkers (alleen bedrijfsleider). Toevoegen en wijzigen: naam (verplicht, uniek), rol, contracturen (0–40), telefoonnummer (niet verplicht). Er blijft altijd minstens één bedrijfsleider. Nieuwe velden bij een persoon: `phone` en `active`.
- **7b:** op inactief zetten kan pas als de persoon geen diensten meer in de toekomst heeft (de app laat zien welke). Inactief: niet in rooster, demoprofiel, herinneringen of concept uit vaste beschikbaarheid; oude uren blijven en tellen mee. Kopje Inactief met Weer actief maken.
- **7c:** meldingen voor de bedrijfsleider gaan naar iedere actieve bedrijfsleider. Leiding ziet de medewerkerslijst niet (besluit eigenaar).
- **7d: werkplekken vloer en keuken.** Er zijn twee werkplekken: **Vloer** en **Keuken** (besluit eigenaar; ook leiding en bedrijfsleider staan op vloer of keuken, geen aparte werkplek voor dagleiding). Nieuw veld bij een persoon: `areas` (lijst met `Vloer` en/of `Keuken`, minstens één; in te stellen onder Medewerkers). De werkplek van een dienst (`area`) is altijd een van de werkplekken van die persoon. Wie één werkplek heeft, krijgt die vanzelf (geen keuze in het formulier); wie beide heeft, krijgt twee knoppen, Vloer staat vooraf gekozen. Geldt bij een conceptdienst, extra beschikbaarheid inplannen en een ongeplande dienst. Concept uit vaste beschikbaarheid: de eerste werkplek (vloer, of keuken voor wie alleen keuken doet). Een keukendienst krijgt een **K** in het teamrooster; een vloerdienst niets. Oude werkplekken (Speelvloer, Dagleiding, Bar) worden de werkplek van die persoon. Werkplekken weghalen bij een medewerker verandert bestaande diensten niet.
- **7e: kleine aanpassingen.** Op Vandaag (Mijn dienst vandaag, Nog in te vullen) en bij Uren › Gewerkte uren staat de knop naast de dienst, net als Herinner. **Concept uit vaste beschikbaarheid** kan alleen voor een week die nog moet beginnen en waarvan nog geen dag gepubliceerd is (besluit eigenaar: daarna zijn het losse aanpassingen); de regel staat in `model.js` (`mayPlanWeek`).
- **7f: publiceren per week.** Het rooster wordt altijd per week (maandag t/m zondag) gepubliceerd; de knop Dag publiceren is weg (besluit eigenaar). Ook op de telefoon staat in de dagweergave **Week publiceren** voor de week van die dag (voorlopig; kan later weg, publiceren is vooral iets voor de laptop). Losse aanpassingen in een gepubliceerde week (extra beschikbaarheid inplannen, dienst wijzigen na een aanvraag) gaan per dienst, zoals eerder.

**Ronde 8: gedeelde opslag en inloggen (apart project)**
- Nu staat alles in de browser. Voor echt gebruik: Supabase met inloggen en één plek voor de gegevens. Dezelfde `model.js` draait op de server (de gebruiker wordt bepaald uit het login-token, niet uit een keuzelijst) en de server stuurt alleen terug wat die rol mag zien. Versienummer tegen tegelijk schrijven. Een testproject met nepgegevens.
- **Inloggen** (besluit 16): Supabase Auth met e-mail en wachtwoord. Openbaar aanmelden staat uit; alleen een uitnodiging door een bedrijfsleider. Nieuw veld bij een persoon: `email` (verplicht voor inloggen, alleen zichtbaar voor de bedrijfsleider, alleen in de echte database en nooit in de repository). Op inactief zetten blokkeert het inloggen.
- **Mail:** de ingebouwde mail van Supabase is alleen voor testen (een paar mails per uur). Voor echt gebruik koppelen we een gratis maildienst (bijvoorbeeld Resend of Brevo) via SMTP. Het bedrijf maakt dat account aan.
- Delen: **8a** opslag en regels op de server (de demo blijft werken), **8b** inloggen met e-mail en wachtwoord, **8c** per rol alleen de juiste gegevens, **8d** proef met twee of drie collega's.
- Daarna de mails en pushmeldingen: zie ronde 11.
- **Tot dit klaar is, mogen er geen echte medewerkersgegevens in de app.**

**Ronde 9: ziek en verlof (voorlopig gebouwd, nog te overleggen met het bedrijf)**
Kan vóór ronde 8 gebouwd worden: het zijn regels in `model.js`, dus het werkt ook in de demo. De keuzes hieronder zijn **voorlopig** (besluit eigenaar 23 november: eerst de werking, daarna definitief na overleg). Zie de lijst "Te overleggen met het bedrijf" onderaan.

*Wat er misging (gecontroleerd 23 november):*
- Vrij vragen kent maar één soort. De app weet niet of het betaald verlof, onbetaald vrij of ziekte is.
- Bij goedkeuren verdwijnt de dienst uit het rooster. Daarna staat nergens meer hoeveel uur iemand gepland stond.
- Het maandoverzicht telt alleen gewerkte uren. Wie met een vast contract verlof had, lijkt uren tekort te komen. De export heeft een kolom afwezigheid (`absenceMinutes`), maar die staat altijd op 0.
- Ziekmelden bestond niet.

**9a: ziek melden per dienst**
- Ziek melden gaat **per dienst**. Er is geen "beter melden": elke dienst wordt apart ziek gemeld.
- **Wie:** de medewerker zelf, voor een eigen dienst die nog niet begonnen is (vandaag of later). De dagleiding van die dag en de bedrijfsleider kunnen het namens iemand doen, ook achteraf. Iedereen met een dienst kan zich ziek melden, ook met contract Uren.
- **Niet mogelijk:** bij een stand-bydienst, een ongeplande dienst, een dienst waarvoor al uren zijn ingediend, of in een afgesloten maand.
- Er is **geen goedkeuring** nodig. Ziek melden via de app is niet genoeg: wie zichzelf ziek meldt, ziet in het venster "Ziek melden doe je ook telefonisch bij de leidinggevende van de dag. Dit mag niet alleen via deze app." (besluit eigenaar).
- **Vastleggen:** de dienst blijft bestaan en krijgt het veld `sick` (`{by, at}`: wie het meldde en wanneer). Zo blijven de geplande tijden bewaard. Nieuw veld bij een dienst: `sick`.
- **Hoeveel uur:** de geplande tijd van de dienst. Is de dienst langer dan 3 uur, dan gaat er 30 minuten pauze af. Voorbeeld: 08:30–15:00 is 6u 30m gepland en telt 6u 00m ziek. Dit wordt uitgerekend, niet opgeslagen.
- **Gevolgen:** een ziek gemelde dienst hoeft niet ingevuld te worden, telt niet als ontbrekend en staat niet bij Nog open in het maandoverzicht. Uren indienen kan niet. Een leidinggevende die ziek is gemeld, is die dag geen dagleiding. In het rooster staat bij de dienst "Ziek gemeld". De dienst kan niet meer gewijzigd worden; eerst de ziekmelding intrekken.
- **Zichtbaar:** de medewerker ziet "Ziek gemeld" bij de dienst. Meldt iemand anders het, dan krijgt de medewerker een melding op Vandaag. De bedrijfsleider en de dagleiding zien op Vandaag het kaartje **Ziek gemeld** (vandaag en later).
- **Achteraf ziek melden** (iemand belde ziek maar vergat de app): bij **Ontbreekt** (Uren goedkeuren en Vandaag) staat naast Herinner per dag de knop **Ziek melden**, voor de bedrijfsleider en de dagleiding van die dag. Een medewerker kan een voorbije dienst niet zelf ziek melden.
- **Intrekken** (bij een vergissing): door wie het meldde of een bedrijfsleider, zolang de maand open is. Een voorbije dienst staat daarna weer bij de ontbrekende uren.
- Het maandoverzicht rekent de ziekte-uren al uit (`monthSummary` geeft `sick`). De kolommen in het overzicht en de export komen in 9c.
- *Scenario:* Elise meldt zich ziek voor zaterdag 10:00–18:00. Die dienst telt 7u 30m ziek, staat niet bij Nog in te vullen en niet bij de ontbrekende uren.
- *Scenario:* Elise is al aan het werk. Ze kan zich niet meer zelf ziek melden; Iris (dagleiding die dag) of Eva kan dat wel.

**9b: soort bij vrij vragen**
- **Soort contract** per persoon, verplicht, in te stellen onder Medewerkers: **Vast** (met maandnorm) of **Uren** (betaald per gewerkt uur, de norm is alleen informatie). Nieuw veld: `contract` (`vast` of `uren`). In de demo heeft Isis contract Uren, de rest Vast.
- **Vrij vragen krijgt een soort.** Nieuw veld bij een aanvraag: `type` (`verlof` of `onbetaald`).
  - **Verlof (betaald):** alleen bij een vast contract. De medewerker vraagt aan, de bedrijfsleider keurt goed. Telt mee als uren.
  - **Onbetaald vrij:** voor iedereen. Telt niet mee. Dit is wat Vrij vragen nu doet; bestaande aanvragen worden Onbetaald vrij.
  - Bij een vast contract staat Verlof (betaald) vooraf gekozen. De medewerker kan ook Onbetaald vrij kiezen.
- **Soort aanpassen bij goedkeuren** (voorlopig, besluit eigenaar 23 november): de bedrijfsleider ziet de gevraagde soort en kan die bij het goedkeuren veranderen. De gevraagde soort blijft bewaard (nieuw veld `askedType`, alleen als de soort is aangepast) en de medewerker ziet op Vandaag "Soort aangepast: je vroeg ...".
- Bij goedkeuren bewaart de aanvraag welk deel van de diensten binnen de vrije tijd viel (nieuw veld `dropped`, lijst van `{date, start, end}`; ook bij onbetaald vrij). Kiest de bedrijfsleider dat een hele dienst vervalt terwijl maar een deel vrij was gevraagd, dan telt alleen het gevraagde deel. Verlof telt de geplande tijd daarvan, met dezelfde pauzeregel als ziek (`absentMinutes`). Betaald verlof goedkeuren kan alleen als de medewerker dan nog een vast contract heeft, en niet in een afgesloten maand. Een verlofdag zonder dienst telt niet mee. Staan er nog geen diensten in die periode, dan waarschuwt de app de bedrijfsleider: "dit verlof telt nu 0 uur".
- Geen verlofsaldo in de app: dat houdt de loonadministratie bij (advies, zie overleg). De app legt alleen de opgenomen verlofuren vast.
- Het maandoverzicht rekent de verlofuren al uit (`monthSummary` geeft `leave`). De kolommen komen in 9c.
- *Scenario:* Isis (contract Uren) kan geen betaald verlof kiezen, alleen onbetaald vrij.
- *Scenario:* Elise krijgt verlof voor zaterdag 10:00–18:00. De dienst verdwijnt uit het rooster en telt 7u 30m verlof.

**Mijn uren (bij Uren, voor iedereen)**
- Bovenaan de kaart **Mijn uren** met de maandkeuze in de kop. Groot het **totaal** van de maand: goedgekeurd + ziek gemeld + verlof (betaald). Daaronder een balk en drie tegels met die drie soorten.
- **Nog te doen** staat in een rode regel: het aantal diensten dat ontbreekt en waarvoor aanpassen is gevraagd (een aantal diensten, geen uren: die zijn nog onbekend). Ze tellen niet mee in het totaal.
- **Wacht op beoordeling** telt niet mee in het totaal en staat er apart onder ("telt mee zodra het is goedgekeurd"). Onbetaald vrij staat er niet bij.
- Daaronder de kaart **Diensten**, met de knop Ongeplande dienst invullen rechts naast de kop: gewerkte diensten tot vandaag, ziek gemelde diensten en verlofdagen (ook later in de maand), met hoeveel ze tellen. Nieuwste bovenaan.
- De getallen komen uit `monthSummary` (nu ook met `pending`), dezelfde als in het maandoverzicht van de bedrijfsleider. Norm en verschil staan er nog niet; dat volgt na het besluit over de maandnorm (9c).

**9c: maandoverzicht en export** (nog niet gebouwd)
- Per persoon Gewerkt, Ziek, Verlof, Totaal, Norm en Verschil. Bij contract Uren staat de norm als informatie en is er geen verschil.
- Export: aparte kolommen Ziek en Verlof in plaats van de lege kolom afwezigheid.

*Te overleggen met het bedrijf (nu gebouwd zoals bij "Nu", daarna definitief maken):*
| Onderwerp | Nu (voorlopig) | Of liever |
|---|---|---|
| Ziekte-uren | Geplande tijd van de dienst, min 30 minuten pauze bij meer dan 3 uur | Gemiddelde per dag uit het contract (bijv. contracturen ÷ 5); of de pauze volgens een andere regel |
| Ziek op een dag zonder dienst | Telt niet mee | Bij een vast contract toch uren per dag uit het contract |
| Beter melden | Niet: ziek per dienst | Ziekteperiode met een begin en "beter gemeld", die alle diensten daarin ziek maakt |
| Halverwege ziek naar huis | Niet in de app: medewerker vult de gewerkte uren in | Rest van de dienst als ziek registreren |
| Ziek melden vooruit | Medewerker kan elke eigen dienst vanaf vandaag ziek melden | Alleen vandaag en morgen; verder vooruit via de leiding |
| Ziek bij contract Uren | Iedereen kan ziek melden; de app registreert de uren, de loonadministratie beslist over uitbetalen | Ziek alleen bij vast contract (let op: ook uurkrachten hebben meestal recht op doorbetaling voor ingeroosterde diensten) |
| Wachtdag | Geen | Eerste ziektedag niet doorbetaald, als cao of contract dat zegt |
| Verlof-uren | Geplande tijd van de vervallen diensten, min 30 minuten pauze bij meer dan 3 uur (zelfde regel als ziek) | Zonder pauzeaftrek; of contracturen ÷ 5 per verlofdag |
| Wie kiest betaald of onbetaald | De medewerker kiest (bij vast contract staat Verlof vooraf gekozen); de bedrijfsleider kan het aanpassen bij goedkeuren | Alleen de bedrijfsleider kiest bij goedkeuren; de medewerker vraagt alleen "vrij" |
| Verlof bij contract Uren | Niet mogelijk, alleen onbetaald vrij | Ook betaald verlof voor uurkrachten (zij bouwen wettelijk ook verlof op, vaak uitbetaald per uur) |
| Verlofdag zonder dienst | Telt niet mee; waarschuwing bij 0 uur | Contracturen ÷ 5 per verlofdag; of de bedrijfsleider vult de uren in bij goedkeuren |
| Verlofsaldo | Niet in de app, bij de loonadministratie | Saldo in de app (opbouw, vervallen, overuren: foutgevoelig met twee administraties) |
| Feestdagen en sluitingsdagen | Geen invloed op de norm | Gaan af van de norm als het park dicht is |

**Ronde 10: account zonder urenregistratie** (nog niet gebouwd; kan vóór ronde 8, het zijn regels in `model.js`)
- *Waarom:* de eigenaar van Monkey Town doet nu het werk van de bedrijfsleider. Komt er een bedrijfsleider, dan krijgt de eigenaar een eigen account met alle rechten van de bedrijfsleider: uren goedkeuren, vrije dagen beoordelen, roosters maken, publiceren, maand afsluiten. Haar uren hoeven niet geregistreerd te worden: ze wordt niet per uur betaald.
- Nieuw veld bij een persoon: `tracksHours` (Uren bijhouden: ja of nee; standaard ja). In te stellen onder Medewerkers, bij elke rol. Het is een eigen instelling naast de rol, zodat het ook kan voor bijvoorbeeld een bedrijfsleider in loondienst met een vast salaris.
- Bij **nee**:
  - Geen uren invullen, geen Nog in te vullen, niet bij Ontbreekt, geen Herinner.
  - Niet in het maandoverzicht en niet in de export. Geen maandnorm.
  - Geen kaart Mijn uren; bij Uren staat alleen Uren goedkeuren.
  - Ziek melden en vrij vragen in de app: niet nodig (voorlopig weg).
  - Wel alle rechten van de rol.
- *Scenario:* de eigenaar staat zaterdag in het rooster. Zondag staat haar dienst niet bij Ontbreekt en ze krijgt geen herinnering. Ze keurt wel de uren van de rest goed.
- *Te vragen aan het bedrijf:*
  - Staat de eigenaar in het rooster (zodat het team ziet dat ze er is), of helemaal niet?
  - Is zij die dag ook dagleiding? (Ze is bedrijfsleider, dus ze mag sowieso alles goedkeuren.)
  - Zijn er nog meer mensen die niet per uur worden betaald?

**Ronde 11: pushmeldingen en herinneringsmails** (nog niet gebouwd; pas na ronde 8, want er is een server en een login nodig)
- **Pushmeldingen** op de telefoon. De app wordt installeerbaar: een eigen icoon op het beginscherm (manifest en service worker). Melding aan of uit per telefoon, met de knop "Meldingen aan".
  - iPhone: alleen als de app op het beginscherm staat (iOS 16.4 of nieuwer). Android: ook vanuit de browser.
  - Versturen gaat via een functie bij Supabase (gratis plan).
- Een melding is een extra seintje. De melding op Vandaag blijft de hoofdplek, want niet iedereen zet push aan en een melding komt niet altijd aan.
- Voorstel welke meldingen (per stuk kiezen met het bedrijf, liever weinig dan veel):
  - Medewerker: uren van gisteren ontbreken nog; aanpassen gevraagd; vrij-aanvraag goedgekeurd of afgewezen; ziek gemeld door de leiding; nieuw voorstel; rooster voor volgende week gepubliceerd.
  - Bedrijfsleider: nieuwe aanvraag om te beoordelen.
  - **Bedrijfsleider: maand afronden.** Vanaf de 1e van de volgende maand: mail én pushmelding "November kan worden afgesloten. Nog X uren te beoordelen en Y ontbreken. Sluit de maand af en download het maandoverzicht." Elke paar dagen opnieuw tot de maand is afgesloten. Na afsluiten opent meteen het downloaden van het maandoverzicht.
- **Mails** (besluit 8): dagoverzicht aan wie dienst had en de herinnering de volgende dag om 09:00, via de maildienst uit ronde 8.
- *Te vragen aan het bedrijf:* welke meldingen wel en niet; hoe vaak de maandherinnering terugkomt; tot welke dag de maand afgerond moet zijn (hangt samen met de loonperiode).

## 7. Woordenlijst
- **Concept:** diensten die nog niet zichtbaar zijn voor medewerkers. **Publiceren** maakt ze zichtbaar.
- **Dagleiding:** de leidinggevende met een dienst op die dag.
- **Aanpassen vragen:** de leiding vraagt de medewerker de uren te corrigeren.
- **Voorstel:** een vraag aan een medewerker of zij ook (op andere tijden) wil werken.
- **Ongeplande dienst:** een dienst die niet in het rooster stond maar wel is gewerkt.
