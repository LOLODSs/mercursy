/* Показывает всё, что ещё не заполнено (запускается перед build). Не блокирует сборку. */
import { readFileSync } from 'node:fs'
const files = ['src/config.js', 'index.html', 'server/cloudflare-worker.js']
const marks = []
for (const f of files) readFileSync(f, 'utf8').split('\n').forEach((l, i) => { if (/ЗАГЛУШКА|your_handle/.test(l)) marks.push(`${f}:${i + 1}  ${l.trim().slice(0, 110)}`) })
if (marks.length) {
  console.log(`\n\x1b[33m🟡 Осталось заглушек: ${marks.length}\x1b[0m (перед публикацией замени на своё)\n` + marks.map((m) => '  ' + m).join('\n') + '\n')
} else console.log('\n\x1b[32m✓ Заглушек нет — можно публиковать\x1b[0m\n')
