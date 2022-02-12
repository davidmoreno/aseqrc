export const COLORS = [
  { background: '#24add5', color: 'white' },
  { background: '#ff6b1c', color: 'black' },
  { background: '#ffa431', color: 'black' },
  { background: '#73d83c', color: 'white' },
  { background: '#ffea4b', color: 'black' },
]

export function row_style(n) {
  return COLORS[n % COLORS.length]
}

export function renamed_name(id: string, default_?: string) {
  const renames = JSON.parse(localStorage.renames || '{}')
  return renames[id] || default_ || id
}

export function reverse<T>(list: T[]) {
  let ret: T[] = []
  for (const element of list) {
    ret = [element, ...ret]
  }
  return ret
}
