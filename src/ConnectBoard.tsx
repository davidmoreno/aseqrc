import React from 'react'
import api from './api'
import { PortId, PortI } from './connection'
import { row_style } from './colors';


interface StatusI {
  ports: PortI[];
  connections: Record<PortId, PortId[]>;
}

interface ConnectBoardState {
  ports: PortI[];
  inputs: PortI[];
  outputs: PortI[];
  connections: Record<PortId, PortId[]>;
  timer: number;
}

function includes(list: string[] | undefined, item: string): boolean {
  if (!list)
    return false;
  for (const l of list) {
    if (l == item) {
      return true
    }
  }
  return false
}

interface ConnectBoardProps {
  setMonitor: (from: string) => void;
}

class ConnectBoard extends React.Component<ConnectBoardProps, ConnectBoardState> {
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
    this.setState({timer})
  }

  componentWillUnmount(){
    clearInterval(this.state.timer)
  }

  async reloadStatus() {
    const status = await api.get<StatusI>("status")
    this.setState({
      ports: status.ports,
      inputs: Object.values(status.ports).filter((x: PortI) => !x.hidden && x.input),
      outputs: Object.values(status.ports).filter((x: PortI) => !x.hidden && x.output),
      connections: status.connections,
    })
  }

  async disconnect(f: PortId, t: PortId) {
    await api.post("disconnect", {
      "from": f,
      "to": t,
    })
    await this.reloadStatus()
  }

  async connect(f: PortId, t: PortId) {
    console.info("Connect %o -> %o", f, t)
    await api.post("connect", {
      "from": f,
      "to": t,
    })
    await this.reloadStatus()
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
              <tr key={i.id} className="md:flex md:flex-col">
                <th className="h-full p-10px" style={row_style(rown)}>
                  <div className="flex flex-col items-center md:min-w-400px h-full" >
                    <div className="flex-1 py-24px">
                      {i.label}
                    </div>
                    <button
                      className="align-end"
                      style={row_style(rown)}
                      onClick={() => this.props.setMonitor(i.port)}>
                      Monitor
                    </button>
                  </div>
                </th>
                <td className="align-top">
                  <div className="flex flex-row md:flex-col flex-wrap">
                    {(connections[i.id] || []).map((o, n) => !ports[o].hidden && (
                      <div key={o} className={`p-24px flex flex-row lg:min-w-400px br-1px bb-1px items-center ${(n & 1) == 0 ? "bg-blue-light" : ""}`}>
                        <span className="pr-10px w-full">{ports[o].label}</span>
                        <button className="min-w-45px" onClick={() => this.disconnect(i.id, o)}>✖</button>
                      </div>
                    ))}
                    <div className="p-24px lg:min-w-400px br-1px">
                      <select onChange={ev => this.connect(i.id, ev.target.value)} className="w-full">
                        <option>-- Select Input to Connect --</option>
                        {outputs.filter(o => !o.hidden && !includes(connections[i.id], o.id)).map(o => (
                          <option value={o.id} key={o.id}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
}

export default ConnectBoard
