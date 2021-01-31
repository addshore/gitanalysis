# git analysis

Work In Progress: Tooling to see what % of a set of codebases was written by a team.

![](https://i.imgur.com/mXBexVJ.png)

**TODOs:**

- Think about allowing the definition of multiple teams?
- Stop files from being allowed in multiple components? (maybe?) Maybe with regex includes and excludes?
- Tests
- Think about co-authors? (would likely make it much slower)
- Think about code review (need gerrit and or github api calls? D:)
- Configurable global ignore regexes (currently hardcoded)

## Requirements

- nodejs 10+
- bash, git, sed

## Usage

Create a JSON file to input.

Then run the script:

```sh
node analyze.js config/wmde-wdwb.json
```

And wait for the processing to happen...

## What it does

1) Clone or fetch the needed git repos
2) run git blame on all files, saving output to disk
3) compile the blames into per repo # of lines touched in files per email
4) compile these counts into a single file of `path email lines-touched`
5) analyse this file based on the desired components and team emails

## Code

A node JS cli script wraps a couple of bash scripts.

Bash scripts are used for speed and provide base data that is then analysed in node.

- `analyze.js` - Main CLI entry point, which has some logic and calls various bash scripts
  - `functions.sh` - Bash functions used in multiple scripts
  - `analyze.sh` - Generates the per repo file lines touched by emails
  - `join.sh` - Joins multiple analyze.sh outputs into one file

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