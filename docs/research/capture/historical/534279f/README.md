# Historical cut, commits 534279f and fadfdcf

`recent-phrase.ts` in this directory is a byte copy of git blob `93292fe449865871f63df08766b7f57ec823e2c7`.

That blob is `src/domain/recent-phrase.ts` at both:

- `534279fd78ffe6e48bbc24107e556e22e112b31b`
- `fadfdcf63c103e3b451be56c78782ad7263374bd`

The two commits match. The snapshot did not include this file. The research scripts pointed at `/workspace/research/blocks-534279f/recent-phrase.ts`, which was outside the archives. This copy was taken from this repository's git history so a checkout can load the harness. File sha256: `545abaac8f59fd275ba97d2f32fcb074c3d38938c25a5c56979227abb487e295`.

It is not the cut in `fdba348` (blob `1a5c2989dd77a101b242d8beedef378d7774203f`) or `497894e` (blob `3742f05ed36ecb93c1e975862e55adb4783f1389`). A run of this file is not evidence against those commits or the current pipeline. The harness was not rerun for the handover import.

The only import is a type import of `./capture`, which is not beside this file. Load it with Node's type stripping (`node --experimental-strip-types`). That command was not run here.
