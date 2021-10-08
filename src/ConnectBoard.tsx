import React from "react"
import api from "./api"
import { PortId, PortI } from "./connection"
import InputRow from "./InputRow"
import { renamed_name } from "./utils"

interface StatusI {
  ports: PortI[]
  connections: Record<PortId, PortId[]>
}

interface ConnectBoardState {
  ports: PortI[]
  inputs: PortI[]
  outputs: PortI[]
  connections: Record<PortId, PortId[]>
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
    inputs: [],
    outputs: [],
    connections: {},
    ports: [],
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
    this.setState({
      ports: status.ports,
      inputs: Object.values(status.ports).filter(
        (x: PortI) => !x.hidden && x.input
      ),
      outputs: Object.values(status.ports).filter(
        (x: PortI) => !x.hidden && x.output
      ),
      connections: status.connections,
    })
  }

  async disconnect(f: PortId, t: PortId) {
    await api.post("disconnect", {
      from: f,
      to: t,
    })
    await this.reloadStatus()
  }

  async connect(f: PortId, t: PortId) {
    console.info("Connect %o -> %o", f, t)
    await api.post("connect", {
      from: f,
      to: t,
    })
    await this.reloadStatus()
  }

  setup(port: PortI) {
    let name = prompt(
      `Setup name for port (${port.port_label})`,
      renamed_name(port.label, port.port_label)
    )
    if (name === undefined) {
      return
    }
    if (name === "") {
      name = port.port_label
    }
    const renames = JSON.parse(localStorage.renames || "{}")
    localStorage.renames = JSON.stringify({ ...renames, [port.label]: name })
  }

  render() {
    const { inputs, outputs, connections, ports } = this.state

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
            {inputs.map((i, rown) => (
              <InputRow
                input={i}
                key={rown}
                connections={connections}
                ports={ports}
                outputs={outputs}
                connect={this.connect.bind(this)}
                disconnect={this.disconnect.bind(this)}
                setMonitor={this.props.setMonitor}
                setup={this.setup.bind(this)}
              />
            ))}
          </tbody>
        </table>
      </div>
    )
  }
}

export default ConnectBoard
