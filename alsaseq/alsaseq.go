package alsaseq

/*
#cgo LDFLAGS: -lasound
#include <alsa/asoundlib.h>
#include <stdint.h>
*/
import "C"
import (
	"errors"
	"log"
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
	device uint8
	port   uint8
}

type Device struct {
	Name string
	Port map[int]string
}

type SequencerTopology struct {
	Devices       map[int]Device
	OutputToInput map[Port][]Port
}

func GetTopology() SequencerTopology {
	var topology SequencerTopology

	topology.Devices = make(map[int]Device)
	topology.OutputToInput = make(map[Port][]Port)

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
		var client int
		C.snd_seq_port_info_set_client(pinfo, C.snd_seq_client_info_get_client(cinfo))
		C.snd_seq_port_info_set_port(pinfo, -1)

		var device = Device{
			Name: "unknown",
			Port: make(map[int]string),
		}

		for int(C.snd_seq_query_next_port(seq, pinfo)) >= 0 {
			// this is the device
			if count == 0 {
				client = int(C.snd_seq_client_info_get_client(cinfo))
				var name = C.GoString(C.snd_seq_client_info_get_name(cinfo))
				device.Name = string(name)
				topology.Devices[client] = device

			}

			port := int(C.snd_seq_port_info_get_port(pinfo))
			name := C.GoString(C.snd_seq_port_info_get_name(pinfo))

			device.Port[port] = name
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

				port_from := Port{device: uint8(addr.client), port: uint8(addr.port)}
				port_to := Port{device: uint8(addr2.client), port: uint8(addr2.port)}
				topology.OutputToInput[port_from] = append(topology.OutputToInput[port_from], port_to)

				C.snd_seq_query_subscribe_set_index(subs, C.int(int(C.snd_seq_query_subscribe_get_index(subs))+1))
			}
		}

	}

	return topology
}
