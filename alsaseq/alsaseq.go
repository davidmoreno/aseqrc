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

var seq *C.snd_seq_t

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
	C.snd_seq_nonblock(seq, 1)

	return "ok", nil
}

func CreatePort(name string) int {
	var caps C.uint = C.SND_SEQ_PORT_CAP_WRITE | C.SND_SEQ_PORT_CAP_SUBS_WRITE |
		C.SND_SEQ_PORT_CAP_READ | C.SND_SEQ_PORT_CAP_SUBS_READ
	var _type C.uint = C.SND_SEQ_TYPE_INET

	var cname = C.CString(name)
	defer C.free(unsafe.Pointer(cname))
	var port = C.snd_seq_create_simple_port(seq, cname, caps, _type)

	return int(port)
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

	fmt.Printf("%+v %+v", from, to)
	fmt.Printf("%+v %+v", sender, dest)

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

	fmt.Printf("%+v %+v", from, to)
	fmt.Printf("%+v %+v", sender, dest)

	C.snd_seq_port_subscribe_malloc(&subs)
	defer C.snd_seq_port_subscribe_free(subs)

	C.snd_seq_port_subscribe_set_sender(subs, &sender)
	C.snd_seq_port_subscribe_set_dest(subs, &dest)

	{
		ret, err := C.snd_seq_get_port_subscription(seq, subs)
		if int(ret) == 0 {
			log.Printf("Aready subscribed: %s\n", C.GoString(C.snd_strerror(C.int(err.(syscall.Errno)))))
			return errors.New("Already subscribed")
		}
	}
	{
		ret, err := C.snd_seq_subscribe_port(seq, subs)
		if int(ret) < 0 {
			log.Printf("Connect failed: %s\n", C.GoString(C.snd_strerror(C.int(err.(syscall.Errno)))))
			//  fprintf(stderr, _("Disconnection failed (%s)\n"), snd_strerror(errno));
			return errors.New("Connect failed")
		}
	}
	log.Printf("Disconnected %+v -> %+v", from, to)
	return nil
}
