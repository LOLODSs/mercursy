import BotDemo from './BotDemo.jsx'
import FlowDemo from './FlowDemo.jsx'
import SiteDemo from './SiteDemo.jsx'
import BuildDemo from './BuildDemo.jsx'
const map = { bot: BotDemo, flow: FlowDemo, site: SiteDemo, build: BuildDemo }
// paused — карточка за краем ленты или под открытым кейсом: автопилот мини-демо стоит, ничего не тратит
export default function Demo({ kind, mini, paused = false }) { const C = map[kind]; return C ? <C mini={mini} paused={paused} /> : null }
