package alsaseq

/*
#cgo LDFLAGS: -lasound
#include <alsa/asoundlib.h>
#include <stdint.h>
#include <errno.h>
*/
import "C"
import (
	"errors"
	"fmt"
	"log"
	"syscall"
	"unsafe"
)

type MidiEvent struct {
	Type int
	Data []byte
}

type ChannelEventListener struct {
	MidiChan  chan []byte
	EventChan chan MidiEvent
}

var seq *C.snd_seq_t
var port_chan_map map[uint8]*ChannelEventListener

func Init(name string) (string, error) {
	log.Println("Init ALSA")

	var seqname = C.CString("default")
	defer C.free(unsafe.Pointer(seqname))
	// C.snd_lib_error_set_handler(error_handler)
	if C.snd_seq_open(&seq, seqname, C.SND_SEQ_OPEN_DUPLEX, 0) < 0 {
		return "", errors.New("Cant open")
	}
	var cname = C.CString(name)
	defer C.free(unsafe.Pointer(cname))
	C.snd_seq_set_client_name(seq, cname)
	// C.snd_seq_nonblock(seq, 1)

	port_chan_map = make(map[uint8]*ChannelEventListener)

	go poll_seq()

	return "ok", nil
}

func poll_seq() {
	log.Println("Start poller")

	npfds := C.snd_seq_poll_descriptors_count(seq, C.short(10))
	ptr := C.malloc(C.ulong(16 * 10)) // Aseume pointer is 16 bytes.. 64bit. Should be more than enough?
	defer C.free(ptr)
	var pfds *C.struct_pollfd = (*C.struct_pollfd)(ptr)

	C.snd_seq_poll_descriptors(seq, pfds, C.uint(npfds), C.POLLIN)

	pdfsa := (*[1 << 30]C.struct_pollfd)(unsafe.Pointer(pfds))

	// fmt.Printf("N fds %d\n", npfds)

	for i := 0; i < int(npfds); i++ {
		fmt.Printf("fd %d: %d", i, pdfsa[i])
	}

	var encoder *C.snd_midi_event_t
	if C.snd_midi_event_new(1024, &encoder) < 0 {
		fmt.Printf("Error creating encoder event")
		return
	}
	defer C.snd_midi_event_free(encoder)
	C.snd_midi_event_no_status(encoder, 1)

	cevent_data := C.malloc(128)
	defer C.free(cevent_data)

	for {
		var event *C.snd_seq_event_t
		err := C.snd_seq_event_input(seq, &event)
		if int(err) < 0 {
			log.Println("Error reading event")
			continue
		}
		// log.Printf("Got event: %v\n", event)
		ch := port_chan_map[uint8(event.dest.port)]
		if ch == nil {
			log.Printf("Data received on invalid port %d\n", event.source.port)
			continue
		}

		count := C.snd_midi_event_decode(
			encoder,
			(*C.uchar)(cevent_data),
			16,
			event,
		)

		if ch.EventChan != nil {
			data := []byte{event.data[0], event.data[1], event.data[2], event.data[3]}
			ch.EventChan <- MidiEvent{Type: int(event._type), Data: data}
		}

		// Not all messages are translatable to MIDI
		if count > 0 {
			event_data := (*[1 << 30]byte)(unsafe.Pointer(cevent_data))[:count]

			// fmt.Printf("%d %v\n", count, event_data)
			if ch.MidiChan != nil {
				ch.MidiChan <- event_data
			}
		}
	}
	// fd := poll.FD{Sysfd: seq}

	// fd.RawRead(func(uintptr) {

	// })
	log.Println("End poller")
}

func CreatePort(name string) int {
	var caps C.uint = C.SND_SEQ_PORT_CAP_WRITE | C.SND_SEQ_PORT_CAP_SUBS_WRITE |
		C.SND_SEQ_PORT_CAP_READ | C.SND_SEQ_PORT_CAP_SUBS_READ
	var _type C.uint = C.SND_SEQ_TYPE_INET

	var cname = C.CString(name)
	defer C.free(unsafe.Pointer(cname))
	var port = C.snd_seq_create_simple_port(seq, cname, caps, _type)

	log.Printf("Created port %d", port)
	return int(port)
}

func DeletePort(port uint8) error {
	if C.snd_seq_delete_simple_port(seq, C.int(port)) < 0 {
		return errors.New("can not delete port")
	}
	log.Printf("Delete port %d", port)
	return nil
}

type Port struct {
	Device uint8 `json:"device_id"`
	Port   uint8 `json:"port_id"`
}

type DevicePort struct {
	Name     string `json:"name"`
	IsInput  bool   `json:"is_input"`
	IsOutput bool   `json:"is_output"`
}

