Sources for the PNGs in `public/icons/`, rasterized from `icon.svg` (off) and `icon-active.svg` (on). Regenerate after editing the SVGs:

```bash
for n in icon icon-active; do for s in 16 32 48 128; do sips -s format png -z $s $s $n.svg --out ../public/icons/$n-$s.png; done; done
```
