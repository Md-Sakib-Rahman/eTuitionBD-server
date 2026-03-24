const nodemailer = require("nodemailer");
require('dotenv').config();
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendApplicationEmail = async (studentEmail, studentName, tutor, postSubject) => {
  const mailOptions = {
    from: `"eTuitionBD Notifications" <${process.env.EMAIL_USER}>`,
    to: studentEmail,
    subject: `New Tutor Application: ${postSubject}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <h2 style="color: #2c3e50;">Hello, ${studentName}!</h2>
        <p>A tutor has applied for your post: <strong style="color: #4CAF50;">"${postSubject}"</strong>.</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; border-left: 5px solid #4CAF50; margin: 20px 0;">
          <h3 style="margin-top: 0;">Tutor Details:</h3>
          <p><strong>Name:</strong> ${tutor.name}</p>
          <p><strong>Email:</strong> ${tutor.email}</p>
          <p><strong>Phone:</strong> ${tutor.phone || tutor.tutorData?.phone || "Not provided"}</p>
          <p><strong>Qualifications:</strong> ${tutor.tutorData?.qualifications || "N/A"}</p>
          <p><strong>Experience:</strong> ${tutor.tutorData?.experience || 0} Years</p>
          <p><strong>Bio:</strong> ${tutor.tutorData?.bio || "No bio available"}</p>
        </div>

        <p>You can view their full profile and manage this application in your dashboard:</p>
        <div style="text-align: center; margin-top: 30px;">
          <a href="${process.env.CLIENT_URL}/student-dashboard/my-posts" 
             style="background-color: #4CAF50; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
             Review Application
          </a>
        </div>
        
        <p style="margin-top: 40px; font-size: 0.9em; color: #7f8c8d;">
          Best regards,<br/>
          <strong>The eTuitionBD Team</strong>
        </p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};

module.exports = { sendApplicationEmail };