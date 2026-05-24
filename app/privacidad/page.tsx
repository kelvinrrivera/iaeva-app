import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidad | DomiCita',
  description: 'Política de privacidad de DomiCita — cómo recopilamos, usamos y protegemos tu información personal.',
};

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-primary text-white py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6 text-white/70 hover:text-white transition-colors text-sm">
            ← Volver al inicio
          </Link>
          <h1 className="text-3xl font-bold">Política de Privacidad</h1>
          <p className="text-white/60 mt-2 text-sm">Última actualización: 19 de mayo de 2026</p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="prose prose-slate max-w-none space-y-8">

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">1. Información General</h2>
            <p className="text-slate-600 leading-relaxed">
              <strong>Rivera Digital Media S.R.L.</strong> (en adelante &quot;la Empresa&quot;), con RNC 014-0016893-4, domiciliada en
              Santo Domingo, República Dominicana, es la entidad responsable del tratamiento de los datos personales
              recopilados a través de la plataforma <strong>DomiCita</strong> (en adelante &quot;la Plataforma&quot;).
            </p>
            <p className="text-slate-600 leading-relaxed">
              Correo electrónico de contacto: <a href="mailto:hola@domicita.com" className="text-accent hover:underline">hola@domicita.com</a><br />
              Teléfono: <a href="tel:+18298737273" className="text-accent hover:underline">829-873-7273</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">2. Datos que Recopilamos</h2>
            <p className="text-slate-600 leading-relaxed mb-3">Recopilamos los siguientes tipos de información:</p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li><strong>Datos de registro:</strong> nombre completo, correo electrónico, contraseña (encriptada), número de teléfono.</li>
              <li><strong>Datos del negocio:</strong> nombre del negocio, tipo (barbería, salón, etc.), dirección, horarios de operación, servicios ofrecidos y precios.</li>
              <li><strong>Datos de clientes finales:</strong> nombre, número de WhatsApp, historial de citas, preferencias de servicio.</li>
              <li><strong>Datos de uso:</strong> interacciones con la plataforma, páginas visitadas, funciones utilizadas.</li>
              <li><strong>Datos de pago:</strong> procesados directamente por Stripe, Inc. No almacenamos números de tarjeta de crédito.</li>
              <li><strong>Datos de comunicación:</strong> mensajes enviados y recibidos a través del chatbot de WhatsApp.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">3. Finalidad del Tratamiento</h2>
            <p className="text-slate-600 leading-relaxed mb-3">Utilizamos los datos recopilados para:</p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Proveer y mantener los servicios de la Plataforma (gestión de citas, recordatorios, chatbot).</li>
              <li>Enviar recordatorios automáticos de citas por WhatsApp.</li>
              <li>Procesar pagos de suscripciones y facturación.</li>
              <li>Mejorar la experiencia del usuario y las funcionalidades del producto.</li>
              <li>Enviar comunicaciones relacionadas con el servicio (cambios, actualizaciones, soporte).</li>
              <li>Cumplir con obligaciones legales y regulatorias aplicables en República Dominicana.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">4. Base Legal</h2>
            <p className="text-slate-600 leading-relaxed">
              El tratamiento de datos se fundamenta en: (a) el consentimiento del usuario al registrarse en la Plataforma;
              (b) la ejecución del contrato de servicio; (c) el cumplimiento de obligaciones legales; y (d) el interés
              legítimo de la Empresa para mejorar sus servicios. Lo anterior de conformidad con la Ley 172-13 sobre
              Protección de Datos Personales de la República Dominicana.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">5. Compartición de Datos con Proveedores</h2>
            <p className="text-slate-600 leading-relaxed mb-3">
              Para operar la Plataforma compartimos datos estrictamente necesarios con los siguientes proveedores de infraestructura:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li><strong>Supabase, Inc.:</strong> almacenamiento de base de datos y autenticación de usuarios (servidores en Estados Unidos).</li>
              <li><strong>Stripe, Inc.:</strong> procesamiento de pagos de suscripciones (servidores en Estados Unidos). Sujeto a su política de privacidad.</li>
              <li><strong>Meta Platforms, Inc.:</strong> envío y recepción de mensajes de WhatsApp Business a través de su API oficial.</li>
              <li><strong>Vercel, Inc.:</strong> hosting y entrega de la aplicación web (servidores en Estados Unidos).</li>
              <li><strong>Proveedores de inteligencia artificial:</strong> procesamiento de lenguaje natural para el asistente virtual del chatbot. El proveedor de IA puede cambiar con el tiempo; usamos servicios que cumplen con estándares profesionales de privacidad (no entrenamos sus modelos con tus datos).</li>
              <li><strong>Proveedores de transcripción de voz:</strong> conversión de mensajes de voz de WhatsApp a texto para que el chatbot pueda procesarlos.</li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-3">
              No vendemos, alquilamos ni compartimos datos personales con terceros para fines de marketing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">6. Integración con WhatsApp Business (Meta Platforms)</h2>
            <p className="text-slate-600 leading-relaxed mb-3">
              DomiCita es un Proveedor Tecnológico (Tech Provider) oficial de Meta Platforms para WhatsApp Business API.
              Cuando un negocio conecta su cuenta de WhatsApp Business a través de Embedded Signup, solicitamos los
              siguientes permisos de Meta:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li><strong><code>whatsapp_business_messaging</code>:</strong> recibir mensajes de clientes finales del negocio y enviar respuestas automáticas, plantillas aprobadas (recordatorios, confirmaciones) y mensajes de sesión generados por nuestro asistente virtual.</li>
              <li><strong><code>whatsapp_business_management</code>:</strong> crear, gestionar y enviar a aprobación las plantillas de mensaje del negocio; leer metadatos de su número (calificación de calidad, nombre visible); desconectar la integración cuando el dueño lo solicite.</li>
              <li><strong><code>business_management</code>:</strong> recibir el identificador del WABA y número de teléfono del negocio durante Embedded Signup. NO accedemos a ningún otro activo del Business Portfolio (catálogos, cuentas publicitarias, páginas).</li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-3">
              Únicamente actuamos en nombre de los negocios que explícitamente nos otorgan acceso a su cuenta de WhatsApp
              Business mediante el flujo oficial de Embedded Signup de Meta. No accedemos a cuentas de WhatsApp fuera
              de este consentimiento explícito.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">7. Transferencia Internacional de Datos</h2>
            <p className="text-slate-600 leading-relaxed">
              Algunos de nuestros proveedores de infraestructura operan servidores fuera de la República Dominicana
              (principalmente en Estados Unidos y la Unión Europea). Al utilizar la Plataforma, consientes esta
              transferencia internacional de datos. Todos nuestros proveedores cumplen con estándares internacionales
              de seguridad y privacidad (SOC 2, ISO 27001, GDPR cuando aplica). En cumplimiento del artículo 9 de la
              Ley 172-13 sobre Protección de Datos Personales de la República Dominicana, garantizamos un nivel
              adecuado de protección equivalente al exigido por la normativa dominicana.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">8. Seguridad de los Datos</h2>
            <p className="text-slate-600 leading-relaxed">
              Implementamos medidas de seguridad técnicas y organizativas para proteger los datos personales,
              incluyendo: cifrado en tránsito (HTTPS/TLS), cifrado de contraseñas (bcrypt), aislamiento multi-tenant
              por negocio, control de acceso basado en roles, y auditorías periódicas de seguridad. Sin embargo,
              ningún sistema es 100% seguro y no podemos garantizar la seguridad absoluta de los datos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">9. Retención de Datos</h2>
            <p className="text-slate-600 leading-relaxed">
              Conservamos los datos personales mientras la cuenta del usuario esté activa o según sea necesario
              para proporcionar los servicios. Al cancelar la cuenta, los datos se eliminarán dentro de los 30 días
              siguientes, excepto aquellos que debamos retener por obligaciones legales o fiscales.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">10. Eliminación de Datos a Solicitud (Meta / Facebook)</h2>
            <p className="text-slate-600 leading-relaxed">
              Si conectaste tu cuenta de WhatsApp Business mediante Facebook Login y deseas que eliminemos los datos
              asociados a tu cuenta de Facebook, Meta proporciona un mecanismo automático. Puedes solicitar la
              eliminación desde la configuración de tu cuenta de Facebook (Apps and Websites → DomiCita → Remove).
              Meta enviará una notificación a nuestro sistema y procesaremos la eliminación dentro de 30 días.
            </p>
            <p className="text-slate-600 leading-relaxed mt-2">
              Endpoint de eliminación de datos (uso técnico de Meta):
              {' '}
              <a href="/api/facebook/data-deletion" className="text-accent hover:underline font-mono text-sm">
                https://domicita.com/api/facebook/data-deletion
              </a>
            </p>
            <p className="text-slate-600 leading-relaxed mt-2">
              Adicionalmente, puedes escribirnos directamente a{' '}
              <a href="mailto:hola@domicita.com" className="text-accent hover:underline">hola@domicita.com</a>{' '}
              solicitando la eliminación de cualquier dato personal, y responderemos en un plazo máximo de 15 días hábiles.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">11. Derechos del Usuario</h2>
            <p className="text-slate-600 leading-relaxed mb-3">
              De acuerdo con la Ley 172-13, tienes derecho a:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li><strong>Acceso:</strong> solicitar una copia de tus datos personales.</li>
              <li><strong>Rectificación:</strong> corregir datos inexactos o incompletos.</li>
              <li><strong>Supresión:</strong> solicitar la eliminación de tus datos.</li>
              <li><strong>Oposición:</strong> oponerte al tratamiento de tus datos en ciertos casos.</li>
              <li><strong>Portabilidad:</strong> recibir tus datos en un formato estructurado.</li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-3">
              Para ejercer estos derechos, contacta a <a href="mailto:hola@domicita.com" className="text-accent hover:underline">hola@domicita.com</a>.
              Responderemos en un plazo máximo de 15 días hábiles.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">12. Menores de Edad</h2>
            <p className="text-slate-600 leading-relaxed">
              La Plataforma no está dirigida a menores de 18 años. No recopilamos intencionalmente datos de menores.
              Si descubrimos que hemos recopilado datos de un menor, los eliminaremos inmediatamente.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">13. Cambios a esta Política</h2>
            <p className="text-slate-600 leading-relaxed">
              Nos reservamos el derecho de modificar esta política en cualquier momento. Los cambios serán notificados
              por correo electrónico y/o mediante un aviso visible en la Plataforma. El uso continuado de la Plataforma
              después de la notificación constituye aceptación de los cambios.
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
