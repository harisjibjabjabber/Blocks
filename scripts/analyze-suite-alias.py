"""Analyze raw coherent-sine fixtures from harmonics_suite_quality_probe.cpp.

Run: python scripts/analyze-suite-alias.py path/to/probe-output
Requires NumPy. No window:8192samples contain an integer number of cycles.
Bins belonging to legal in-band harmonics are excluded; remaining energy is
reported relative to fundamental, or octave for Rectify (which removes pitch1).
This is a narrow steady-sine test, not broadband/alias-free certification.
"""
import json
import pathlib
import re
import sys
import numpy as np

folder = pathlib.Path(sys.argv[1])
rows = []
for path in sorted(folder.glob("colour-*.f64")):
    style, drive, bin_number = map(int, re.search(r"colour-(\d+)-drive-(\d+)-bin-(\d+)", path.name).groups())
    samples = np.fromfile(path, dtype="<f8")
    assert len(samples) == 8192 and np.isfinite(samples).all()
    spectrum = abs(np.fft.rfft(samples)) ** 2
    mask = np.ones(len(spectrum), bool)
    mask[0] = False
    mask[bin_number::bin_number] = False
    reference = spectrum[bin_number * (2 if style == 4 else 1)]
    rows.append({"style": style, "drive_db": drive,
                 "frequency_hz": 48000 * bin_number / 8192,
                 "nonharmonic_db": float(10 * np.log10(max(spectrum[mask].sum(), 1e-30) / max(reference, 1e-30))),
                 "peak": float(max(abs(samples))), "dc": float(samples.mean())})
assert len(rows) == 30
result = json.dumps(rows, indent=2)
(folder / "alias-report.json").write_text(result)
print(result)
