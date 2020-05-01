export const COLORS = [
    { background: '#ff6b1c', color: 'black' },
    { background: '#24add5', color: 'white' },
    { background: '#ffa431', color: 'black' },
    { background: '#73d83c', color: 'white' },
    { background: '#ffea4b', color: 'black' },
]


export function row_style(n) {
    return COLORS[n % COLORS.length]
}