#!/bin/bash
# Fetches the git repo into ./data/<PROJECT_NAME> and gets .gitblame output for all of the files
# Processes this into an easy to read <ref>.allcounts file which contains lines that look like:
# <file> <email> <line count>
# 
# Examples:
#./analyze.sh <PROJECT_NAME> <PROJECT_REPO> <REF>
#./analyze.sh mwext-Wikibase https://github.com/wikimedia/Wikibase.git master
#./analyze.sh mwext-WikibaseLexeme https://github.com/wikimedia/mediawiki-extensions-WikibaseLexeme.git REL1_35

source ./functions.sh

PROJECT_NAME=$1
PROJECT_REPO=$2
REF=$3

# Get the code
echo "$PROJECT_NAME: Getting code for $PROJECT_REPO"
cloneOrFetch $PROJECT_NAME $PROJECT_REPO

FILES=./data/$PROJECT_NAME/$REF.allfiles

# List the files
echo "$PROJECT_NAME: Collecting file list"
# TODO don't hardcode the global ignore list...
git --git-dir ./data/$PROJECT_NAME/.git ls-tree -r --name-only $REF \
	| grep -v ".tests.js$"\
	| grep -v "Test.php$"\
	| grep -v "tests/"\
	| grep -v "i18n/"\
	| grep -v ".phan/"\
	| grep -v ".github/"\
	> $FILES
# Remove folders from the list
while read FILE_PATH; do
	if [ -d "${FILE_PATH}" ]; then
		sed -i /$FILE_PATH/d $FILES
		continue
	fi
done < $FILES

FILE_COUNT=$(cat $FILES | wc -l)

# Save blame for all of the files
echo "$PROJECT_NAME: Generating blames for $FILE_COUNT files"
while read FILE_PATH; do
	OUTPUT_BLAME=./data/$PROJECT_NAME/$FILE_PATH.$REF.gitblame
	OUTPUT_DIR=$(dirname $OUTPUT_BLAME)
	mkdir -p $OUTPUT_DIR
	# -c forces the file name to NOT be included https://stackoverflow.com/a/33603112/4746236
	# -w ignore whitespace changes
	git --git-dir ./data/$PROJECT_NAME/.git blame --show-email -c -w $REF $FILE_PATH > $OUTPUT_BLAME
done < $FILES

# Calculate the counts
echo "$PROJECT_NAME: Collecting results $FILE_COUNT"
calculateCounts $PROJECT_NAME $REF

echo "$PROJECT_NAME: Done!"