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
| 2 Isoleren | **Punten** rond de steen, een **Kader**, of de steen verven met **Steen +**, dan *Uitvoeren* | Na het uitvoeren werken *Steen +* en *Gum* direct op het gele vlak (ongedaan maken werkt). *Punten exact* = geen GrabCut. *Overslaan* = direct opmeten op de foto (instelling: na een nieuwe foto altijd direct naar Opmeten) |
| 3 Omtrek | Vereenvoudigen + **bogen passen** | *Verplaatsen*, *Punt toevoegen*, *Punt verwijderen*, ook op bogen (blauwe punten). Optioneel detaillijnen |
| 4 Opmeten | Twee punten tikken → **maat intypen** | De eerste maat zet de schaal (⌖ bij een maat: deze als schaal gebruiken). Schuin (langs de lijn) / horizontaal (alleen breedte) / verticaal (alleen hoogte), *Selecteren* om een maatlijn te wijzigen (lijnstijl) of te verwijderen, *Maatlijnen ordenen*. **Maatlijst**: *Vrij* (standaard), *Standaard* (lengte, breedte, diepte) of een element (raamdorpel, vensterbank, …); *+ Maat* voegt een eigen maat toe, ✕ haalt hem weg |
| 5 Tekenen | **Bewerkingsvlakken** met arcering | gefrijnd schuin/verticaal/horizontaal, gescharreerd, gegradineerd, kathedraalslag, vrije kathedraalslag, gebouchardeerd, gespitst, randslag, gezoet, gepolijst, gezaagd, gevlamd, geschuurd. Per vlak: **slagen per 10 cm** en een opmerking; beide komen in de legenda. Lijnen, pijlen, tekst. *Selecteren*: een bestaand vlak of lijn achteraf wijzigen of verwijderen |
| 6 Exporteren | **PDF** (ware grootte A4/A3, anders 1:2 / 1:5), **PNG / JPEG**, DXF 2010 en R12, SVG, CSV | Titelblok: project, element, steensoort, aantal, afwerking, getekend door. Andere aanzichten (zijaanzicht, profiel, …) koppelen aan hetzelfde blad |

Zolang er nog geen maat is ingevoerd staat op elke export **NIET OP SCHAAL**.

Bediening: wiel = zoom, rechts slepen = verschuiven, `f` = passend, Ctrl/Cmd+Z
= ongedaan. Tablet: één vinger = gereedschap, twee vingers = zoom en
verschuiven, knoppen + − ⌖ rechtsboven in het beeld.

## Perspectief

De omtrek is de vorm zoals de camera hem zag. Fotografeer daarom **recht van
voren**; een scheve foto geeft een scheve tekening. De getypte maten zijn
altijd leidend; de tekening is de drager van die maten.

## Op Cloudflare Pages zetten (aanbevolen: gratis, werkt ook offline)

De map `cloudflare/` (en `pvsketch-cloudflare-pages.zip`, dezelfde inhoud) is de
complete webapp. Er draait geen server: de omtrek- en exportcode draait in de
browser (JavaScript + OpenCV.js in een Web Worker), projecten staan op het
apparaat zelf (IndexedDB). Na het eerste bezoek werkt de app zonder internet.

1. <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → tabblad **Pages** → **Upload assets** (Direct Upload).
2. Projectnaam kiezen (bv. `pvsketch`), dan de **map `cloudflare`** (of de zip) naar het venster slepen → **Deploy**.
3. Open de gegeven URL (`https://pvsketch.pages.dev`). Op de iPad: Delen → **Zet op beginscherm**, dan opent hij schermvullend en blijft hij offline beschikbaar.
4. Eigen domein: Pages-project → Custom domains. Inloggen vooraf: Zero Trust → Access → Applications.

Een nieuwe versie uploaden = opnieuw slepen (Deployments → Create new deployment).

Goed om te weten:

- Projecten staan **in de browser van dat apparaat**. Maak een back-up via Exporteren → JSON (bevat foto, omtrek, maten en bewerkingen) en open die met *Project openen (.json)*; zo verhuist u ook een project naar een ander apparaat.
- Safari kan data van sites die u lang niet gebruikt opruimen; installeren op het beginscherm voorkomt dat grotendeels.
- DXF is hier R12 (werkt in vrijwel elk CAD/CAM-pakket, maatlijnen als losse lijnen en tekst).
- Bouwen: `python tools/build_cloudflare.py` (alleen nodig na wijzigingen aan de code; het haalt OpenCV.js via `npm install` in `web/`). Test: `python3 -m http.server 5077` in `cloudflare/`, dan `node web/tests/drive_static.js` en `node web/tests/drive_edit.js`.

## Als serverapp (Python, optioneel)

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
web/engine/      dezelfde pijplijn in JavaScript voor de Cloudflare-versie (OpenCV.js)
web/worker.js, shim.js, sw.js   Web Worker, /api-naar-browser-brug, offline-cache
tools/build_cloudflare.py       bouwt cloudflare/ + zip
cloudflare/      de upload-klare webapp
  __main__.py    serve / run / export
samples/make_sample.py   synthetische testfoto
tests/test_pipeline.py   python -m unittest
Dockerfile, render.yaml, docker-compose.yml
```

## Bekende grenzen

- Eén vlak per foto. Een zijkant of profiel is een tweede foto, gekoppeld als aanzicht.
- GrabCut heeft wat contrast nodig; de Punten-band en de kwasten vangen de rest op.
- Detaillijnen zijn een hulp voor het oog, geen geometrie om op te bewerken.
