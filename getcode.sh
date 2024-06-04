#!/bin/bash
# Fetches the git repo into ./data/<PROJECT_NAME> and gets .gitblame output for all of the files
# Processes this into an easy to read <targetDate>/allcounts file which contains lines that look like:
# <file> <email> <line count>
# 
# Examples:
#./getcode.sh <PROJECT_NAME> <PROJECT_REPO>
#./getcode.sh mwext-Wikibase https://github.com/wikimedia/Wikibase.git
#./getcode.sh mwext-WikibaseLexeme https://github.com/wikimedia/mediawiki-extensions-WikibaseLexeme.git

source ./functions.sh

PROJECT_NAME=$1
PROJECT_REPO=$2

# Get the code
echo "$PROJECT_NAME: Getting code for $PROJECT_REPO"
cloneOrFetch $PROJECT_NAME $PROJECT_REPO