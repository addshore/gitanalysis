package cmd

import (
	"io/ioutil"
	"encoding/json"
	"path/filepath"
	"regexp"
	"strings"
	"os/user"
	"log"
	"github.com/spf13/cobra"
	"os"
	"fmt"
	"github.com/go-git/go-git/v5"
)
var myVersion string
var mySourceDate string

var Verbose bool
var Version bool

func Execute(appVersion string, appSourceDate string) {
	rootCmd.PersistentFlags().BoolVarP(&Verbose, "verbose", "v", false, "verbose output")
	rootCmd.PersistentFlags().BoolVarP(&Version, "version", "", false, "version infomation")
	myVersion = appVersion
	mySourceDate = appSourceDate

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

type Config struct {
	Repos []Repo
	IgnoreRegex []string
	IgnoreExtensions []string
}

type Repo struct {
	Url string
}

func (r Repo) DirName() string {
	s := string(r.Url)
	s = strings.Replace(s,"://","_", -1)
	s = strings.Replace(s,".git","", -1)
	s = strings.Replace(s,"/","_", -1)
	return s
}

func (r Repo) DirNameInDir( inDir string ) string {
	return inDir + "/" + r.DirName()
}

var rootCmd = &cobra.Command{
	Use: `gitanalysis [repo...]`,
	Short: "Run the command",
	Run: func(cmd *cobra.Command, args []string) {
		if(Version){
			fmt.Println("Version: " + myVersion)
			fmt.Println("Built at : " + mySourceDate)
			os.Exit(0)
		}

		// if(len(args)== 0) {
		// 	fmt.Println("Error: requires at least 1 arg(s), only received 0")
		// 	fmt.Println("Use --help to see help text")
		// 	os.Exit(0)
		// }

		// TODO read this from an argument or something?
		configJson, err := ioutil.ReadFile("input.json")
		if err != nil {
			panic(err)
		}
		var config Config
		err = json.Unmarshal(configJson, &config)
		if err != nil { // don't forget handle errors
			log.Fatal(err)
		}

		fmt.Printf(config.Repos[0].Url + "\n")

		var repos = config.Repos

		fmt.Printf("Analysing %d Repos\n",len(repos))

		user, err := user.Current()
		if err != nil {
			log.Fatalf(err.Error())
		}
		// TODO fix the dir name? or keep it? :P
		workDir := user.HomeDir + "/.gitnalysis"
		if _, err := os.Stat(workDir); os.IsNotExist(err) {
			errDir := os.MkdirAll(workDir, 0755)
			if errDir != nil {
				log.Fatal(err)
			}
		}
		fmt.Printf("Work Directory: %s\n", workDir)

		gitDir := workDir + "/git"
		if _, err := os.Stat(gitDir); os.IsNotExist(err) {
			errDir := os.MkdirAll(gitDir, 0755)
			if errDir != nil {
				log.Fatal(err)
			}
		}

		// Get or update the repos..
		for i := 0; i < len(repos); i++ { 
			// Clone or update the repo
			repo := repos[i]
			Repo, err := git.PlainOpen(repo.DirNameInDir(gitDir));
			if(err != nil) {
				fmt.Printf("Cloning: %s\n",repo.Url)
				// TODO check error
				Repo, err = git.PlainClone(repo.DirNameInDir(gitDir), false, &git.CloneOptions{
					URL:      repo.Url,
					Progress: os.Stdout,
				})
			} else {
				fmt.Printf("Repo already on disk, updating: %s\n",repo.Url)
				// TODO check error
				gitWorkTree, _ := Repo.Worktree()
				// TODO check error
				gitWorkTree.Pull(&git.PullOptions{RemoteName: "origin"})
			}
			if err != nil {
				log.Fatal(err)
			}

			// Open a file for tmp output...
			fOut, err := os.OpenFile("output.txt", os.O_APPEND|os.O_WRONLY|os.O_CREATE, 0600)
			if err != nil {
				panic(err)
			}
			defer fOut.Close()

			// TODO also be able to exclude stuff in a specific repo? maybe...?
			// Build a bunch of stuff to exclude
			var ignoreRegexes []*regexp.Regexp
			pathIgnoreRegex, e := regexp.Compile("^.+/\\.git/.+$")
			if e != nil {
				log.Fatal(e)
			}
			ignoreRegexes = append(ignoreRegexes, pathIgnoreRegex)
			// Specific full regexes
			for _, ignoreRegexString := range config.IgnoreRegex {
				newRegex, e := regexp.Compile(ignoreRegexString)
				if e != nil {
					log.Fatal(e)
				}
				ignoreRegexes = append(ignoreRegexes, newRegex)
			}
			// Just file extensions
			for _, fileExtension := range config.IgnoreExtensions {
				newRegex, e := regexp.Compile("^.+\\." + fileExtension + "$")
				if e != nil {
					log.Fatal(e)
				}
				ignoreRegexes = append(ignoreRegexes, newRegex)
			}

			// Find all the files we care about (with some excluded)
			e = filepath.Walk(repo.DirNameInDir(gitDir), func(path string, info os.FileInfo, err error ) error {
				if info.IsDir() || err != nil {
					return nil
				}
				// Ignore various files
				for _, ignoreRegex := range ignoreRegexes {
					if ignoreRegex.MatchString(path) {
						return nil
					}
				}

				// Run a blame on the files that we are looking at
				fileInRepo := strings.Replace(path,repo.DirNameInDir(gitDir) + "/","", -1)
				head, _ := Repo.Head()
				commit, _ := Repo.CommitObject(head.Hash())
				// TODO do something with blame...
				blameOut, err := git.Blame(commit,fileInRepo)
				if err != nil {
					log.Fatal(err)
				}

				// Calculate for file...
				lineAuthorCounter := map[string]int{}
				// TODO could do filtering of individual lines here... (comment blocks etc?)
				for j := 0; j < len(blameOut.Lines); j++ {
					line := blameOut.Lines[j]
					if _, ok := lineAuthorCounter[line.Author]; ok {
						lineAuthorCounter[line.Author]++
					} else {
						lineAuthorCounter[line.Author] = 1
					}
				}

				// Write to file..
				for author, lineCount := range lineAuthorCounter {
					lineToWrite := fmt.Sprintf("%s %s %d\n", blameOut.Path, author, lineCount)
					fmt.Print(lineToWrite)
					if _, err = fOut.WriteString(lineToWrite); err != nil {
						panic(err)
					}
				}

				return nil
			})
			if e != nil {
				log.Fatal(e)
			}

		}

		// TODO fixme, got 2021/01/17 10:56:17 contents and commits have different length


		// TODO use regexes to separate files into "projects" or "areas"?
		// TODO join the blames together in these areas to see the % that is written by who?
		// TODO associate people with teams that currently work on it?
		// TODO output the % of each area that is written by the current team (and breakdown by people?)

		// TODO allow this all to be run for a specific previous date so trends can be created


	},
}
