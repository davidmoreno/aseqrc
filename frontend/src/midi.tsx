export interface EventI {
  id: number
  type: string
  data: any
}

export const CC_NAMES = {
  0: "Bank Select",
  1: "Modulation",
  2: "Breath Controller",
  3: "Undefined",
  4: "Foot Controller",
  5: "Portamento Time",
  6: "Data Entry Most Significant Bit(MSB)",
  7: "Volume",
  8: "Balance",
  9: "Undefined",
  10: "Pan",
  11: "Expression",
  12: "Effect Controller 1",
  13: "Effect Controller 2",
  // (14, "Undefined".to_string()),
  // (15, "Undefined".to_string()),
  //(1, "General Purpose".to_string()),
  //(1, "Undefined".to_string()),
  // (1, "Controller 0-31 Least Significant Bit (LSB)".to_string()),
  64: "Damper Pedal / Sustain Pedal",
  65: "Portamento On/Off Switch",
  66: "Sostenuto On/Off Switch",
  67: "Soft Pedal On/Off Switch",
  68: "Legato FootSwitch",
  69: "Hold 2",
  70: "Sound Controller 1",
  71: "Sound Controller 2",
  72: "Sound Controller 3",
  73: "Sound Controller 4",
  74: "Sound Controller 5",
  75: "Sound Controller 6",
  76: "Sound Controller 7",
  77: "Sound Controller 8",
  78: "Sound Controller 9",
  79: "Sound Controller 10",
  80: "General Purpose MIDI CC Controller",
  81: "General Purpose MIDI CC Controller",
  82: "General Purpose MIDI CC Controller",
  83: "General Purpose MIDI CC Controller",
  84: "Portamento CC Control",
  // (, "Undefined".to_string()),
  91: "Effect 1 Depth",
  92: "Effect 2 Depth",
  93: "Effect 3 Depth",
  94: "Effect 4 Depth",
  95: "Effect 5 Depth",
  96: "(+1) Data Increment",
  97: "(-1) Data Decrement",
  98: "Non-Registered Parameter Number LSB (NRPN)",
  99: "Non-Registered Parameter Number MSB (NRPN)",
  100: "Registered Parameter Number LSB (RPN)",
  101: "Registered Parameter Number MSB (RPN)",
  // (1, "Undefined".to_string()),
  // (1, "".to_string()),
  120: "All Sound Off",
  121: "Reset All Controllers",
  122: "Local On/Off Switch",
  123: "All Notes Off",
  124: "Omni Mode Off",
  125: "Omni Mode On",
  126: "Mono Mode",
  127: "Poly Mode",
}

export function midi_to_event(buffer: Uint8Array) {
  let type: string = ""
  let data: any = {}
  switch (buffer[0] & 0xf0) {
    case 0x90:
      type = "noteon"
      data = {
        channel: buffer[0] & 0x0f,
        note: buffer[1],
        velocity: buffer[2],
      }
      break
    case 0x80:
      type = "noteoff"
      data = {
        channel: buffer[0] & 0x0f,
        note: buffer[1],
        velocity: buffer[2],
      }
      break
    case 0xb0:
      type = "controller"
      data = {
        channel: buffer[0] & 0x0f,
        name: CC_NAMES[buffer[1]],
        cc: buffer[1],
        value: buffer[2],
      }
      break
    case 0xa0:
      type = "aftertouch"
      data = {
        channel: buffer[0] & 0x0f,
        note: buffer[1],
        value: buffer[2],
      }
      break
    case 0xe0:
      type = "pitch"
      data = {
        channel: buffer[0] & 0x0f,
        value: buffer[2] * 0x80 + buffer[1],
      }
      break
    case 0xc0:
      type = "program change"
      data = {
        channel: buffer[0] & 0x0f,
        value: buffer[1],
      }
      break
    default:
      type = "unknown"
      data = {
        b1: buffer[0].toString(16),
        b2: buffer[1].toString(16),
        b3: buffer[2].toString(16),
      }
  }
  const event: EventI = {
    id: 0,
    type,
    data,
  }
  return event
}
