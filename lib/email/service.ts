// Using Resend as example (npm install resend)
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export const emailTemplates = {
  welcomeEmail: (company: any, accessToken: string) => ({
    subject: 'Bienvenue sur RH Quantum - Vos accès',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .header { background: linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%); padding: 40px; border-radius: 16px 16px 0 0; text-align: center; }
            .content { background: #f9fafb; padding: 40px; border-radius: 0 0 16px 16px; }
            .token-box { background: #1f2937; color: #10b981; padding: 20px; border-radius: 8px; font-family: monospace; word-break: break-all; margin: 20px 0; }
            .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
            .steps { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .step { display: flex; align-items: start; margin-bottom: 16px; }
            .step-number { background: #8b5cf6; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="color: white; margin: 0;">Bienvenue sur RH Quantum!</h1>
              <p style="color: rgba(255,255,255,0.9); margin-top: 8px;">Votre plateforme d'analytics RH est prête</p>
            </div>
            
            <div class="content">
              <h2>Bonjour ${company.contact_name || 'là'},</h2>
              <p>Votre compte <strong>${company.nom}</strong> a été créé avec succès. Vous pouvez maintenant accéder à votre tableau de bord RH Quantum.</p>
              
              <h3>🔐 Votre code d'accès sécurisé:</h3>
              <div class="token-box">${accessToken}</div>
              <p style="color: #6b7280; font-size: 14px;">⚠️ Conservez ce code en lieu sûr. Il est unique et confidentiel.</p>
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="https://app.rhquantum.com/login" class="button">Accéder à mon dashboard →</a>
              </div>
              
              <div class="steps">
                <h3>🚀 Démarrage rapide:</h3>
                <div class="step">
                  <div class="step-number">1</div>
                  <div>
                    <strong>Connectez-vous</strong><br>
                    Utilisez votre code d'accès sur la page de connexion
                  </div>
                </div>
                <div class="step">
                  <div class="step-number">2</div>
                  <div>
                    <strong>Importez vos données</strong><br>
                    Téléchargez le template Excel et importez vos données RH
                  </div>
                </div>
                <div class="step">
                  <div class="step-number">3</div>
                  <div>
                    <strong>Explorez vos analytics</strong><br>
                    Découvrez vos KPIs en temps réel et les insights IA
                  </div>
                </div>
              </div>
              
              <h3>📅 Votre période d'essai:</h3>
              <p>Vous bénéficiez de <strong>30 jours d'essai gratuit</strong> avec accès complet à toutes les fonctionnalités.</p>
              <p>Date d'expiration: <strong>${new Date(company.trial_ends_at).toLocaleDateString('fr-FR')}</strong></p>
              
              <h3>💬 Besoin d'aide?</h3>
              <p>Notre équipe est là pour vous accompagner:</p>
              <ul>
                <li>Support prioritaire: support@rhquantum.com</li>
                <li>Documentation: docs.rhquantum.com</li>
                <li>Hotline: +33 1 23 45 67 89</li>
              </ul>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
              
              <p style="color: #6b7280; font-size: 14px; text-align: center;">
                Cet email contient des informations confidentielles. Si vous n'êtes pas le destinataire, merci de supprimer ce message.
              </p>
            </div>
          </div>
        </body>
      </html>
    `
  }),

  demoConfirmation: (demo: any) => ({
    subject: 'RH Quantum - Confirmation de votre demande de démo',
    html: `
      <h2>Merci pour votre intérêt!</h2>
      <p>Nous avons bien reçu votre demande de démonstration pour ${demo.company_name}.</p>
      <p>Notre équipe commerciale vous contactera dans les 24h pour planifier votre démo personnalisée.</p>
    `
  })
}

export async function sendEmail(to: string, template: keyof typeof emailTemplates, data: any) {
  try {
    const emailContent = emailTemplates[template](data, data.accessToken);
    
    const response = await resend.emails.send({
      from: 'RH Quantum <noreply@rhquantum.com>',
      to: to,
      subject: emailContent.subject,
      html: emailContent.html
    });
    
    // Check for a successful response and access the data
    if (response.data) {
      return { success: true, id: response.data.id };
    } else {
      console.error('Email send error:', response.error);
      return { success: false, error: response.error };
    }
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error };
  }
}