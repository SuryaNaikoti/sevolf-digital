export interface PurchasedItemDisplay {
  name: string;
  formatLabel: string;
  coverImageUrl?: string | null;
  downloadUrl: string;
  fileName?: string;
  attached?: boolean;
}

export interface RecommendedProductDisplay {
  name: string;
  shortDescription: string;
  coverImageUrl?: string | null;
  priceFormatted: string;
  productUrl: string;
}

export interface PurchaseEmailData {
  orderNumber: string;
  purchaseDate: string;
  amountFormatted: string;
  customerName?: string | null;
  siteUrl: string;
  supportEmail: string;
  items: PurchasedItemDisplay[];
  recommendations: RecommendedProductDisplay[];
  hasAttachments: boolean;
  oversizedFallback: boolean;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildPurchaseDeliveryEmailHtml(data: PurchaseEmailData): string {
  const greeting = data.customerName
    ? `Hi ${escapeHtml(data.customerName)},`
    : "Hello,";

  const itemsHtml = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 16px 0; border-bottom: 1px solid #E8E5DD;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              ${
                item.coverImageUrl
                  ? `<td width="64" valign="top" style="padding-right: 16px;">
                      <img src="${escapeHtml(item.coverImageUrl)}" alt="${escapeHtml(item.name)}" width="64" height="80" style="display: block; width: 64px; height: 80px; object-fit: cover; border-radius: 4px; border: 1px solid #E8E5DD;" />
                    </td>`
                  : ""
              }
              <td valign="top">
                <p style="margin: 0 0 4px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; color: #22231F; font-weight: normal;">
                  ${escapeHtml(item.name)}
                </p>
                <p style="margin: 0 0 12px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #77766E;">
                  ${escapeHtml(item.formatLabel)}${item.fileName ? ` &bull; ${escapeHtml(item.fileName)}` : ""}
                </p>
                <a href="${escapeHtml(item.downloadUrl)}" style="display: inline-block; background-color: #22231F; color: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; text-decoration: none; padding: 11px 22px; border-radius: 3px;">
                  Download your product
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    )
    .join("");

  const recommendationsHtml =
    data.recommendations.length > 0
      ? `
      <tr>
        <td style="padding: 32px 32px 24px 32px; border-top: 1px solid #E8E5DD;">
          <h2 style="margin: 0 0 16px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 20px; font-weight: normal; color: #22231F;">
            A few more things you might love.
          </h2>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            ${data.recommendations
              .map(
                (rec) => `
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #F0EDE6;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      ${
                        rec.coverImageUrl
                          ? `<td width="56" valign="top" style="padding-right: 14px;">
                              <img src="${escapeHtml(rec.coverImageUrl)}" alt="${escapeHtml(rec.name)}" width="56" height="70" style="display: block; width: 56px; height: 70px; object-fit: cover; border-radius: 3px; border: 1px solid #E8E5DD;" />
                            </td>`
                          : ""
                      }
                      <td valign="top">
                        <p style="margin: 0 0 3px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; color: #22231F;">
                          ${escapeHtml(rec.name)}
                        </p>
                        <p style="margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 1.5; color: #77766E;">
                          ${escapeHtml(rec.shortDescription)}
                        </p>
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td style="font-family: monospace; font-size: 12px; color: #22231F; font-weight: 600;">
                              ${escapeHtml(rec.priceFormatted)}
                            </td>
                            <td align="right">
                              <a href="${escapeHtml(rec.productUrl)}" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #657052; text-decoration: none;">
                                View Product &rarr;
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>`
              )
              .join("")}
          </table>
        </td>
      </tr>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your SEVOLF Digital Order ${escapeHtml(data.orderNumber)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F7F5F0; color: #22231F; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F7F5F0; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #FFFFFF; border: 1px solid #E8E5DD; border-radius: 4px; overflow: hidden;">
          <!-- A. Header -->
          <tr>
            <td style="padding: 28px 32px 20px 32px; border-bottom: 1px solid #E8E5DD;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family: Georgia, 'Times New Roman', serif; font-size: 20px; letter-spacing: 0.14em; color: #22231F;">
                    SEVOLF <span style="font-size: 11px; letter-spacing: 0.2em; color: #77766E; display: block; margin-top: 2px;">DIGITAL</span>
                  </td>
                  <td align="right" valign="top" style="font-family: monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: #657052;">
                    Order Confirmation
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- B. Welcome Section -->
          <tr>
            <td style="padding: 32px 32px 20px 32px;">
              <h1 style="margin: 0 0 12px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 26px; font-weight: normal; line-height: 1.25; color: #22231F;">
                Your next chapter starts here.
              </h1>
              <p style="margin: 0 0 10px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #22231F;">
                ${greeting}
              </p>
              <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #77766E;">
                Thank you for purchasing from SEVOLF Digital. Your digital product is ready for instant download below.
              </p>
            </td>
          </tr>

          <!-- C. Order Summary -->
          <tr>
            <td style="padding: 0 32px 20px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FAF8F5; border: 1px solid #E8E5DD; border-radius: 4px; padding: 14px 16px;">
                <tr>
                  <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #77766E; padding: 3px 0;">
                    Order Number: <strong style="color: #22231F; font-family: monospace;">${escapeHtml(data.orderNumber)}</strong>
                  </td>
                  <td align="right" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #77766E; padding: 3px 0;">
                    Date: <strong style="color: #22231F;">${escapeHtml(data.purchaseDate)}</strong>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #77766E; padding: 3px 0;">
                    Amount Paid: <strong style="color: #22231F; font-family: monospace;">${escapeHtml(data.amountFormatted)}</strong>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- D. Product Delivery -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${itemsHtml}
              </table>
              <p style="margin: 14px 0 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 1.5; color: #77766E;">
                Your secure download link remains valid for <strong>30 days</strong> and permits up to <strong>10 downloads</strong>.
                ${data.hasAttachments ? " A copy of your file is also attached to this email for your convenience." : ""}
                ${data.oversizedFallback ? " Due to file size limits, please use the secure download button above to retrieve your file." : ""}
              </p>
            </td>
          </tr>

          <!-- E. Getting Started -->
          <tr>
            <td style="padding: 20px 32px; background-color: #FAF8F5; border-top: 1px solid #E8E5DD;">
              <h2 style="margin: 0 0 8px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; font-weight: normal; color: #22231F;">
                Getting started
              </h2>
              <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 1.6; color: #77766E;">
                Click <strong>Download your product</strong> above to save your file to your device. You can also access your purchases anytime from your <a href="${escapeHtml(data.siteUrl)}/account/library" style="color: #22231F; text-decoration: underline;">Digital Library</a>.
              </p>
            </td>
          </tr>

          <!-- F. Recommendations -->
          ${recommendationsHtml}

          <!-- G. Stay Connected -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #E8E5DD; text-align: center;">
              <p style="margin: 0 0 10px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; color: #22231F;">
                Stay connected with SEVOLF
              </p>
              <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #77766E;">
                <a href="${escapeHtml(data.siteUrl)}/shop" style="color: #22231F; text-decoration: underline;">Explore the SEVOLF Shop</a>
                &nbsp;&bull;&nbsp;
                <a href="mailto:${escapeHtml(data.supportEmail)}" style="color: #22231F; text-decoration: underline;">${escapeHtml(data.supportEmail)}</a>
              </p>
            </td>
          </tr>

          <!-- H. Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #F7F5F0; border-top: 1px solid #E8E5DD; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; line-height: 1.6; color: #85847D;">
              <p style="margin: 0 0 6px 0;">
                Order Reference: <strong style="color: #22231F;">${escapeHtml(data.orderNumber)}</strong> &bull; Need help? Contact <a href="mailto:${escapeHtml(data.supportEmail)}" style="color: #22231F;">${escapeHtml(data.supportEmail)}</a>.
              </p>
              <p style="margin: 0;">
                This is a transactional email sent to deliver your digital purchase. You have not been added to any marketing list.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
