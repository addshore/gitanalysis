const fs = require('fs');
const lineByLine = require('n-readlines');
const spawn = require("child_process").spawn;
const { exit } = require('process');
const tablemark = require('tablemark')
const yaml = require('js-yaml');

/**
 * Example usage:
 * node main.js input.yaml master
 */

var optionator = require('optionator')({
    prepend: 'Usage: ganalyze [options] input.yaml',
    append: 'Version 0.0.0',
    options: [{
        option: 'help',
        alias: 'h',
        type: 'Boolean',
        description: 'displays help'
    }, {
        option: 'noanalyze',
        type: 'Boolean',
        description: 'Don\'t re-analyze, use existing data',
        example: 'ganalyze --noanalyze input.yaml'
    }]
});

var options = optionator.parseArgv(process.argv);
if (options.help) {
    console.log(optionator.generateHelp());
    exit();
}

// Get user input
var configFile = options._[0];
var skipAnalyze = options.noanalyze;
var rawConfig = yaml.load(fs.readFileSync(configFile, 'utf8'));

// TODO add some basic validation for the config...

// Config contains all of the data it needs per date (created from our rawConfig)
var config = {}
// There is a top level snapshots key, within are keys for dates, and within are keys for people names (which map to emails)
for (let dateKey in rawConfig['snapshots']) {
    let date = rawConfig['snapshots'][dateKey]
    dateObj = new Date(date)

    // Find ppl who have started but not yet ended on this date
    // Each person has 3 keys, start, end, and email
    let emailsForSnapshot = []
    for (let personKey in rawConfig['people']) {
        let person = rawConfig['people'][personKey]
        let personStart = new Date(person.start)
        let personEnd = new Date(person.end)
        let personStarted = personStart == undefined || personStart <= dateObj
        let personEnded = personEnd == undefined || personEnd >= dateObj
        if(personStarted && !personEnded) {
            emailsForSnapshot = emailsForSnapshot.concat(person.emails)
        }
    }

    // Create an entry for this date
    config[normalizeDate(date)] = {}
    config[normalizeDate(date)].team = emailsForSnapshot
    config[normalizeDate(date)].code = rawConfig['code']
    config[normalizeDate(date)].components = rawConfig['components']
}

// Run the thing
console.log("Running with config file " + configFile );
if (!skipAnalyze) {
    mainmainProcess();
}
mainmainOutput();

function spawnWithOut(childProcess) {
    childProcess.stdout.on('data', function (data) {
        process.stdout.write(data.toString());
    });
    childProcess.stderr.on('data', function (data) {
        process.stdout.write(data.toString());
    });
    childProcess.on('exit', function (code) {
        if (code != 0) {
            console.log('child process exited with code ' + code.toString());
        }
    });
    return childProcess
}

function normalizeDate(date) {
    let dateObj = new Date(date)
    return dateObj.getFullYear() + '-' + (dateObj.getMonth() + 1) + '-' + dateObj.getDate()
}

function normalizeDateForOut(date) {
    let dateObj = new Date(date)
    let year = dateObj.getFullYear()
    let month = (dateObj.getMonth() + 1).toString().padStart(2, '0')
    let day = dateObj.getDate().toString().padStart(2, '0')
    return year + '-' + month + '-' + day
}

// The mainmain processing function...
async function mainmainProcess() {
    // Firstly collect all git repos from all dates in the config
    let allRepos = []
    for (let date in config) {
        let input = config[date]
        for (let projectName in input.code) {
            let projectRepo = input.code[projectName]
            allRepos.push(projectRepo)
        }
    }
    allRepos = [...new Set(allRepos)]
    // And then make sure we have them all on disk, for all of the processing to access
    let codeFetchProcesses = [];
    for (let i = 0; i < allRepos.length; i++) {
        let projectRepo = allRepos[i]
        let projectName = projectRepo.split('/').pop().split('.')[0]
        codeFetchProcesses.push(spawnWithOut(spawn("./getcode.sh", [projectName, projectRepo])));
    }
    // Wait for them to finish running
    let nonZeroExitCode = await waitForAllProccesses(codeFetchProcesses)
    // Bail if one of the scripts broke
    if(nonZeroExitCode) {
        console.log("Got a non zero exit code D:")
        exit(1)
    }

    // Run the main function for each date requested
    await Promise.all(Object.entries(config).map(async ([date, input]) => {
        let normalDate = normalizeDate(date);
        console.log("Running for date " + normalDate);
        await main(normalDate, input);
        console.log("Done running for date " + normalDate);
    }));
}

