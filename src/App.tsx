import React from 'react'
import api from './api'
import { PortId, PortI } from './connection'
import './styles.css'

interface AppState {
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
    const status = await api.get<AppState>("status")
    this.setState({
      inputs: status.inputs,
      outputs: status.outputs,
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
    const {inputs, outputs, connections} = this.state

    return (
      <div className="">
        <table className="w-100vw">
          <thead>
            <tr className="bg-orange">
              <th>Input Port</th>
              <th>Output ports</th>
            </tr>
          </thead>
          <tbody>
            {inputs.map( i => (
              <tr key={i.id}>
                <th>{i.label}</th>
                <td className="align-top">
                  <div className="flex flex-row md:flex-col">
                    {(connections[i.id] || []).map( o => (
                      <div key={o} className="px-10px py-10px">
                        <span className="pr-10px">{o}</span>
                        <button onClick={() => this.disconnect(i.id, o)}>x</button>
                      </div>
                    ))}
                    <div>
                      <select onChange={ev => this.connect(i.id, ev.target.value)}>
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
