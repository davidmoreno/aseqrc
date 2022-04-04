package watcher

type Connection struct {
	FromDevice string
	FromPort   string
	ToDevice   string
	ToPort     string
}


func Watch() {
	FullCheck()

	announcements := alsaseq.AnnounceReader()

	for {
		select {
		case port := <- announcements:
			topology := alsaseq.GetTopology()
			DoConnectionsToFrom(port, topology)
		}
	}
}

func FullCheck(){
	topology := alsaseq.GetTopology()

	for device in topology.Devices {
		for port in topology.Ports {
			DoConnectionsToFrom(Port{Device: device.DeviceId, Port: port.PortId}, topology)
		}
	}
}

func GetConnectionsToFrom(port Port, topology Topology) []Connection{
	return []
}

func DoConnectionsToFrom(port Port, topology Topology){
	connections := GetConnectionsToFrom(port)

	for conn in connections {
		from := FindPort(conn.FromDevice, conn.FromPort, topology Topology)
		if from == nil {
			continue
		}
		to :=  FindPort(conn.ToDevice, conn.ToPort, topology Topology)
		if to == nil {
			continue
		}
		Connect(from, to)
	}
}
