/* Дом в SVG: этажность, материал стен, гараж, терраса и стадия стройки (1 — фундамент … 5 — готов) */
const WALL = { 'Газобетон': '#ece7dc', 'Кирпич': '#b4553d', 'Брус': '#c58d55', 'Каркас': '#dfe5e8' }
export default function House({ floors = 1, material = 'Газобетон', garage = false, terrace = false, stage = 5, uid = 'h', className = '' }) {
  const h = floors === 2 ? 104 : 62, top = 176 - h, x = 86, w = 150
  const pat = `${uid}-${material}`
  return (
    <svg className={`house ${className}`} viewBox="0 0 320 210" role="img" aria-label={`Дом: ${floors} эт., ${material}${stage < 5 ? `, этап ${stage}` : ''}`}>
      <defs>
        <pattern id={`${uid}-Газобетон`} width="20" height="10" patternUnits="userSpaceOnUse"><rect width="20" height="10" fill={WALL['Газобетон']} /><path d="M0 9.5H20M10 0V5M0 5H20M20 5V10" stroke="#d3ccbd" strokeWidth=".8" /></pattern>
        <pattern id={`${uid}-Кирпич`} width="12" height="6" patternUnits="userSpaceOnUse"><rect width="12" height="6" fill={WALL['Кирпич']} /><path d="M0 5.6H12M6 0V3M0 3H12M12 3V6" stroke="#8e3f2c" strokeWidth=".7" /></pattern>
        <pattern id={`${uid}-Брус`} width="10" height="8" patternUnits="userSpaceOnUse"><rect width="10" height="8" fill={WALL['Брус']} /><path d="M0 7.5H10" stroke="#93643a" strokeWidth="1.2" /></pattern>
        <pattern id={`${uid}-Каркас`} width="9" height="10" patternUnits="userSpaceOnUse"><rect width="9" height="10" fill={WALL['Каркас']} /><path d="M8.5 0V10" stroke="#b9c3c8" strokeWidth=".8" /></pattern>
      </defs>
      <ellipse cx="160" cy="190" rx="150" ry="10" fill="rgba(60,80,40,.18)" />
      <rect x="10" y="184" width="300" height="4" rx="2" fill="#9db37a" />
      {/* фундамент */}
      <rect className="h-found" x={x - 8 - (terrace ? 44 : 0)} y="176" width={w + 16 + (terrace ? 44 : 0) + (garage ? 70 : 0)} height="9" fill="#9a9ea3" />
      {stage >= 2 && <g className="h-walls" style={{ transformOrigin: `160px 176px` }}>
        <rect x={x} y={top} width={w} height={h} fill={`url(#${pat})`} stroke="rgba(0,0,0,.18)" />
        {floors === 2 && <rect x={x} y={top + 44} width={w} height="4" fill="rgba(0,0,0,.12)" />}
        {garage && <g><rect x={x + w} y="128" width="62" height="48" fill={`url(#${pat})`} stroke="rgba(0,0,0,.18)" />
          {stage >= 4 && <rect x={x + w + 9} y="140" width="44" height="36" fill="#6c737b" />}{stage >= 4 && <path d={`M${x + w + 9} 149h44M${x + w + 9} 158h44M${x + w + 9} 167h44`} stroke="#5a6067" />}</g>}
      </g>}
      {stage >= 3 && <g className="h-roof">
        <path d={`M${x - 16} ${top + 2}L160 ${top - 52}L${x + w + 16} ${top + 2}Z`} fill="var(--bd-roof)" />
        <path d={`M${x - 16} ${top + 2}L160 ${top - 52}L${x + w + 16} ${top + 2}`} fill="none" stroke="rgba(0,0,0,.25)" strokeWidth="3" />
        {garage && <path d={`M${x + w - 2} 130L${x + w + 68} 122V130Z`} fill="var(--bd-roof)" />}
        <rect x="196" y={top - 40} width="12" height="22" fill="#7b5a4a" />
      </g>}
      {stage >= 4 && <g className="h-win">
        {[0, 1].map((f) => (floors === 2 || f === 0) && [0, 1].map((k) => (
          <g key={`${f}${k}`}><rect x={x + 18 + k * 82} y={(f ? top + 12 : 132) } width="32" height="28" rx="2" fill="#bfe1f2" stroke="#fff" strokeWidth="3" /><path d={`M${x + 34 + k * 82} ${(f ? top + 12 : 132)}v28`} stroke="#fff" strokeWidth="2" /></g>
        )))}
        <rect x={x + 62} y="138" width="26" height="38" rx="2" fill="#6b4632" /><circle cx={x + 82} cy="158" r="1.8" fill="#e8c27a" />
      </g>}
      {terrace && stage >= 2 && <g className="h-terr"><rect x={x - 46} y="170" width="46" height="6" fill="#a87a4c" />{stage >= 3 && <><path d={`M${x - 44} 170V138M${x - 4} 170V138`} stroke="#8a6036" strokeWidth="3" /><rect x={x - 50} y="134" width="50" height="5" fill="var(--bd-roof)" /></>}</g>}
      {stage >= 5 && <g className="h-yard"><circle cx="40" cy="176" r="12" fill="#7fae5b" /><circle cx="54" cy="179" r="8" fill="#93c26d" /><path d={`M${x + 75} 186L${x + 60} 200H${x + 100}L${x + 85} 186Z`} fill="#d8cfbf" /></g>}
      {stage < 5 && <g className="h-crane"><path d="M292 186V40M292 46H220M292 46L304 58" stroke="var(--bd-c)" strokeWidth="3" fill="none" /><path d="M240 46V70" stroke="#555" strokeWidth="1.2" /><rect x="234" y="70" width="12" height="8" fill="#666" /></g>}
    </svg>
  )
}
