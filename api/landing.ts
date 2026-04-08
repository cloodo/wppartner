import type { VercelRequest, VercelResponse } from "@vercel/node";

function renderLandingPage(): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WPPartner - Dich Vu Thiet Ke Website Chuyen Nghiep</title>
  <meta name="description" content="WPPartner - Doi ngu chuyen gia thiet ke website WordPress, WooCommerce. Giai phap web toan dien cho doanh nghiep cua ban.">
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --bg-primary: #0a0a1a;
      --bg-card: #12122a;
      --bg-card-hover: #1a1a3e;
      --accent: #6c5ce7;
      --accent-light: #a29bfe;
      --accent-glow: rgba(108, 92, 231, 0.3);
      --text-primary: #f0f0f5;
      --text-secondary: #8888aa;
      --text-muted: #55556a;
      --border: #222244;
      --gradient-1: linear-gradient(135deg, #6c5ce7, #a29bfe);
      --gradient-2: linear-gradient(135deg, #00cec9, #6c5ce7);
    }

    html { scroll-behavior: smooth; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      overflow-x: hidden;
    }

    .container { max-width: 1100px; margin: 0 auto; padding: 0 1.5rem; }

    /* NAV */
    nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      background: rgba(10, 10, 26, 0.85);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border);
      padding: 1rem 0;
    }
    nav .container { display: flex; justify-content: space-between; align-items: center; }
    .logo { font-size: 1.4rem; font-weight: 800; letter-spacing: -0.5px; }
    .logo span { background: var(--gradient-1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .nav-links { display: flex; gap: 2rem; list-style: none; }
    .nav-links a { color: var(--text-secondary); text-decoration: none; font-size: 0.9rem; font-weight: 500; transition: color 0.3s; }
    .nav-links a:hover { color: var(--text-primary); }
    .nav-cta {
      background: var(--gradient-1); color: #fff; border: none; padding: 0.6rem 1.4rem;
      border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer;
      text-decoration: none; transition: transform 0.2s, box-shadow 0.2s;
    }
    .nav-cta:hover { transform: translateY(-1px); box-shadow: 0 4px 20px var(--accent-glow); }

    /* HERO */
    .hero {
      padding: 10rem 0 6rem;
      text-align: center;
      position: relative;
    }
    .hero::before {
      content: '';
      position: absolute; top: 0; left: 50%; transform: translateX(-50%);
      width: 600px; height: 600px;
      background: radial-gradient(circle, var(--accent-glow) 0%, transparent 70%);
      pointer-events: none;
    }
    .hero-badge {
      display: inline-block; background: var(--bg-card); border: 1px solid var(--border);
      padding: 0.4rem 1rem; border-radius: 50px; font-size: 0.8rem; color: var(--accent-light);
      margin-bottom: 1.5rem;
    }
    .hero h1 {
      font-size: clamp(2.5rem, 6vw, 4rem); font-weight: 800; line-height: 1.15;
      letter-spacing: -1px; margin-bottom: 1.2rem; position: relative;
    }
    .hero h1 .gradient { background: var(--gradient-1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .hero p { font-size: 1.15rem; color: var(--text-secondary); max-width: 600px; margin: 0 auto 2.5rem; }
    .hero-buttons { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
    .btn-primary {
      background: var(--gradient-1); color: #fff; border: none; padding: 0.9rem 2rem;
      border-radius: 10px; font-size: 1rem; font-weight: 600; cursor: pointer;
      text-decoration: none; transition: transform 0.2s, box-shadow 0.2s;
    }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 30px var(--accent-glow); }
    .btn-outline {
      background: transparent; color: var(--text-primary); border: 1px solid var(--border);
      padding: 0.9rem 2rem; border-radius: 10px; font-size: 1rem; font-weight: 500;
      cursor: pointer; text-decoration: none; transition: all 0.3s;
    }
    .btn-outline:hover { border-color: var(--accent); background: rgba(108, 92, 231, 0.1); }

    /* STATS */
    .stats {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem;
      padding: 3rem 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
      margin-bottom: 5rem;
    }
    .stat { text-align: center; }
    .stat .number { font-size: 2.2rem; font-weight: 800; background: var(--gradient-2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .stat .label { color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.3rem; }

    /* SECTIONS */
    section { padding: 5rem 0; }
    .section-header { text-align: center; margin-bottom: 3.5rem; }
    .section-header h2 { font-size: 2.2rem; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 0.8rem; }
    .section-header p { color: var(--text-secondary); font-size: 1rem; max-width: 550px; margin: 0 auto; }

    /* SERVICES */
    .services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; }
    .service-card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px;
      padding: 2rem; transition: all 0.3s;
    }
    .service-card:hover { background: var(--bg-card-hover); border-color: var(--accent); transform: translateY(-4px); box-shadow: 0 8px 30px rgba(0,0,0,0.3); }
    .service-icon { font-size: 2.2rem; margin-bottom: 1rem; display: block; }
    .service-card h3 { font-size: 1.15rem; font-weight: 700; margin-bottom: 0.6rem; }
    .service-card p { color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6; }

    /* PROCESS */
    .process-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.5rem; }
    .process-step {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px;
      padding: 2rem; position: relative; text-align: center;
    }
    .step-number {
      width: 48px; height: 48px; border-radius: 12px; background: var(--gradient-1);
      display: inline-flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 1.2rem; margin-bottom: 1rem;
    }
    .process-step h3 { font-size: 1.05rem; font-weight: 700; margin-bottom: 0.5rem; }
    .process-step p { color: var(--text-secondary); font-size: 0.85rem; }

    /* PRICING */
    .pricing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; }
    .pricing-card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px;
      padding: 2.5rem; position: relative; transition: all 0.3s;
    }
    .pricing-card.featured { border-color: var(--accent); box-shadow: 0 0 40px var(--accent-glow); }
    .pricing-card.featured::before {
      content: 'PHO BIEN'; position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
      background: var(--gradient-1); color: #fff; padding: 0.3rem 1rem; border-radius: 50px;
      font-size: 0.7rem; font-weight: 700; letter-spacing: 1px;
    }
    .pricing-card h3 { font-size: 1.1rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.8rem; }
    .price { font-size: 2.5rem; font-weight: 800; margin-bottom: 0.3rem; }
    .price span { font-size: 0.9rem; font-weight: 400; color: var(--text-secondary); }
    .price-desc { color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1.5rem; }
    .price-features { list-style: none; margin-bottom: 2rem; }
    .price-features li { padding: 0.5rem 0; font-size: 0.9rem; color: var(--text-secondary); display: flex; align-items: center; gap: 0.6rem; }
    .price-features li::before { content: '\\2713'; color: var(--accent-light); font-weight: bold; font-size: 0.85rem; }
    .pricing-card .btn-primary, .pricing-card .btn-outline { width: 100%; text-align: center; display: block; }

    /* TECH */
    .tech-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 1rem; }
    .tech-badge {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px;
      padding: 0.7rem 1.4rem; font-size: 0.9rem; font-weight: 500; color: var(--text-secondary);
      transition: all 0.3s;
    }
    .tech-badge:hover { border-color: var(--accent); color: var(--text-primary); }

    /* CTA */
    .cta-section {
      text-align: center; padding: 5rem 2rem;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px;
      margin: 3rem auto; position: relative; overflow: hidden;
    }
    .cta-section::before {
      content: ''; position: absolute; top: -50%; left: -50%;
      width: 200%; height: 200%;
      background: radial-gradient(circle at center, var(--accent-glow) 0%, transparent 50%);
      pointer-events: none;
    }
    .cta-section h2 { font-size: 2rem; font-weight: 800; margin-bottom: 0.8rem; position: relative; }
    .cta-section p { color: var(--text-secondary); margin-bottom: 2rem; position: relative; }
    .cta-section .btn-primary { position: relative; }
    .contact-info { display: flex; justify-content: center; gap: 2.5rem; margin-top: 2rem; flex-wrap: wrap; position: relative; }
    .contact-item { color: var(--text-secondary); font-size: 0.9rem; }
    .contact-item strong { color: var(--text-primary); }

    /* FOOTER */
    footer {
      text-align: center; padding: 2.5rem 0; margin-top: 3rem;
      border-top: 1px solid var(--border); color: var(--text-muted); font-size: 0.85rem;
    }

    /* RESPONSIVE */
    @media (max-width: 768px) {
      .nav-links { display: none; }
      .stats { grid-template-columns: repeat(2, 1fr); }
      .hero { padding: 8rem 0 4rem; }
      .hero h1 { font-size: 2.2rem; }
      section { padding: 3rem 0; }
      .contact-info { flex-direction: column; gap: 1rem; }
    }
    @media (max-width: 480px) {
      .stats { grid-template-columns: 1fr 1fr; gap: 1rem; }
      .stat .number { font-size: 1.8rem; }
      .hero-buttons { flex-direction: column; align-items: center; }
    }
  </style>
