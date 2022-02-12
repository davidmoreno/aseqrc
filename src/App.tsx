import React from "react"
import "./styles.css"
import ConnectBoard from "./ConnectBoard"
import Monitor from "./Monitor"
import api from "./api"
import { Keyboard } from "./Keyboard"

interface AppState {
  screen: "connections" | "monitor"
  gen: number
  from?: string
}

class App extends React.Component<{}, AppState> {
  state: AppState = {
    screen: "connections",
    gen: 0,
  }

  reset() {
    api.post("reset", {})
    this.setState({ gen: this.state.gen + 1 })
  }

  render() {
    if (this.state.screen === "connections") {
      return (
        <div className="flex flex-col min-h-screen">
          <div className="flex mb-10px bg-orange text-small items-center">
            <span className="mr-20px p-3px text-normal">AseqRC 2021.11</span>
            <span className="flex-1" />
            <button
              className="bg-orange text-white"
              onClick={() => this.reset()}
            >
              Reload &#128259;
            </button>
          </div>
          <ConnectBoard
            key={this.state.gen}
            setMonitor={(from: string) =>
              this.setState({ screen: "monitor", from })
            }
          />
        </div>
      )
    }
    if (this.state.screen === "monitor") {
      return (
        <Monitor
          onClose={() => this.setState({ screen: "connections" })}
          from={this.state.from!}
        />
      )
    }
  }
}

export default App
