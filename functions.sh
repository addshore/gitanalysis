function cloneOrFetch() {
    name=$1
    repo=$2
    if [ -d ./data/$name ] 
    then
        git --git-dir ./data/$name/.git fetch
    else
        git clone --no-checkout $repo ./data/$name
    fi
}

# Take the raw git blame outputs (that are stored in files)
# And add everythign up, creating a $targetDate.allcounts file for the repo
function calculateCounts() {
    name=$1
    targetDate=$2

    FILES=./data/$name/$targetDate.allfiles

    # Create a fresh file for the final output counts
    OUTPUT_COUNTS=./data/$name/$targetDate.allcounts
    touch $OUTPUT_COUNTS
    rm $OUTPUT_COUNTS
    touch $OUTPUT_COUNTS

    REGEX="^([[:alnum:]]+)[[:space:]]+\(<([^@]+\@[^>]+)>[[:space:]]+([0-9]{4}\-[0-9]{2}\-[0-9]{2} [0-9]{2}\:[0-9]{2}\:[0-9]{2} \+[0-9]{4})[[:space:]]+([0-9]+)\)(.*)$"

    while read FILE_PATH; do
        declare -A AUTHORS=()
        # EXAMPLE: fca2a09a0d2 (<addshorewiki@gmail.com> 2020-01-10 10:32:46 +0000  1) <?php
        # 1 hash, 2 email, 3 date time, 4 line number, 5 line
        while read BLAME_LINE; do
            if [[ "$BLAME_LINE" =~ $REGEX ]]; then
                ((AUTHORS["${BASH_REMATCH[2]}"]++))
            fi
        done < "./data/${name}/${FILE_PATH}.${targetDate}.gitblame"
        for i in "${!AUTHORS[@]}"
        do
            EMAIL=$i
            LINES="${AUTHORS[$i]}"
            echo "$FILE_PATH $EMAIL $LINES" >> $OUTPUT_COUNTS
        done
    done < $FILES
}