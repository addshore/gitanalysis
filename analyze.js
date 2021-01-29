const fs = require('fs');
const lineByLine = require('n-readlines');
const spawn = require("child_process").spawn;
const { exit } = require('process');

/**
 * Example usage:
 * node main.js input.json master
 */

// Get user input
var myArgs = process.argv.slice(2);
var inputFile = myArgs[0];
var inputRef = myArgs[1];
console.log("Running for input file " + inputFile);
var input = JSON.parse(fs.readFileSync(inputFile,{encoding:'utf8', flag:'r'}));

// Run the thing
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
    // TODO run the below again...
    input.code.forEach(function(codeDetails) {
        // TODO don't hardcode master
        childProcesses.push(spawnWithOut(spawn("./analyze.sh", [codeDetails.name, codeDetails.git, "master"])));
    });

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
    // TODO re enable this
    let spawned = spawnWithOut(spawn("./join.sh", ["master"]))
    while (spawned.exitCode == null) {
        await new Promise(resolve => setTimeout(resolve, 250))
    }

    // Generate data for each component
    // TODO don't hardcode master
    let allCountsData = 'data/master.allcounts'
    let teamEmails = input.team;
    let projectComponents = input.components;
    let compiledData = {
        total: {
            false:0,
            true:0
        }
    }

    const liner = new lineByLine(allCountsData);
    let line;
    let lineNumber = 0;
    let foundEmails = [];
    while (line = liner.next()) {
        let lineParts = line.toString('ascii').split(" ");
        let path = lineParts[0]
        let email = lineParts[1]
        let lines = parseInt(lineParts[2])
        let inTeam = (teamEmails.indexOf(email) > -1)
        let component = 'ungrouped'

        if(!foundEmails.includes(email)) {
            foundEmails.push(email)
        }

        componentLoop: for (let componentName in projectComponents) {
            for(let i = 0; i < projectComponents[componentName].length; i++){
                let componentPath = projectComponents[componentName][i]
                if(path.startsWith(componentPath)){
                    component = componentName
                    break componentLoop;
                }
            }
        }

        // TODO output un-grouped files to a useful list?

        if(!compiledData.hasOwnProperty(component)){
            compiledData[component] = {
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

    // TODO don't hardcode master
    fs.writeFileSync("data/master.allemails",foundEmails.join("\n"))
    fs.writeFileSync("data/master.data",JSON.stringify(compiledData,null,'\t'))

    console.log(compiledData)

}
