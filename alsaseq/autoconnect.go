package alsaseq

import "log"

type Connection struct {
	FromDevice string
	FromPort   string
	ToDevice   string
	ToPort     string
}

const (
	Connected    = 1
	Disconnected = 2
	NewPort      = 3
)

type AnnouncementEvent struct {
	_type  int
	source Port
	dest   Port
}

func Watch() {
	FullCheck()

	announcements, err := AnnounceReader()
	if err != nil {
		log.Println("Error connecting to announcements")
		return
	}

	go func() {
		for {
			select {
			case annevent := <-announcements:
				log.Println("Got announcement ", annevent)
				// topology := GetTopology()
				// DoConnectionsToFrom(port, topology)
			}
		}
	}()
}

/// Connets to announcements, and transforms the announcement events to "checkout this port" events
/// We check for three events: connect, disconnect, and new port.
func AnnounceReader() (chan AnnouncementEvent, error) {
	announce_chan := make(chan AnnouncementEvent, 10)
	reader := make(chan MidiEvent)
	reader_port, err := OpenReaderPort("announcements", nil, reader)
	if err != nil {
		return nil, err
	}

	go func() {
		port := Port{0, 1} // This is always announce port
		Connect(port, reader_port)
		defer Disconnect(port, reader_port)
		for {
			data := <-reader

			log.Println("Type %o", data._type)
			// log.Println("Tag %o", data.tag)
			// log.Println("Source dev %o", data.source.client)
			// log.Println("Source port %o", data.source.port)
			// log.Println("Dest dev %o", data.dest.client)
			// log.Println("Dest port %o", data.dest.port)
			// log.Println("Flags %o", data.flags)
			// log.Println("Data 0 %o", data.data[0])

			if data._type == 63 {
				log.Println("New port ", data.data[0], data.data[1])
				announce_chan <- AnnouncementEvent{NewPort, Port{data.data[0], data.data[1]}, Port{0, 0}}
			}
			if data._type == 66 {
				log.Println("New connection ", data.data[0], data.data[1], "->", data.data[2], data.data[3])
				announce_chan <- AnnouncementEvent{Connected, Port{data.data[0], data.data[1]}, Port{data.data[2], data.data[3]}}
			}
			if data._type == 67 {
				log.Println("New disconnection ", data.data[0], data.data[1], "->", data.data[2], data.data[3])
				announce_chan <- AnnouncementEvent{Disconnected, Port{data.data[0], data.data[1]}, Port{data.data[2], data.data[3]}}
			}

		}
	}()

	return announce_chan, nil
}

func FullCheck() {
	topology := GetTopology()

	for device_id, device := range topology.Devices {
		for port_id, _ := range device.Ports {
			DoConnectionsToFrom(Port{Device: device_id, Port: port_id}, topology)
		}
	}
}

func GetConnectionsToFrom(port Port, topology SequencerTopology) []Connection {
	return make([]Connection, 0, 0)
}

func DoConnectionsToFrom(port Port, topology SequencerTopology) {
	connections := GetConnectionsToFrom(port, topology)

	for _, conn := range connections {
		from := FindPort(conn.FromDevice, conn.FromPort, topology)
		if from == nil {
			continue
		}
		to := FindPort(conn.ToDevice, conn.ToPort, topology)
		if to == nil {
			continue
		}
		Connect(*from, *to)
	}
}

func FindPort(device string, port string, topology SequencerTopology) *Port {
	if device == "" && port == "" {
		return new(Port)
	}
	return nil
}
