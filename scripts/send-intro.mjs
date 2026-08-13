import 'dotenv/config'
import nodemailer from 'nodemailer'

const to = process.env.MAIL_TO
const from = process.env.MAIL_FROM || process.env.SMTP_USER

if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !to) {
  console.error('SMTP veya MAIL_TO eksik')
  process.exit(1)
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const link = 'https://alperenng07.github.io/ev-stok/'

const info = await transporter.sendMail({
  from: `"Ev Stok" <${from}>`,
  to,
  subject: 'Ev Stok uygulamanız hazır',
  text: `Merhaba,

Evdeki eksikleri birlikte takip edebileceğiniz Ev Stok uygulaması hazır.

Uygulamaya buradan erişebilirsiniz:
${link}

Telefonda bu linki açıp ana ekrana ekleyebilirsiniz. Biriniz ürün ekleyince veya alındı işaretleyince diğeriniz de aynı listeyi görür.

İyi kullanımlar,
Ev Stok`,
  html: `<p>Merhaba,</p>
<p>Evdeki eksikleri birlikte takip edebileceğiniz <strong>Ev Stok</strong> uygulaması hazır.</p>
<p>Uygulamaya buradan erişebilirsiniz:<br>
<a href="${link}">${link}</a></p>
<p>Telefonda bu linki açıp ana ekrana ekleyebilirsiniz. Biriniz ürün ekleyince veya alındı işaretleyince diğeriniz de aynı listeyi görür.</p>
<p>İyi kullanımlar,<br>Ev Stok</p>`,
})

console.log(`Sent ${info.messageId} -> ${to}`)
