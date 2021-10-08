import React from "react"

import { renamed_name, row_style } from "./utils"
import Connection from "./Connection"
import { PortI, PortId } from "./connection"

interface DeviceRowI {
  ports: PortI[]
  input: PortI
  outputs: PortI[]
  connections: Record<PortId, PortId[]>
  setMonitor(mon: string): void
  connect(orig: string, dest: string): Promise<void>
  disconnect(orig: string, dest: string): Promise<void>
  setup(port: PortI): void
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
  const { input, connections, ports, outputs } = props

  const deviceid = input.id.split(":")[0]
  return (
    <tr key={input.id} className="md:flex md:flex-col">
      <th className="h-full p-10px" style={row_style(deviceid)}>
        <div className="flex flex-row items-center md:min-w-400px h-full">
          <div className="sidetag">{input.device_label}</div>
          <div className="flex-1 py-24px">
            {renamed_name(input.label, input.port_label)}
          </div>
          <div className="flex flex-col">
            {
              <button
                className="align-end mb-20px"
                style={row_style(deviceid)}
                onClick={() => props.setup(input)}
              >
                &#9881;
              </button>
            }

            <button
              className="align-end shadow"
              style={row_style(deviceid)}
              onClick={() => props.setMonitor(input.port)}
            >
              Monitor
            </button>
          </div>
        </div>
      </th>
      <td className="align-top">
        <div className="flex flex-row md:flex-col flex-wrap">
          {(connections[input.id] || []).map((o, n) => (
            <Connection
              ports={props.ports}
              port={props.ports[o]}
              key={n}
              input={input}
              n={n}
              disconnect={props.disconnect}
            />
          ))}
          <div className="p-24px lg:min-w-400px br-1px">
            <select
              onChange={(ev) => props.connect(input.id, ev.target.value)}
              className="w-full"
            >
              <option>-- Select Input to Connect --</option>
              {outputs
                .filter(
                  (o) => !o.hidden && !includes(connections[input.id], o.id)
                )
                .map((o) => (
                  <option value={o.id} key={o.id}>
                    {o.label}
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
