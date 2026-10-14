"""Une scène dessinée de bas en haut ; les calques d'encre (et leurs réserves)
s'en déduisent : une forme pleine réserve tout ce qu'elle recouvre, une trame
se surimprime."""


class Scene:
    def __init__(self):
        self.items = []   # dict(els, ink, kind, width, knock, key)
        self.opts = {}

    def _add(self, ink, els, kind, width=None, knock=True, screen=None):
        key = (ink, screen) if screen else (ink, None)
        self.items.append(dict(els="".join(els), ink=ink, kind=kind, width=width, knock=knock, key=key))
        return self

    def fill(self, ink, *els, knock=True):
        return self._add(ink, els, "fill", knock=knock)

    def over(self, ink, *els):
        """Aplat surimprimé : ne réserve rien dessous."""
        return self._add(ink, els, "fill", knock=False)

    def stroke(self, ink, width, *els, knock=True):
        return self._add(ink, els, "stroke", width=width, knock=knock)

    def paper(self, *els):
        return self._add(None, els, "fill", knock=True)

    def paper_stroke(self, width, *els):
        return self._add(None, els, "stroke", width=width, knock=True)

    def tint(self, ink, *els, screen="a", **opts):
        """Trame surimprimée : `els` porte ses propres densités (dégradés, gris)."""
        self._add(ink, els, "raw", knock=False, screen=screen)
        o = dict(screen=True)
        o.update(opts)
        self.opts[(ink, screen)] = o
        return self

    def layer_opts(self, ink, screen=None, **opts):
        self.opts.setdefault((ink, screen), {}).update(opts)
        return self

    @staticmethod
    def _draw(item, color):
        if item["kind"] == "fill":
            return f'<g fill="{color}" stroke="none">{item["els"]}</g>'
        if item["kind"] == "stroke":
            return (f'<g fill="none" stroke="{color}" stroke-width="{item["width"]}" stroke-linecap="round" '
                    f'stroke-linejoin="round">{item["els"]}</g>')
        return item["els"]

    def layers(self):
        keys = []
        for it in self.items:
            if it["ink"] is not None and it["key"] not in keys:
                keys.append(it["key"])
        out = []
        for key in keys:
            body = []
            started = False
            for it in self.items:
                if it["key"] == key and it["ink"] is not None:
                    body.append(self._draw(it, "white"))
                    started = True
                elif started and it["knock"] and it["kind"] != "raw":
                    body.append(self._draw(it, "black"))
            out.append((key[0], "".join(body), self.opts.get(key, {})))
        return out
