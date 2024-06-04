#!/bin/bash
# Joins various reports for individual repos into one large report!

TARGET_DATE=$1

OUTPUT_COUNTS=$TARGET_DATE/allcounts
JOINED_OUTPUT_COUNTS=data/$TARGET_DATE/allcounts

# Make data/$TARGET_DATE dir if it doesn't exist
mkdir -p data/$TARGET_DATE

echo "Joining multiple repo blames"

rm $JOINED_OUTPUT_COUNTS
touch $JOINED_OUTPUT_COUNTS
for d in ./data/*/; do
	INDIVIDUAL_OUTPUT_COUNTS_FILE=$d$OUTPUT_COUNTS

	# It's perfectly fine for a file to not exist, if for example a date is given for when a repo didn't exist.
	if [ ! -f "$INDIVIDUAL_OUTPUT_COUNTS_FILE" ]; then
		echo "$INDIVIDUAL_OUTPUT_COUNTS_FILE does not exist."
		continue
	fi

	echo "Joining $d"
	while read LINE; do
		if [ -n "$d" ]; then
			echo ${d:7:-1}/$LINE >> $JOINED_OUTPUT_COUNTS
		fi
	done < $INDIVIDUAL_OUTPUT_COUNTS_FILE
done
