function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function buildVerificationPreviewPath(token: string) {
  return `/verify-email?token=${encodeURIComponent(token)}`;
}

export function buildVerificationSentPath(email: string) {
  return `/verify-email?sent=1&email=${encodeURIComponent(email)}`;
}

function getAppBaseUrl() {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) return trimTrailingSlash(configured);
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "APP_BASE_URL is required when email verification is enabled in production",
    );
  }
  return "http://127.0.0.1:3001";
}

function buildVerificationAppUrl(token: string) {
  return `${getAppBaseUrl()}${buildVerificationPreviewPath(token)}`;
}

export type VerificationDelivery =
  | {
      delivery: "preview";
      redirectTo: string;
      verificationPreviewUrl: string;
    }
  | {
      delivery: "email";
      redirectTo: string;
      verificationPreviewUrl: null;
    };

export async function sendVerificationEmail(input: {
  email: string;
  fullName?: string | null;
  token: string;
}): Promise<VerificationDelivery> {
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const emailFrom = process.env.EMAIL_FROM?.trim();
  const sentRedirect = buildVerificationSentPath(input.email);

  if (!resendApiKey || !emailFrom) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Email verification delivery is not configured for production. Set RESEND_API_KEY, EMAIL_FROM, and APP_BASE_URL.",
      );
    }

    const previewUrl = buildVerificationPreviewPath(input.token);
    console.info(`[auth] email verification preview for ${input.email}: ${previewUrl}`);
    return {
      delivery: "preview",
      redirectTo: previewUrl,
      verificationPreviewUrl: previewUrl,
    };
  }

  const verificationUrl = buildVerificationAppUrl(input.token);
  const greeting = input.fullName?.trim() ? `Hi ${input.fullName.trim()},` : "Hi,";
  const subject = "Verify your agency email for angle/RFP";
  const text = `${greeting}

Verify your business email to finish setting up your agency workspace:
${verificationUrl}

This link expires in 30 minutes.`;
  const html = `
    <div style="background:#050505;color:#f5f5f5;font-family:Inter,Helvetica,Arial,sans-serif;padding:32px;line-height:1.6">
      <p style="margin:0 0 16px;color:#ff6a44;font-size:12px;letter-spacing:0.16em;text-transform:uppercase">angle/RFP</p>
      <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2">Verify your business email</h1>
      <p style="margin:0 0 20px;color:rgba(245,245,245,0.78)">${greeting}</p>
      <p style="margin:0 0 24px;color:rgba(245,245,245,0.78)">
        Confirm your email to create or join your agency workspace and start calibrating bid decisions for your team.
      </p>
      <a href="${verificationUrl}" style="display:inline-block;background:#f5f5f5;color:#050505;padding:12px 18px;text-decoration:none;font-weight:700">
        Verify email
      </a>
      <p style="margin:24px 0 0;color:rgba(245,245,245,0.45);font-size:13px">
        This link expires in 30 minutes. If you did not request this, you can ignore this email.
      </p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [input.email],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.warn(
      `[auth] email delivery failed (${response.status}), falling back to preview link: ${details}`,
    );
    const previewUrl = buildVerificationPreviewPath(input.token);
    return {
      delivery: "preview" as const,
      redirectTo: previewUrl,
      verificationPreviewUrl: previewUrl,
    };
  }

  return {
    delivery: "email",
    redirectTo: sentRedirect,
    verificationPreviewUrl: null,
  };
}
