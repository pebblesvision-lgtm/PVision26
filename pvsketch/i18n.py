"""Strings that end up on exported drawings (SVG / PDF / DXF), per language.

The browser UI has its own translation table in static/app.js; this one is
for the server-side renderers. Finish names use the Dutch stonemason terms as
canonical keys, because that is how they appear on Dutch production drawings.
"""
from __future__ import annotations

STRINGS: dict[str, dict[str, str]] = {
    "en": {
        "title": "production outline from photo",
        "scale": "scale",
        "photo": "photo",
        "measurements": "measurements (registered / photo)",
        "outline": "outline",
        "print": "print at 100% / actual size",
        "source": "source",
        "finishes": "finishes",
        "project": "project",
        "element": "element",
        "material": "stone",
        "quantity": "qty",
        "finish": "finish",
        "drawn_by": "drawn by",
        "date": "date",
        "notes": "notes",
        "units": "units mm",
    },
    "nl": {
        "title": "productietekening uit foto",
        "scale": "schaal",
        "photo": "foto",
        "measurements": "maten (opgemeten / foto)",
        "outline": "omtrek",
        "print": "afdrukken op 100% / ware grootte",
        "source": "bron",
        "finishes": "bewerkingen",
        "project": "project",
        "element": "element",
        "material": "steensoort",
        "quantity": "aantal",
        "finish": "afwerking",
        "drawn_by": "getekend door",
        "date": "datum",
        "notes": "opmerkingen",
        "units": "maten in mm",
    },
}

# canonical key -> (nl name, en name)
FINISH_NAMES: dict[str, tuple[str, str]] = {
    "frijnen": ("gefrijnd", "tooled (frijnen)"),
    "scharreren": ("gescharreerd", "droved"),
    "gradineren": ("gegradineerd", "clawed (toothed chisel)"),
    "boucharderen": ("gebouchardeerd", "bush-hammered"),
    "spitsen": ("gespitst", "pitched / pointed"),
    "randslag": ("randslag", "drafted margin"),
    "gezoet": ("gezoet", "honed"),
    "gepolijst": ("gepolijst", "polished"),
    "gezaagd": ("gezaagd", "sawn"),
    "gevlamd": ("gevlamd", "flamed"),
    "geschuurd": ("geschuurd", "rubbed"),
}


def t(lang: str, key: str) -> str:
    lang = lang if lang in STRINGS else "en"
    return STRINGS[lang].get(key, STRINGS["en"].get(key, key))


def finish_name(kind: str, lang: str) -> str:
    nl, en = FINISH_NAMES.get(kind, (kind, kind))
    return nl if lang == "nl" else en
