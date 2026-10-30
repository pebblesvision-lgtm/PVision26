"""Element templates: which measurements a production drawing of a given
natuursteen element must carry. In the Measure step a template becomes a
checklist; every item is either measured on the drawing (two points, with a
kind) or typed in directly when it cannot be seen on the photo (thickness,
depth, a rebate on the back).

Keys are stable identifiers; names are shown in the UI language.
"""
from __future__ import annotations

from typing import Any

# item: key, nl, en, kind (horizontal | vertical | aligned | value), hint
ELEMENT_TEMPLATES: dict[str, dict[str, Any]] = {
    "raamdorpel": {
        "nl": "Raamdorpel", "en": "Window sill (exterior)",
        "items": [
            ("lengte", "Lengte", "Length", "horizontal", "incl. inmetselnokken"),
            ("breedte", "Breedte / diepte", "Width / depth", "value", "van voorkant tot achterkant"),
            ("dikte_voor", "Dikte voorkant", "Thickness front", "value", ""),
            ("dikte_achter", "Dikte achterkant", "Thickness back", "value", ""),
            ("helling", "Helling (afschot)", "Slope", "value", "mm per 100 mm of graden"),
            ("overstek", "Overstek", "Overhang", "value", "buiten de gevel"),
            ("waterhol", "Waterhol (afstand tot voorkant)", "Drip groove (distance from front)", "value", ""),
            ("sponning_h", "Sponning hoogte", "Rebate height", "vertical", "achter, onder het kozijn"),
            ("sponning_d", "Sponning diepte", "Rebate depth", "value", ""),
            ("nok_l", "Inmetselnok lengte", "Tail length", "horizontal", "per zijde"),
        ],
    },
    "vensterbank": {
        "nl": "Vensterbank (binnen)", "en": "Window board (interior)",
        "items": [
            ("lengte", "Lengte", "Length", "horizontal", ""),
            ("breedte", "Breedte", "Width", "value", ""),
            ("dikte", "Dikte", "Thickness", "value", ""),
            ("neus", "Neus / overstek", "Nosing / overhang", "value", ""),
            ("uitsparing", "Uitsparing(en)", "Notch(es)", "aligned", "voor dagkanten"),
        ],
    },
    "dorpel": {
        "nl": "Dorpel / onderdorpel", "en": "Threshold / door sill",
        "items": [
            ("lengte", "Lengte", "Length", "horizontal", ""),
            ("breedte", "Breedte", "Width", "value", ""),
            ("dikte", "Dikte", "Thickness", "value", ""),
            ("sponning_b", "Sponning breedte", "Rebate width", "horizontal", ""),
            ("sponning_h", "Sponning hoogte", "Rebate height", "vertical", ""),
            ("helling", "Helling", "Slope", "value", ""),
        ],
    },
    "muurafdekker": {
        "nl": "Muurafdekker / ezelsrug", "en": "Coping stone",
        "items": [
            ("lengte", "Lengte", "Length", "horizontal", ""),
            ("breedte", "Breedte", "Width", "horizontal", "over de muur"),
            ("hoogte_nok", "Hoogte nok", "Height at ridge", "vertical", ""),
            ("hoogte_rand", "Hoogte rand", "Height at edge", "vertical", ""),
            ("overstek", "Overstek per zijde", "Overhang per side", "value", ""),
            ("waterhol", "Waterhol", "Drip groove", "value", "afstand tot buitenkant"),
            ("helling", "Dakhelling", "Pitch", "value", "graden of verhouding"),
        ],
    },
    "traptrede": {
        "nl": "Traptrede", "en": "Stair tread",
        "items": [
            ("lengte", "Lengte", "Length", "horizontal", ""),
            ("aantrede", "Aantrede (breedte)", "Going (width)", "value", ""),
            ("optrede", "Optrede (dikte)", "Rise (thickness)", "vertical", ""),
            ("neus", "Neus", "Nosing", "value", "uitsteek en profiel"),
            ("afschot", "Afschot", "Fall", "value", ""),
        ],
    },
    "gevelband": {
        "nl": "Gevelband / lijst / cordon", "en": "String course / moulding",
        "items": [
            ("lengte", "Lengte", "Length", "horizontal", ""),
            ("hoogte", "Hoogte", "Height", "vertical", ""),
            ("diepte", "Diepte (in de muur)", "Depth (bed)", "value", ""),
            ("uitsteek", "Uitsteek", "Projection", "value", "buiten het gevelvlak"),
            ("profiel", "Profielhoogte", "Profile height", "vertical", "zie zijaanzicht / profiel"),
        ],
    },
    "ornament": {
        "nl": "Ornament / sluitsteen / console", "en": "Ornament / keystone / corbel",
        "items": [
            ("hoogte", "Hoogte", "Height", "vertical", ""),
            ("breedte", "Breedte", "Width", "horizontal", ""),
            ("diepte", "Diepte", "Depth", "value", "zie zijaanzicht"),
            ("relief", "Reliëfdiepte", "Relief depth", "value", ""),
            ("hoogte_bovenkant", "Breedte bovenkant", "Width at top", "horizontal", "bij taps toelopend"),
            ("hoogte_onderkant", "Breedte onderkant", "Width at bottom", "horizontal", ""),
        ],
    },
    "pinakel": {
        "nl": "Pinakel / topstuk / bol", "en": "Pinnacle / finial",
        "items": [
            ("hoogte", "Totale hoogte", "Total height", "vertical", ""),
            ("breedte_voet", "Breedte voet", "Width at base", "horizontal", ""),
            ("breedte_max", "Grootste breedte", "Largest width", "horizontal", ""),
            ("hoogte_hals", "Hoogte hals", "Neck height", "vertical", ""),
            ("doorn", "Doorn / pen", "Dowel", "value", "diameter en lengte"),
        ],
    },
    "vrij": {
        "nl": "Vrij (eigen lijst)", "en": "Free (own list)",
        "items": [],
    },
}


def templates_json(lang: str = "en") -> list[dict[str, Any]]:
    out = []
    for key, tpl in ELEMENT_TEMPLATES.items():
        out.append({
            "key": key, "name": tpl["nl"] if lang == "nl" else tpl["en"], "nl": tpl["nl"], "en": tpl["en"],
            "items": [{"key": k, "name": (nl if lang == "nl" else en), "nl": nl, "en": en, "kind": kind, "hint": hint}
                      for (k, nl, en, kind, hint) in tpl["items"]],
        })
    return out


def checklist_from_template(key: str) -> list[dict[str, Any]]:
    tpl = ELEMENT_TEMPLATES.get(key)
    if not tpl:
        return []
    return [{"key": k, "nl": nl, "en": en, "kind": kind, "hint": hint, "value_mm": None, "dim_id": ""}
            for (k, nl, en, kind, hint) in tpl["items"]]
