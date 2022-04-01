import React from "react"
import { reverse, row_style } from "./utils"
import api from "./api"
import { Keyboard } from "./Keyboard"
import { Port } from "./connection"

interface MonitorProps {
  onClose: () => any
  from: Port
}

interface EventI {
  id: number
  type: string
  data: any
}

interface MonitorState {
  maxid: number
  events: EventI[]
  last: number
  prevlast: number
  pressed: Record<number, number>
  websocket?: WebSocket
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
  switch (event.type) {
    case "noteon":
      return row_style(0)
      break
    case "noteoff":
      return row_style(1)
      break
    case "note":
      return row_style(2)
    case "cc":
      return row_style(event.data["control.param"])
    case "pitch bend":
      return row_style(3)
  }
  return row_style(4)
}

class Monitor extends React.Component<MonitorProps> {
  state: MonitorState = {
    maxid: 0,
    events: [],
    last: 0,
    prevlast: 0,
    pressed: [],
  }

  async componentDidMount() {
    const from = this.props.from
    const url = new URL(
      `/monitor?port=${from.device_id}:${from.port_id}`,
      window.location.href
    )
    url.protocol = url.protocol.replace("http", "ws")
    const websocket = new WebSocket(url.href)
    websocket.addEventListener("open", () => console.log("open ws"))
    websocket.addEventListener("close", () => console.log("close ws"))
    websocket.addEventListener("message", this.receivedMessage.bind(this))
    this.setState({ websocket })
    console.log({ websocket })
  }

  async receivedMessage(wsdata: any) {
    const buffer: Uint8Array = new Uint8Array(await wsdata.data.arrayBuffer())

    let type: string = ""
    let data: any = {}
    switch (buffer[0] & 0xf0) {
      case 0x90:
        type = "noteon"
        data = {
          channel: buffer[0] & 0x0f,
          note: buffer[1],
          velocity: buffer[2],
        }
        break
      case 0x80:
        type = "noteoff"
        data = {
          channel: buffer[0] & 0x0f,
          note: buffer[1],
          velocity: buffer[2],
        }
        break
    }
    const id = this.state.maxid + 1

    const event: EventI = {
      id,
      type,
      data,
    }

    const pressed = this.updatePressState(event, this.state.pressed)
    this.setState({ pressed })

    const events = [event, ...this.state.events.slice(0, 100)]
    this.setState({ events, maxid: id })
  }

  async componentWillUnmount() {
    if (this.state.websocket) {
      this.state.websocket.send("CLOSE")
      console.log("Close connection")
      this.state.websocket.close()
    }
  }

  updatePressState(
    event: EventI,
    pressed: Record<number, number>
  ): Record<number, number> {
    if (event.type === "noteon" || event.type === "keypress") {
      pressed = {
        ...pressed,
        [event.data["note"]]: event.data["velocity"],
      }
    }
    if (event.type === "noteoff") {
      pressed = {
        ...pressed,
        [event.data["note"]]: 0,
      }
    }
    return pressed
  }

  render() {
    const { prevlast, pressed } = this.state

    return (
      <>
        <div className="bg-orange p-10px">
          <button className="bg-orange p-10px" onClick={this.props.onClose}>
            &lt; Back
          </button>
        </div>
        <Keyboard pressed={pressed} noctaves={4} />
        <table className="w-full uppercase">
          <thead>
            <tr>
              <th className="p-10px">Id</th>
              <th className="p-10px">Type</th>
              <th className="p-10px" colSpan={10}>
                Data
              </th>
            </tr>
          </thead>
          <tbody>
            {this.state.events.map((ev, n) => (
              <tr
                style={evcolor(ev)}
                className={ev.id <= prevlast ? "fade" : ""}
                key={n}
              >
                <td>{ev.id}</td>
                <td className="p-10px align-right">{ev.type}</td>
                {Object.keys(ev.data).map((k) =>
                  k === "control.param" ? (
                    <td className="p-10px" key={k}>
                      <span className="text-xs">{k}:</span> <b>{ev.data[k]}</b>{" "}
                      {CC_NAMES[ev.data[k]]}
                    </td>
                  ) : (
                    <td className="p-10px" key={k}>
                      <span className="text-xs">{k}:</span> <b>{ev.data[k]}</b>
                    </td>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </>
    )
  }
}

export default Monitor
