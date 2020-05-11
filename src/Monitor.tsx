import React from 'react'
import { row_style } from './colors'
import api from './api'

interface MonitorProps {
  onClose: () => any;
  from: string;
}

interface EventI {
  id: number;
  type: string;
  data: any;
}

interface MonitorState {
  events: EventI[];
  timer: number;
}

const EVCOLOR = {
  "noteon": row_style(0),
  "noteoff": row_style(1),
  "note": row_style(2),
}

class Monitor extends React.Component<MonitorProps> {
  state: MonitorState = {
    events: [],
    timer: 0,
  }

  async componentDidMount() {
    await api.post("monitor", {from: this.props.from})
    await this.reloadEvents()
    const timer = setInterval(this.reloadEvents.bind(this), 1000)
    this.setState({timer})
  }

  async componentWillUnmount(){
    clearInterval(this.state.timer)
    await api.post("monitor", {from: null})
  }

  async reloadEvents(){
    const events = await api.get("monitor")
    this.setState({events: events.events})
  }

  render() {
    return (
      <>
        <div className="bg-orange p-10px">
          <button className="bg-orange p-10px" onClick={this.props.onClose}>
            &lt; Back
        </button>
        </div>
        <table className="w-full uppercase">
          <thead>
            <tr>
              <th className="p-10px">
                Type
              </th>
              <th className="p-10px" colSpan={10}>
                Data
              </th>
            </tr>
          </thead>
          <tbody>
            {this.state.events.map( (ev, n) => (
              <tr style={EVCOLOR[ev.type] || row_style(ev.id)} key={n}>
                <td className="p-10px align-right">{ev.type}</td>
                {Object.keys(ev.data).map( k => (
                  <td className="p-10px" key={k}><span className="text-xs">{k.split('.')[1]}:</span> <b>{ev.data[k]}</b></td>
                ))}
              </tr>
            ))}
          </tbody>

        </table>
      </>
    )
  }
}

export default Monitor
