#!/bin/bash
# Fetches the git repo into ./data/<PROJECT_NAME> and gets .gitblame output for all of the files
# Processes this into an easy to read <ref>.allcounts file which contains lines that look like:
# <file> <email> <line count>
# 
# Examples:
#./analyze.sh <PROJECT_NAME> <PROJECT_REPO> <REF>
#./analyze.sh mwext-Wikibase https://github.com/wikimedia/Wikibase.git master
#./analyze.sh mwext-WikibaseLexeme https://github.com/wikimedia/mediawiki-extensions-WikibaseLexeme.git REL1_35

PROJECT_NAME=$1
PROJECT_REPO=$2
REF=$3

# Get the code
echo "$PROJECT_NAME: Getting code for $PROJECT_REPO"
if [ -d ./data/$PROJECT_NAME ] 
then
	git --git-dir ./data/$PROJECT_NAME/.git fetch
else
	git clone --no-checkout $PROJECT_REPO ./data/$PROJECT_NAME
fi

OUTPUT_FILES=./data/$PROJECT_NAME/$REF.allfiles
OUTPUT_COUNTS=./data/$PROJECT_NAME/$REF.allcounts

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
	> $OUTPUT_FILES
# Remove folders from the list
while read FILE_PATH; do
	if [ -d "${FILE_PATH}" ]; then
		sed -i /$FILE_PATH/d $OUTPUT_FILES
		continue
	fi
done < $OUTPUT_FILES

FILE_COUNT=$(cat $OUTPUT_FILES | wc -l)

# Save blame for all of the files
echo "$PROJECT_NAME: Generating blames for $FILE_COUNT files"
while read FILE_PATH; do
	OUTPUT_BLAME=./data/$PROJECT_NAME/$FILE_PATH.$REF.gitblame
	OUTPUT_DIR=$(dirname $OUTPUT_BLAME)
	mkdir -p $OUTPUT_DIR
	git --git-dir ./data/$PROJECT_NAME/.git blame --show-email $REF $FILE_PATH > $OUTPUT_BLAME
done < $OUTPUT_FILES

# Create a fresh file for the final output counts
rm $OUTPUT_COUNTS
touch $OUTPUT_COUNTS

# Calculate the counts
echo "$PROJECT_NAME: Collecting results $FILE_COUNT"
while read FILE_PATH; do
	OUTPUT_BLAME=./data/$PROJECT_NAME/$FILE_PATH.$REF.gitblame
	declare -A AUTHORS
	# EXAMPLE: fca2a09a0d2 (<addshorewiki@gmail.com> 2020-01-10 10:32:46 +0000  1) <?php
	# 1 hash, 2 email, 3 date time, 4 line number, 5 line
	REGEX="^([[:alnum:]]+) \(<([^@]+\@[^>]+)> ([0-9]{4}\-[0-9]{2}\-[0-9]{2} [0-9]{2}\:[0-9]{2}\:[0-9]{2} \+[0-9]{4})\s+([0-9]+)\)(.*)$"
	while read BLAME_LINE; do
		if [[ "$BLAME_LINE" =~ $REGEX ]]; then
			((AUTHORS["${BASH_REMATCH[2]}"]++))
		fi
	done < $OUTPUT_BLAME
	for i in "${!AUTHORS[@]}"
	do
		EMAIL=$i
		LINES="${AUTHORS[$i]}"
		echo "$FILE_PATH $EMAIL $LINES" >> $OUTPUT_COUNTS
	done
done < $OUTPUT_FILES

echo "$PROJECT_NAME: Done!"