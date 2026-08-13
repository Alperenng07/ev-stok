import 'dotenv/config'
import cron from 'node-cron'
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

const from = process.env.MAIL_FROM ?? process.env.SMTP_USER
const user = process.env.SMTP_USER
const pass = process.env.SMTP_PASS
const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const fallbackRecipients = (
  process.env.MAIL_TO ??
  'alperenturksoy0110@gmail.com,balkesdilan07@gmail.com'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

if (!user || !pass) {
  console.error('SMTP_USER ve SMTP_PASS gerekli.')
  process.exit(1)
}

if (!from) {
  console.error('MAIL_FROM veya SMTP_USER tanımlı olmalı.')
  process.exit(1)
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user, pass },
})

const admin =
  supabaseUrl && serviceKey
    ? createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null

async function loadRecipients() {
  if (!admin) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY yok — sadece MAIL_TO kullanılıyor.')
    return fallbackRecipients
  }
  const { data, error } = await admin.from('reminder_emails').select('email')
  if (error) {
    console.error('Mail listesi alınamadı:', error.message)
    return fallbackRecipients
  }
  const emails = [...new Set((data ?? []).map((r) => String(r.email).trim().toLowerCase()))]
  return emails.length ? emails : fallbackRecipients
}

async function sendMail(subject, text) {
  const recipients = await loadRecipients()
  if (!recipients.length) {
    console.warn('Gönderilecek mail yok.')
    return
  }
  const info = await transporter.sendMail({
    from: `"Ev Stok" <${from}>`,
    to: recipients.join(', '),
    subject,
    text,
  })
  console.log(
    `[${new Date().toISOString()}] Gönderildi: ${subject} → ${recipients.length} kişi (${info.messageId})`,
  )
}

const TZ = 'Europe/Istanbul'
const APP_LINK = 'https://alperenng07.github.io/ev-stok/'

const MSG_ADD = `Merhaba,

Bugünkü hatırlatma: Evdeki eksikleri Ev Stok uygulamasına eklemeyi unutmayın.

Uygulama: ${APP_LINK}

— Ev Stok`

const MSG_BUY = `Merhaba,

Bugünkü hatırlatma: Listede bekleyen eksikleri almayı unutmayın.

Uygulama: ${APP_LINK}

— Ev Stok`

if (process.argv.includes('--test')) {
  const buy = process.argv.includes('--buy')
  sendMail(
    buy ? 'Ev Stok — Eksikleri almayı unutma' : 'Ev Stok — Eksikleri eklemeyi unutma',
    buy ? MSG_BUY : MSG_ADD,
  )
    .then(() => {
      console.log('Test maili gönderildi.')
      process.exit(0)
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
} else {
  cron.schedule(
    '30 15 * * *',
    () => {
      sendMail('Ev Stok — Eksikleri eklemeyi unutma', MSG_ADD).catch((err) =>
        console.error('15:30 mail hatası:', err),
      )
    },
    { timezone: TZ },
  )

  cron.schedule(
    '30 17 * * *',
    () => {
      sendMail('Ev Stok — Eksikleri almayı unutma', MSG_BUY).catch((err) =>
        console.error('17:30 mail hatası:', err),
      )
    },
    { timezone: TZ },
  )

  console.log('Ev Stok mail hatırlatıcı çalışıyor (Europe/Istanbul).')
  console.log('Gönderen:', from)
  console.log(
    admin
      ? 'Alıcılar: veritabanındaki tüm aile mailleri'
      : `Alıcılar (yedek): ${fallbackRecipients.join(', ')}`,
  )
  console.log('15:30 → eksikleri eklemeyi unutma')
  console.log('17:30 → eksikleri almayı unutma')
}
