'use server'

import nodemailer from 'nodemailer'

// Create nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
})

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  from?: string
}

export async function sendEmail({ to, subject, html, from }: SendEmailOptions) {
  try {
    const info = await transporter.sendMail({
      from: from || process.env.SMTP_FROM || 'Stand Walk Run <support@standwalkrun.com>',
      to,
      subject,
      html,
    })
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('Error sending email:', error)
    return { success: false, error }
  }
}

// Code with associated plan info
export interface AccessCodeWithPlan {
  code: string
  tierName: string
  journeyName: string
}

// Send access codes email after purchase
export async function sendAccessCodesEmail(
  email: string,
  codes: string[] | AccessCodeWithPlan[],
  tierName?: string,
  journeyName?: string,
  orgName?: string,
  isExistingOrgAdmin?: boolean // Set to true when org admin is adding more licenses
) {
  // Determine if we have detailed code info or just strings
  const hasDetailedInfo = codes.length > 0 && typeof codes[0] === 'object'

  const codesList = codes.map((codeData, i) => {
    if (hasDetailedInfo) {
      const { code, tierName: codeTier, journeyName: codeJourney } = codeData as AccessCodeWithPlan
      return `
        <div style="background: #f5f5f5; padding: 12px; margin: 8px 0; border-radius: 8px;">
          <div style="font-family: monospace; font-size: 18px; text-align: center; margin-bottom: 8px;">
            ${codes.length > 1 ? `License ${i + 1}: ` : ''}${code}
          </div>
          <div style="font-size: 13px; text-align: center; color: #666;">
            <span style="background: #166534; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${codeTier}</span>
            <span style="margin-left: 8px;">${codeJourney}</span>
          </div>
        </div>
      `
    } else {
      const code = codeData as string
      return `
        <div style="background: #f5f5f5; padding: 12px; margin: 8px 0; border-radius: 8px; font-family: monospace; font-size: 18px; text-align: center;">
          ${codes.length > 1 ? `License ${i + 1}: ` : ''}${code}
        </div>
      `
    }
  }).join('')

  const appUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://standwalkrun.com'

  // For summary, use passed values or extract from detailed codes
  const summaryTierName = tierName || (hasDetailedInfo
    ? [...new Set((codes as AccessCodeWithPlan[]).map(c => c.tierName))].join(', ')
    : 'Your Plan')
  const summaryJourneyName = journeyName || (hasDetailedInfo
    ? [...new Set((codes as AccessCodeWithPlan[]).map(c => c.journeyName))].join(', ')
    : 'Stand Walk Run Journey')

  // Different email content for existing org admins vs new purchasers
  const emailSubject = isExistingOrgAdmin
    ? 'Additional Licenses Added - Stand Walk Run'
    : 'Your Access Code(s) - Stand Walk Run'

  const emailHeading = isExistingOrgAdmin
    ? 'Additional Licenses Added!'
    : 'Welcome to Stand Walk Run!'

  const emailIntro = isExistingOrgAdmin
    ? `Your additional license${codes.length === 1 ? ' has' : 's have'} been added to your organization. Here ${codes.length === 1 ? 'is the new access code' : 'are your new access codes'}:`
    : `Thank you for your purchase! Here ${codes.length === 1 ? 'is your access code' : 'are your access codes'} to get started:`

  return sendEmail({
    to: email,
    subject: emailSubject,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #0f6353;">${emailHeading}</h1>
        
        <p>${emailIntro}</p>
        
        ${codesList}
        
        ${!hasDetailedInfo ? `
        <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Plan:</strong> ${summaryTierName}</p>
          <p style="margin: 8px 0 0 0;"><strong>Journey:</strong> ${summaryJourneyName}</p>
          ${orgName ? `<p style="margin: 8px 0 0 0;"><strong>Organization:</strong> ${orgName}</p>` : ''}
        </div>
        ` : (orgName ? `
        <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Organization:</strong> ${orgName}</p>
        </div>
        ` : '')}
        
        ${isExistingOrgAdmin ? `
          <div style="background: #e0f2fe; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0284c7;">
            <h3 style="margin: 0 0 8px 0; color: #0369a1;">Manage Your Licenses</h3>
            <p style="margin: 0 0 12px 0;">Your new access codes are now available in your Admin Portal. Share them with your team members or manage them from your dashboard.</p>
            <p style="margin: 0;"><a href="${appUrl}/admin/dashboard/access-codes" style="display: inline-block; background: #0284c7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 500;">View Access Codes</a></p>
          </div>
        ` : `
          <h2>Next Steps:</h2>
          ${orgName ? `
            <div style="background: #e0f2fe; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0284c7;">
              <h3 style="margin: 0 0 8px 0; color: #0369a1;">Organization Admin Access</h3>
              <p style="margin: 0 0 12px 0;">As the organization admin, you can manage your team, view access codes, and monitor progress from the Admin Portal:</p>
              <p style="margin: 0;"><a href="${appUrl}/admin/login" style="display: inline-block; background: #0284c7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 500;">Access Admin Portal</a></p>
              <p style="margin: 12px 0 0 0; font-size: 14px; color: #666;">Use your email (${email}) to create your admin account.</p>
            </div>
          ` : ''}
          
          <h3>For Journey Participants:</h3>
          <ol>
            <li>Go to <a href="${appUrl}/auth/signup">Sign Up</a></li>
            <li>Enter your access code when prompted</li>
            <li>Complete your profile and start your journey!</li>
          </ol>
        `}
        
        ${codes.length > 1 ? `
          <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Multiple Licenses:</strong> Share the additional access codes with your team members. Each code can only be used once.</p>
          </div>
        ` : ''}
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">If you have any questions, please contact our support team at <a href="mailto:support@standwalkrun.com" className="text-primary hover:underline">support@standwalkrun.com</a>.</p>
      </div>
    `,
  })
}

// Invite a newly created leader with their assigned access code(s)
export async function sendLeaderInviteEmail({
  email,
  fullName,
  codes,
  setupUrl,
  orgName,
}: {
  email: string
  fullName: string
  codes: AccessCodeWithPlan[]
  setupUrl?: string | null
  orgName?: string | null
}) {
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://standwalkrun.com'
  const greetingName = fullName.trim() || 'there'
  const codesList = codes.map((codeData, i) => `
        <div style="background: #f5f5f5; padding: 12px; margin: 8px 0; border-radius: 8px;">
          <div style="font-family: monospace; font-size: 18px; text-align: center; margin-bottom: 8px;">
            ${codes.length > 1 ? `Code ${i + 1}: ` : ''}${codeData.code}
          </div>
          <div style="font-size: 13px; text-align: center; color: #666;">
            <span style="background: #166534; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${codeData.tierName}</span>
            <span style="margin-left: 8px;">${codeData.journeyName}</span>
          </div>
        </div>
      `).join('')

  const setupSection = setupUrl
    ? `
          <p>Set your password to finish activating your Leader account:</p>
          <p><a href="${setupUrl}" style="display: inline-block; background: #0f6353; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500;">Set your password</a></p>
          <p style="font-size: 14px; color: #666;">This link expires, so use it soon. If it has expired, go to <a href="${appUrl}/auth/forgot-password">Forgot password</a> and enter this email (${email}).</p>
        `
    : `
          <p>To finish activating your Leader account:</p>
          <ol>
            <li>Go to <a href="${appUrl}/auth/forgot-password">Forgot password</a></li>
            <li>Enter this email (${email}) to set your password</li>
            <li>Sign in at <a href="${appUrl}/auth/login">User login</a></li>
          </ol>
        `

  return sendEmail({
    to: email,
    subject: 'You have been added as a Leader - Stand Walk Run',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #0f6353;">Welcome to Stand Walk Run</h1>

        <p>Hi ${greetingName},</p>
        <p>A master admin created a Leader account for you. Your assigned access ${codes.length === 1 ? 'code is' : 'codes are'} below, based on the plan and journey chosen for you.</p>

        ${codesList}

        ${orgName ? `
        <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Organization:</strong> ${orgName}</p>
        </div>
        ` : ''}

        ${setupSection}

        <p>Your first access code is already applied to your account. ${codes.length > 1
          ? 'Share any extra codes with other leaders so they can sign up at <a href="' + appUrl + '/auth/signup">Sign up</a>.'
          : 'You can sign in and start inviting learners from your dashboard.'}</p>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">If you have any questions, please contact our support team at <a href="mailto:support@standwalkrun.com">support@standwalkrun.com</a>.</p>
      </div>
    `,
  })
}

// Send journey purchase confirmation email
export async function sendJourneyPurchaseEmail(
  email: string,
  journeyId: string
) {
  const journeyNames: Record<string, string> = {
    foundations: 'Foundations of Faith',
    'spiritual-disciplines': 'Spiritual Disciplines',
    leadership: 'Leadership Development',
  }

  const appUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://standwalkrun.com'

  return sendEmail({
    to: email,
    subject: 'Journey Unlocked - Stand Walk Run',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #166534;">Your New Journey is Ready!</h1>
        
        <p>Thank you for your purchase. <strong>${journeyNames[journeyId] || journeyId}</strong> has been added to your account.</p>
        
        <p>You can start this journey after completing your current one, or choose it from your dashboard.</p>
        
        <p><a href="${appUrl}/dashboard" style="display: inline-block; background: #166534; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Go to Dashboard</a></p>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">If you have any questions, please contact our support team at <a href="mailto:support@standwalkrun.com" className="text-primary hover:underline">support@standwalkrun.com</a>.</p>
      </div>
    `,
  })
}
