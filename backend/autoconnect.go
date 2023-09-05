package main

import (
	"log"

	"github.com/davidmoreno/aseqrc/alsaseq"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

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

func AseqRcDb(filename string) (*gorm.DB, error) {
	db, err := gorm.Open(sqlite.Open(filename), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	db.AutoMigrate(&Connection{})

	log.Println("Database created")

	for device_idx, device := range alsaseq.GetTopology().Devices {
		for port_idx, port := range device.Ports {
			var connections []Connection
			db.Find(&connections, "from_device = ? AND from_port = ?", device.Name, port.Name)
			nport := alsaseq.Port{Device: device_idx, Port: port_idx}
			log.Println(device.Name, port.Name, nport, connections)
		}
	}

	return db, nil
}

/// Connets to announcements, and transforms the announcement events to "checkout this port" events
/// We check for three events: connect, disconnect, and new port.
func AnnounceReader(db *gorm.DB) error {
	reader := make(chan alsaseq.MidiEvent)
	reader_port, err := alsaseq.OpenReaderPort("announcements", nil, reader)
	if err != nil {
		return err
	}

	go func() {
		FullCheck(db)
		port := alsaseq.Port{Device: 0, Port: 1} // This is always announce port
		alsaseq.Connect(port, reader_port)
		defer alsaseq.Disconnect(port, reader_port)
		for {
			data := <-reader

			log.Println("Type %o", data.Type)
			// log.Println("Tag %o", data.tag)
			// log.Println("Source dev %o", data.source.client)
			// log.Println("Source port %o", data.source.port)
			// log.Println("Dest dev %o", data.dest.client)
			// log.Println("Dest port %o", data.dest.port)
			// log.Println("Flags %o", data.flags)
			// log.Println("Data 0 %o", data.data[0])

			if data.Type == 63 {
				// announce_chan <- AnnouncementEvent{NewPort, alsaseq.Port{data.Data[0], data.Data[1]}, alsaseq.Port{0, 0}}

				newport := alsaseq.Port{Device: data.Data[0], Port: data.Data[1]}
				log.Println("New port ", newport)

				DoConnectionsToFrom(newport, db)
			}
			if data.Type == 66 {
				log.Println("New connection ", data.Data[0], data.Data[1], "->", data.Data[2], data.Data[3])
				SourceDevice, SourcePort := alsaseq.GetDevicePortName(alsaseq.Port{Device: data.Data[0], Port: data.Data[1]})
				DestDevice, DestPort := alsaseq.GetDevicePortName(alsaseq.Port{Device: data.Data[2], Port: data.Data[3]})

				if IgnorePortForDB(SourceDevice, SourcePort) || IgnorePortForDB(DestDevice, DestPort) {
					continue
				}

				conn := Connection{
					FromDevice: SourceDevice, FromPort: SourcePort,
					ToDevice: DestDevice, ToPort: DestPort,
				}
				db.Create(&conn)

				// announce_chan <- AnnouncementEvent{Connected, alsaseq.Port{data.Data[0], data.Data[1]}, alsaseq.Port{data.Data[2], data.Data[3]}}
			}
			if data.Type == 67 {
				SourceDevice, SourcePort := alsaseq.GetDevicePortName(alsaseq.Port{Device: data.Data[0], Port: data.Data[1]})
				DestDevice, DestPort := alsaseq.GetDevicePortName(alsaseq.Port{Device: data.Data[2], Port: data.Data[3]})

				log.Println(
					"New disconnection ",
					data.Data[0], ":", data.Data[1], " (", SourceDevice, ":", SourcePort, ")",
					"->",
					data.Data[2], ":", data.Data[3], "(", DestDevice, ":", DestPort, ")",
				)

				res := db.Where(
					"from_device = ? AND from_port = ? AND to_device = ? AND to_port = ?",
					SourceDevice, SourcePort,
					DestDevice, DestPort,
				).Delete(
					&Connection{},
				)
				if res.Error != nil {
					log.Println("Error deleting from db: ", res.Error)
				} else {
					log.Println("Rows deleted: ", res.RowsAffected)
				}
				log.Println(res.Statement.SQL.String(), res.Statement.Vars)

				// announce_chan <- AnnouncementEvent{Disconnected, alsaseq.Port{data.Data[0], data.Data[1]}, alsaseq.Port{data.Data[2], data.Data[3]}}
			}

		}
	}()

	return nil
}

func FullCheck(db *gorm.DB) {
	topology := alsaseq.GetTopology()

	for device_id, device := range topology.Devices {
		for port_id, _ := range device.Ports {
			port := alsaseq.Port{Device: device_id, Port: port_id}
			DeviceName, PortName := alsaseq.GetDevicePortName(port)
			log.Println("Try connections: ", device_id, ":", port_id, "/", DeviceName, ":", PortName)
			DoConnectionsFrom(port, db)
		}
	}
}

func DoConnectionsToFrom(port alsaseq.Port, db *gorm.DB) {
	DoConnectionsFrom(port, db)
	DoConnectionsTo(port, db)
}

func DoConnectionsFrom(port alsaseq.Port, db *gorm.DB) {
	device, portname := alsaseq.GetDevicePortName(port)

	if IgnorePortForDB(device, portname) {
		return
	}

	var connections []Connection
	db.Where("from_device = ? AND from_port = ?", device, portname).Find(&connections)
	for _, conn := range connections {
		log.Println("Connecting ", conn.FromDevice, conn.FromPort, " to ", conn.ToDevice, conn.ToPort)
		oport, ok := alsaseq.FindPortByName(conn.ToDevice, conn.ToPort)
		if ok {
			log.Println("Connect ", port, oport)
			alsaseq.Connect(port, oport)
		}
	}
}

func DoConnectionsTo(port alsaseq.Port, db *gorm.DB) {
	device, portname := alsaseq.GetDevicePortName(port)

	if IgnorePortForDB(device, portname) {
		return
	}

	var connections []Connection
	db.Where("to_device = ? AND to_port = ?", device, portname).Find(&connections)
	for _, conn := range connections {
		log.Println("Connecting ", conn.FromDevice, conn.FromPort, " to ", conn.ToDevice, conn.ToPort)
		oport, ok := alsaseq.FindPortByName(conn.FromDevice, conn.FromPort)
		if ok {
			log.Println("Connect ", oport, port)
			alsaseq.Connect(oport, port)
		}
	}
}

func FindPort(device string, port string, topology alsaseq.SequencerTopology) *alsaseq.Port {
	if device == "" && port == "" {
		return new(alsaseq.Port)
	}
	return nil
}

func IgnorePortForDB(device string, port string) bool {
	if device == "System" && port == "announce" {
		return true
	}
	if device == "aseqrc GO" {
		return true
	}
	return false
}
