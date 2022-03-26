import React from "react"
import { Device, DevicePort, Port } from "./connection"
import { renamed_name } from "./utils"

interface ConnectionI {
  port: DevicePort
  input: Port
  inputs: DevicePort[]
  n: number
  disconnect(orig: Port, dest: Port): Promise<void>
}

const Connection = (props: ConnectionI) => {
  const { port, input, inputs, n, disconnect } = props

  const minput = inputs.find(
    (x) => x.port_id === input.port_id && x.device_id === input.device_id
  )

  return (
    <div
      className={`p-24px flex flex-row lg:min-w-400px br-1px bb-1px items-center ${
        (props.n & 1) == 0 ? "bg-blue-light" : ""
      } with-sidetag`}
    >
      {/* <span className="sidetag-70">{device.name}</span> */}
      <span className="pr-10px w-full text-center">
        {minput ? minput.name : "Unknown"}
      </span>
      <button
        className="min-w-45px"
        onClick={() => props.disconnect(port, input)}
      >
        ✖
      </button>
    </div>
  )
}

export default Connection
