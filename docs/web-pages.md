# Static web build

Later status is in [handover/README.md](handover/README.md). The workflow file on this history runs on push to `main` and on `workflow_dispatch`, and the public site is https://harisjibjabjabber.github.io/Blocks/ at base `/Blocks/`. Sentences below that say the workflow is dispatch-only, or that no hosted URL exists, describe an earlier pass. A commit that is not on `main` does not deploy that site.



The static site base path is exactly `/Blocks/`. `npm run build:web` sets `BLOCKS_BASE=/Blocks/` and writes `dist/`. GitHub project pages for the repository named Blocks serve that directory at `/Blocks/`.

The dev server does not set `BLOCKS_BASE`, so it stays at `/` on port 41713. That is local development, not the static site.

## Enable, HTTPS, and localhost

Web MIDI is only available in a secure context. Tap **Enable**. That click resumes the `AudioContext` before `navigator.requestMIDIAccess({ sysex: false })`. If the page is not a secure context, the click still resumes audio and does not ask for MIDI.

`http://localhost` and `http://127.0.0.1` are secure contexts. That is the only secure-context check this build has been run through. A public HTTPS host is not treated as verified until a fetch of the deployed page succeeds.

`.github/workflows/pages.yml` builds `dist/` with base `/Blocks/` and can deploy GitHub Pages. It runs only on `workflow_dispatch`. It stays unused when the account cannot serve private Pages.
