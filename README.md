# git analysis

Work In Progress: Tooling to see what % of a set of codebases was written by a team.

**TODOs:**

- Work for repos that don't have a "master" branch (like release prototype and arch docs)
- Input of a date (rather than master), and git would be used to find a commit to look at per repo etc.
- Think about allowing the definition of multiple teams?
- Stop files from being allowed in multiple components? (maybe?) Maybe with regex includes and excludes?
- Tests

## Usage

Create a JSON file to input.

Then run the script:

```sh
node analyze.js config/wmde-wdwb.json
```

And wait for the processing to happen...

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

For now see the config directory