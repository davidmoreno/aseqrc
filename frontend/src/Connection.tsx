import React from "react"
import { Device, DevicePort, Port } from "./connection"
import { renamed_name } from "./utils"
import { get_image } from "./image"

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

  const name = minput ? minput.name : "Unknown"
  const [devicename, portname] = name.split("/", 2)

  return (
    <div
      className={`p-24px flex flex-row lg:min-w-400px br-1px bb-1px items-center ${
        (props.n & 1) == 0 ? "bg-blue-light" : ""
      }`}
    >
      <img
        className="w-64px h-64px object-fill"
        src={get_image(devicename, portname)}
      ></img>
      <span className="pr-10px w-full text-center">{name}</span>
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
