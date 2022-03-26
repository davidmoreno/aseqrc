import React from "react"

import { renamed_name, row_style } from "./utils"
import Connection from "./Connection"
import { ConnectionTree, Device, DevicePort, Port } from "./connection"
import { isJSDocProtectedTag } from "typescript"

interface DeviceRowI {
  device: Device
  port: DevicePort
  inputs: DevicePort[]
  connected_to: Port[]
  setMonitor(port: Port): void
  connect(orig: Port, dest: Port): Promise<void>
  disconnect(orig: Port, dest: Port): Promise<void>
  setup(port: DevicePort): void
}

function includes(list: string[] | undefined, item: string): boolean {
  if (!list) return false
  for (const l of list) {
    if (l == item) {
      return true
    }
  }
  return false
}

const InputRow = (props: DeviceRowI) => {
  const { device, port, inputs, connected_to, inputs: outputs } = props

  const deviceid = device.device_id
  return (
    <tr key={deviceid} className="md:flex md:flex-col">
      <th className="h-full p-10px" style={row_style(deviceid)}>
        <div className="flex flex-row items-center md:min-w-400px h-full with-sidetag">
          <div className="sidetag">{device.name}</div>
          <div className="flex-1 py-24px">{port.name}</div>
          <div className="flex flex-col">
            {
              <button
                className="align-end mb-20px"
                style={row_style(deviceid)}
                onClick={() => props.setup(port)}
              >
                &#9881;
              </button>
            }

            <button
              className="align-end shadow"
              style={row_style(deviceid)}
              onClick={() => props.setMonitor(port)}
            >
              Monitor
            </button>
          </div>
        </div>
      </th>
      <td className="align-top">
        <div className="flex flex-row md:flex-col flex-wrap">
          {(connected_to || []).map((iport, n) => (
            <Connection
              key={n}
              port={port}
              inputs={props.inputs}
              input={iport}
              n={n}
              disconnect={props.disconnect}
            />
          ))}
          <div className="p-24px lg:min-w-400px br-1px">
            <select
              onChange={(ev) =>
                props.connect(port, inputs[Number(ev.target.value)])
              }
              className="w-full"
            >
              <option>-- Select Input to Connect --</option>
              {inputs
                // .filter(
                //   (o) => !o.hidden && !includes(connected_to[input.id], o.id)
                // )
                .map((input, idx) => (
                  <option value={idx} key={idx}>
                    {input.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </td>
    </tr>
  )
}

export default InputRow
