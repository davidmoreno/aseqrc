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
  last: number;
  prevlast: number;
}

const CC_NAMES = {
  0: "Bank Select",
  1: "Modulation",
  2: "Breath Controller",
  3: "Undefined",
  4: "Foot Controller",
  5: "Portamento Time",
  6: "Data Entry Most Significant Bit(MSB)",
  7: "Volume",
  8: "Balance",
  9: "Undefined",
  10: "Pan",
  11: "Expression",
  12: "Effect Controller 1",
  13: "Effect Controller 2",
  // (14, "Undefined".to_string()),
  // (15, "Undefined".to_string()),
  //(1, "General Purpose".to_string()),
  //(1, "Undefined".to_string()),
  // (1, "Controller 0-31 Least Significant Bit (LSB)".to_string()),
  64: "Damper Pedal / Sustain Pedal",
  65: "Portamento On/Off Switch",
  66: "Sostenuto On/Off Switch",
  67: "Soft Pedal On/Off Switch",
  68: "Legato FootSwitch",
  69: "Hold 2",
  70: "Sound Controller 1",
  71: "Sound Controller 2",
  72: "Sound Controller 3",
  73: "Sound Controller 4",
  74: "Sound Controller 5",
  75: "Sound Controller 6",
  76: "Sound Controller 7",
  77: "Sound Controller 8",
  78: "Sound Controller 9",
  79: "Sound Controller 10",
  80: "General Purpose MIDI CC Controller",
  81: "General Purpose MIDI CC Controller",
  82: "General Purpose MIDI CC Controller",
  83: "General Purpose MIDI CC Controller",
  84: "Portamento CC Control",
  // (, "Undefined".to_string()),
  91: "Effect 1 Depth",
  92: "Effect 2 Depth",
  93: "Effect 3 Depth",
  94: "Effect 4 Depth",
  95: "Effect 5 Depth",
  96: "(+1) Data Increment",
  97: "(-1) Data Decrement",
  98: "Non-Registered Parameter Number LSB (NRPN)",
  99: "Non-Registered Parameter Number MSB (NRPN)",
  100: "Registered Parameter Number LSB (RPN)",
  101: "Registered Parameter Number MSB (RPN)",
  // (1, "Undefined".to_string()),
  // (1, "".to_string()),
  120: "All Sound Off",
  121: "Reset All Controllers",
  122: "Local On/Off Switch",
  123: "All Notes Off",
  124: "Omni Mode Off",
  125: "Omni Mode On",
  126: "Mono Mode",
  127: "Poly Mode",
}

function evcolor(event: any) {
  switch(event.type){
    case "noteon":
      return row_style(0);
    break;
    case "noteoff":
      return row_style(1);
    break;
    case "note":
      return row_style(2);
    case "cc":
      return row_style(event.data["control.param"])
    case "pitch bend":
      return row_style(3);
    }
  return row_style(4);
}

class Monitor extends React.Component<MonitorProps> {
  state: MonitorState = {
    events: [],
    timer: 0,
    last: 0,
    prevlast: 0,
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
    const prevlast = this.state.last
    const last = events.events.length ? events.events[0].id : 0
    if (prevlast !== last) {
      this.setState({prevlast, last})
    }
  }

  render() {
    const prevlast = this.state.prevlast

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
                Id
              </th>
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
              <tr style={evcolor(ev)} className={ev.id <= prevlast ? "fade" : ""} key={n}>
                <td>{ev.id}</td>
                <td className="p-10px align-right">{ev.type}</td>
                {Object.keys(ev.data).map( k => k === "control.param" ? (
                  <td className="p-10px" key={k}><span className="text-xs">{k.split('.')[1]}:</span> <b>{ev.data[k]}</b> {CC_NAMES[ev.data[k]]}</td>
                ) : (
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
