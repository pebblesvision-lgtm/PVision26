# pvsketch — productietekening uit een foto, maten typt u zelf

Een foto van een natuursteenelement wordt een **schone omtrek** (lijnen en
cirkelbogen), waarop u de **zelf gemeten maten** registreert, bewerkingen
(gefrijnd, gescharreerd, kathedraalslag, randslag, …) aangeeft en het geheel
exporteert als **PDF, afbeelding, DXF, SVG of CSV**. Er wordt **niets uit de
foto gemeten**: de foto geeft alleen de vorm, de eerste maat die u intypt
bepaalt de schaal van de tekening.

Alles draait lokaal; geen modellen, geen cloud. Nederlands standaard, English
via het tandwiel. Gemaakt voor gebruik op een tablet op de steiger: alles op
één scherm, grote knoppen, twee vingers = zoom.

```
foto ──► 2 isoleren ──► 3 omtrek ──► 4 opmeten ──► 5 tekenen ──► 6 exporteren
         (punten)       (lijnen+bogen) (typen)     (bewerkingen)  (PDF/PNG/DXF/SVG/CSV)
```

## Starten

```bash
python3 -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m pvsketch serve
```

Open <http://127.0.0.1:5000>. Projecten staan in `./workspace/` (anders:
`--workspace MAP` of `PVSKETCH_WORKSPACE`). "Voorbeeldfoto" op het eerste
scherm laadt een synthetische teststeen.

## De stappen

| Stap | Wat | Opmerkingen |
|---|---|---|
| 1 Foto | Foto maken (telefoon/tablet) of kiezen | JPEG, PNG, HEIC. Recht van voren fotograferen |
| 2 Isoleren | **Punten** langs de buitenlijn tikken, *Uitvoeren* | GrabCut zoekt de rand alleen in de band rond uw punten. Kwasten steen/achtergrond, gum, ongedaan maken. *Punten exact* = geen GrabCut |
| 3 Omtrek | Vereenvoudigen + **bogen passen** | Punten verplaatsen, toevoegen (dubbeltik), verwijderen. Optioneel detaillijnen |
| 4 Opmeten | Twee punten tikken → **maat intypen** | De eerste maat zet de schaal (⌖ bij een maat: deze als schaal gebruiken). Schuin / horizontaal / verticaal, maatlijn slepen, *Opruimen*. **Elementsjabloon** (raamdorpel, vensterbank, dorpel, muurafdekker, traptrede, gevelband, ornament, pinakel) geeft de checklist van verplichte maten; wat niet op de foto staat typt u direct |
| 5 Tekenen | **Bewerkingsvlakken** met arcering | gefrijnd schuin/verticaal/horizontaal, gescharreerd, gegradineerd, kathedraalslag, vrije kathedraalslag, gebouchardeerd, gespitst, randslag, gezoet, gepolijst, gezaagd, gevlamd, geschuurd. Per vlak: **slagen per 10 cm** en een opmerking; beide komen in de legenda. Lijnen, pijlen, tekst |
| 6 Exporteren | **PDF** (ware grootte A4/A3, anders 1:2 / 1:5), **PNG / JPEG**, DXF 2010 en R12, SVG, CSV | Titelblok: project, element, steensoort, aantal, afwerking, getekend door. Andere aanzichten (zijaanzicht, profiel, …) koppelen aan hetzelfde blad |

Zolang er nog geen maat is ingevoerd staat op elke export **NIET OP SCHAAL**.

Bediening: wiel = zoom, rechts slepen = verschuiven, `f` = passend, Ctrl/Cmd+Z
= ongedaan. Tablet: één vinger = gereedschap, twee vingers = zoom en
verschuiven, knoppen + − ⌖ rechtsboven in het beeld.

## Perspectief

De omtrek is de vorm zoals de camera hem zag. Fotografeer daarom **recht van
voren**; een scheve foto geeft een scheve tekening. De getypte maten zijn
altijd leidend; de tekening is de drager van die maten.

## Als webapp (testen op een tablet)

Dezelfde app draait op een server. Zet `PVSKETCH_PASSWORD` (wachtwoord op
alle pagina's) en `PVSKETCH_RETENTION_DAYS` (oude projecten opruimen).

- **Cloudflare Tunnel** (aanbevolen bij een eigen Cloudflare-account):
  `docker-compose.yml` bevat de app en `cloudflared`. Zero Trust → Networks →
  Tunnels → tunnel maken, token in `.env` (zie `.env.example`), hostnaam
  naar `http://pvsketch:8000`, dan `docker compose up -d --build`.
  Cloudflare Access ervoor zetten voor inloggen op e-mailadres.
- **Render.com** (gratis): New + → Blueprint → deze repository; `render.yaml`
  regelt de rest. Let op: geen vaste schijf op het gratis plan.
- **Elke Docker-host**: `docker build -t pvsketch .` en
  `docker run -p 8000:8000 -e PVSKETCH_PASSWORD=... -v $PWD/workspace:/data/workspace pvsketch`.

## Headless

```bash
python -m pvsketch run foto.jpg --rect x,y,w,h --width-mm 1240 --out out/
python -m pvsketch export <project-id> --out out/
```

## Indeling

```
pvsketch/
  calibrate.py   tekenruimte: px ↔ mm, schaal uit de eerste getypte maat
  segment.py     GrabCut met punten-band / kader, kwaststreken, gum
  contour.py     omtrek → vereenvoudigen → lijnen + bogen; detaillijnen
  geometry.py    Polyline / Arc / Dimension / Finish / Sketch / Drawing (mm)
  hatch.py       arceringen voor bewerkingen (lijnen, bundels, visgraat, bogen, stippen, randslag)
  templates.py   elementsjablonen → checklist van maten
  views.py       meerdere aanzichten op één blad
  export_svg.py / export_pdf.py / export_dxf.py / export_table.py
  i18n.py        teksten op de tekening (nl/en) en namen van bewerkingen
  project.py     projectmap: original, rectified.jpg, mask.png, project.json
  server/        Flask-API + één-pagina-UI (vanilla JS, geen CDN, offline)
  __main__.py    serve / run / export
samples/make_sample.py   synthetische testfoto
tests/test_pipeline.py   python -m unittest
Dockerfile, render.yaml, docker-compose.yml
```

## Bekende grenzen

- Eén vlak per foto. Een zijkant of profiel is een tweede foto, gekoppeld als aanzicht.
- GrabCut heeft wat contrast nodig; de Punten-band en de kwasten vangen de rest op.
- Detaillijnen zijn een hulp voor het oog, geen geometrie om op te bewerken.
