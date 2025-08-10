const { send, handleOptions, readJson } = require('./_shared');

// Use a global store to increase hit rate on warm instances (still not persistent)
const otpStore = global.__OTP_STORE__ || (global.__OTP_STORE__ = new Map());

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendSmsWithTencent(phone, otp) {
  const {
    TENCENT_SECRET_ID,
    TENCENT_SECRET_KEY,
    SMS_SDK_APP_ID,
    SMS_TEMPLATE_ID,
    SMS_SIGN_NAME,
    SMS_REGION
  } = process.env;

  if (!TENCENT_SECRET_ID || !TENCENT_SECRET_KEY || !SMS_SDK_APP_ID || !SMS_TEMPLATE_ID || !SMS_SIGN_NAME) {
    return { success: false, message: '短信服务未配置' };
  }

  try {
    const tencentcloud = require('tencentcloud-sdk-nodejs');
    const SmsClient = tencentcloud.sms.v20210111.Client;
    const client = new SmsClient({
      credential: { secretId: TENCENT_SECRET_ID, secretKey: TENCENT_SECRET_KEY },
      region: SMS_REGION || 'ap-guangzhou',
      profile: { httpProfile: { endpoint: 'sms.tencentcloudapi.com' } },
    });

    const params = {
      PhoneNumberSet: [`+86${phone}`],
      SmsSdkAppId: SMS_SDK_APP_ID,
      TemplateId: SMS_TEMPLATE_ID,
      SignName: SMS_SIGN_NAME,
      TemplateParamSet: [otp, '5'],
    };

    const result = await client.SendSms(params);
    if (result && result.SendStatusSet && result.SendStatusSet[0] && result.SendStatusSet[0].Code === 'Ok') {
      return { success: true };
    }
    return { success: false, message: '短信网关返回非成功状态' };
  } catch (error) {
    console.error('发送短信失败:', error);
    return { success: false, message: error.message };
  }
}

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { success: false, message: 'Method Not Allowed' });

  try {
    const { phone } = await readJson(req);
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return send(res, 400, { success: false, message: '请输入正确的手机号码' });
    }

    const key = `phone_${phone}`;
    const existing = otpStore.get(key);
    if (existing && Date.now() - existing.lastSent < 60 * 1000) {
      return send(res, 429, { success: false, message: '请稍后再试，验证码发送过于频繁' });
    }

    const otp = generateOTP();
    otpStore.set(key, { otp, expires: Date.now() + 5 * 60 * 1000, attempts: 0, lastSent: Date.now() });

    let smsResult = { success: false };
    // 通过环境变量开关启用真实短信发送
    if (process.env.ENABLE_SMS === '1' || process.env.TENCENT_SECRET_ID) {
      smsResult = await sendSmsWithTencent(phone, otp);
    }

    const includeOtp = process.env.ALLOW_OTP_IN_RESPONSE === '1';
    if (!smsResult.success) {
      // 未配置或发送失败时，回退到控制台日志，便于调试
      console.log(`[OTP] send to ${phone}: ${otp}`);
      return send(res, 200, { success: true, message: '验证码已发送（未配置短信网关时请查看后端日志）', ...(includeOtp ? { otp } : {}) });
    }

    return send(res, 200, { success: true, message: '验证码已发送', ...(includeOtp ? { otp } : {}) });
  } catch (e) {
    return send(res, 500, { success: false, message: '服务器错误', error: e.message });
  }
};
