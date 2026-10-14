import nodemailer from "nodemailer";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });

  const { email, otp } = req.body || {};
  if (!email || !/^\d{6}$/.test(String(otp))) {
    return res.status(400).json({ success: false, message: "Email and 6-digit OTP are required" });
  }

  const gmailUser = String(process.env.GMAIL_USER || "").trim();
  const gmailPass = String(process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
  if (!gmailUser || !gmailPass) {
    return res.status(503).json({ success: false, configured: false, message: "Gmail credentials are not configured" });
  }

  try {
    const transporter = nodemailer.createTransport({ service: "gmail", auth: { user: gmailUser, pass: gmailPass } });
    await transporter.sendMail({
      from: `"Melo Music" <${gmailUser}>`,
      to: email,
      subject: "Melo Music verification code",
      text: `Your Melo Music verification code is ${otp}. It expires in 10 minutes.`,
      html: `<div style="font-family:Arial,sans-serif;padding:24px"><h2>Melo Music</h2><p>Your verification code is:</p><strong style="font-size:32px;letter-spacing:8px">${otp}</strong><p>This code expires in 10 minutes.</p></div>`
    });
    return res.status(200).json({ success: true, configured: true });
  } catch (error) {
    console.error("OTP email delivery failed:", error);
    return res.status(502).json({ success: false, configured: true, message: "Gmail rejected the message. Check the Gmail App Password and sender account." });
  }
}
