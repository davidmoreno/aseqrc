package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/davidmoreno/aseqrc/alsaseq"
)

type Config struct {
	Hostname string `json:"hostname"`
}

type Status struct {
	Devices       map[uint8]alsaseq.Device           `json:"devices"`
	OutputToInput map[uint8]map[uint8][]alsaseq.Port `json:"outputtoinput"`
	Config        Config                             `json:"config"`
}

var mutex = &sync.Mutex{}
var hostname string

//go:embed static
var staticFS embed.FS

func echoString(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "hello")
}

func getStatus(w http.ResponseWriter, r *http.Request) {
	mutex.Lock()

	// We could cache and update as needed.. but it is just 2 times faster from 4500 req/sec to 7700/req sec.. so nope.
	topology := alsaseq.GetTopology()
	var status = Status{
		Devices:       topology.Devices,
		OutputToInput: topology.OutputToInput,
		Config: Config{
			Hostname: hostname,
		},
	}

	data, err := json.Marshal(status)
	panic_if(err)
	fmt.Fprint(w, string(data))

	mutex.Unlock()
}

func panic_if(e error) {
	if e != nil {
		panic(e)
	}
}

func setup() {
	hostname_, err := os.ReadFile("/etc/hostname")
	hostname = strings.TrimSpace(string(hostname_))
	panic_if(err)

	alsaseq.Init("aseqrc GO")
	alsaseq.CreatePort("test")

	var topology = alsaseq.GetTopology()
	fmt.Printf("%v\n", topology)
}

// From https://drstearns.github.io/tutorials/gomiddleware/
//Logger is a middleware handler that does request logging
type Logger struct {
	handler http.Handler
}

//ServeHTTP handles the request by passing it to the real
//handler and logging the request details
func (l *Logger) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	l.handler.ServeHTTP(w, r)
	log.Printf("%16v %-6s %s", time.Since(start), r.Method, r.URL.Path)
}

//NewLogger constructs a new Logger middleware handler
func NewLogger(handlerToWrap http.Handler) *Logger {
	return &Logger{handlerToWrap}
}

func main() {
	setup()

	{
		staticFSstatic, err := fs.Sub(staticFS, "static")
		panic_if(err)

		http.Handle("/", http.FileServer(http.FS(staticFSstatic)))
	}
	mux := http.NewServeMux()

	mux.Handle("/static/", http.FileServer(http.FS(staticFS)))
	mux.Handle("/devel/", http.FileServer(http.Dir("static")))
	mux.HandleFunc("/status", getStatus)

	mux.HandleFunc("/hi", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Hi")
	})

	log.Println("Listening at http://localhost:8001")
	log.Fatal(http.ListenAndServe(":8001", NewLogger(mux)))
}
