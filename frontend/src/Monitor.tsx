import React from "react"
import { reverse, row_style } from "./utils"
import api from "./api"
import { Keyboard } from "./Keyboard"
import { Port } from "./connection"
import { EventI, midi_to_event } from "./midi"

interface MonitorProps {
  onClose: () => any
  from: Port
}

interface MonitorState {
  maxid: number
  events: EventI[]
  last: number
  prevlast: number
  pressed: Record<number, number>
  websocket?: WebSocket
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

    const event = midi_to_event(buffer)
    const id = this.state.maxid + 1
    event.id = id

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
