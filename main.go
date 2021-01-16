package main

import (
	"github.com/addshore/gitanalysis/cmd"
)

var (
	// VERSION is set during build
	VERSION = "dev"
	// SOURCE_DATE is set during build
	SOURCE_DATE = "unknown"
)

func main() {
	cmd.Execute(VERSION, SOURCE_DATE)
}
