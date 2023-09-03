import midi_svg from "../img/midi.svg"
import React from "react"

interface BrandLogoI {
  device_re?: RegExp
  port_re?: RegExp
  image_url: string
}

const BRAND_LOGO: BrandLogoI[] = [
  // ASHUN SOUND MACHINES
  {
    port_re: /.*\sasm\s.*/i,
    image_url: require("../img/asm.png"),
  },
  {
    port_re: /.*hydrasynth.*/i,
    image_url: require("../img/asm.png"),
  },
  // BEHRINGER
  {
    port_re: /.*deepmind.*/i,
    image_url: require("../img/behringer.svg"),
  },
  {
    port_re: /.*model d.*/i,
    image_url: require("../img/behringer.svg"),
  },
  // FOCUSRITE
  {
    device_re: /^Scarlett/,
    image_url: require("../img/focursrite-scarlett-6i6.png"),
  },
  {
    device_re: /^Virtual Raw MIDI.*/,
    image_url: require("../img/midi-black.svg"),
  },
  // ROLAND
  {
    port_re: /.*Roland.*/i,
    image_url: require("../img/roland.svg"),
  },
  {
    port_re: /.*jupiter.*/i,
    image_url: require("../img/roland.svg"),
  },
  // NOVATION
  {
    port_re: /.*\novation\s.*/i,
    image_url: require("../img/novation.png"),
  },
  {
    port_re: /.*peak.*/i,
    image_url: require("../img/novation.png"),
  },
  // SOFTWARE
  {
    device_re: /^VMPK.*/,
    image_url: require("../img/vmpk.png"),
  },

  // DEFAULTS
  // RTPMIDI
  {
    device_re: /.*rtpmidi.*/,
    image_url: require("../img/rtpmidi.svg"),
  },
  // FINAL DEFAULT
  {
    image_url: midi_svg,
  },
]

export function get_image(device: string, port: string) {
  for (const check of BRAND_LOGO) {
    let ok = true
    if (check.device_re && !check.device_re.test(device)) {
      ok = false
    }
    if (check.port_re && !check.port_re.test(port)) {
      ok = false
    }
    if (ok) return check.image_url
  }

  return midi_svg
}

export const MidiBrandLogo = (props: {
  className?: string
  device: string
  port: string
}) => {
  return (
    <img
      className={`w-64px h-64px object-contain ${props.className || ""}`}
      src={get_image(props.device, props.port)}
    />
  )
}
