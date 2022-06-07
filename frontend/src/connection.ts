export interface Port {
  device_id: number
  port_id: number
}

export interface DevicePort {
  device_id: number
  port_id: number
  name: string
  is_input : boolean
  is_output: boolean
}

export interface Device {
  device_id: number
	name: string
	ports: Record<number, DevicePort>
}

export type DeviceTree = Record<number, Device>
export type ConnectionTree = Record<number, Record<number, Port[]>>
