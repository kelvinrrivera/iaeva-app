import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Términos y Condiciones | DomiCita',
  description: 'Términos y condiciones de uso de la plataforma DomiCita.',
};

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-primary text-white py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6 text-white/70 hover:text-white transition-colors text-sm">
            ← Volver al inicio
          </Link>
          <h1 className="text-3xl font-bold">Términos y Condiciones</h1>
          <p className="text-white/60 mt-2 text-sm">Última actualización: 19 de mayo de 2026</p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="prose prose-slate max-w-none space-y-8">

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">1. Aceptación de los Términos</h2>
            <p className="text-slate-600 leading-relaxed">
              Al acceder y utilizar la plataforma <strong>DomiCita</strong> (en adelante &quot;la Plataforma&quot;), operada por
              <strong> Rivera Digital Media S.R.L.</strong> (RNC: 014-0016893-4), con domicilio en Santo Domingo, República Dominicana, aceptas estos Términos y Condiciones en su totalidad. Si no estás de acuerdo,
              no utilices la Plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">2. Descripción del Servicio</h2>
            <p className="text-slate-600 leading-relaxed">
              DomiCita es una plataforma SaaS (Software como Servicio) diseñada para la gestión de citas y comunicación
              con clientes a través de WhatsApp, dirigida a barberías, salones de belleza y negocios similares en
              República Dominicana. La Plataforma ofrece:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mt-3">
              <li>Gestión de citas y calendario</li>
              <li>Chatbot inteligente de WhatsApp para reservas automáticas</li>
              <li>Recordatorios automáticos de citas por WhatsApp</li>
              <li>Gestión de clientes y servicios</li>
              <li>Analíticas y reportes del negocio</li>
              <li>Cola de walk-ins (clientes sin cita)</li>
              <li>Gestión de equipo y roles</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">3. Registro y Cuenta</h2>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Debes tener al menos 18 años para crear una cuenta.</li>
              <li>La información proporcionada debe ser veraz, completa y actualizada.</li>
              <li>Eres responsable de mantener la confidencialidad de tus credenciales de acceso.</li>
              <li>Cada cuenta está asociada a un negocio. No se permite compartir cuentas entre negocios diferentes.</li>
              <li>Nos reservamos el derecho de suspender o cancelar cuentas que violen estos términos.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">4. Planes y Pagos</h2>
            <p className="text-slate-600 leading-relaxed mb-3">La Plataforma ofrece los siguientes planes:</p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li><strong>FREE ($0/mes):</strong> 1 profesional, funciones básicas, hasta 1,000 mensajes WhatsApp/mes.</li>
              <li><strong>SOLO ($19/mes):</strong> 1 profesional, hasta 1,000 mensajes WhatsApp/mes, recordatorios automáticos, analíticas.</li>
              <li><strong>TEAM ($39/mes):</strong> Hasta 5 profesionales, gestión de equipo, multi-servicio por cita, hasta 1,000 mensajes WhatsApp/mes.</li>
              <li><strong>BUSINESS ($79/mes):</strong> Profesionales ilimitados, multi-sucursal, API access, hasta 1,000 mensajes WhatsApp/mes, soporte prioritario.</li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-2 text-sm">
              <strong>Nota sobre mensajes WhatsApp:</strong> el límite de 1,000 mensajes/mes aplica a mensajes salientes
              originados por el chatbot o recordatorios automáticos. Si tu negocio supera regularmente este límite,
              contáctanos para discutir un plan personalizado.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              Todos los precios están en dólares estadounidenses (USD). Los pagos se procesan de forma segura a través
              de <strong>Stripe, Inc.</strong> La suscripción se renueva automáticamente cada mes. Puedes cancelar
              en cualquier momento desde tu panel de administración; el acceso continuará hasta el final del período pagado.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">5. Política de Reembolso</h2>
            <p className="text-slate-600 leading-relaxed">
              Ofrecemos un reembolso completo durante los primeros 7 días después de la primera suscripción a un plan
              de pago, siempre que no se hayan utilizado más de 50 mensajes de WhatsApp. Después de este período, no se
              realizarán reembolsos por el período restante de la suscripción. Para solicitar un reembolso, contacta a
              <a href="mailto:hola@domicita.com" className="text-accent hover:underline"> hola@domicita.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">6. Uso Aceptable</h2>
            <p className="text-slate-600 leading-relaxed mb-3">Al utilizar la Plataforma, te comprometes a:</p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Utilizar la Plataforma únicamente para fines legítimos relacionados con tu negocio.</li>
              <li>No enviar mensajes de spam, contenido ofensivo o no solicitado a través del chatbot de WhatsApp.</li>
              <li>No intentar acceder a datos de otros negocios o usuarios.</li>
              <li>No realizar ingeniería inversa, descompilar o intentar extraer el código fuente.</li>
              <li>No utilizar la Plataforma para actividades ilegales o fraudulentas.</li>
              <li>Cumplir con las políticas de uso de WhatsApp Business API y Meta Platforms.</li>
              <li>Obtener el consentimiento de tus clientes antes de enviarles mensajes por WhatsApp.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">7. Propiedad Intelectual</h2>
            <p className="text-slate-600 leading-relaxed">
              La Plataforma, incluyendo su código, diseño, logotipos, textos y demás contenido, es propiedad exclusiva
              de Rivera Digital Media S.R.L. o sus licenciantes. Se otorga al usuario una licencia limitada, no exclusiva,
              no transferible y revocable para utilizar la Plataforma conforme a estos términos. Los datos ingresados por
              el usuario siguen siendo propiedad del usuario.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">8. Disponibilidad del Servicio</h2>
            <p className="text-slate-600 leading-relaxed">
              Nos esforzamos por mantener la Plataforma disponible las 24 horas, los 7 días de la semana. Sin embargo,
              no garantizamos un tiempo de actividad del 100%. Podremos realizar mantenimientos programados, los cuales
              serán notificados con antelación cuando sea posible. No seremos responsables por interrupciones causadas
              por terceros (proveedores de hosting, API de WhatsApp, pasarelas de pago, etc.).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">9. Limitación de Responsabilidad</h2>
            <p className="text-slate-600 leading-relaxed">
              En la máxima medida permitida por la legislación dominicana, Rivera Digital Media S.R.L. no será responsable
              por: (a) daños indirectos, incidentales o consecuentes derivados del uso de la Plataforma; (b) pérdida de
              ingresos o clientes debido a fallos técnicos; (c) acciones de terceros que afecten el servicio; (d) pérdida
              de datos por causas fuera de nuestro control. La responsabilidad total de la Empresa se limita al monto
              pagado por el usuario en los últimos 3 meses.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">10. Protección de Datos</h2>
            <p className="text-slate-600 leading-relaxed">
              El tratamiento de datos personales se rige por nuestra{' '}
              <Link href="/privacidad" className="text-accent hover:underline">Política de Privacidad</Link>{' '}
              y la Ley 172-13 sobre Protección de Datos Personales de la República Dominicana.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">11. Terminación</h2>
            <p className="text-slate-600 leading-relaxed">
              Puedes cancelar tu cuenta en cualquier momento. Nos reservamos el derecho de suspender o terminar
              cuentas que violen estos términos, sin previo aviso. Al terminar la cuenta: (a) se cancelará la
              suscripción activa; (b) los datos se eliminarán dentro de 30 días; (c) no habrá reembolso por el
              período restante (salvo lo dispuesto en la sección 5).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">12. Legislación Aplicable y Jurisdicción</h2>
            <p className="text-slate-600 leading-relaxed">
              Estos Términos se rigen por las leyes de la República Dominicana. Cualquier disputa será sometida a la
              jurisdicción de los tribunales competentes de Santo Domingo, República Dominicana. Las partes acuerdan
              intentar resolver cualquier controversia de manera amistosa antes de acudir a los tribunales.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">13. Modificaciones</h2>
            <p className="text-slate-600 leading-relaxed">
              Nos reservamos el derecho de modificar estos Términos en cualquier momento. Los cambios serán publicados
              en esta página y notificados por correo electrónico con al menos 15 días de antelación. El uso continuado
              de la Plataforma constituye aceptación de los términos modificados.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">14. Contacto</h2>
            <p className="text-slate-600 leading-relaxed">
              Para cualquier consulta relacionada con estos Términos, contacta a:
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
