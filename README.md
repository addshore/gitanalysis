# git analysis

WIP and currently doing EVIL things...

```
mwext-Wikibase/view/lib/wikibase-tainted-ref/.eslintrc.js tools.libraryupgrader@tools.wmflabs.org 3798
```

?????

## Usage

Create a JSON file to input.

Then run the script:

```sh
node analyze.js input.json
```

And wait for the processing the happen...

## Global behaviors

### Components files

It is possible for a file to appear in multiple components!

### Submodules

Are not checked (will output and error)

### Global Ignores

Some files are globally ignored for speed:

- `.tests.js$`
- `tests/`
- `i18n/`
- `.phan/`
- `.github/`

In the future these might also be configurable...

## Configuration

TBA
