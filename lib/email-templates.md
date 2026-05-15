# Supabase Email Templates

These templates live in the Supabase dashboard, **not** in code.

Set them at: **Supabase Dashboard → Authentication → Email Templates**

---

## Password Reset

**Subject:**
```
Reset your Nexyru password
```

**Body (HTML):**
```html
<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;background:#080808;color:#fff;">
  <div style="font-size:22px;font-weight:800;color:#fff;margin-bottom:8px;">Nexyru</div>
  <div style="font-size:13px;color:#6b7280;margin-bottom:32px;">The trading journal for funded traders</div>
  <div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:12px;">Reset your password</div>
  <div style="font-size:14px;color:#9ca3af;margin-bottom:24px;line-height:1.6;">We received a request to reset the password for your Nexyru account. Click the button below to choose a new password.</div>
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;margin-bottom:24px;">Reset Password</a>
  <div style="font-size:12px;color:#4b5563;margin-top:24px;line-height:1.6;">If you didn't request a password reset, you can safely ignore this email. This link expires in 24 hours.</div>
  <div style="font-size:12px;color:#4b5563;margin-top:8px;">— The Nexyru Team</div>
</div>
```

---

## Confirm Signup

**Subject:**
```
Confirm your Nexyru account
```

**Body (HTML):**
```html
<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;background:#080808;color:#fff;">
  <div style="font-size:22px;font-weight:800;color:#fff;margin-bottom:8px;">Nexyru</div>
  <div style="font-size:13px;color:#6b7280;margin-bottom:32px;">The trading journal for funded traders</div>
  <div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:12px;">Confirm your email</div>
  <div style="font-size:14px;color:#9ca3af;margin-bottom:24px;line-height:1.6;">Thanks for signing up for Nexyru. Click below to confirm your email address and start tracking your trades.</div>
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;margin-bottom:24px;">Confirm Email</a>
  <div style="font-size:12px;color:#4b5563;margin-top:24px;">If you didn't create a Nexyru account, you can safely ignore this email.</div>
  <div style="font-size:12px;color:#4b5563;margin-top:8px;">— The Nexyru Team</div>
</div>
```

---

## Notes

- `{{ .ConfirmationURL }}` is a Supabase template variable — leave as-is, Supabase fills it in.
- The Change Email flow (initiated from `/settings`) also sends a confirmation email to the new address. Supabase uses the **Confirm Email Change** template — consider adding a matching dark-themed template there as well.
- Email styling uses inline styles only — many email clients strip `<style>` blocks.
