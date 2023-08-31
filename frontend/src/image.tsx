import midi_svg from "../img/midi.svg"
import midi_black_svg from "../img/midi-black.svg"
import rtpmidi_svg from "../img/rtpmidi.svg"
import vmpk_png from "../img/vmpk.png"

export function get_image(device: string, port: string) {
  if (device.startsWith("Virtual Raw MIDI")) {
    return midi_black_svg
  }
  if (device.includes("rtpmidi")) {
    return rtpmidi_svg
  }
  if (device.includes("VMPK")) {
    return vmpk_png
  }
  return midi_svg
}
