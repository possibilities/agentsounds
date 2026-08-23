# 2. A Web Audio host, not a hand-written renderer

`src/audio-host.ts` assigns Web Audio globals from node-web-audio-api instead of implementing
an offline renderer for the player's whitelist. The whitelist is small enough to reimplement,
but AudioParam automation, biquad coefficients and convolution are exactly where a
reimplementation goes subtly and inaudibly wrong, and "sounds slightly different from the
site" is the one defect this project cannot tolerate. The trade is a native dependency. Only
`src/render.ts` and this file would change if it has to go.
