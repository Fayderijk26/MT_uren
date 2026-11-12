# Accounts, e-mail en afsluitmeldingen

## Lokaal testen op de Mac

1. Start Docker Desktop. Voer in de projectmap `npx supabase start` uit. De CLI past de migraties toe en opent een lokaal testpostvak op <http://127.0.0.1:54324>. De ontwikkelwebsite in deze configuratie is <http://localhost:5173>.
2. Zet de lokale API URL en de **publishable of anon key** uit de CLI-uitvoer in de publieke appconfiguratie. Reserveer het service-role geheim voor de server.
3. Open lokaal Studio, kies **Authentication → Users → Add user → Create new user** en maak een fictieve eerste bedrijfsleider aan. Kopieer de UUID uit dat account. Voer vanuit de SQL Editor één keer onderstaande opdracht uit met de gekopieerde UUID. Het profiel wordt door een trigger bij accountcreatie aangemaakt. De volgende rolwijzigingen verlopen via de app.
4. Start de lokale website volgens de README. Open de app als bedrijfsleider en nodig testmedewerkers uit. Voor lokale Edge Functions zet je `MT_SITE_URL=http://localhost:5173/` in een lokaal secretsbestand buiten de repository. Voer in een andere terminal `npx supabase functions serve --env-file /absoluut/pad/naar/test.env` uit. De CLI verstrekt de lokale Supabase-sleutels aan de functies.
5. Volg de uitnodiging via het lokale testpostvak. Bij een normale inlog vraagt een uitgenodigde medewerker op het inlogscherm een e-mailcode aan. Het lokale herstelpad gebruikt een aparte herstelcode en daarna een nieuw wachtwoord. Controleer ook dat een eerder gebruikte, verlopen of foutieve code geweigerd wordt.

```sql
update mt.people set role='admin', active=true where id='VUL-HIER-DE-AUTH-UUID-IN'::uuid;
```

## Supabase Free en GitHub Pages

1. Maak een Supabase Free-testproject in Frankfurt, bewaar het databasewachtwoord privé en verbind de CLI in de projectmap via `npx supabase login` en `npx supabase link --project-ref PROJECTREF`. Controleer de gekozen projectref voordat je `npx supabase db push` gebruikt.
2. Zet onder **Authentication** openbare registratie en anonieme aanmeldingen uit. Schakel de e-mailprovider in. Zet de eigen Pages-project-URL (met repositorynaam en afsluitende slash) bij **Site URL** en de toegestane redirect-URL’s. Kopieer de drie HTML-bestanden uit `supabase/templates` naar de bijbehorende uitnodigings-, magische-link- en herstelsjablonen in het dashboard. De code staat in het sjabloon als `{{ .Token }}`. Gebruik voor de prototypeconfiguratie zes cijfers met een geldigheidsduur van tien minuten.
3. Configureer eigen SMTP voor Supabase Auth zodra uitnodigingen en codes naar externe testadressen gaan. Verifieer het verzenddomein en kies één aangewezen testadres voor de echte bezorgtest. Maak de eerste beheerder en wijs de rol toe zoals bij de lokale installatie.
4. Voeg als publieke buildconfiguratie de eigen project-URL en publishable key (of legacy anon key) toe. Zet `MT_SITE_URL` bij de Supabase Edge Function-secrets op de exacte Pages-URL. De Edge-omgeving geeft de functies standaard de project-URL, anon key en service-role key. De browser krijgt uitsluitend de publieke sleutel.
5. Publiceer de functies met `npx supabase functions deploy invite` en `npx supabase functions deploy closing-mail`. De uitnodigingsfunctie valideert het Supabase-gebruikerstoken via de database en controleert de actieve bedrijfsleidersrol. De afsluitfunctie heeft een eigen servergeheim.
6. Laat één fictief account per rol inloggen. Controleer met een eigen testmailbox de echte ontvangst van de uitnodiging en van een login- en herstelcode. Herhaal na een verhuizing naar Cloudflare met de bijgewerkte URL en secrets.

## Automatische afsluiting

De in-app dagcontrole gebruikt de actuele registraties. E-mail heeft daarnaast een Resend-account met geverifieerd afzenderadres nodig. Configureer in de Edge Function-secrets de volgende waarden. Domeinverificatie, provideraccount en echte levering zijn externe installatiestappen.

