"""Score Stage-1 top-1 labels with mir_eval.chord (MIT, v0.8.2) comparison functions.
Duration-weighted over labelled spans. Abstentions are scored as 'N' (no chord), so they count against
the predictor here even when abstention was appropriate; see the abstention metric in evaluate-harmony.mjs.
SYNTHETIC fixtures, provisional labels: not an accuracy claim."""
import json, sys
import numpy as np
import mir_eval.chord as C
out = {}
for path in sys.argv[1:]:
    d = json.load(open(path))
    ref = [p["ref"] for p in d["pairs"]]; est = [p["est"] for p in d["pairs"]]; w = np.array([p["durS"] for p in d["pairs"]])
    row = {}
    for name in ["root", "thirds", "sevenths", "mirex", "majmin", "tetrads"]:
        s = np.array(getattr(C, name)(ref, est), dtype=float)
        ok = s >= 0  # mir_eval returns -1 for pairs it excludes (e.g. majmin on non-majmin refs)
        row[name] = round(float((s[ok] * w[ok]).sum() / w[ok].sum()), 3) if ok.any() else None
        row[name + "_n"] = int(ok.sum())
    out[d["set"]] = row
    print(d["set"], json.dumps(row))
json.dump(out, open("/tmp/mireval.json", "w"))
