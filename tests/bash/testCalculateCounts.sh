#!/bin/bash
# Must be run from in this directory...

source ./../../functions.sh

calculateCounts testProject master

cmp --silent ./data/testProject/master.allcounts ./data/testProject/master.allcounts.expected || echo "files are different" && exit 1