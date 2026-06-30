import QRCode from 'qrcode';

export const qrUtils = {
  // Generate QR Code as a Data URL (base64 PNG)
  async generateQrCode(text: string, colorDark = '#000000', colorLight = '#ffffff'): Promise<string> {
    try {
      return await QRCode.toDataURL(text, {
        width: 400,
        margin: 2,
        color: {
          dark: colorDark,
          light: colorLight,
        },
      });
    } catch (err) {
      console.error('Failed to generate QR Code:', err);
      throw err;
    }
  }
};
