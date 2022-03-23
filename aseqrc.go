package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"

	"github.com/davidmoreno/aseqrc/alsaseq"
)

type Port struct {
	Id          string `json:"id"`
	Label       string `json:"label"`
	DeviceLabel string `json:"device_label"`
	Hidden      bool   `json:"hidden"`
	Input       bool   `json:"input"`
	Output      bool   `json:"output"`
	Port        string `json:"port"`
	PortLabel   string `json:"port_label"`
}

type Status struct {
	Ports       map[string]Port     `json:"ports"`
	Connections map[string][]string `json:"Connections"`
	Config      struct {
		Hostname string `json:"hostname"`
	} `json:"config"`
}

var status *Status
var counter int
var mutex = &sync.Mutex{}

func echoString(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "hello")
}

func getStatus(w http.ResponseWriter, r *http.Request) {
	mutex.Lock()

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
	status = new(Status)

	status.Ports = make(map[string]Port)
	status.Connections = make(map[string][]string)

	hostname, err := os.ReadFile("/etc/hostname")
	panic_if(err)
	status.Config.Hostname = strings.TrimSpace(string(hostname))

	alsaseq.Init("aseqrc GO")

	alsaseq.CreatePort("test")

	var topology = alsaseq.GetTopology()
	fmt.Printf("%v\n", topology)
}

func main() {
	setup()

	http.Handle("/", http.FileServer(http.Dir("./static")))

	http.HandleFunc("/status", getStatus)

	http.HandleFunc("/hi", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Hi")
	})

	log.Println("Listening at http://localhost:8001")
	log.Fatal(http.ListenAndServe(":8001", nil))
}
