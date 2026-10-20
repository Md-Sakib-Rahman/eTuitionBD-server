const nodemailer = require("nodemailer");
require("dotenv").config();
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const sendApplicationEmail = async (
  studentEmail,
  studentName,
  tutor,
  postSubject,
) => {
  const mailOptions = {
    from: `"eTuitionBD Notifications" <${process.env.EMAIL_USER}>`,
    to: studentEmail,
    subject: `New Tutor Application: ${postSubject}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <h2 style="color: #2c3e50;">Hello, ${escapeHtml(studentName)}!</h2>
        <p>A tutor has applied for your post: <strong style="color: #4CAF50;">"${escapeHtml(postSubject)}"</strong>.</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; border-left: 5px solid #4CAF50; margin: 20px 0;">
          <h3 style="margin-top: 0;">Tutor Details:</h3>
          <p><strong>Name:</strong> ${escapeHtml(tutor.name)}</p>
          <p><strong>Email:</strong> ${escapeHtml(tutor.email)}</p>
          <p><strong>Phone:</strong> ${escapeHtml(tutor.phone || tutor.tutorData?.phone || "Not provided")}</p>
          <p><strong>Qualifications:</strong> ${escapeHtml(tutor.tutorData?.qualifications || "N/A")}</p>
          <p><strong>Experience:</strong> ${escapeHtml(tutor.tutorData?.experience || 0)} Years</p>
          <p><strong>Bio:</strong> ${escapeHtml(tutor.tutorData?.bio || "No bio available")}</p>
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
const sendHiringEmail = async (tutorEmail, tutorName, student, postSubject) => {

  const mailOptions = {
    from: `"eTuitionBD" <${process.env.EMAIL_USER}>`,
    to: tutorEmail,
    subject: `Congratulations! You've been hired for ${postSubject}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; border: 1px solid #4CAF50; padding: 20px; border-radius: 10px;">
        <h2 style="color: #2e7d32;">Congratulations, ${escapeHtml(tutorName)}!</h2>
        <p>You have been officially <strong>hired</strong> for the tuition post: <br/>
           <span style="font-size: 1.2em; color: #1b5e20;">"${escapeHtml(postSubject)}"</span>
        </p>
        
        <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #2e7d32;">Student Contact Information:</h3>
          <p><strong>Student Name:</strong> ${escapeHtml(student.name)}</p>
          <p><strong>Email:</strong> ${escapeHtml(student.email)}</p>
          <p><strong>Phone:</strong> ${escapeHtml(student.phone || student.studentData?.phone || "Not provided")}</p>
          <p><strong>Location:</strong> ${escapeHtml(student.studentData?.address || "Check dashboard for details")}</p>
        </div>

        <p>Please contact the student as soon as possible to finalize the schedule.</p>
        
        <div style="text-align: center; margin-top: 30px;">
          <a href="${process.env.CLIENT_URL}/tutor-dashboard/my-sessions" 
             style="background-color: #2e7d32; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
             View Session Details
          </a>
        </div>
        
        <p style="margin-top: 40px; font-size: 0.8em; color: #999; border-top: 1px solid #eee; padding-top: 10px;">
          This is an automated notification from eTuitionBD. Happy teaching!
        </p>
      </div>
    `,
  };
  console.log("mail sent !");
  return transporter.sendMail(mailOptions);
};
module.exports = { sendApplicationEmail, sendHiringEmail };