async function mainmainOutput() {
    // FINAL FINAL processing
    console.log("Final processing")
    let allEmails = []
    // All data will end up being a table
    // Each object in the table is a row, with keys of the column names
    // We aim for component names in column A, and then the rest of the columns are the data
    // The headings are the date, and the actual data is the team% for that date
    let allData = {}
    for (let date in config) {
        console.log("Processing " + date)
        let normalDate = normalizeDate(date)

        let emails = fs.readFileSync("data/" + normalDate + "/allemails", 'utf8').split("\n")
        allEmails = allEmails.concat(emails)

        let data = JSON.parse(fs.readFileSync("data/" + normalDate + "/data", 'utf8'))
        for(let i = 0; i < data.length; i++){
            let dataRow = data[i]
            let componentName = dataRow.name
            let teamPercent = dataRow["team%"]
            // Try to find the row, representing the component
            if(!allData.hasOwnProperty(componentName)){
                allData[componentName] = {
                    name: componentName
                }
            }
            // Add the data to the row
            allData[componentName][normalizeDateForOut(date)] = teamPercent
        }
    }

    // Put a couple of things first
    let ungrouped = allData["ungrouped"]
    delete allData["ungrouped"]
    allData = {ungrouped: ungrouped, ...allData}
    let total = allData["Total"]
    delete allData["Total"]
    allData = {Total: total, ...allData}

    console.log("Final output...")

    // Make allEmails unique and sort
    allEmails = [...new Set(allEmails)]
    allEmails.sort()

    // Output all emails
    fs.writeFileSync("data/allemails",allEmails.join("\n"))

    // Output all data
    fs.writeFileSync("data/data",JSON.stringify(allData,null,'\t'))

    // And output it as a markdown table
    let compiledMarkdown = tablemark(Object.values(allData))
    fs.writeFileSync("data/data.md",compiledMarkdown)
    console.log(compiledMarkdown)
}

async function waitForAllProccesses(childProcesses) {
    let waitingForProcessing = true;
    let nonZeroExitCode = false;
    while (waitingForProcessing) {
        waitingForProcessing = false;
        for(let i = 0; i < childProcesses.length; i++){
            let process = childProcesses[i]
            if(process.exitCode == null) {
                waitingForProcessing = true;
                await new Promise(resolve => setTimeout(resolve, 250))
                break
            }
            if(process.exitCode != 0) {
                nonZeroExitCode = process.exitCode
            }
        }
        // wait 10ms
        await new Promise(resolve => setTimeout(resolve, 10))
    }
    return nonZeroExitCode
}

// The main function...
async function main(inputDate, input) {
    // Collect the input for each repo...
    let childProcesses = [];
    if(!skipAnalyze) {
        for (let projectName in input.code) {
            let projectRepo = input.code[projectName]
            childProcesses.push(spawnWithOut(spawn("./analyze.sh", [projectName, projectRepo, inputDate])));
        }
    }

    // Wait for them to finish running
    let nonZeroExitCode = await waitForAllProccesses(childProcesses)
    // Bail if one of the scripts broke
    if(nonZeroExitCode) {
        console.log("Got a non zero exit code D:")
        exit(1)
    }

    // Join all the counts together
    if(!skipAnalyze) {
        let spawned = spawnWithOut(spawn("./join.sh", [inputDate]))
        while (spawned.exitCode == null) {
            await new Promise(resolve => setTimeout(resolve, 250))
        }
    }

    // Generate data for each component
    let allCountsData = 'data/' + inputDate + '/allcounts'
    let teamEmails = input.team;
    let projectComponents = input.components;
    let compiledData = {
        total: {
            name:"Total",
            false:0,
            true:0
        }
    }

    if(!fs.existsSync(allCountsData)) {
        console.log(allCountsData + " does not yet exist!")
        exit();
    }

    const liner = new lineByLine(allCountsData);
    let line;
    let lineNumber = 0;
    let foundEmails = [];
    let ungroupedFiles = [];
    while (line = liner.next()) {
        let lineParts = line.toString('ascii').split(" ");
        let lines = parseInt(lineParts.pop())
        let email = lineParts.pop()
        let path = lineParts.join(' ')
        let inTeam = (teamEmails.indexOf(email) > -1)
        let component = 'ungrouped'

        componentLoop: for (let componentName in projectComponents) {
            for(let i = 0; i < projectComponents[componentName].length; i++){
                let componentPath = projectComponents[componentName][i]
                if(path.startsWith(componentPath)){
                    component = componentName
                    break componentLoop;
                }
            }
        }

        if(!foundEmails.includes(email)) {
            foundEmails.push(email)
        }
        if(component == 'ungrouped' && !ungroupedFiles.includes(path)) {
            ungroupedFiles.push(path)
        }

        if(!compiledData.hasOwnProperty(component)){
            compiledData[component] = {
                name : component,
                true : parseInt(0),
                false : parseInt(0)
            };
        }
        compiledData[component][inTeam] = compiledData[component][inTeam] + lines
        compiledData["total"][inTeam] = compiledData["total"][inTeam] + lines

        lineNumber++
    };

    // Add %s to compiledData
    componentLoop: for (let componentName in compiledData) {
        let componentsData = compiledData[componentName]
        compiledData[componentName]["team%"] = ( componentsData[true] / ( componentsData[true] + componentsData[false] ) * 100 ).toFixed(1)
    }

    compiledData = Object.values(compiledData)

    // Sort some output..
    foundEmails.sort()
    ungroupedFiles.sort()
    compiledData.sort(function(a,b){
        if(parseFloat(a["team%"]) < parseFloat(b["team%"])) {
            return 1
        }
        if(parseFloat(a["team%"]) > parseFloat(b["team%"])) {
            return -1
        }
        return 0
    })

    // Final output files
    fs.writeFileSync("data/" + inputDate + "/allemails",foundEmails.join("\n"))
    fs.writeFileSync("data/" + inputDate + "/ungrouped",ungroupedFiles.join("\n"))
    fs.writeFileSync("data/" + inputDate + "/data",JSON.stringify(compiledData,null,'\t'))

    // Markdown tableify
    let compiledMarkdown = tablemark(Object.values(compiledData))
    fs.writeFileSync("data/" + inputDate + "/data.md",compiledMarkdown)
    console.log(compiledMarkdown)

}
