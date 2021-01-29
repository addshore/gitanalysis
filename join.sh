#!/bin/bash
# Joins various reports for individual repos into one large report!

REF=$1

OUTPUT_COUNTS=$REF.allcounts
JOINED_OUTPUT_COUNTS=data/$REF.allcounts

echo "Joining multiple repo blames"

rm $JOINED_OUTPUT_COUNTS
touch $JOINED_OUTPUT_COUNTS
for d in ./data/*/; do
	echo "Joining $d"
	while read LINE; do
		if [ -n "$d" ]; then
			echo ${d:7:-1}/$LINE >> $JOINED_OUTPUT_COUNTS
		fi
	done < $d$OUTPUT_COUNTS
done
