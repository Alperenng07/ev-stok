import 'dotenv/config'
import cron from 'node-cron'
import nodemailer from 'nodemailer'

const recipients = (
  process.env.MAIL_TO ??
  'alperenturksoy0110@gmail.com,balkesdilan07@gmail.com'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const from = process.env.MAIL_FROM ?? process.env.SMTP_USER
const user = process.env.SMTP_USER
const pass = process.env.SMTP_PASS

if (!user || !pass) {
  console.error(
    'SMTP_USER ve SMTP_PASS gerekli. .env dosyasını .env.example üzerinden oluşturun.',
  )
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

async function sendMail(subject, text) {
  const info = await transporter.sendMail({
    from: `"Ev Stok" <${from}>`,
    to: recipients.join(', '),
    subject,
    text,
  })
  console.log(`[${new Date().toISOString()}] Gönderildi: ${subject} → ${info.messageId}`)
}

const TZ = 'Europe/Istanbul'

if (process.argv.includes('--test')) {
  const which = process.argv.includes('--buy') ? 'buy' : 'add'
  const payload =
    which === 'buy'
      ? [
          'Ev Stok — Eksikleri almayı unutma',
          'Merhaba,\n\nBugünkü hatırlatma: Listede bekleyen eksikleri almayı unutmayın.\n\n— Ev Stok',
        ]
      : [
          'Ev Stok — Eksikleri eklemeyi unutma',
          'Merhaba,\n\nBugünkü hatırlatma: Evdeki eksikleri Ev Stok uygulamasına eklemeyi unutmayın.\n\n— Ev Stok',
        ]
  sendMail(...payload)
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
      sendMail(
        'Ev Stok — Eksikleri eklemeyi unutma',
        'Merhaba,\n\nBugünkü hatırlatma: Evdeki eksikleri Ev Stok uygulamasına eklemeyi unutmayın.\n\n— Ev Stok',
      ).catch((err) => console.error('15:30 mail hatası:', err))
    },
    { timezone: TZ },
  )

  cron.schedule(
    '30 17 * * *',
    () => {
      sendMail(
        'Ev Stok — Eksikleri almayı unutma',
        'Merhaba,\n\nBugünkü hatırlatma: Listede bekleyen eksikleri almayı unutmayın.\n\n— Ev Stok',
      ).catch((err) => console.error('17:30 mail hatası:', err))
    },
    { timezone: TZ },
  )

  console.log('Ev Stok mail hatırlatıcı çalışıyor (Europe/Istanbul).')
  console.log(`Alıcılar: ${recipients.join(', ')}`)
  console.log('15:30 → eksikleri eklemeyi unutma')
  console.log('17:30 → eksikleri almayı unutma')
}
