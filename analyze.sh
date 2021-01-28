#!/bin/bash

PROJECT_NAME=$1
PROJECT_REPO=$2
REF=$3

# Convenience

# Get the code
echo "Getting code for $PROJECT_REPO"
if [ -d ./code/$PROJECT_NAME ] 
then
	git --git-dir ./code/$PROJECT_NAME/.git fetch
else
	git clone --no-checkout $PROJECT_REPO ./code/$PROJECT_NAME
fi

OUTPUT_FILES=./code/$PROJECT_NAME/$REF.allfiles
OUTPUT_COUNTS=./code/$PROJECT_NAME/$REF.allcounts

# List the files
echo "Collecting file list"
git --git-dir ./code/$PROJECT_NAME/.git ls-tree -r --name-only $REF \
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

FILE_COUNT=$(cat $OUTPUT_COUNTS | wc -l)

# Save blame for all of the files
echo "Generating blames for $FILE_COUNT files"
while read FILE_PATH; do
	OUTPUT_BLAME=./code/$PROJECT_NAME/$FILE_PATH.$REF.gitblame
	OUTPUT_DIR=$(dirname $OUTPUT_BLAME)
	mkdir -p $OUTPUT_DIR
	git --git-dir ./code/$PROJECT_NAME/.git blame --show-email $REF $FILE_PATH > $OUTPUT_BLAME
done < $OUTPUT_FILES

# Create a fresh file for the final output counts
echo "" > $OUTPUT_COUNTS

# Calculate the counts
echo "Collecting results $FILE_COUNT"
while read FILE_PATH; do
	OUTPUT_BLAME=./code/$PROJECT_NAME/$FILE_PATH.$REF.gitblame
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

echo "Done!"