import React, { CSSProperties } from 'react'

export interface KeyboardProps {
  pressed: Record<number, number> // stores velocity, for example 0, off
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

function getKeyStyle(
  pressed: Record<number, number>,
  key: number,
  default_: CSSProperties,
) {
  if (!pressed[key]) {
    return default_
  }
  return {...PRESSED_KEY, fill: `rgb(${pressed[key]*2}, 35, 200)`}
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
            style={getKeyStyle(pressed, basekey + octave * 12 + 0, WHITE_KEY)}
            width="20"
            height="50"
            x="0"
            y="0"
          />
          <rect
            style={getKeyStyle(pressed, basekey + octave * 12 + 2, WHITE_KEY)}
            width="20"
            height="50"
            x="20"
            y="0"
          />
          <rect
            style={getKeyStyle(pressed, basekey + octave * 12 + 4, WHITE_KEY)}
            width="20"
            height="50"
            x="40"
            y="0"
          />
          <rect
            style={getKeyStyle(pressed, basekey + octave * 12 + 5, WHITE_KEY)}
            width="20"
            height="50"
            x="60"
            y="0"
          />
          <rect
            style={getKeyStyle(pressed, basekey + octave * 12 + 7, WHITE_KEY)}
            width="20"
            height="50"
            x="80"
            y="0"
          />
          <rect
            style={getKeyStyle(pressed, basekey + octave * 12 + 9, WHITE_KEY)}
            width="20"
            height="50"
            x="100"
            y="0"
          />
          <rect
            style={getKeyStyle(pressed, basekey + octave * 12 + 11, WHITE_KEY)}
            width="20"
            height="50"
            x="120"
            y="0"
          />
          <rect
            style={getKeyStyle(pressed, basekey + octave * 12 + 1, BLACK_KEY)}
            width="10"
            height="35"
            x="15"
            y="0"
          />
          <rect
            style={getKeyStyle(pressed, basekey + octave * 12 + 3, BLACK_KEY)}
            width="10"
            height="35"
            x="35"
            y="0"
          />
          <rect
            style={getKeyStyle(pressed, basekey + octave * 12 + 6, BLACK_KEY)}
            width="10"
            height="35"
            x="75"
            y="0"
          />
          <rect
            style={getKeyStyle(pressed, basekey + octave * 12 + 8, BLACK_KEY)}
            width="10"
            height="35"
            x="95"
            y="0"
          />
          <rect
            style={getKeyStyle(pressed, basekey + octave * 12 + 10, BLACK_KEY)}
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
