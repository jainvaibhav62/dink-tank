const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// Email transport. Set GMAIL_USER / GMAIL_PASSWORD (an app password) as
// function env vars, or swap in SendGrid/Mailgun/SMTP. If unset, the code is
// logged to the Functions console instead (fine for development).
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASSWORD,
  },
});

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send a 6-digit verification code to a newly-signed-up email user.
exports.sendVerificationCode = functions.https.onCall(async (data) => {
  const { email, uid } = data;

  if (!email || !uid) {
    throw new functions.https.HttpsError('invalid-argument', 'Email and UID are required');
  }

  try {
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await admin.firestore().collection('pending_verifications').doc(uid).set({
      email,
      code,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt,
    });

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: '🥒 Dink Tank — Verify Your Email',
      html: `
        <h2>Welcome to Dink Tank!</h2>
        <p>Enter this code to verify your email:</p>
        <h1 style="font-size: 32px; letter-spacing: 4px; color: #16a34a;">${code}</h1>
        <p>This code expires in 10 minutes.</p>
        <p>If you didn't sign up for Dink Tank, ignore this email.</p>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`Verification email sent to ${email}`);
    } catch (emailError) {
      console.warn(`Email sending failed (OK during development): ${emailError.message}`);
      console.log(`Verification code for ${email}: ${code}`);
    }

    return { success: true, message: 'Verification code sent' };
  } catch (error) {
    console.error('Error sending verification code:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send verification code');
  }
});

// Verify a submitted code and flip the user's emailVerified flag.
exports.verifyCode = functions.https.onCall(async (data) => {
  const { uid, code } = data;

  if (!uid || !code) {
    throw new functions.https.HttpsError('invalid-argument', 'UID and code are required');
  }

  try {
    const verificationDoc = await admin.firestore().collection('pending_verifications').doc(uid).get();

    if (!verificationDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Verification code not found');
    }

    const verificationData = verificationDoc.data();
    const now = new Date();

    if (verificationData.expiresAt.toDate() < now) {
      throw new functions.https.HttpsError('unauthenticated', 'Verification code expired');
    }

    if (verificationData.code !== code) {
      throw new functions.https.HttpsError('unauthenticated', 'Invalid verification code');
    }

    await admin.firestore().collection('users').doc(uid).update({ emailVerified: true });
    await admin.firestore().collection('pending_verifications').doc(uid).delete();

    return { success: true, message: 'Email verified successfully' };
  } catch (error) {
    console.error('Error verifying code:', error);
    if (error.code) throw error; // re-throw HttpsError
    throw new functions.https.HttpsError('internal', 'Failed to verify code');
  }
});

// Fully delete a user (admin only) — profile, registrations, matches, and the
// Firebase Auth account. Matches live in a top-level `matches` collection.
exports.deleteUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { uid } = data;
  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'User UID is required');
  }

  try {
    const requesterDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    if (requesterDoc.data()?.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Only admins can delete users');
    }
    if (uid === context.auth.uid) {
      throw new functions.https.HttpsError('invalid-argument', 'Cannot delete your own account');
    }

    const db = admin.firestore();
    await db.collection('users').doc(uid).delete();
    await db.collection('publicProfiles').doc(uid).delete();

    const registrations = await db.collection('registrations').where('userId', '==', uid).get();
    await Promise.all(registrations.docs.map((d) => d.ref.delete()));

    const [matchesA, matchesB] = await Promise.all([
      db.collection('matches').where('teamA', 'array-contains', uid).get(),
      db.collection('matches').where('teamB', 'array-contains', uid).get(),
    ]);
    const matchRefs = new Map();
    [...matchesA.docs, ...matchesB.docs].forEach((d) => matchRefs.set(d.ref.path, d.ref));
    await Promise.all([...matchRefs.values()].map((ref) => ref.delete()));

    await admin.auth().deleteUser(uid);

    return { success: true, message: `User ${uid} deleted successfully` };
  } catch (error) {
    console.error('Error deleting user:', error);
    if (error.code) throw error;
    throw new functions.https.HttpsError('internal', `Failed to delete user: ${error.message}`);
  }
});
