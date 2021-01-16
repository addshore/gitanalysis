package cmd

import (
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

type GitRepo string

func (r GitRepo) Url() string {
	return string(r)
}

func (r GitRepo) DirName() string {
	s := string(r)
	s = strings.Replace(s,"://","_", -1)
	s = strings.Replace(s,".git","", -1)
	s = strings.Replace(s,"/","_", -1)
	return s
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

		// TODO take repos as arguments or something
		repos := [1]GitRepo{GitRepo("https://github.com/wikimedia/Wikibase.git")}
		fmt.Printf("Analysing Repos: %s\n",repos)

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
			repo := repos[i]
			repoPath := workDir + "/" + repo.DirName()

			gitRepo, err := git.PlainOpen(repoPath);
			if(err != nil) {
				fmt.Printf("Cloning: %s\n",repo.Url())
				// TODO check error
				gitRepo, err = git.PlainClone(repoPath, false, &git.CloneOptions{
					URL:      repo.Url(),
					Progress: os.Stdout,
				})
			} else {
				fmt.Printf("Repo already on disk, updating: %s\n",repo.Url())
				// TODO check error
				gitWorkTree, _ := gitRepo.Worktree()
				// TODO check error
				gitWorkTree.Pull(&git.PullOptions{RemoteName: "origin"})
			}

			if err != nil {
				log.Fatal(err)
			}
		}

		// TODO ignore some files like tests?
		// TODO run git blame on every file..?
		// TODO use regexes to separate files into "projects" or "areas"?
		// TODO join the blames together in these areas to see the % that is written by who?
		// TODO associate people with teams that currently work on it?
		// TODO output the % of each area that is written by the current team (and breakdown by people?)

		// TODO allow this all to be run for a specific previous date so trends can be created


	},
}
