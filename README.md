# 9-ELEVEN Private Digital Hub

A colorful, animated, password-gated media portal with:
- Visitor access code
- Separate Admin login
- Private image/video/audio/document/APK library
- Admin upload/delete
- Private Supabase Storage
- Temporary visitor access code with expiry
- Responsive mobile/desktop UI
- Animated particles, rain, glow and touch/cursor effects

## Architecture
Frontend: HTML/CSS/JavaScript
Backend: Supabase Auth + PostgreSQL + private Storage
Hosting: Vercel or any static host

> The included `config.js` is intentionally blank. You must add your own Supabase URL and anon/publishable key.

## 1) Create Supabase
1. Create a project at https://supabase.com/
2. Open Authentication -> Providers.
3. Enable Email provider.
4. Enable Anonymous Sign-Ins.
5. Open SQL Editor and run `supabase/schema.sql`.
6. Open Storage and confirm the `media` bucket exists. The SQL creates it as PRIVATE.
7. Create your admin account in Authentication -> Users -> Add user.
8. Copy that user's UUID.
9. In SQL Editor run:
   INSERT INTO public.profiles (id, role) VALUES ('YOUR-ADMIN-UUID', 'admin')
   ON CONFLICT (id) DO UPDATE SET role='admin';

## 2) Configure the website
Copy `config.example.js` to `config.js` and put:
- SUPABASE_URL = your project URL
- SUPABASE_ANON_KEY = your publishable/anon key

Do NOT put a `service_role` key in this website.

## 3) Run locally
You need a local web server because browser modules/CDN auth work better over HTTP.

Python:
  python -m http.server 5500

Then open:
  http://localhost:5500

## 4) First visitor password
After running the SQL, create a temporary visitor code from the Admin panel.
The default demo code is NOT hardcoded in the frontend.

Visitor codes can have:
- label
- expiry time
- active/inactive
- max uses

## 5) Deploy with GitHub + Vercel
A) Create a GitHub repository, e.g. `9-eleven-private-hub`.
B) Upload all project files.
C) IMPORTANT: upload `config.js` only if you are comfortable exposing the Supabase URL and anon/publishable key. Those two values are designed for frontend use when RLS is correctly configured.
D) Never upload passwords, service_role keys, private API keys, or `.env` secrets.
E) Import the GitHub repo into Vercel.
F) Deploy.
G) In Supabase Authentication URL settings, add your Vercel domain as an allowed Site URL/Redirect URL if needed.

## 6) Important security notes
- Supabase private buckets are used for media.
- RLS controls database and Storage access.
- Admin access is based on a Supabase Auth user whose `profiles.role` is `admin`.
- Visitor access is granted to an anonymous Supabase user after a valid temporary code.
- Signed URLs are short-lived for preview/download.
- No website can prevent a determined visitor from screen-recording or copying content after it is legitimately shown.
- For a public site with heavy traffic, add CAPTCHA/rate limiting and consider a server-side upload/signing layer.

## 7) What you can do from Admin
- Create temporary access codes
- Activate/deactivate codes
- Upload media
- Delete media
- See content count
- Sign out

## 8) Recommended next upgrades
- Cloudflare Turnstile CAPTCHA
- Download/view audit log
- Per-user accounts
- Folder/album system
- Search and filters
- File size limits
- Image/video transcoding
- Admin 2FA
