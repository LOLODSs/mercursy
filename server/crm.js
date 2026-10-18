/**
 * CRM Storage Engine for Mercury Portfolio
 * Saves and retrieves leads with statuses: 'new' | 'in_progress' | 'done' | 'archived'
 * Features:
 *   - Lead persistence (leads.json)
 *   - Financial analytics (revenue, pipeline in work, avg deal)
 *   - Notes / Timeline system for leads
 *   - UTF-8 with BOM CSV export
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const DATA_DIR = process.env.VERCEL ? '/tmp' : 'data'
const FILE_PATH = join(DATA_DIR, 'leads.json')

function ensureStorage() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
  if (!existsSync(FILE_PATH)) {
    writeFileSync(FILE_PATH, JSON.stringify([], null, 2), 'utf8')
  }
}

export function getAllLeads() {
  ensureStorage()
  try {
    const raw = readFileSync(FILE_PATH, 'utf8')
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveLeads(leads) {
  ensureStorage()
  writeFileSync(FILE_PATH, JSON.stringify(leads, null, 2), 'utf8')
}

export function parseAmount(str = '') {
  const cleaned = String(str).replace(/[^\d]/g, '')
  const num = parseInt(cleaned, 10)
  return isNaN(num) ? 0 : num
}

export function formatRubles(num = 0) {
  return new Intl.NumberFormat('ru-RU').format(num) + ' ₽'
}

export function addLead(data) {
  const leads = getAllLeads()
  const id = `lead_${Date.now()}_${Math.floor(Math.random() * 1000)}`
  const now = new Date().toISOString()

  const lead = {
    id,
    name: String(data.name || 'Без имени').trim(),
    contact: String(data.contact || '').trim(),
    type: String(data.type || 'Проект').trim(),
    ref: data.ref ? String(data.ref).trim() : null,
    task: String(data.task || '').trim(),
    budget: String(data.budget || 'Не указан').trim(),
    price: parseAmount(data.budget),
    deadline: String(data.deadline || 'Не указан').trim(),
    page: String(data.page || '').trim(),
    status: data.status || 'new', // 'new' | 'in_progress' | 'done' | 'archived'
    notes: Array.isArray(data.notes) ? data.notes : [],
    createdAt: now,
    updatedAt: now,
  }

  leads.unshift(lead) // Add to start
  saveLeads(leads)
  return lead
}

export function getLead(id) {
  const leads = getAllLeads()
  return leads.find((l) => l.id === id) || null
}

export function updateLeadStatus(id, newStatus) {
  const leads = getAllLeads()
  const lead = leads.find((l) => l.id === id)
  if (!lead) return null

  lead.status = newStatus
  lead.updatedAt = new Date().toISOString()
  saveLeads(leads)
  return lead
}

export function addLeadNote(id, noteText) {
  const leads = getAllLeads()
  const lead = leads.find((l) => l.id === id)
  if (!lead) return null

  if (!Array.isArray(lead.notes)) lead.notes = []
  lead.notes.push({
    id: `note_${Date.now()}`,
    text: String(noteText).trim(),
    createdAt: new Date().toISOString(),
  })
  lead.updatedAt = new Date().toISOString()
  saveLeads(leads)
  return lead
}

export function updateLeadField(id, field, value) {
  const leads = getAllLeads()
  const lead = leads.find((l) => l.id === id)
  if (!lead) return null

  lead[field] = String(value).trim()
  if (field === 'budget') {
    lead.price = parseAmount(lead[field])
  }
  lead.updatedAt = new Date().toISOString()
  saveLeads(leads)
  return lead
}

export function searchLeads(query = '') {
  const q = String(query).toLowerCase().trim()
  if (!q) return []
  const leads = getAllLeads()
  return leads.filter((l) => {
    const inName = (l.name || '').toLowerCase().includes(q)
    const inContact = (l.contact || '').toLowerCase().includes(q)
    const inType = (l.type || '').toLowerCase().includes(q)
    const inTask = (l.task || '').toLowerCase().includes(q)
    const inBudget = (l.budget || '').toLowerCase().includes(q)
    const inNotes = (l.notes || []).some((n) => (n.text || '').toLowerCase().includes(q))
    return inName || inContact || inType || inTask || inBudget || inNotes
  })
}

export function deleteLead(id) {
  const leads = getAllLeads()
  const filtered = leads.filter((l) => l.id !== id)
  saveLeads(filtered)
  return filtered.length !== leads.length
}

export function getLeadsByStatus(status) {
  const leads = getAllLeads()
  if (status === 'all') return leads
  return leads.filter((l) => l.status === status)
}

export function getStats() {
  const leads = getAllLeads()
  return {
    total: leads.length,
    new: leads.filter((l) => l.status === 'new').length,
    in_progress: leads.filter((l) => l.status === 'in_progress').length,
    done: leads.filter((l) => l.status === 'done').length,
    archived: leads.filter((l) => l.status === 'archived').length,
  }
}

export function getFinancialStats() {
  const leads = getAllLeads()

  const inProgressLeads = leads.filter((l) => l.status === 'in_progress')
  const doneLeads = leads.filter((l) => l.status === 'done')

  const inProgressSum = inProgressLeads.reduce((acc, l) => acc + (l.price || parseAmount(l.budget)), 0)
  const doneSum = doneLeads.reduce((acc, l) => acc + (l.price || parseAmount(l.budget)), 0)
  const totalPipeline = inProgressSum + doneSum

  const avgCheck = doneLeads.length ? Math.round(doneSum / doneLeads.length) : 0

  return {
    inProgressSum,
    doneSum,
    totalPipeline,
    avgCheck,
    inProgressCount: inProgressLeads.length,
    doneCount: doneLeads.length,
  }
}

export function exportLeadsToCsv() {
  const leads = getAllLeads()
  const headers = ['ID', 'Клиент', 'Контакт', 'Тип', 'Бюджет (₽)', 'Статус', 'Дата создания', 'Задача', 'Заметки']

  const rows = leads.map((l) => {
    const notesStr = (l.notes || []).map((n) => `[${n.createdAt.slice(0, 10)}] ${n.text}`).join('; ')
    return [
      l.id,
      `"${(l.name || '').replace(/"/g, '""')}"`,
      `"${(l.contact || '').replace(/"/g, '""')}"`,
      `"${(l.type || '').replace(/"/g, '""')}"`,
      l.price || parseAmount(l.budget),
      l.status,
      l.createdAt ? l.createdAt.slice(0, 10) : '',
      `"${(l.task || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      `"${notesStr.replace(/"/g, '""')}"`,
    ].join(';')
  })

  // UTF-8 BOM for Excel Cyrillic support
  return '\uFEFF' + [headers.join(';'), ...rows].join('\r\n')
}
