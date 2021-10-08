import React from "react"

import { row_style } from "./colors"
import { PortI, PortId } from "./connection"

interface DeviceRowI {
  ports: PortI[]
  input: PortI
  outputs: PortI[]
  connections: Record<PortId, PortId[]>
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

export function InputRow(props: DeviceRowI) {
  const { input, connections, ports, outputs } = props

  const deviceid = input.id.split(":")[0]

  return (
    <tr key={input.id} className="md:flex md:flex-col">
      <th className="h-full p-10px" style={row_style(deviceid)}>
        <div className="flex flex-row items-center md:min-w-400px h-full">
          <div className="sidetag">{input.device_label}</div>
          <div className="flex-1 py-24px">{input.port_label}</div>
          <div className="flex flex-col">
            {/* <button
              className="align-end mb-20px"
              style={row_style(deviceid)}
              onClick={() => this.props.setMonitor(input.port)}
            >
              &#9881;
            </button> */}

            <button
              className="align-end shadow"
              style={row_style(deviceid)}
              onClick={() => this.props.setMonitor(input.port)}
            >
              Monitor
            </button>
          </div>
        </div>
      </th>
      <td className="align-top">
        <div className="flex flex-row md:flex-col flex-wrap">
          {(connections[input.id] || []).map(
            (o, n) =>
              !ports[o].hidden && (
                <div
                  key={o}
                  className={`p-24px flex flex-row lg:min-w-400px br-1px bb-1px items-center ${
                    (n & 1) == 0 ? "bg-blue-light" : ""
                  }`}
                >
                  <span className="pr-10px w-full">{ports[o].label}</span>
                  <button
                    className="min-w-45px"
                    onClick={() => this.disconnect(input.id, o)}
                  >
                    ✖
                  </button>
                </div>
              )
          )}
          <div className="p-24px lg:min-w-400px br-1px">
            <select
              onChange={(ev) => this.connect(input.id, ev.target.value)}
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
