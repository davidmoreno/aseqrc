import React from "react"
import { PortI } from "./connection"
import { renamed_name } from "./utils"

interface ConnectionI {
  input: PortI
  port: PortI
  ports: PortI[]
  n: number
  disconnect(orig: string, dest: string): Promise<void>
}

const Connection = (props: ConnectionI) =>
  !props.port.hidden && (
    <div
      key={props.port.id}
      className={`p-24px flex flex-row lg:min-w-400px br-1px bb-1px items-center ${
        (props.n & 1) == 0 ? "bg-blue-light" : ""
      } with-sidetag`}
    >
      <span className="sidetag-70">{props.port.device_label}</span>
      <span className="pr-10px w-full text-center">
        {renamed_name(props.port.label, props.port.port_label)}
      </span>
      <button
        className="min-w-45px"
        onClick={() => props.disconnect(props.input.id, props.port.id)}
      >
        ✖
      </button>
    </div>
  )

export default Connection