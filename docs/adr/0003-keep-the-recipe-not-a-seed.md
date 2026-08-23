# 3. A sound is made stable by keeping its recipe, not by seeding a draw

Every draw is fresh, as it is in the product page: generate until one fits. A sound that must
sound the same twice is kept as a recipe file and replayed with `--sound`. A `--seed` flag was
considered and rejected because it would create a second identity for a sound alongside its
derived name, which is already a hash of the recipe and already guarantees that the same
recipe names and sounds alike. A kept recipe carries its leveled volume baked in, matching
the product's Copy sound, because leveling is solved at play time and never stored in a patch.
