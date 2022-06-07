import React from "react"
import api from "./api"
import {
  DeviceTree,
  ConnectionTree,
  Port,
  DevicePort,
  Device,
} from "./connection"
import InputRow from "./InputRow"
import { renamed_name } from "./utils"

export interface StatusI {
  devices: DeviceTree
  outputtoinput: ConnectionTree
  config: {
    hostname: string
  }
}

interface ConnectBoardState {
  devices: DeviceTree
  outputtoinput: ConnectionTree
  input_ports: DevicePort[]
  config: {
    hostname: string
  }
  timer: number
}

interface ConnectBoardProps {
  setMonitor: (from: string) => void
}

class ConnectBoard extends React.Component<
  ConnectBoardProps,
  ConnectBoardState
> {
  state: ConnectBoardState = {
    devices: {},
    outputtoinput: {},
    input_ports: [],
    config: {
      hostname: "??",
    },
    timer: 0,
  }

  async componentDidMount() {
    await this.reloadStatus()

    // May be set to unmount, but unmount is get out so ...
    const timer = setInterval(this.reloadStatus.bind(this), 5000)
    this.setState({ timer })
  }

  componentWillUnmount() {
    clearInterval(this.state.timer)
  }

  async reloadStatus() {
    const status = await api.get<StatusI>("status")

    const input_ports: DevicePort[] = []
    const devices: DeviceTree = {}
    for (const [device_id_s, device] of Object.entries(status.devices)) {
      const device_id = Number(device_id_s)
      devices[device_id] = {
        device_id,
        ...device,
      }
      for (const [port_id_s, port] of Object.entries(device.ports)) {
        const port_id = Number(port_id_s)
        devices[device_id].ports[port_id] = {
          ...port,
          device_id,
          port_id,
        }
        input_ports.push({
          ...port,
          device_id,
          port_id,
          name: `${device.name} / ${port.name}`,
        })
      }
    }

    this.setState({
      devices,
      input_ports,
      outputtoinput: status.outputtoinput,
    })
  }

  async disconnect(f: Port, t: Port) {
    await api.post("disconnect", {
      from: { device_id: f.device_id, port_id: f.port_id },
      to: { device_id: t.device_id, port_id: t.port_id },
    })
    await this.reloadStatus()
  }

  async connect(f: Port, t: Port) {
    await api.post("connect", {
      from: { device_id: f.device_id, port_id: f.port_id },
      to: { device_id: t.device_id, port_id: t.port_id },
    })
    await this.reloadStatus()
  }

  setup(port: DevicePort) {
    // let name = prompt(
    //   `Setup name for port (${port.port_label})`,
    //   renamed_name(port.label, port.port_label)
    // )
    // if (name === undefined) {
    //   return
    // }
    // if (name === "") {
    //   name = port.port_label
    // }
    // const renames = JSON.parse(localStorage.renames || "{}")
    // localStorage.renames = JSON.stringify({ ...renames, [port.label]: name })
    return
  }

  render() {
    const { devices, outputtoinput, input_ports } = this.state

    return (
      <div className="">
        <table className="w-100vw">
          <thead className="md:hidden">
            <tr className="bg-orange md:flex md:flex-col">
              <th className="p-24px">Input Port</th>
              <th className="p-24px">Output ports</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(devices).map((device) =>
              Object.values(device.ports).map((port) => (
                <InputRow
                  key={device.device_id * 1024 + port.port_id}
                  device={device}
                  port={port}
                  connected_to={
                    outputtoinput[port.device_id]?.[port.port_id] || []
                  }
                  inputs={input_ports}
                  connect={this.connect.bind(this)}
                  disconnect={this.disconnect.bind(this)}
                  setMonitor={this.props.setMonitor}
                  setup={this.setup.bind(this)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    )
  }
}

export default ConnectBoard
