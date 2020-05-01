import React from 'react'
import api from './api'
import { PortId, PortI } from './connection'
import './styles.css'
import { row_style } from './colors';


interface StatusI {
  ports: PortI[];
  connections: Record<PortId, PortId[]>;
}

interface AppState {
  ports: PortI[];
  inputs: PortI[];
  outputs: PortI[];
  connections: Record<PortId, PortId[]>;
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

class App extends React.Component<{}, AppState> {
  state: AppState = {
    inputs: [],
    outputs: [],
    connections: {},
    ports: [],
  }

  async componentDidMount() {
    await this.reloadStatus()

    // May be set to unmount, but unmount is get out so ...
    setInterval(this.reloadStatus.bind(this), 5000)
  }

  async reloadStatus() {
    const status = await api.get<StatusI>("status")
    this.setState({
      ports: status.ports,
      inputs: Object.values(status.ports).filter((x: PortI) => x.input),
      outputs: Object.values(status.ports).filter((x: PortI) => x.output),
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
                <th className="p-24px md:min-w-400px" style={row_style(rown)}>{i.label}</th>
                <td className="align-top">
                  <div className="flex flex-row md:flex-col flex-wrap">
                    {(connections[i.id] || []).map((o, n) => (
                      <div key={o} className={`p-24px flex flex-row lg:min-w-400px br-1px bb-1px items-center ${(n & 1) == 0 ? "bg-blue-light" : ""}`}>
                        <span className="pr-10px w-full">{ports[o].label}</span>
                        <button className="min-w-45px" onClick={() => this.disconnect(i.id, o)}>✖</button>
                      </div>
                    ))}
                    <div className="p-24px lg:min-w-400px br-1px">
                      <select onChange={ev => this.connect(i.id, ev.target.value)} className="w-full">
                        <option>-- Select Input to Connect --</option>
                        {outputs.filter(o => !includes(connections[i.id], o.id)).map(o => (
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

export default App
