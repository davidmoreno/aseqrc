import React from 'react'
import { row_style } from './colors'

interface MonitorProps {
  onClose: () => any;
  from: string;
}

class Monitor extends React.Component<MonitorProps> {
  render() {
    return (
      <>
        <div className="bg-orange p-10px">
          <button className="bg-orange p-10px" onClick={this.props.onClose}>
            &lt; Back
        </button>
        </div>
        <table className="w-full">
          <thead>
            <tr>
              <th className="p-10px">
                Type
              </th>
              <th className="p-10px">
                Data
              </th>
              <th className="p-10px">
                Data
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style={row_style(1)}>
              <td className="p-10px">NOTE ON</td>
              <td className="p-10px">C4</td>
              <td className="p-10px">128</td>
            </tr>
          </tbody>

        </table>
      </>
    )
  }
}

export default Monitor
