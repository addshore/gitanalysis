const fs = require('fs');
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

// The main function...
async function main() {

    // Collect the input for each repo...
    var childProcesses = [];
    input.code.forEach(function(codeDetails) {
        // TODO don't hardcode master
        let spawned = spawn("./analyze.sh", [codeDetails.name, codeDetails.git, "master"]);
        spawned.stdout.on('data', function (data) {
            process.stdout.write(data.toString());
          });
          spawned.stderr.on('data', function (data) {
            process.stdout.write(data.toString());
          });
          spawned.on('exit', function (code) {
            console.log('child process exited with code ' + code.toString());
          });
        childProcesses.push(spawned);
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

    if(nonZeroExitCode) {
        exit(1)
    }

}
