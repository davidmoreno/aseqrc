import React from 'react'
import api from './api'
import { PortId, PortI } from './connection'
import './styles.css'


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

function includes(list: string[]|undefined, item: string): boolean {
  if (!list)
    return false;
  for (const l of list){
    if (l == item){
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
  }

  async componentDidMount() {
    await this.reloadStatus()

    // May be set to unmount, but unmount is get out so ...
    setInterval(this.reloadStatus.bind(this), 5000)
  }

  async reloadStatus(){
    const status = await api.get<StatusI>("status")
    this.setState({
      ports: status.ports,
      inputs: Object.values(status.ports).filter( (x: PortI) => x.input ),
      outputs: Object.values(status.ports).filter( (x: PortI) => x.output ),
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
    await api.post("connect", {
      "from": f,
      "to": t,
    })
    await this.reloadStatus()
  }

  render(){
    const {inputs, outputs, connections, ports} = this.state

    return (
      <div className="">
        <table className="w-100vw">
          <thead className="md:hidden">
            <tr className="bg-orange" className="md:flex md:flex-col">
              <th>Input Port</th>
              <th>Output ports</th>
            </tr>
          </thead>
          <tbody>
            {inputs.map( i => (
              <tr key={i.id} className="md:flex md:flex-col">
                <th className="text-blue bg-orange">{i.label}</th>
                <td className="align-top pb-20px">
                  <div className="flex flex-row md:flex-col">
                    {(connections[i.id] || []).map( (o, n) => (
                      <div key={o} className={`px-10px py-10px flex flex-row ${(n & 1) == 0 ? "bg-blue-light" : "" }`}>
                        <span className="pr-10px w-full">{ports[o].label}</span>
                        <button className="mw-45px" onClick={() => this.disconnect(i.id, o)}>✖</button>
                      </div>
                    ))}
                    <div className="pt-20px">
                      <select onChange={ev => this.connect(i.id, ev.target.value)} className="w-full">
                        <option>-- Select Input to Connect --</option>
                        {outputs.filter( o => !includes(connections[i.id], o.id)).map( o => (
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