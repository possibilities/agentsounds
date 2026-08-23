# 1. Vendor the sound engine verbatim

The engine is copied byte-for-byte from procedural-sounds into `src/sounds/` rather than
ported, and never edited here. Byte-identity is what lets us claim a headless render is the
same node graph a browser builds, and it makes a re-sync a diff instead of an archaeology
dig. The cost is real and accepted: this repository's compiler flags are upstream's, and the
tree is excluded from lint, because the alternative is 9,000 lines of edits that make every
future sync a merge.