</head>
<body>

  <nav>
    <div class="container">
      <div class="logo">WP<span>Partner</span></div>
      <ul class="nav-links">
        <li><a href="#services">Dich vu</a></li>
        <li><a href="#process">Quy trinh</a></li>
        <li><a href="#pricing">Bang gia</a></li>
        <li><a href="#contact">Lien he</a></li>
      </ul>
      <a href="#contact" class="nav-cta">Bao gia ngay</a>
    </div>
  </nav>

  <section class="hero">
    <div class="container">
      <div class="hero-badge">Doi ngu chuyen gia WordPress & WooCommerce</div>
      <h1>
        Thiet ke Website<br>
        <span class="gradient">Chuyen nghiep & Hieu qua</span>
      </h1>
      <p>
        Chung toi giup doanh nghiep cua ban toa sang tren Internet voi website dep, nhanh,
        chuan SEO va toi uu chuyen doi.
      </p>
      <div class="hero-buttons">
        <a href="#contact" class="btn-primary">Bat dau du an</a>
        <a href="#services" class="btn-outline">Tim hieu them</a>
      </div>
    </div>
  </section>

  <div class="container">
    <div class="stats">
      <div class="stat"><div class="number">150+</div><div class="label">Du an hoan thanh</div></div>
      <div class="stat"><div class="number">98%</div><div class="label">Khach hang hai long</div></div>
      <div class="stat"><div class="number">5+</div><div class="label">Nam kinh nghiem</div></div>
      <div class="stat"><div class="number">24/7</div><div class="label">Ho tro ky thuat</div></div>
    </div>
  </div>

  <section id="services">
    <div class="container">
      <div class="section-header">
        <h2>Dich vu cua chung toi</h2>
        <p>Giai phap web toan dien tu thiet ke, phat trien den van hanh va toi uu</p>
      </div>
      <div class="services-grid">
        <div class="service-card">
          <span class="service-icon">&#x1f3a8;</span>
          <h3>Thiet ke Website</h3>
          <p>Thiet ke UI/UX hien dai, responsive tren moi thiet bi. Giao dien dep, chuyen nghiep va dung thuong hieu.</p>
        </div>
        <div class="service-card">
          <span class="service-icon">&#x1f6d2;</span>
          <h3>WooCommerce Store</h3>
          <p>Xay dung cua hang truc tuyen voi WooCommerce. Thanh toan, van chuyen, quan ly kho hang tu dong.</p>
        </div>
        <div class="service-card">
          <span class="service-icon">&#x26a1;</span>
          <h3>Toi uu hieu suat</h3>
          <p>Tang toc website, toi uu Core Web Vitals, cache thong minh. Website load duoi 2 giay.</p>
        </div>
        <div class="service-card">
          <span class="service-icon">&#x1f50d;</span>
          <h3>SEO & Marketing</h3>
          <p>Toi uu SEO on-page, Schema markup, Google Analytics. Tang thu hang va luong truy cap tu nhien.</p>
        </div>
        <div class="service-card">
          <span class="service-icon">&#x1f512;</span>
          <h3>Bao mat & Bao tri</h3>
          <p>SSL, firewall, backup tu dong, cap nhat bao mat. Bao ve website 24/7 khoi moi nguy co.</p>
        </div>
        <div class="service-card">
          <span class="service-icon">&#x1f4f1;</span>
          <h3>Ung dung Web</h3>
          <p>Phat trien ung dung web tuy chinh voi React, Next.js. API integration va he thong phuc tap.</p>
        </div>
      </div>
    </div>
  </section>

  <section id="process">
    <div class="container">
      <div class="section-header">
        <h2>Quy trinh lam viec</h2>
        <p>4 buoc don gian de co website trong mo cua ban</p>
      </div>
      <div class="process-grid">
        <div class="process-step">
          <div class="step-number">1</div>
          <h3>Tu van & Phan tich</h3>
          <p>Lan nghe yeu cau, phan tich nhu cau va de xuat giai phap phu hop nhat.</p>
        </div>
        <div class="process-step">
          <div class="step-number">2</div>
          <h3>Thiet ke & Duyet</h3>
          <p>Thiet ke mockup, trinh bay y tuong. Chinh sua cho den khi ban hai long 100%.</p>
        </div>
        <div class="process-step">
          <div class="step-number">3</div>
          <h3>Phat trien & Test</h3>
          <p>Code chuan, test ky luong tren moi thiet bi va trinh duyet.</p>
        </div>
        <div class="process-step">
          <div class="step-number">4</div>
          <h3>Go live & Ho tro</h3>
          <p>Trien khai len server, huong dan su dung va ho tro ky thuat lau dai.</p>
        </div>
      </div>
    </div>
  </section>

  <section>
    <div class="container">
      <div class="section-header">
        <h2>Cong nghe su dung</h2>
        <p>Luon cap nhat va su dung cong nghe hien dai nhat</p>
      </div>
      <div class="tech-grid">
        <div class="tech-badge">WordPress</div>
        <div class="tech-badge">WooCommerce</div>
        <div class="tech-badge">Elementor</div>
        <div class="tech-badge">React</div>
        <div class="tech-badge">Next.js</div>
        <div class="tech-badge">TypeScript</div>
        <div class="tech-badge">Tailwind CSS</div>
        <div class="tech-badge">Node.js</div>
        <div class="tech-badge">Cloudflare</div>
        <div class="tech-badge">Vercel</div>
        <div class="tech-badge">PostgreSQL</div>
        <div class="tech-badge">REST API</div>
      </div>
    </div>
  </section>

  <section id="pricing">
    <div class="container">
      <div class="section-header">
        <h2>Bang gia dich vu</h2>
        <p>Goi dich vu linh hoat, phu hop moi quy mo doanh nghiep</p>
      </div>
      <div class="pricing-grid">
        <div class="pricing-card">
          <h3>STARTER</h3>
          <div class="price">5M <span>VND</span></div>
          <div class="price-desc">Website gioi thieu co ban</div>
          <ul class="price-features">
            <li>Thiet ke 5 trang</li>
            <li>Responsive mobile</li>
            <li>Chuan SEO co ban</li>
            <li>Form lien he</li>
            <li>Ho tro 3 thang</li>
          </ul>
          <a href="#contact" class="btn-outline">Chon goi nay</a>
        </div>
        <div class="pricing-card featured">
          <h3>BUSINESS</h3>
          <div class="price">12M <span>VND</span></div>
          <div class="price-desc">Website doanh nghiep chuyen nghiep</div>
          <ul class="price-features">
            <li>Thiet ke 15 trang</li>
            <li>WooCommerce Store</li>
            <li>SEO nang cao</li>
            <li>Toi uu toc do</li>
            <li>Blog & Tin tuc</li>
            <li>Ho tro 6 thang</li>
          </ul>
          <a href="#contact" class="btn-primary">Chon goi nay</a>
        </div>
        <div class="pricing-card">
          <h3>ENTERPRISE</h3>
          <div class="price">Lien he</div>
          <div class="price-desc">Giai phap tuy chinh toan dien</div>
          <ul class="price-features">
            <li>Khong gioi han trang</li>
            <li>Ung dung web tuy chinh</li>
            <li>API Integration</li>
            <li>Da ngon ngu</li>
            <li>Training & Docs</li>
            <li>Ho tro 12 thang</li>
          </ul>
          <a href="#contact" class="btn-outline">Lien he</a>
        </div>
      </div>
    </div>
  </section>

  <section id="contact">
    <div class="container">
      <div class="cta-section">
        <h2>San sang bat dau du an?</h2>
        <p>Lien he ngay de duoc tu van mien phi va nhan bao gia chi tiet.</p>
        <a href="mailto:hello@wppartner.dev" class="btn-primary">Gui yeu cau bao gia</a>
        <div class="contact-info">
          <div class="contact-item"><strong>Email:</strong> hello@wppartner.dev</div>
          <div class="contact-item"><strong>Zalo:</strong> 0123 456 789</div>
          <div class="contact-item"><strong>Dia chi:</strong> TP. Ho Chi Minh, Viet Nam</div>
        </div>
      </div>
    </div>
  </section>

  <footer>
    <div class="container">
      <p>&copy; 2024 WPPartner. All rights reserved.</p>
    </div>
  </footer>

</body>
</html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "text/html;charset=UTF-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.status(200).send(renderLandingPage());
}
