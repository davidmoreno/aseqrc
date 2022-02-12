import React from 'react'

export interface KeyboardProps {
  pressed: number[]
  noctaves: number
}

const WHITE_KEY = {
  opacity: 1,
  fill: '#ffffff',
  fillOpacity: 1,
  stroke: '#000000',
  strokeWidth: 1,
  strokeMiterlimit: 4,
  strokeDasharray: 'none',
  strokeOpacity: 1,
}
const BLACK_KEY = {
  opacity: 1,
  fill: '#000000',
  fillOpacity: 1,
  stroke: '#000000',
  strokeWidth: 1,
  strokeMiterlimit: 4,
  strokeDasharray: 'none',
  strokeOpacity: 1,
}
const PRESSED_KEY = {
  fill: '#0022BB',
  stroke: '#000000',
  strokeWidth: 1,
}

export const Keyboard = (props: KeyboardProps) => {
  const basekey = 36
  const { pressed, noctaves } = props

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${noctaves * 140} 50`}
    >
      {range(noctaves).map((octave) => (
        <g id="layer1" transform={`translate(${140 * octave}, 0)`} key={octave}>
          <rect
            style={
              pressed.includes(basekey + octave * 12 + 0)
                ? PRESSED_KEY
                : WHITE_KEY
            }
            width="20"
            height="50"
            x="0"
            y="0"
          />
          <rect
            style={
              pressed.includes(basekey + octave * 12 + 2)
                ? PRESSED_KEY
                : WHITE_KEY
            }
            width="20"
            height="50"
            x="20"
            y="0"
          />
          <rect
            style={
              pressed.includes(basekey + octave * 12 + 4)
                ? PRESSED_KEY
                : WHITE_KEY
            }
            width="20"
            height="50"
            x="40"
            y="0"
          />
          <rect
            style={
              pressed.includes(basekey + octave * 12 + 5)
                ? PRESSED_KEY
                : WHITE_KEY
            }
            width="20"
            height="50"
            x="60"
            y="0"
          />
          <rect
            style={
              pressed.includes(basekey + octave * 12 + 7)
                ? PRESSED_KEY
                : WHITE_KEY
            }
            width="20"
            height="50"
            x="80"
            y="0"
          />
          <rect
            style={
              pressed.includes(basekey + octave * 12 + 9)
                ? PRESSED_KEY
                : WHITE_KEY
            }
            width="20"
            height="50"
            x="100"
            y="0"
          />
          <rect
            style={
              pressed.includes(basekey + octave * 12 + 11)
                ? PRESSED_KEY
                : WHITE_KEY
            }
            width="20"
            height="50"
            x="120"
            y="0"
          />
          <rect
            style={
              pressed.includes(basekey + octave * 12 + 1)
                ? PRESSED_KEY
                : BLACK_KEY
            }
            width="10"
            height="35"
            x="15"
            y="0"
          />
          <rect
            style={
              pressed.includes(basekey + octave * 12 + 3)
                ? PRESSED_KEY
                : BLACK_KEY
            }
            width="10"
            height="35"
            x="35"
            y="0"
          />
          <rect
            style={
              pressed.includes(basekey + octave * 12 + 6)
                ? PRESSED_KEY
                : BLACK_KEY
            }
            width="10"
            height="35"
            x="75"
            y="0"
          />
          <rect
            style={
              pressed.includes(basekey + octave * 12 + 8)
                ? PRESSED_KEY
                : BLACK_KEY
            }
            width="10"
            height="35"
            x="95"
            y="0"
          />
          <rect
            style={
              pressed.includes(basekey + octave * 12 + 10)
                ? PRESSED_KEY
                : BLACK_KEY
            }
            width="10"
            height="35"
            x="115"
            y="0"
          />
        </g>
      ))}
    </svg>
  )
}

function range(count) {
  let ret = []
  for (let i = 0; i < count; i++) {
    ret.push(i)
  }
  return ret
}