| Secret | Waarde |
|---|---|
| MT_SITE_URL | Volledige URL van de gedeelde urenapp |
| MT_CLOSING_TIME | Gewenste eerste controletijd in Amsterdam, bijvoorbeeld 18:15 |
| MT_MAIL_FROM | Geverifieerde afzender voor de afsluit- en herinneringsmail |
| RESEND_API_KEY | Verzendbevoegde API-sleutel, uitsluitend server-side |
| MT_JOB_SECRET | Lang willekeurig geheim, bijvoorbeeld uit een wachtwoordbeheerder |

Activeer Cron, pg_net en Vault. Sla twee secrets op in Vault: `mt_closing_url` bevat de volledige URL van de functie die eindigt op `/functions/v1/closing-mail`. `mt_job_secret` bevat exact dezelfde waarde als de Edge Function-secret `MT_JOB_SECRET`. Voer dan `integration/schedule.sql` één keer uit in de SQL Editor. De taak controleert elke vijf minuten of de ingestelde lokale tijd is verstreken. Tijdens de zomertijd blijft het tijdstip in Amsterdam gelijk.

Een open dag gaat naar de actuele dagleiding of bij ontbreken daarvan naar de eerste actieve bedrijfsleider op account-ID. Een medewerker met een ontbrekende inzending krijgt alleen de eigen herinnering. Bij verzenden bevat de mail een algemene tekst en de applink. Vervallen diensten, stand-by zonder oproep en vrije dagen produceren geen medewerkerherinnering. Een late inzending wordt direct zichtbaar bij het opnieuw laden van de dagcontrole. De job werkt ook wanneer alle telefoons gesloten zijn.

De database registreert de bezorgstatus per dag, ontvanger en soort melding in `mt.mail_delivery`. De verzender gebruikt dezelfde idempotentiesleutel bij een herhaling. Mislukte afleverpogingen zijn opnieuw aan de beurt vanaf vijf minuten later zolang dezelfde lokale dag loopt. `sent` geeft aan dat de mailprovider het bericht accepteerde. Voor daadwerkelijke aankomst controleer je het testpostvak.

## Uitgevoerde technische controles

Voer vanuit de projectmap `node --test integration/*.test.mjs` uit met Node.js 24. De 11 tests oefenen sessieverversing, ongeldig geworden sessies, autorisatie voor uitnodigingen en veilige herhaling van de verzendactie. Deze tests gebruiken lokale simulaties van de Auth API en van de mailprovider. Een echte bezorging en toegang met een live GoTrue-sessie worden afzonderlijk op het geconfigureerde project gecontroleerd.

De volledige databaseback-up en SQL-tests staan bij de database-installatie. Om accounts terug te krijgen in hetzelfde project moeten de accounts in het auth-schema met dezelfde UUID’s beschikbaar blijven. Herstel eerst in een apart testproject. Controleer na een projectwissel ook Auth-configuratie, SMTP, URL’s, sjablonen, Edge-secrets, Vault en de cronjob. Gebruik uitsluitend fictieve accounts voor de herstelproef.

[Supabase e-mailcodes](https://supabase.com/docs/guides/auth/auth-email-passwordless) · [E-mail via eigen SMTP](https://supabase.com/docs/guides/auth/auth-smtp) · [Geplande functies](https://supabase.com/docs/guides/functions/schedule-functions) · [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys)

### Reproduceerbare mail- en accountproef met een echte lokale Supabase-server

Start de lokale stack met de migraties en deze mailsjablonen. Exporteer in je terminal de lokale publieke sleutel als `SUPABASE_KEY` en de lokale service-role-sleutel als `SUPABASE_SERVICE_ROLE_KEY` uit `npx supabase status`. De servergeheime sleutel hoort uitsluitend in die terminalomgeving. Draai `node integration/check-local-auth.mjs`. Dit script gebruikt een uniek fictief adres, controleert het lokale Mailpit-postvak, accepteert de uitnodiging, toetst rol en geweigerd hergebruik, doorloopt herstel en logt ten slotte met een gewone e-mailcode in. Het respecteert de ingestelde minuut tussen mails. Het script laat het fictieve testaccount in het wegwerpproject staan. Deze proef vergt Docker en een draaiende lokale Supabase-stack.

Voor de bezorgadministratie in een lege lokale testdatabase draait `psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f supabase/tests/notifications.sql` een transactie die ten slotte wordt teruggedraaid. Deze controle dekt overgedragen dagleiding, genegeerde stand-by, herhaling na mailstoring en het opnieuw controleren van een inmiddels geannuleerde dienst.
