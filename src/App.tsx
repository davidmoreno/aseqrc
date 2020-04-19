import React from 'react'
import api from './api'
import { PortId, PortI } from './connection'

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
  }

  async reloadStatus(){
    const status = await api.get<AppState>("status")
    console.log(status)
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
        <table>
          <thead>
            <tr>
              <th>Input Port</th>
              <th>Output ports...</th>
            </tr>
          </thead>
          <tbody>
            {inputs.map( i => (
              <tr key={i.id}>
                <th>{i.label}</th>
                {(connections[i.id] || []).map( o => (
                  <td key={o}>
                    {o}
                    <button onClick={() => this.disconnect(i.id, o)}>x</button>
                  </td>
                ))}
                <td>
                  <select onChange={ev => this.connect(i.id, ev.target.value)}>
                    {outputs.filter( o => !includes(connections[i.id], o.id)).map( o => (
                      <option value={o.id} key={o.id}>{o.label}</option>
                    ))}
                  </select>
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
