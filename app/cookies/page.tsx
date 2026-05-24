import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Cookies | DomiCita',
  description: 'Información sobre las cookies que utiliza la plataforma DomiCita.',
};

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-primary text-white py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6 text-white/70 hover:text-white transition-colors text-sm">
            ← Volver al inicio
          </Link>
          <h1 className="text-3xl font-bold">Política de Cookies</h1>
          <p className="text-white/60 mt-2 text-sm">Última actualización: 19 de mayo de 2026</p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="prose prose-slate max-w-none space-y-8">

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">1. ¿Qué son las Cookies?</h2>
            <p className="text-slate-600 leading-relaxed">
              Las cookies son pequeños archivos de texto que se almacenan en tu dispositivo (computadora, teléfono móvil
              o tablet) cuando visitas un sitio web. Las cookies permiten que la Plataforma te reconozca, recuerde tus
              preferencias y mejore tu experiencia de navegación.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">2. Cookies que Utilizamos</h2>

            <div className="overflow-x-auto mt-4">
              <table className="min-w-full border border-slate-200 rounded-lg overflow-hidden text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 border-b">Cookie</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 border-b">Tipo</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 border-b">Propósito</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 border-b">Duración</th>
                  </tr>
                </thead>
                <tbody className="text-slate-600">
                  <tr className="border-b border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs">sb-*-auth-token</td>
                    <td className="px-4 py-3">Esencial</td>
                    <td className="px-4 py-3">Autenticación de sesión (Supabase Auth)</td>
                    <td className="px-4 py-3">Sesión</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs">sb-*-auth-token-code-verifier</td>
                    <td className="px-4 py-3">Esencial</td>
                    <td className="px-4 py-3">Verificación de código PKCE para autenticación segura</td>
                    <td className="px-4 py-3">Sesión</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs">__stripe_mid</td>
                    <td className="px-4 py-3">Funcional</td>
                    <td className="px-4 py-3">Detección de fraude en pagos (Stripe)</td>
                    <td className="px-4 py-3">1 año</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs">__stripe_sid</td>
                    <td className="px-4 py-3">Funcional</td>
                    <td className="px-4 py-3">Sesión de pago (Stripe)</td>
                    <td className="px-4 py-3">30 min</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs">next-locale</td>
                    <td className="px-4 py-3">Funcional</td>
                    <td className="px-4 py-3">Preferencia de idioma</td>
                    <td className="px-4 py-3">1 año</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">3. Tipos de Cookies</h2>
            <ul className="list-disc pl-6 text-slate-600 space-y-3">
              <li>
                <strong>Cookies esenciales:</strong> Necesarias para el funcionamiento básico de la Plataforma.
                Sin ellas, no puedes iniciar sesión ni utilizar las funciones principales. No requieren tu consentimiento.
              </li>
              <li>
                <strong>Cookies funcionales:</strong> Permiten recordar tus preferencias y mejorar la funcionalidad.
                Incluyen las cookies de procesamiento de pagos (Stripe).
              </li>
              <li>
                <strong>Cookies de terceros:</strong> Establecidas por servicios externos que utilizamos
                (Supabase para autenticación, Stripe para pagos, Meta para la integración de WhatsApp).
                Estas cookies se rigen por las políticas de privacidad de sus respectivos proveedores.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">4. Cookies que NO Utilizamos</h2>
            <p className="text-slate-600 leading-relaxed">
              DomiCita <strong>no utiliza</strong> cookies de publicidad, cookies de tracking de terceros para marketing,
              ni cookies de redes sociales para rastreo. No compartimos información de cookies con redes publicitarias.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">5. Almacenamiento Local (Local Storage)</h2>
            <p className="text-slate-600 leading-relaxed">
              Además de cookies, la Plataforma utiliza el almacenamiento local del navegador (localStorage) para:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mt-3">
              <li>Almacenar tokens de sesión de forma segura.</li>
              <li>Guardar preferencias de interfaz (tema, sidebar colapsado, etc.).</li>
              <li>Cachear datos temporales para mejorar el rendimiento.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">6. Cómo Gestionar las Cookies</h2>
            <p className="text-slate-600 leading-relaxed mb-3">
              Puedes configurar tu navegador para rechazar o eliminar cookies. Ten en cuenta que si desactivas las
              cookies esenciales, la Plataforma no funcionará correctamente. Aquí te indicamos cómo gestionar cookies
              en los navegadores más comunes:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li><strong>Chrome:</strong> Configuración → Privacidad y seguridad → Cookies y otros datos de sitios</li>
              <li><strong>Firefox:</strong> Opciones → Privacidad y seguridad → Cookies y datos del sitio</li>
              <li><strong>Safari:</strong> Preferencias → Privacidad → Gestionar datos del sitio web</li>
              <li><strong>Edge:</strong> Configuración → Cookies y permisos del sitio</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">7. Cambios a esta Política</h2>
            <p className="text-slate-600 leading-relaxed">
              Podemos actualizar esta Política de Cookies periódicamente. Los cambios se publicarán en esta página
              con la fecha de última actualización. Te recomendamos revisar esta página ocasionalmente.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">8. Contacto</h2>
            <p className="text-slate-600 leading-relaxed">
              Si tienes preguntas sobre nuestra Política de Cookies, contacta a:
            </p>
          </section>

          <section className="bg-slate-50 rounded-xl p-6 mt-8">
            <p className="text-slate-500 text-sm">
              <strong>Rivera Digital Media S.R.L.</strong><br />
              RNC: 014-0016893-4<br />
              Santo Domingo, República Dominicana<br />
              <a href="mailto:hola@domicita.com" className="text-accent hover:underline">hola@domicita.com</a> · 829-873-7273
            </p>
          </section>

        </div>
      </main>
    </div>
  );
}
