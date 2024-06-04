#!/bin/bash
# Fetches the git repo into ./data/<PROJECT_NAME> and gets .gitblame output for all of the files
# Processes this into an easy to read <targetDate>/allcounts file which contains lines that look like:
# <file> <email> <line count>
# 
# Examples:
#./analyze.sh <PROJECT_NAME> <PROJECT_REPO> <TARGET_DATE>
#./analyze.sh mwext-Wikibase https://github.com/wikimedia/Wikibase.git 2017-01-01
#./analyze.sh mwext-WikibaseLexeme https://github.com/wikimedia/mediawiki-extensions-WikibaseLexeme.git 2020-01-01

source ./functions.sh

PROJECT_NAME=$1
PROJECT_REPO=$2
TARGET_DATE=$3

# Code stuff
MAIN_BRANCH=$(git --git-dir ./data/$PROJECT_NAME/.git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')
COMMIT=$(git --git-dir ./data/$PROJECT_NAME/.git rev-list -n 1 --before="$TARGET_DATE" $MAIN_BRANCH)
FILES=./data/$PROJECT_NAME/$TARGET_DATE/allfiles

# Make the dir and FILES file
mkdir -p $(dirname "$FILES")
touch "$FILES"

if [ -z "$COMMIT" ]; then
    echo "No commit found for date"
	exit
fi

# List the files
echo "$PROJECT_NAME: Collecting file list"
# TODO don't hardcode the global ignore list...
git --git-dir ./data/$PROJECT_NAME/.git ls-tree -r --name-only $COMMIT \
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
	OUTPUT_BLAME=./data/${PROJECT_NAME}/${TARGET_DATE}/${FILE_PATH}.gitblame
	OUTPUT_DIR=$(dirname "$OUTPUT_BLAME")
	mkdir -p $OUTPUT_DIR
	# -c forces the file name to NOT be included https://stackoverflow.com/a/33603112/4746236
	# -w ignore whitespace changes
	git --git-dir ./data/$PROJECT_NAME/.git blame --show-email -c -w $COMMIT "${FILE_PATH}" > "$OUTPUT_BLAME"
done < $FILES

# Calculate the counts
echo "$PROJECT_NAME: Collecting results $FILE_COUNT"
calculateCounts $PROJECT_NAME $TARGET_DATE

echo "$PROJECT_NAME: Done!"