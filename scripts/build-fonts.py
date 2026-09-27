"""Builds the self hosted font files from the Fontsource variable packages.

Web fonts: Latin only, axes limited to the settings in section 3 of the brief.
OG fonts: static TTF instances for Satori (build time only, never shipped).
Run: python scripts/build-fonts.py   (needs fonttools and brotli)
"""
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

FS = "node_modules/@fontsource-variable"
SRC = {
    "archivo": f"{FS}/archivo/files/archivo-latin-wdth-normal.woff2",
    "serif": f"{FS}/source-serif-4/files/source-serif-4-latin-opsz-normal.woff2",
    "serif-italic": f"{FS}/source-serif-4/files/source-serif-4-latin-opsz-italic.woff2",
    "mono": f"{FS}/martian-mono/files/martian-mono-latin-wdth-normal.woff2",
}
import json, re

# Basic Latin, typographic quotes and ellipsis, plus every Latin 1 character the data and copy use.
# Rerun this script if new data brings new accented letters.
_text = "".join(open(p, encoding="utf-8").read() for p in ["src/data/events.json", "src/data/debate.json", "src/data/meta.json", "src/lib/copy.ts"])
_used = {ord(c) for c in _text if 0xA0 <= ord(c) <= 0xFF}
UNICODES = list(range(0x20, 0x7F)) + sorted(_used | {0xA0, 0xB7}) + [0x2018, 0x2019, 0x201C, 0x201D, 0x2026, 0x20AC, 0x2009, 0x202F]
print("latin 1 in use:", "".join(chr(c) for c in sorted(_used)))

# Display face for the headline and tag only, so the largest text paints early.
_meta = json.load(open("src/data/meta.json", encoding="utf-8"))
DISPLAY = sorted({ord(c) for c in _meta["headline"] + "UNGA81 HIGH LEVEL WEEK" + "\u2026 "})

def make(name, axes, out, flavor, unicodes=None):
    font = TTFont(SRC[name], lazy=False)
    opts = subset.Options()
    opts.layout_features = ["kern", "liga", "tnum", "lnum", "case"]
    opts.flavor = flavor
    opts.desubroutinize = True
    opts.name_IDs = ["*"]
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=unicodes or UNICODES)
    sub.subset(font)
    font = instancer.instantiateVariableFont(font, axes)
    font.flavor = flavor
    font.save(out)
    print(out)


# Web (variable where the brief needs more than one setting)
make("archivo", {"wght": 800, "wdth": 75}, "src/fonts/archivo-display.woff2", "woff2", DISPLAY)
make("archivo", {"wght": (600, 800), "wdth": (62, 87)}, "src/fonts/archivo.woff2", "woff2")
make("serif", {"wght": 400, "opsz": (14, 36)}, "src/fonts/serif.woff2", "woff2")
make("serif-italic", {"wght": 450, "opsz": 18}, "src/fonts/serif-italic.woff2", "woff2")
make("mono", {"wght": 500, "wdth": 87.5}, "src/fonts/mono.woff2", "woff2")

# Open Graph (static instances for Satori)
make("archivo", {"wght": 800, "wdth": 62}, "og-fonts/archivo-800-62.ttf", None)
make("archivo", {"wght": 800, "wdth": 75}, "og-fonts/archivo-800-75.ttf", None)
make("archivo", {"wght": 600, "wdth": 87}, "og-fonts/archivo-600-87.ttf", None)
make("serif", {"wght": 400, "opsz": 36}, "og-fonts/serif-400-36.ttf", None)
make("serif-italic", {"wght": 450, "opsz": 18}, "og-fonts/serif-italic-450-18.ttf", None)
make("mono", {"wght": 500, "wdth": 87.5}, "og-fonts/mono-500-87.ttf", None)

# Tiny extension files for the few Latin Extended letters in speaker and country names.
# Loaded only when a page uses one of these characters (unicode-range).
EXT_CHARS = "ğėćēčşšĞĖĆĒČŞŠ"
SRC_EXT = {
    "archivo": f"{FS}/archivo/files/archivo-latin-ext-wdth-normal.woff2",
    "serif": f"{FS}/source-serif-4/files/source-serif-4-latin-ext-opsz-normal.woff2",
    "mono": f"{FS}/martian-mono/files/martian-mono-latin-ext-wdth-normal.woff2",
}


def make_ext(name, axes, out):
    font = TTFont(SRC_EXT[name], lazy=False)
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["kern"]
    opts.notdef_outline = False
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=[ord(c) for c in EXT_CHARS])
    sub.subset(font)
    font = instancer.instantiateVariableFont(font, axes)
    font.flavor = "woff2"
    font.save(out)
    print(out)


make_ext("archivo", {"wght": (600, 800), "wdth": (62, 87)}, "src/fonts/archivo-ext.woff2")
make_ext("serif", {"wght": 400, "opsz": (14, 36)}, "src/fonts/serif-ext.woff2")
make_ext("mono", {"wght": 500, "wdth": 87.5}, "src/fonts/mono-ext.woff2")
