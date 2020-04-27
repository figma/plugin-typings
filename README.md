This repository contains the typings for the Figma Plugin API.

It is intended to be installed as "@figma/plugin-typings" and the types should become globally available without needing to use import statements. We do it this way because the plugin API is part of the host environment, as opposed to being a package that a plugin includes.

The plugin will need to have a `tsconfig.json` which contains `"typeRoots": ["./node_modules/@types", "./node_modules/@figma"]` otherwise TypeScript won't look in the `node_modules/@figma/plugin-typings` folder by default.

Plugin API releases have the format "Version X, Update Y". Equivalent tags are created in this repository as `v<x>.<y>`. Note that not all API releases include API changes, some are just bug fixes. Therefore, some typings versions are skipped.
