import React from "react"
import "./styles.css"
import ConnectBoard from "./ConnectBoard"
import Monitor from "./Monitor"
import api from "./api"
import { row_style } from "./utils"

interface ConfigI {
  hostname: string
}

interface AppState {
  screen: "connections" | "monitor"
  gen: number
  from?: string
  config?: ConfigI
}

class App extends React.Component<{}, AppState> {
  state: AppState = {
    screen: "connections",
    gen: 0,
  }
  async componentDidMount() {
    const config = await api.get<ConfigI>("config")
    this.setState({ config: config })
  }

  reset() {
    api.post("reset", {})
    this.setState({ gen: this.state.gen + 1 })
  }

  render() {
    if (this.state.screen === "connections") {
      return (
        <div className="flex flex-col min-h-screen">
          <div className={`flex text-small items-center`}>
            <span className="p-24px text-huge">
              {this.state.config?.hostname}
            </span>
            <span className="flex-1" />
            <div className="p-10px flex flex-col items-end text-right">
              <span className="text-normal">AseqRC 2023.09</span>
              <button
                className="hover:bg-orange text-black mt-10px"
                onClick={() => this.reset()}
              >
                Reload &#128259;
              </button>
            </div>
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
