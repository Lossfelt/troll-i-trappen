# Troll i trappen

**Spill her: https://lossfelt.github.io/troll-i-trappen/**

Et lite three.js-spill for mobil og PC om en treåring som går rundt i huset om kvelden og møter troll. Målet er å finne bamsen og komme seg opp trappen til senga, forbi Trappetrollet.

Hvert troll har en personlighet som avgjør hvilket valg som virker best:

| Troll | Hint | Beste valg |
|---|---|---|
| Trappetrollet | vil ha bompenger | Forhandle (hva som helst), eller «Hei» når du har to trollvenner |
| Sinnatrollet | sint og gretten | «Gå vekk!» |
| Sultentrollet | skrubbsulten | Forhandle med mat |
| Lille Lurv | sjenert og liten | «Hei, troll!» eller en gave |
| Kjempetrollet | tre hoder | Løp! |
| Sokketrollet | samler på sokker | Forhandle med en sokk |
| Søvntrollet | veldig trøtt | «Hei» (blir til «God natt») |

Under jakt kan du gjemme deg under kjøkkenbordet eller i teltet på lekerommet. Trollene får ikke plass der.

Mer moro:

- «Gå vekk!» er et rope-spill: trykk fort for å rope høyt nok. Sinnatrollet gir seg bare for et skikkelig rop.
- Noen troll gjemmer seg under gulvet og spretter opp med et «BØ!» når du kommer nær.
- En trollvenn som følger deg, kan hjelpe én gang («Spør …»), og da blir det andre trollet også venn.
- Hver natt du klarer, kommer det ett troll til neste natt.
- 📣 spør pappa hvilket rom bamsen er i.

## Stemmer og lyder

Replikkene og lydeffektene lages på forhånd med ElevenLabs og ligger som MP3 i `audio/`. Spillet spiller dem når de finnes, og bruker enhetens talesyntese som reserve ellers (velg reservestemmer på startskjermen).

1. Kopier `.env.example` til `.env` og lim inn nøkkelen fra ElevenLabs. `.env` skal aldri publiseres eller deles.
2. Kjør `node tools/generate-audio.mjs`. Skriptet
   - bruker norske stemmer fra ElevenLabs sitt stemmebibliotek (krever betalt plan), én per figur, valgt etter lyttetester
   - lager alle replikker fra `js/lines.js` og `js/trolls.js` med `eleven_v4` og en lydtagg per figur, for eksempel `[gruffly]`
   - lager lydeffektene og skriver `audio/manifest.json`
3. Kjør skriptet på nytt etter at du har endret replikker. Det lager bare det som mangler, og rydder bort filer som ikke brukes lenger.

API-nøkkelen trenger tilgang til tekst-til-tale, lydeffekter og stemmer (lese og skrive).

Verktøy for å velge stemmer:

- `node tools/find-voices.mjs` lager en lytteside med alle norske bibliotekstemmer (`tools/norske-stemmer.html`)
- `node tools/generate-audio.mjs --sample` lager én prøve per figur (`tools/stemmeprover.html`)
- `node tools/voice-variants.mjs` sammenligner stemmer, tagger og modeller for utvalgte figurer

Bytt stemme for en figur i `CAST` øverst i `tools/generate-audio.mjs`. Det som leses høyt, bruker aldri guttens navn, så lydfilene passer for alle.

## Publisering

Spillet er helt statisk og trenger ingen backend. GitHub Pages publiserer `main` fra rotmappen hver gang du pusher. Navn og trollbok ligger bare i spillerens nettleser (`localStorage`).

Spillet kan legges på Hjem-skjermen på mobil (`manifest.webmanifest`) og åpnes da i fullskjerm.

Ikonene og delingsbildet i `icons/` er laget med OpenAI sitt bilde-API: `node tools/generate-images.mjs` lager originalene (krever `OPENAI_API_KEY`), og `tools/resize-images.ps1` skalerer dem til riktige størrelser.

## Kjøre lokalt

ES-moduler må serveres over HTTP:

```bash
node serve.mjs
```

Åpne http://localhost:5173. Legg til `?debug` for å få `window.__troll` med `tick(sekunder)` for å spole simuleringen i tester.

## Struktur

- `index.html`: markup og stil for HUD, dialog og skjermer
- `js/main.js`: oppstart, kamera, hovedløkke og knapper
- `js/round.js`: én natt: plassering av troll og ting, og opplukking
- `js/trolls.js`: trolltyper, replikker og utfall (her endrer du innholdet)
- `js/lines.js`: alle andre replikker som leses høyt
- `tools/generate-audio.mjs`: lager stemmer og lyder med ElevenLabs
- `js/encounter.js`: møteflyt og utfall
- `js/actors.js`: trollenes oppførsel og jakt
- `js/kid.js`, `js/models.js`: gutten og figurene
- `js/house.js`, `js/furniture.js`: huset, kollisjon og gjemmesteder
- `js/physics.js`: kollisjon og A*-stifinning

three.js lastes fra jsDelivr (versjon 0.170.0). Navn og trollbok lagres i `localStorage`. Opplesning bruker nettleserens talesyntese med norsk stemme når enheten har en.
