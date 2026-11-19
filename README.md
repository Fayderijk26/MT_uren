# Monkey Town Uithoorn · Uren

Mobiele demo met fictieve medewerkers, roosterimport en maandexport.

Wat de app doet, wat besloten is en wat er nog moet gebeuren: zie [docs/SPEC.md](docs/SPEC.md).
De werkregels voor Claude Code staan in [CLAUDE.md](CLAUDE.md). De oude versie staat in `legacy/` en wordt niet meer gebruikt.

Open het profielmenu om te wisselen tussen medewerker, dagleiding en bedrijfsleider.

Lokaal met Node.js 24:

```sh
npm test
npm run build
npm run dev
```

Open http://localhost:5173.

GitHub Pages: Settings → Pages → Deploy from a branch → main → /(root) → Save.
