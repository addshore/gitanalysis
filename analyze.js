const fs = require('fs');
const lineByLine = require('n-readlines');
const spawn = require("child_process").spawn;
const { exit } = require('process');
const tablemark = require('tablemark')

/**
 * Example usage:
 * node main.js input.json master
 */

var optionator = require('optionator')({
    prepend: 'Usage: ganalyze [options] input.json <date>',
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
        example: 'ganalyze --noanalyze input.json <date>'
    }]
});

var options = optionator.parseArgv(process.argv);
if (options.help) {
    console.log(optionator.generateHelp());
    exit();
}

// Get user input
var inputFile = options._[0];
var inputDate = options._[1];
var skipAnalyze = options.noanalyze;
var input = JSON.parse(fs.readFileSync(inputFile,{encoding:'utf8', flag:'r'}));
// Fallback to today if no date is defined
if(inputDate == undefined) {
    let currentDate = new Date();
    inputDate=currentDate.getFullYear() + '-' + (currentDate.getMonth() + 1) + '-' + currentDate.getDate()
}

// Run the thing

console.log("Running for input file " + inputFile + " and date " + inputDate);
main();

function spawnWithOut(childProcess) {
    childProcess.stdout.on('data', function (data) {
        process.stdout.write(data.toString());
    });
    childProcess.stderr.on('data', function (data) {
        process.stdout.write(data.toString());
    });
    childProcess.on('exit', function (code) {
        console.log('child process exited with code ' + code.toString());
    });
    return childProcess
}


// The main function...
async function main() {

    // Collect the input for each repo...
    var childProcesses = [];
    if(!skipAnalyze) {
        for (let projectName in input.code) {
            let projectRepo = input.code[projectName]
            childProcesses.push(spawnWithOut(spawn("./analyze.sh", [projectName, projectRepo, inputDate])));
        }
    }

    // Wait for them to finish running
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
    }

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
    let allCountsData = 'data/' + inputDate + '.allcounts'
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
        let path = lineParts[0]
        let email = lineParts[1]
        let lines = parseInt(lineParts[2])
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
                false : parseInt(0),
                true : parseInt(0)
            };
        }
        compiledData[component][inTeam] = compiledData[component][inTeam] + lines
        compiledData["total"][inTeam] = compiledData["total"][inTeam] + lines

        lineNumber++
    };

    // Add %s to compiledData
    componentLoop: for (let componentName in compiledData) {
        let componentsData = compiledData[componentName]
        compiledData[componentName]["team%"] = componentsData[true] / ( componentsData[true] + componentsData[false] ) * 100
    }

    // Final output files
    fs.writeFileSync("data/" + inputDate + ".allemails",foundEmails.join("\n"))
    fs.writeFileSync("data/" + inputDate + ".ungrouped",ungroupedFiles.join("\n"))
    fs.writeFileSync("data/" + inputDate + ".data",JSON.stringify(compiledData,null,'\t'))

    // Useful user output
    console.log(tablemark(Object.values(compiledData)))

}
