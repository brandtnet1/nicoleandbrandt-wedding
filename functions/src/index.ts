import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';

const resendApiKey = defineSecret('RESEND_API_KEY');
const confirmationFrom = 'Nicole & Brandt <rsvp@nicoleandbrandt.com>';
const confirmationReplyTo = 'rsvp@nicoleandbrandt.com';

type Attendance = 'yes' | 'no';
type RsvpResponse = {
  name: string;
  wedding: Attendance;
  welcomeEvent: Attendance;
};
type RsvpRecord = {
  invitationId: string;
  invitationName: string;
  contactEmail: string;
  contactPhone?: string;
  responses: RsvpResponse[];
};

function yesNo(value: Attendance) {
  return value === 'yes' ? 'Attending' : 'Not attending';
}

function responseSummary(responses: RsvpResponse[]) {
  return responses
    .map((response) => `${response.name}: Wedding - ${yesNo(response.wedding)}, Welcome event - ${yesNo(response.welcomeEvent)}`)
    .join('\n');
}

function responseSummaryHtml(responses: RsvpResponse[]) {
  return responses
    .map((response) => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #eadfce;"><strong>${escapeHtml(response.name)}</strong></td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #eadfce;">${yesNo(response.wedding)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #eadfce;">${yesNo(response.welcomeEvent)}</td>
      </tr>
    `)
    .join('');
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function textBody(rsvp: RsvpRecord) {
  const editUrl = `https://nicoleandbrandt.com/?rsvp=${encodeURIComponent(rsvp.invitationId)}`;

  return `Hi ${rsvp.invitationName},

Thank you for your RSVP for Nicole & Brandt's wedding.

Wedding: Saturday, November 28, 2026
Venue: Rocky's Lake Estate
Address: 2700 Cox Rd, Woodstock, GA 30188
Ceremony time: TBD

Your responses:
${responseSummary(rsvp.responses)}

You can update your RSVP here:
${editUrl}

Nicole & Brandt`;
}

function htmlBody(rsvp: RsvpRecord) {
  const editUrl = `https://nicoleandbrandt.com/?rsvp=${encodeURIComponent(rsvp.invitationId)}`;

  return `
    <div style="font-family: Inter, Segoe UI, Arial, sans-serif; color: #2d2924; line-height: 1.5;">
      <h1 style="font-family: Georgia, serif; color: #6f321f;">RSVP received</h1>
      <p>Hi ${escapeHtml(rsvp.invitationName)},</p>
      <p>Thank you for your RSVP for Nicole &amp; Brandt's wedding.</p>
      <div style="background: #fbf7ef; border: 1px solid #eadfce; border-radius: 8px; padding: 16px; margin: 18px 0;">
        <p style="margin: 0;"><strong>Wedding:</strong> Saturday, November 28, 2026</p>
        <p style="margin: 6px 0 0;"><strong>Venue:</strong> Rocky's Lake Estate</p>
        <p style="margin: 6px 0 0;"><strong>Address:</strong> 2700 Cox Rd, Woodstock, GA 30188</p>
        <p style="margin: 6px 0 0;"><strong>Ceremony time:</strong> TBD</p>
      </div>
      <table style="border-collapse: collapse; width: 100%; margin: 18px 0;">
        <thead>
          <tr>
            <th align="left" style="padding: 10px 12px; border-bottom: 2px solid #b5793b;">Guest</th>
            <th align="left" style="padding: 10px 12px; border-bottom: 2px solid #b5793b;">Wedding</th>
            <th align="left" style="padding: 10px 12px; border-bottom: 2px solid #b5793b;">Welcome event</th>
          </tr>
        </thead>
        <tbody>${responseSummaryHtml(rsvp.responses)}</tbody>
      </table>
      <p>
        <a href="${editUrl}" style="display: inline-block; background: #6f321f; color: #fff; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-weight: 700;">Update RSVP</a>
      </p>
      <p style="color: #70675d;">If the button does not work, copy and paste this link: <br>${editUrl}</p>
      <p>Nicole &amp; Brandt</p>
    </div>
  `;
}

async function sendResendEmail(rsvp: RsvpRecord, apiKey: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: confirmationFrom,
      to: [rsvp.contactEmail],
      reply_to: confirmationReplyTo,
      subject: "Nicole & Brandt wedding RSVP confirmation",
      text: textBody(rsvp),
      html: htmlBody(rsvp),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend email failed with ${response.status}: ${body}`);
  }
}

export const sendRsvpConfirmation = onDocumentWritten(
  {
    document: 'rsvps/{invitationId}',
    region: 'us-central1',
    secrets: [resendApiKey],
  },
  async (event) => {
    if (!event.data?.after.exists) return;

    const rsvp = {
      ...(event.data.after.data() as RsvpRecord),
      invitationId: event.params.invitationId,
    };
    if (!rsvp.contactEmail || !Array.isArray(rsvp.responses)) {
      logger.warn('Skipping RSVP confirmation because required fields are missing.', {
        invitationId: event.params.invitationId,
      });
      return;
    }

    await sendResendEmail(rsvp, resendApiKey.value());
    logger.info('Sent RSVP confirmation email.', {
      invitationId: event.params.invitationId,
      contactEmail: rsvp.contactEmail,
    });
  },
);
