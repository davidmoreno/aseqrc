import React from 'react'
import './styles.css'
import ConnectBoard from './ConnectBoard'
import Monitor from './Monitor'



interface AppState {
  screen: "connections" | "monitor";
  from?: string;
}


class App extends React.Component<{}, AppState> {
  state: AppState = {
    screen: "connections",
  }

  render() {
    if (this.state.screen === "connections") {
      return (
        <ConnectBoard setMonitor={(from: string) => this.setState({ screen: "monitor", from })} />
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