type Device struct {
	Name  string               `json:"name"`
	Ports map[uint8]DevicePort `json:"ports"`
}

type SequencerTopology struct {
	Devices       map[uint8]Device           `json:"devices"`
	OutputToInput map[uint8]map[uint8][]Port `json:"outputtoinput"`
}

func GetTopology() SequencerTopology {
	var topology SequencerTopology

	topology.Devices = make(map[uint8]Device)
	topology.OutputToInput = make(map[uint8]map[uint8][]Port)

	var cinfo *C.snd_seq_client_info_t
	var pinfo *C.snd_seq_port_info_t
	var count int

	C.snd_seq_client_info_malloc(&cinfo)
	defer C.snd_seq_client_info_free(cinfo)
	C.snd_seq_port_info_malloc(&pinfo)
	defer C.snd_seq_port_info_free(pinfo)
	C.snd_seq_client_info_set_client(cinfo, -1)

	for int(C.snd_seq_query_next_client(seq, cinfo)) >= 0 {
		count = 0
		var client uint8
		C.snd_seq_port_info_set_client(pinfo, C.snd_seq_client_info_get_client(cinfo))
		C.snd_seq_port_info_set_port(pinfo, -1)

		var device = Device{
			Name:  "unknown",
			Ports: make(map[uint8]DevicePort),
		}

		for int(C.snd_seq_query_next_port(seq, pinfo)) >= 0 {
			// this is the device
			if count == 0 {
				client = uint8(C.snd_seq_client_info_get_client(cinfo))
				var name = C.GoString(C.snd_seq_client_info_get_name(cinfo))
				device.Name = string(name)
				topology.Devices[client] = device

			}

			port := uint8(C.snd_seq_port_info_get_port(pinfo))
			name := C.GoString(C.snd_seq_port_info_get_name(pinfo))

			caps := C.snd_seq_port_info_get_capability(pinfo)
			input := (caps & (C.SND_SEQ_PORT_CAP_READ | C.SND_SEQ_PORT_CAP_SUBS_READ)) == (C.SND_SEQ_PORT_CAP_READ | C.SND_SEQ_PORT_CAP_SUBS_READ)
			output := (caps & (C.SND_SEQ_PORT_CAP_WRITE | C.SND_SEQ_PORT_CAP_SUBS_WRITE)) == (C.SND_SEQ_PORT_CAP_WRITE | C.SND_SEQ_PORT_CAP_SUBS_WRITE)
			device.Ports[port] = DevicePort{Name: name, IsInput: input, IsOutput: output}
			count += 1

			// Get subs
			var addr = C.snd_seq_port_info_get_addr(pinfo)
			var subs *C.snd_seq_query_subscribe_t
			C.snd_seq_query_subscribe_malloc(&subs)
			defer C.snd_seq_query_subscribe_free(subs)
			C.snd_seq_query_subscribe_set_root(subs, addr)

			C.snd_seq_query_subscribe_set_type(subs, C.SND_SEQ_QUERY_SUBS_READ)
			C.snd_seq_query_subscribe_set_index(subs, 0)

			for int(C.snd_seq_query_port_subscribers(seq, subs)) >= 0 {
				addr2 := C.snd_seq_query_subscribe_get_addr(subs)

				port_to := Port{Device: uint8(addr2.client), Port: uint8(addr2.port)}
				if topology.OutputToInput[uint8(addr.client)] == nil {
					topology.OutputToInput[uint8(addr.client)] = make(map[uint8][]Port)
				}
				topology.OutputToInput[uint8(addr.client)][uint8(addr.port)] = append(
					topology.OutputToInput[uint8(addr.client)][uint8(addr.port)],
					port_to,
				)

				C.snd_seq_query_subscribe_set_index(subs, C.int(int(C.snd_seq_query_subscribe_get_index(subs))+1))
			}
		}

	}

	return topology
}

func Disconnect(from Port, to Port) error {
	var subs *C.snd_seq_port_subscribe_t
	var sender C.snd_seq_addr_t
	var dest C.snd_seq_addr_t

	sender.client = C.uint8_t(from.Device)
	sender.port = C.uint8_t(from.Port)
	dest.client = C.uint8_t(to.Device)
	dest.port = C.uint8_t(to.Port)

	fmt.Printf("%+v %+v\n", from, to)
	fmt.Printf("%+v %+v\n", sender, dest)

	C.snd_seq_port_subscribe_malloc(&subs)
	defer C.snd_seq_port_subscribe_free(subs)

	C.snd_seq_port_subscribe_set_sender(subs, &sender)
	C.snd_seq_port_subscribe_set_dest(subs, &dest)

	if int(C.snd_seq_get_port_subscription(seq, subs)) < 0 {
		log.Printf("Error getting subscription\n")
		return errors.New("Disconnect failed")
	}
	if int(C.snd_seq_unsubscribe_port(seq, subs)) < 0 {
		log.Printf("Disconnect failed\n")
		//  fprintf(stderr, _("Disconnection failed (%s)\n"), snd_strerror(errno));
		return errors.New("Disconnect failed")
	}
	log.Printf("Disconnected %+v -> %+v", from, to)
	return nil
}

