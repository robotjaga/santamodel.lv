const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config();

const submissionsFile = path.join(process.cwd(), 'submissions.json');

function safeText(value) {
  return String(value ?? '').trim();
}

function readSubmissions() {
  try {
    const raw = fs.readFileSync(submissionsFile, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeSubmissions(entries) {
  fs.writeFileSync(submissionsFile, JSON.stringify(entries, null, 2));
}

async function sendEmailNotification(formData) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const toEmail = process.env.TO_EMAIL || 'santa.model.management@gmail.com';

  if (!host || !user || !pass) {
    return { sent: false, reason: 'SMTP not configured' };
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: user,
    to: toEmail,
    subject: 'Jauns pieteikums Santa Model Management',
    text: [
      `Vecāks / aizbildnis: ${formData.parent}`,
      `Bērna vārds: ${formData.child || 'Nav norādīts'}`,
      `Bērna vecums: ${formData.age}`,
      `Vēlamā vieta: ${formData.city || 'Nav norādīta'}`,
      `Tālrunis: ${formData.phone}`,
      `E-pasts: ${formData.email || 'Nav norādīts'}`,
      `Jautājums: ${formData.message || 'Nav norādīts'}`,
    ].join('\n'),
  });

  return { sent: true };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  let formData = {};

  try {
    if (typeof req.body === 'string') {
      formData = JSON.parse(req.body);
    } else if (req.body && typeof req.body === 'object') {
      formData = req.body;
    }
  } catch (error) {
    formData = {};
  }

  const parent = safeText(formData.parent);
  const phone = safeText(formData.phone);
  const age = safeText(formData.age);

  if (!parent || !phone || !age) {
    return res.status(400).json({
      ok: false,
      message: 'Lūdzu, aizpildiet obligātos laukus: vecāka vārds, tālrunis un bērna vecums.',
    });
  }

  const submission = {
    id: Date.now(),
    createdAt: new Date().toISOString(),
    parent,
    child: safeText(formData.child),
    age,
    city: safeText(formData.city),
    phone,
    email: safeText(formData.email),
    message: safeText(formData.message),
  };

  const entries = readSubmissions();
  entries.unshift(submission);
  writeSubmissions(entries);

  try {
    const emailResult = await sendEmailNotification(submission);
    if (emailResult.sent) {
      return res.status(200).json({
        ok: true,
        message: 'Pieteikums veiksmīgi nosūtīts! Mēs sazināsimies ar Jums drīz.',
      });
    }

    return res.status(200).json({
      ok: true,
      message: 'Pieteikums ir saglabāts. E-pasta sūtīšana nav konfigurēta šajā serverī, bet informācija ir pieejama failā submissions.json.',
    });
  } catch (error) {
    return res.status(200).json({
      ok: true,
      message: 'Pieteikums ir saglabāts, bet e-pasta sūtīšana neizdevās. Mēs to pārbaudīsim manuāli.',
    });
  }
};
