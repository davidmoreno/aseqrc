package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"golang.org/x/net/websocket"

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

type ResponseDetails struct {
	Details string `json:"details"`
}
type ResponseError struct {
	Details string `json:"details"`
}

var hostname string

//go:embed static
var staticFS embed.FS

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

func getStatus(w http.ResponseWriter, r *http.Request) {
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
}

func connect(w http.ResponseWriter, r *http.Request) {
	type DisconnectMessage struct {
		From alsaseq.Port `json:"from"`
		To   alsaseq.Port `json:"to"`
	}
	disconnect_message := DisconnectMessage{}

	decoder := json.NewDecoder(r.Body)
	err := decoder.Decode(&disconnect_message)
	if err != nil {
		data, err := json.Marshal(ResponseError{Details: "error parsing data"})
		panic_if(err)
		w.WriteHeader(500)
		fmt.Fprint(w, string(data))
		return
	}

	fmt.Printf("%v\n", r.Body)
	fmt.Printf("%v\n", disconnect_message)
	{
		err := alsaseq.Connect(disconnect_message.From, disconnect_message.To)
		if err != nil {
			data, err := json.Marshal(ResponseError{Details: err.Error()})
			panic_if(err)
			w.WriteHeader(500)
			fmt.Fprint(w, string(data))
			return
		}
	}
	data, err := json.Marshal(ResponseDetails{Details: "ok"})
	panic_if(err)
	fmt.Fprint(w, string(data))
}

func disconnect(w http.ResponseWriter, r *http.Request) {
	type DisconnectMessage struct {
		From alsaseq.Port `json:"from"`
		To   alsaseq.Port `json:"to"`
	}
	disconnect_message := DisconnectMessage{}

	decoder := json.NewDecoder(r.Body)
	err := decoder.Decode(&disconnect_message)
	if err != nil {
		data, err := json.Marshal(ResponseError{Details: "error parsing data"})
		panic_if(err)
		w.WriteHeader(500)
		fmt.Fprint(w, string(data))
		return
	}

	fmt.Printf("%v\n", r.Body)
	fmt.Printf("%v\n", disconnect_message)
	{
		err := alsaseq.Disconnect(disconnect_message.From, disconnect_message.To)
		if err != nil {
			data, err := json.Marshal(ResponseError{Details: err.Error()})
			panic_if(err)
			w.WriteHeader(500)
			fmt.Fprint(w, string(data))
			return
		}
	}
	data, err := json.Marshal(ResponseDetails{Details: "ok"})
	panic_if(err)
	fmt.Fprint(w, string(data))
}

func MonitorWs(ws *websocket.Conn) {
	monitor := ws.Request().URL.Query().Get("port")
	monitors := strings.Split(monitor, ":")
	var err error
	var device_id int = 0
	var port_id int = 0

	device_id, err = strconv.Atoi(monitors[0])
	if err != nil {
		fmt.Println("Invalid port")
		return
	}
	port_id, err = strconv.Atoi(monitors[1])
	if err != nil {
		fmt.Println("Invalid port")
		return
	}

	reader, err := alsaseq.PortReader(alsaseq.Port{Device: uint8(device_id), Port: uint8(port_id)})
	if err != nil {
		fmt.Println(err)
		return
	}

	var data []byte
	for {
		data = <-reader
		err := websocket.Message.Send(ws, data)
		if err != nil {
			fmt.Println("Conn closed")
			return
		}

	}
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
	mux.HandleFunc("/connect", connect)
	mux.Handle("/monitor", websocket.Handler(MonitorWs))
	mux.HandleFunc("/disconnect", disconnect)

	log.Println("Listening at http://localhost:8001")
	log.Fatal(http.ListenAndServe(":8001", NewLogger(mux)))
}