func Connect(from Port, to Port) error {
	var subs *C.snd_seq_port_subscribe_t
	var sender C.snd_seq_addr_t
	var dest C.snd_seq_addr_t

	sender.client = C.uint8_t(from.Device)
	sender.port = C.uint8_t(from.Port)
	dest.client = C.uint8_t(to.Device)
	dest.port = C.uint8_t(to.Port)

	// log.Printf("Connect %+v -> %+v\n", from, to)

	C.snd_seq_port_subscribe_malloc(&subs)
	defer C.snd_seq_port_subscribe_free(subs)

	C.snd_seq_port_subscribe_set_sender(subs, &sender)
	C.snd_seq_port_subscribe_set_dest(subs, &dest)

	{
		ret, _ := C.snd_seq_get_port_subscription(seq, subs)
		if int(ret) == 0 {
			// can not make errno to work here.. so no good feedback.
			// var errno syscall.Errno
			// errno = err.(syscall.Errno)
			log.Println("Aready subscribed?")
			return errors.New("already subscribed")
		}
	}
	{
		ret, err := C.snd_seq_subscribe_port(seq, subs)
		if int(ret) < 0 {
			log.Printf("Connect failed: %s\n", C.GoString(C.snd_strerror(C.int(err.(syscall.Errno)))))
			//  fprintf(stderr, _("Disconnection failed (%s)\n"), snd_strerror(errno));
			return errors.New("connect failed")
		}
	}
	log.Printf("Connected %+v -> %+v", from, to)
	return nil
}

func PortReader(port Port) (chan []byte, Port, error) {
	reader := make(chan []byte)
	reader_port, err := OpenReaderPort("monitor", reader, nil)
	if err != nil {
		return nil, reader_port, err
	}
	ch := make(chan []byte)
	go func() {
		Connect(port, reader_port)
		defer Disconnect(port, reader_port)

		var data []byte
		for {
			data = <-reader
			if data == nil {
				return
			}
			ch <- data[:]
		}
	}()
	return ch, reader_port, nil
}

func CloseReader(port_id uint8) error {
	DeletePort(port_id)
	port_chan_map[port_id] = nil
	return nil
}

func OpenReaderPort(name string, midi_chan chan []byte, event_chan chan MidiEvent) (Port, error) {
	var port_id int
	{
		var caps C.uint = C.SND_SEQ_PORT_CAP_WRITE | C.SND_SEQ_PORT_CAP_SUBS_WRITE |
			C.SND_SEQ_PORT_CAP_READ | C.SND_SEQ_PORT_CAP_SUBS_READ
		var _type C.uint = C.SND_SEQ_TYPE_INET

		var cname = C.CString(name)
		defer C.free(unsafe.Pointer(cname))
		var port = C.snd_seq_create_simple_port(seq, cname, caps, _type)
		port_id = int(port)

		if port_id < 0 {
			return Port{}, errors.New("cant create port")
		}
	}

	var cinfo *C.snd_seq_client_info_t
	C.snd_seq_client_info_malloc(&cinfo)
	defer C.snd_seq_client_info_free(cinfo)

	C.snd_seq_get_client_info(seq, cinfo)

	device_id := int(C.snd_seq_client_info_get_client(cinfo))
	port := Port{Device: uint8(device_id), Port: uint8(port_id)}

	port_chan_map[uint8(port_id)] = &ChannelEventListener{midi_chan, event_chan}
	return port, nil
}

func GetDevicePortName(port Port) (string, string) {
	topology := GetTopology()
	device, ok := topology.Devices[port.Device]
	if !ok {
		return "", ""
	}
	dport, ok := device.Ports[port.Port]
	if !ok {
		return "", ""
	}

	return device.Name, dport.Name
}

func FindPortByName(device_name string, port_name string) (Port, bool) {
	topology := GetTopology()
	for device_id, device := range topology.Devices {
		for port_id, port := range device.Ports {
			if device.Name == device_name && port.Name == port_name {
				return Port{Device: device_id, Port: port_id}, true
			}
		}
	}
	return Port{Device: 255, Port: 255}, false
}
